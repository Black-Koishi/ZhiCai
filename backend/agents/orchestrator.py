"""
Orchestrator: Analyzes input to decide routing and UI actions.
"""
import json

from langchain_core.messages import HumanMessage, SystemMessage

from backend.agents.config import get_router_llm
from backend.agents.models import OrchestrationResponse


def orchestrator_router(input_str: str) -> OrchestrationResponse:
    """
    协调器：对用户输入信息进行分析，以决定路由方式和界面操作。
    通过使用原生 JSON Scheam 简化了对 结构化输出 的可靠性保障。
    """
    prompt = f"""你是一个 AI 编排器。
    只输出符合以下 schema 的有效 JSON：
    {{
      "decision": "email" | "compliance" | "pdf" | "supplier" | "forecast" | "unknown",
      "reasoning": "<简短字符串>",
      "ui_actions": [
        {{ "action_type": "redirect" | "set_filter" | "popup" | "trigger_api" | "open_inline_procurement" | "params": {{ "view": "...", "search": "...", "status": "unanalyzed"|"high"|"medium"|"low"|"failed"|"processed"|"failed_compliance"|"ignored"|"pending_review", "sort": "newest"|"oldest", "endpoint": "...", "method": "POST", "label": "...", "item_name": "...", "quantity": 数字, "mode": "manual" }} }}
      ],
      "chat_response": "字符串或 null"
    }}

    基本规则：
    - 如果用户想分析邮件，decision 用 'email'。
    - 如果用户想运行合规检查、审查政策或批量审核，decision 用 'compliance'。
    - 如果用户想生成、下载或创建采购订单或 PDF 文档，decision 用 'pdf'。
    - 如果用户想新增、录入、入驻或添加供应商，decision 用 'supplier'。
    - 如果用户想生成需求预测、预测报告或趋势分析，decision 用 'forecast'。
    - 如果无法明确归入以上，decision 用 'unknown'。

    详细规则：
    - 'decision'：仅当用户明确要“分析全部/处理/扫描邮件数据”时才设为 'email'。关键词：分析、处理、扫描收件箱。
    - 'decision'：重要 —— 当设为 'email' 时，ui_actions 设为 []（后台流水线，无导航）。
    - 'decision'：对于泛指"运行合规检查/审查全部邮件"（没有具体 ID 或物品名），直接设为 'compliance' 且 ui_actions 设为 []。
    - 'decision'：对于按数字 ID 的合规或订单请求，设为 'unknown' + trigger_api：
        - 按邮件 ID 合规的端点："/procurement/<id>/compliance"
        - 按订单 ID 生成 PDF 的端点："/orders/<id>/generate-pdf"
        - 如果缺少 ID，通过 chat_response 向用户询问。
    - 'decision'：对于按物品名称的订单或合规请求（如“订购挡泥板”、“锂电池合规检查”）或手动订单：
        - 设为 'unknown'。
        - ui_actions 设为：[{{ "action_type": "open_inline_procurement", "params": {{ "item_name": "<提取的物品名称>", "quantity": <提取的数量，未提及则默认 1>, "mode": "manual" }} }}]
        - 'chat_response' 应为：“我可以帮你处理这个订单，请查看下方详情。”
    - 'decision'：对于导航/查看（显示、列出、打开、前往收件箱、展示），用 'unknown' + ui_actions redirect。
    - 'decision'：对于打开/前往设置、配置页面，用 'unknown' + redirect 到 settings（view = "settings"）。
    - 'decision'：对于下单/新建订单/手动下单（没有具体物品名），用 'unknown' + redirect 到 new_order（view = "new_order"）。
    - 'decision'：对于按状态筛选邮件（如“显示高优先级邮件”“展示未分析邮件”“只看待审核的”），用 'unknown' + redirect 到 emails + set_filter 设置 status：
        - 高 / 高优先级 → "high"，中 / 中优先级 → "medium"，低 / 低优先级 → "low"
        - 未分析 → "unanalyzed"，分析失败 → "failed"，待审核 → "pending_review"
        - 已处理 → "processed"，未通过 → "failed_compliance"，已忽略 → "ignored"
    - 'decision'：对于"新增/录入/入驻供应商"（提供供应商名称、邮箱、电话、主营品类等），直接设为 'supplier' 且 ui_actions 设为 []。
    - 'decision'：对于问候/闲聊/能力询问，用 'unknown' + chat_response。

    示例：
    - 用户："分析邮件"：{{"decision": "email", "reasoning": "用户想分析邮件", "chat_response": "正在启动提取流水线...", "ui_actions": []}}
    - 用户："检查 14 的合规"：{{"decision": "unknown", "reasoning": "按 ID 合规检查", "chat_response": "正在为邮件 14 触发合规检查。", "ui_actions": [{{"action_type": "trigger_api", "params": {{"endpoint": "/procurement/14/compliance", "method": "POST", "label": "运行合规检查（14）"}}}}]}}
    - 用户："为订单 14 生成 pdf"：{{"decision": "unknown", "reasoning": "按订单 ID 生成 PDF", "chat_response": "点击下方为订单 14 生成 PDF。", "ui_actions": [{{"action_type": "trigger_api", "params": {{"endpoint": "/orders/14/generate-pdf", "method": "POST", "label": "生成 PDF（订单 14）"}}}}]}}
    - 用户："订购挡泥板"：{{"decision": "unknown", "reasoning": "按物品名称手动下单", "chat_response": "我可以帮你处理这个订单，请查看下方详情。", "ui_actions": [{{"action_type": "open_inline_procurement", "params": {{"item_name": "挡泥板", "quantity": 1, "mode": "manual"}}}}]}}
    - 用户："订购 10 个锂电池"：{{"decision": "unknown", "reasoning": "按物品名称手动下单", "chat_response": "我可以帮你处理这个订单，请查看下方详情。", "ui_actions": [{{"action_type": "open_inline_procurement", "params": {{"item_name": "锂电池", "quantity": 10, "mode": "manual"}}}}]}}
    - 用户："显示高优先级邮件"：{{"decision": "unknown", "reasoning": "导航/筛选请求", "chat_response": null, "ui_actions": [{{"action_type": "redirect", "params": {{"view": "emails"}}}}, {{"action_type": "set_filter", "params": {{"status": "high"}}}}]}}
    - 用户："展示未分析邮件"：{{"decision": "unknown", "reasoning": "导航/筛选请求", "chat_response": null, "ui_actions": [{{"action_type": "redirect", "params": {{"view": "emails"}}}}, {{"action_type": "set_filter", "params": {{"status": "unanalyzed"}}}}]}}
    - 用户："生成预测报告"：{{"decision": "forecast", "reasoning": "用户想生成需求预测", "chat_response": "正在后台生成预测报告...", "ui_actions": []}}
    - 用户："打开设置"：{{"decision": "unknown", "reasoning": "导航到设置", "chat_response": null, "ui_actions": [{{"action_type": "redirect", "params": {{"view": "settings"}}}}]}}
    - 用户："下单"：{{"decision": "unknown", "reasoning": "新建订单", "chat_response": null, "ui_actions": [{{"action_type": "redirect", "params": {{"view": "new_order"}}}}]}}
    - 用户："新增供应商：顶点工业供应，主营金属材料，邮箱 sales@vertex.com，有 ISO 认证"：{{"decision": "supplier", "reasoning": "供应商入驻", "chat_response": null, "ui_actions": []}}

    用户输入："{input_str}"
    """

    messages = [
        SystemMessage(content="你是一个只输出 JSON 的编排器。只输出符合所请求 schema 的有效 JSON，JSON 键名保持英文，所有面向用户的文本值使用简体中文。"),
        HumanMessage(content=prompt)
    ]

    try:
        response = get_router_llm().invoke(messages)
        data = json.loads(response.content)

        # 如果 LLM 生成了错误但意思相近的键, 则映射回schema
        if "decision" not in data:
            if "action" in data: data["decision"] = data["action"]
            elif "intent" in data: data["decision"] = data["intent"]
            else: data["decision"] = "unknown"

        # 如果 LLM 生成了错误但意思相近的键, 则映射回ui_actions
        if "ui_actions" not in data:
            data["ui_actions"] = []
            for key in ["actions", "ui_hints", "hints"]:
                if key in data and isinstance(data[key], list):
                    data["ui_actions"] = data[key]
                    break

        valid_decisions = ["email", "compliance", "pdf", "supplier", "forecast", "unknown"]
        if data.get("decision") not in valid_decisions:
            # 简单的关键词检测兜底
            if "forecast" in str(data.get("decision", "")).lower() or "预测" in str(data.get("decision", "")):
                data["decision"] = "forecast"
            elif "pdf" in str(data.get("decision", "")).lower():
                data["decision"] = "pdf"
            elif "email" in str(data.get("decision", "")).lower():
                data["decision"] = "email"
            elif "compliance" in str(data.get("decision", "")).lower():
                data["decision"] = "compliance"
            elif "supplier" in str(data.get("decision", "")).lower() or "供应商" in str(data.get("decision", "")):
                data["decision"] = "supplier"
            else:
                data["decision"] = "unknown"

        print(f"Orchestrator Input: '{input_str}' -> Final Data: {data}\n")
        return OrchestrationResponse(**data)
    except Exception as e:
        print(f"Error in simplified orchestrator: {e}")
        return OrchestrationResponse(decision="unknown", ui_actions=[])
