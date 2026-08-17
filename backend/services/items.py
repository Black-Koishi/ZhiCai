"""
物料服务：物料建档（自然语言提取 + 落库）。
"""
from backend.agents import onboard_item
from backend.database import create_item, get_vendor_by_name


def onboard_item_from_text(text: str) -> dict:
    """从自然语言建档物料，返回结果 dict。

    返回 status == "success" 时含 item_id/name/sku/unit/unit_price/vendor_name；
    status == "error" 时含 message。
    """
    extraction = onboard_item(text)
    if not extraction or not extraction.get("name"):
        return {"status": "error", "message": "无法从文本中提取物料信息。"}

    vendor_id = None
    vendor_name = extraction.get("vendor_name")
    if vendor_name:
        vendor = get_vendor_by_name(vendor_name)
        if vendor:
            vendor_id = vendor["id"]
            vendor_name = vendor["name"]

    try:
        item_id = create_item(
            name=extraction["name"],
            sku=extraction.get("sku"),
            unit=extraction.get("unit"),
            unit_price=extraction.get("unit_price", 0),
            default_vendor_id=vendor_id,
        )
    except ValueError as e:
        return {"status": "error", "message": str(e)}

    return {
        "status": "success",
        "item_id": item_id,
        "name": extraction["name"],
        "sku": extraction.get("sku"),
        "unit": extraction.get("unit"),
        "unit_price": extraction.get("unit_price", 0),
        "vendor_name": vendor_name,
    }
