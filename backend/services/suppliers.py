"""
供应商服务：供应商入驻（Agent 提取 + 评分 + 落库）。
"""
from backend.agents import onboard_supplier, score_supplier
from backend.database import create_vendor


def onboard_supplier_from_text(text: str) -> dict:
    """从自然语言入驻供应商，返回结果 dict。

    返回：
        - status == "success" 时含 vendor_id/name/email/phone/category/ext_score/review
        - status == "error" 时含 message
    """
    extraction = onboard_supplier(text)
    if not extraction or not extraction.get("name"):
        return {"status": "error", "message": "无法从文本中提取供应商信息。"}

    vendor_id = create_vendor(
        name=extraction["name"],
        email=extraction.get("email"),
        phone=extraction.get("phone"),
        category=extraction.get("category"),
        ext_score=extraction.get("ext_score", 80),
        approved=1,
    )

    return {
        "status": "success",
        "vendor_id": vendor_id,
        "name": extraction["name"],
        "email": extraction.get("email"),
        "phone": extraction.get("phone"),
        "category": extraction.get("category"),
        "ext_score": extraction.get("ext_score", 80),
        "review": extraction.get("review", ""),
    }


def score_supplier_from_text(description: str) -> dict:
    """根据描述生成供应商初始评分与审核意见（复用现有评分逻辑）。"""
    return score_supplier(description)
