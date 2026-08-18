"""
电子邮件分析智能体：从电子邮件正文中提取结构化的采购数据。
"""
import json

from langchain_core.messages import HumanMessage, SystemMessage

from backend.agents.config import get_email_analyzer_llm
from backend.agents.models import EmailExtraction


def analyze_email_content(body: str) -> dict:
    """
    使用语言模型从电子邮件正文中提取结构化的采购数据。
    优先级逻辑：高（<= 7 天），中（7 - 30 天），低（> 30 天）。
    """
    system_prompt = """你是一个采购分析智能体。从以下邮件中提取订单详情。
你必须提取：物品名称、数量（数字）、需要在多少天内交付、预算总金额。
另外提供一个 1 句话的中文摘要（summary）。

严格根据天数确定优先级（priority 字段使用英文枚举值）：
- 7 天以内（含 7 天）需要则为 'High'。
- 8 到 30 天之间需要则为 'Medium'。
- 30 天之后需要则为 'Low'。

budget 为本次采购需求的预算总金额（数字），即申请方愿意为该采购支付的最高总价。
is_procurement_request：判断该邮件是否为真实的采购/询价需求。只有确实在请求采购某物品时才为 true；通知、广告、订阅、系统邮件、个人往来等一律为 false。

只输出符合所请求 schema 的有效 JSON 对象。
注意：item_name 请保留邮件原文中的物品名称（不要翻译，以便匹配数据库），summary 字段使用简体中文。
"""
    try:
        response = get_email_analyzer_llm().invoke([
            SystemMessage(content=system_prompt + "\nSchema: {\"item_name\": \"str\", \"quantity\": int, \"days_available\": int, \"priority\": \"str\", \"summary\": \"str\", \"budget\": number, \"is_procurement_request\": bool}\n只返回纯 JSON。"),
            HumanMessage(content=body)
        ])
        content = response.content.strip()
        # # 如果存在 Markdown 代码块则删除它们
        if content.startswith("```json"):
             content = content[7:-3]
        elif content.startswith("```"):
             content = content[3:-3]
             
        data = json.loads(content)
        # 验证并返回
        extracted = EmailExtraction(**data)
        return extracted.model_dump()
    except Exception as e:
        print(f"Error extracting email data: {e}. Raw response: {response.content if 'response' in locals() else 'None'}")
        return None
