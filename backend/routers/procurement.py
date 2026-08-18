"""采购流程路由：合规检查、下单与物品查询。"""
import asyncio
import datetime

from fastapi import APIRouter, HTTPException

from backend.database import (
    get_item_by_name,
    get_vendor,
    get_email_analysis,
    find_analysis_by_item_name,
    set_email_analysis_status,
)
from backend.services.compliance import (
    run_compliance,
    save_compliance_explanation,
    send_order_confirmation,
    send_cancel_notification,
)
from backend.services.orders import create_order_with_pdf, link_analysis_order

router = APIRouter()


@router.post("/procurement/manual/compliance")
async def manual_compliance_check(payload: dict):
    item_name = payload.get("item_name")
    quantity = payload.get("quantity", 1)
    expected_date_str = payload.get("expected_date")  # YYYY-MM-DD
    summary = payload.get("summary", "")

    if not item_name:
        raise HTTPException(status_code=400, detail="必须提供 item_name")

    item = get_item_by_name(item_name)
    if not item:
        raise HTTPException(status_code=404, detail="物品未找到")

    total_cost = item["unit_price"] * quantity
    vendor = get_vendor(item.get("default_vendor_id"))

    priority = "Normal"
    if expected_date_str:
        try:
            expected_date = datetime.datetime.strptime(expected_date_str, "%Y-%m-%d").date()
            days_available = (expected_date - datetime.date.today()).days
            if days_available <= 7:
                priority = "High"
            elif days_available <= 30:
                priority = "Medium"
            else:
                priority = "Low"
        except ValueError:
            pass

    fake_analysis = {
        "item_id": item["id"],
        "item_name": item["name"],
        "vendor_id": vendor["id"] if vendor else None,
        "quantity": quantity,
        "total_cost": total_cost,
        "priority": priority,
        "summary": summary,
    }

    result = await asyncio.to_thread(run_compliance, fake_analysis)

    return {
        "status": "success",
        "passed": result["passed"],
        "explanation": result["explanation"],
        "review": result["review"],
        "total_cost": total_cost,
        "fake_analysis_context": fake_analysis,
    }


@router.post("/procurement/manual/order")
async def manual_order_create(payload: dict):
    context = payload.get("context")
    if not context:
        raise HTTPException(status_code=400, detail="缺少订单上下文（需先运行合规检查）。")

    try:
        result = await asyncio.to_thread(
            create_order_with_pdf,
            item_id=context["item_id"],
            vendor_id=context["vendor_id"],
            qty=context["quantity"],
            amount=context["total_cost"],
            priority=context.get("priority", "Normal"),
        )
        return {"status": "success", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/procurement/{email_id}/compliance")
async def check_compliance(email_id: str):
    try:
        analysis = get_email_analysis(email_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="未找到分析")

        result = await asyncio.to_thread(run_compliance, analysis)
        save_compliance_explanation(email_id, result["explanation"])
        set_email_analysis_status(email_id, "pending_review" if result["passed"] else "failed_compliance")

        # 合规未通过：直接把原因通知发件人，无需人工填写
        if not result["passed"]:
            await asyncio.to_thread(send_cancel_notification, email_id, result["explanation"])

        return {"status": "success", "passed": result["passed"], "explanation": result["explanation"], "review": result["review"]}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/procurement/{email_id}/cancel")
async def cancel_procurement_request(email_id: str, payload: dict):
    """人工最终审核未通过（待审核阶段）：填写原因发给发件人，并标记为「未通过」。"""
    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="请填写未通过原因")

    try:
        set_email_analysis_status(email_id, "failed_compliance")
        # 人工原因与 AI 评审共用同一个字段存储，便于统一展示
        save_compliance_explanation(email_id, reason)
        notified = await asyncio.to_thread(send_cancel_notification, email_id, reason)
        return {"status": "success", "email_id": email_id, "notified": notified, "message": "采购需求未通过"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/procurement/{email_id}/order")
async def generate_procurement_order(email_id: str):
    try:
        analysis = get_email_analysis(email_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="未找到分析")

        result = await asyncio.to_thread(
            create_order_with_pdf,
            item_id=analysis["item_id"],
            vendor_id=analysis["vendor_id"],
            qty=analysis["item_quantity"],
            amount=analysis["total_cost"],
            priority=analysis.get("priority", "Normal"),
        )
        link_analysis_order(email_id, result["order_id"])
        await asyncio.to_thread(send_order_confirmation, email_id, result["order_id"])
        return {"status": "success", **result}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/procurement/compliance-by-item")
async def compliance_by_item_name(payload: dict):
    """对匹配 item_name 的最新邮件分析运行合规检查。"""
    item_name = payload.get("item_name", "").strip()
    if not item_name:
        raise HTTPException(status_code=400, detail="必须提供 item_name")

    analysis = find_analysis_by_item_name(item_name)
    if not analysis:
        raise HTTPException(status_code=404, detail=f"未找到 '{item_name}' 的邮件分析")

    result = await asyncio.to_thread(run_compliance, analysis)
    save_compliance_explanation(analysis["email_id"], result["explanation"])
    set_email_analysis_status(analysis["email_id"], "pending_review" if result["passed"] else "failed_compliance")

    if not result["passed"]:
        await asyncio.to_thread(send_cancel_notification, analysis["email_id"], result["explanation"])

    return {
        "status": "success",
        "item_name": analysis.get("item_name"),
        "email_id": analysis["email_id"],
        "passed": result["passed"],
        "explanation": result["explanation"],
        "review": result["review"],
    }


@router.post("/procurement/order-by-item")
async def order_by_item_name(payload: dict):
    """为匹配 item_name 的最新邮件分析创建订单并生成 PDF。"""
    item_name = payload.get("item_name", "").strip()
    if not item_name:
        raise HTTPException(status_code=400, detail="必须提供 item_name")

    analysis = find_analysis_by_item_name(item_name)
    if not analysis:
        raise HTTPException(status_code=404, detail=f"未找到 '{item_name}' 的邮件分析")

    result = await asyncio.to_thread(
        create_order_with_pdf,
        item_id=analysis["item_id"],
        vendor_id=analysis["vendor_id"],
        qty=analysis["item_quantity"],
        amount=analysis["total_cost"],
        priority=analysis.get("priority", "Normal"),
    )
    link_analysis_order(analysis["email_id"], result["order_id"])
    await asyncio.to_thread(send_order_confirmation, analysis["email_id"], result["order_id"])

    return {
        "status": "success",
        "item_name": analysis.get("item_name"),
        **result,
        "message": f"订单 #{result['order_id']} 已创建并生成 PDF。",
    }


@router.get("/items/lookup")
async def lookup_item(name: str):
    """按名称查找物品，用于手动下单。"""
    item = get_item_by_name(name)
    if not item:
        raise HTTPException(status_code=404, detail="物品未找到")
    vendor = get_vendor(item["default_vendor_id"]) if item.get("default_vendor_id") else None
    return {"status": "success", "item": item, "vendor": vendor}
