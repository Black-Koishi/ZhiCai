from typing import TypedDict, Literal
from langgraph.graph import StateGraph, END
from backend.agents import orchestrator_router
from backend.database import get_unanalyzed_emails, get_email_analyses_by_status, get_order_by_id, set_email_analysis_status
from backend.services.emails import analyze_email
from backend.services.compliance import run_compliance_and_record
from backend.services.orders import generate_and_store_pdf
from backend.services.suppliers import onboard_supplier_from_text

# 1. 定义 State, 用于存储智能体的状态
class AgentState(TypedDict):
    input_text: str
    routing_decision: str
    output_text: str
    steps: list[str]
    agent_email_enabled: bool
    agent_compliance_enabled: bool
    agent_pdf_enabled: bool
    agent_forecast_enabled: bool
    ui_actions: list[dict]
    gatekeeper_results: list[dict]
    order_ids: list[int]

# 2. 编排器节点
def orchestrator_node(state: AgentState):
    """ 
    分析当前状态(用户输入)并决定路由到哪里。
    """
    input_text = state.get("input_text", "")
    orchestration = orchestrator_router(input_text)
    decision = orchestration.decision    # 编排器判定结果
    ui_actions = [action.model_dump() for action in orchestration.ui_actions]   # 编排器识别的ui操作
    chat_response = orchestration.chat_response    # 编排器输出
    
    steps = list(state.get("steps", []))
    
    display_decision = decision
    if decision == "unknown" and (ui_actions or chat_response):
        display_decision = "界面跳转 / 直接回复"
        
    steps.append(f"编排器：已分析输入，路由到 {display_decision}。")
    
    return {
        "routing_decision": decision, 
        "ui_actions": ui_actions,
        "output_text": chat_response if chat_response else state.get("output_text", ""),
        "steps": steps
    }

def agent_email_node(state: AgentState):
    """分析所有未分析邮件：LLM 提取 → 物品/供应商匹配 → 保存。"""
    steps = list(state.get("steps", [])) + ["邮件智能体：正在启动邮件分析流水线..."]
    analyzed_count = 0

    unanalyzed = get_unanalyzed_emails()
    if not unanalyzed:
        return {
            "output_text": "当前没有新邮件需要分析。",
            "steps": steps + ["邮件智能体：未发现未分析的邮件。"],
            "gatekeeper_results": [],
            "order_ids": [],
        }

    for email in unanalyzed:
        email_id = email["id"]
        try:
            saved = analyze_email(email_id, email["body"])
            if not saved:
                steps.append(f"邮件智能体：无法从 '{email_id}' 分析完整需求，已跳过。")
                continue
            steps.append(
                f"📧 邮件 '{email_id}'：'{saved.get('item_name', '?')}' "
                f"x{saved.get('item_quantity', '?')} — 优先级：{saved.get('priority', '?')}"
            )
            analyzed_count += 1
        except Exception as e:
            set_email_analysis_status(email_id, "failed", str(e))
            steps.append(f"处理邮件 '{email_id}' 时出错：{str(e)}")

    summary = f"流水线完成 — 已保存提取结果：{analyzed_count} 条。"
    steps.append(summary)

    return {
        "output_text": summary,
        "steps": steps,
        "gatekeeper_results": [],
        "order_ids": [],
    }


def compliance_node(state: AgentState):
    """对「高/中/低优先」的邮件运行批量合规检查。

    通过 → 进入「待审核」；未通过 → 「未通过」并自动发邮件通知发件人。
    """
    steps = list(state.get("steps", [])) + ["合规智能体：正在对「高/中/低优先」的邮件运行批量守门检查..."]
    gatekeeper_results = []
    passed_count = failed_count = 0

    analyses = get_email_analyses_by_status("analyzed")
    if not analyses:
        return {
            "output_text": "当前没有需要合规检查的邮件。",
            "steps": steps + ["合规智能体：没有需要合规检查的邮件。"],
            "gatekeeper_results": [],
            "order_ids": [],
        }

    for analysis in analyses:
        item_name = analysis.get("item_name", "未知")
        email_id = analysis.get("email_id", "?")
        try:
            result = run_compliance_and_record(email_id, analysis)
            gatekeeper_results.append({
                "email_id": email_id,
                "item_name": item_name,
                **result,
            })

            if result["passed"]:
                passed_count += 1
                steps.append(f"✅ 通过  [{item_name}] → 待审核")
            else:
                failed_count += 1
                steps.append(f"❌ 未通过  [{item_name}]（已通知发件人）：{result['explanation']}")
        except Exception as e:
            steps.append(f"检查 '{item_name}'（邮件 {email_id}）时出错：{str(e)}")

    summary = f"合规检查完成 — 共检查 {len(analyses)} 项，✅ {passed_count} 项通过（待审核），❌ {failed_count} 项未通过。"
    steps.append(summary)

    return {
        "output_text": summary,
        "steps": steps,
        "gatekeeper_results": gatekeeper_results,
        "order_ids": [],
    }


def pdf_node(state: AgentState):
    """
    根据用户输入中提取的特定订单编号生成一份 PDF 购货订单。
    用户说：“生成订单 14 的 PDF”  → 生成 PDF → 返回下载路径。
    """
    import re
    import os

    steps = list(state.get("steps", [])) + ["PDF 智能体：正在启动 PDF 生成..."]
    input_text = state.get("input_text", "")

    # 从输入中提取订单编号（例如：“生成订单 14 的 PDF” → 14）
    # 正则表达式
    numbers = re.findall(r'\d+', input_text)
    if not numbers:
        return {
            "output_text": "请指定订单 ID。示例：“为订单 14 生成 PDF”",
            "steps": steps + ["PDF 智能体：输入中未找到订单 ID。"]
        }

    order_id = int(numbers[0])
    steps.append(f"PDF 智能体：正在为订单 #{order_id} 生成 PDF...")

    order = get_order_by_id(order_id)
    if not order:
        return {
            "output_text": f"未找到订单 #{order_id}, 请检查订单是否存在。",
            "steps": steps + [f"PDF 智能体：数据库中未找到订单 #{order_id}。"]
        }

    try:
        order_context = {
            "item_name":   order.get("item_name", "无"),
            "quantity":    order.get("qty", 0),
            "unit_price":  order.get("unit_price", 0),
            "total_cost":  order.get("amount", 0),
            "vendor_name": order.get("vendor_name", "无"),
            "vendor_email":order.get("vendor_email", "无"),
            "created_at":  order.get("created_at", ""),
        }

        pdf_path = generate_and_store_pdf(order_id, order_context)

        abs_path = os.path.abspath(pdf_path)
        steps.append(f"PDF 智能体：✅ 已在 '{pdf_path}' 生成 PDF")

        return {
            "output_text": (
                f"📄 订单 #{order_id} 的采购订单 PDF 已生成！\n"
                f"物品：{order_context['item_name']}\n"
                f"供应商：{order_context['vendor_name']}\n"
                f"金额：${order_context['total_cost']:,.2f}\n"
                f"文件保存于：{abs_path}\n"
                f"或通过下载：POST /orders/{order_id}/generate-pdf"
            ),
            "steps": steps
        }
    except Exception as e:
        return {
            "output_text": f"为订单 #{order_id} 生成 PDF 失败：{str(e)}",
            "steps": steps + [f"PDF 智能体：出错 — {str(e)}"]
        }

def unknown_node(state: AgentState):
    """
    处理不明确的输入或单纯的用户界面导航请求。
    """
    steps = list(state.get("steps", []))
    output_text = state.get("output_text", "")
    
    # 如果编排器提供了聊天回复，则使用该回复。
    if isinstance(output_text, str) and output_text and not output_text.startswith("抱歉，我无法判断"):
        steps.append("编排器：已提供直接回复。")
        return {
            "output_text": output_text,
            "steps": steps
        }
    
    ui_actions = state.get("ui_actions", [])
    if ui_actions:
        steps.append("编排器：已执行 UI 操作，请求已完成。")
        return {
            "output_text": "我已根据你的请求更新了视图。",
            "steps": steps
        }
    
    steps.append("编排器：无法判断意图，已停止执行。")
    return {
        "output_text": "抱歉，我无法判断你的意图。请尝试“分析邮件”“运行合规检查”或“生成需求趋势报告”。",
        "steps": steps
    }

def service_unavailable_node(state: AgentState):
    """处理被禁用的智能体：返回服务不可用提示。"""
    return {
        "output_text": "服务不可用：所需智能体当前已禁用。",
        "steps": state.get("steps", []) + ["编排器：智能体已禁用，服务不可用。"]
    }

def supplier_node(state: AgentState):
    """供应商入驻：从自然语言提取供应商信息、评分并建档。"""
    steps = list(state.get("steps", [])) + ["供应商智能体：正在提取供应商信息..."]
    text = state.get("input_text", "")

    result = onboard_supplier_from_text(text)
    if result.get("status") != "success":
        msg = result.get("message", "供应商入驻失败。")
        return {
            "output_text": msg,
            "steps": steps + [f"供应商智能体：{msg}"],
            "ui_actions": [],
            "gatekeeper_results": [],
            "order_ids": [],
        }

    steps.append(
        f"供应商智能体：已入驻「{result['name']}」，初始评分 {result['ext_score']} 分。"
    )
    output = (
        f"✅ 供应商「{result['name']}」已入驻（ID #{result['vendor_id']}）。\n"
        f"主营品类：{result.get('category') or '未填写'}\n"
        f"邮箱：{result.get('email') or '未填写'}\n"
        f"电话：{result.get('phone') or '未填写'}\n"
        f"初始评分：{result['ext_score']} 分\n"
        f"审核意见：{result.get('review') or '无'}"
    )
    return {
        "output_text": output,
        "steps": steps,
        "ui_actions": [],
        "gatekeeper_results": [],
        "order_ids": [],
    }

def forecast_node(state: AgentState):
    """启动后台需求趋势分析，立即返回；完成后前端轮询状态并提示用户。"""
    from backend.forecast import start_forecast_generation

    steps = list(state.get("steps", [])) + ["需求分析智能体：正在后台启动趋势分析..."]
    started = start_forecast_generation()
    if started:
        output = "正在后台生成需求趋势报告，完成后会通知你。"
        steps.append("需求分析智能体：已在后台启动趋势分析。")
        ui_actions = [{"action_type": "start_forecast", "params": {}}]
    else:
        output = "需求趋势报告正在生成中，请稍候。"
        steps.append("需求分析智能体：已有分析任务正在运行。")
        ui_actions = []

    return {
        "output_text": output,
        "steps": steps,
        "ui_actions": ui_actions,
        "gatekeeper_results": [],
        "order_ids": [],
    }

# 3. 判断服务是否开启
def route_decision(state: AgentState) -> Literal["agent_email", "agent_compliance", "agent_pdf", "agent_supplier", "agent_forecast", "unknown", "service_unavailable"]:
    """根据编排结果与各智能体开关，决定下一步路由到哪个节点。"""
    decision = state["routing_decision"]
    agent_enabled_map = {
        "email":      state.get("agent_email_enabled", True),
        "compliance": state.get("agent_compliance_enabled", True),
        "pdf":        state.get("agent_pdf_enabled", True),
        "forecast":   state.get("agent_forecast_enabled", True),
    }

    if decision in ["email", "compliance", "pdf", "forecast"]:
        if agent_enabled_map[decision]:
            return f"agent_{decision}"
        else:
            return "service_unavailable"
    
    if decision == "supplier":
        return "agent_supplier"
    
    return "unknown"

# 建图
workflow = StateGraph(AgentState)

# 添加节点
workflow.add_node("orchestrator", orchestrator_node)
workflow.add_node("agent_email", agent_email_node)
workflow.add_node("agent_compliance", compliance_node)
workflow.add_node("agent_pdf", pdf_node)
workflow.add_node("agent_supplier", supplier_node)
workflow.add_node("agent_forecast", forecast_node)
workflow.add_node("unknown", unknown_node)
workflow.add_node("service_unavailable", service_unavailable_node)

# 设置入口
workflow.set_entry_point("orchestrator")

# 添加条件边
workflow.add_conditional_edges(
    "orchestrator",
    route_decision,
    {
        "agent_email":       "agent_email",
        "agent_compliance":  "agent_compliance",
        "agent_pdf":         "agent_pdf",
        "agent_supplier":    "agent_supplier",
        "agent_forecast":    "agent_forecast",
        "unknown":           "unknown",
        "service_unavailable": "service_unavailable"
    }
)

# 连到终点
workflow.add_edge("agent_email", END)
workflow.add_edge("agent_compliance", END)
workflow.add_edge("agent_pdf", END)
workflow.add_edge("agent_supplier", END)
workflow.add_edge("agent_forecast", END)
workflow.add_edge("unknown", END)
workflow.add_edge("service_unavailable", END)

# 编译图
app = workflow.compile()
