"""邮件分析服务：LLM 提取 → 物品/供应商匹配 → 校验预算 → 保存分析。

供 LangGraph 节点与 REST 端点共用，避免同一逻辑重复实现。
"""
from backend.agents import analyze_email_content
from backend.database import get_item_by_name, get_vendor, save_email_analysis, get_email_analysis


def analyze_email(email_id: str, body: str) -> dict:
    """分析单封邮件并保存结果，返回保存后的 email_analysis 记录。

    以下情况视为分析失败并抛出带说明的异常：
    - 无法提取结构化数据
    - 物品在物料库中不存在
    - 未能提取预算
    """
    extraction = analyze_email_content(body)
    if not extraction:
        raise ValueError("无法从邮件中提取结构化数据。")

    if not extraction.get("is_procurement_request", True):
        raise ValueError("该邮件不是采购需求邮件，已标记为分析失败。")

    item_name = extraction.get("item_name", "")
    item_data = get_item_by_name(item_name)
    if not item_data:
        raise ValueError(f"邮件中的物品「{item_name}」在物料库中不存在，无法匹配供应商，分析失败。")

    # 校验预算
    budget = extraction.get("budget")
    if budget is None or budget <= 0:
        raise ValueError(f"邮件中未能提取到有效的预算金额，分析失败。")

    vendor_data = None
    if item_data.get("default_vendor_id"):
        vendor_data = get_vendor(item_data["default_vendor_id"])

    save_email_analysis(email_id, extraction, item_data, vendor_data)
    return get_email_analysis(email_id)
