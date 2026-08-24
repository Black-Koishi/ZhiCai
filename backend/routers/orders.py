"""订单管理路由：列表、汇总、手动下单与 PDF 生成。"""
import asyncio

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.database import (
    get_orders as db_get_orders,
    get_orders_paginated as db_get_orders_paginated,
    get_orders_summary as db_get_orders_summary,
    get_order_by_id as db_get_order_by_id,
    get_item_by_name,
    get_vendor,
    delete_order as db_delete_order,
)
from backend.services.compliance import run_compliance
from backend.services.orders import (
    create_order_with_pdf,
    generate_and_store_pdf,
    send_order_email,
    receive_order,
    cancel_order,
)

router = APIRouter()


class ManualOrderRequest(BaseModel):
    item_name: str
    quantity: int = 1


@router.get("/orders/list")
async def list_orders_paginated(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    status: str = Query(None),
    min_amount: float = Query(None),
    max_amount: float = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
):
    """分页订单列表，支持搜索、金额范围、日期范围与状态筛选。"""
    try:
        result = db_get_orders_paginated(
            page=page, per_page=per_page, search=search,
            status=status, min_amount=min_amount, max_amount=max_amount,
            date_from=date_from, date_to=date_to,
        )
        return {"status": "success", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orders/summary")
async def orders_summary():
    """订单头部的聚合统计。"""
    try:
        return {"status": "success", **db_get_orders_summary()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orders")
async def list_orders():
    """列出全部订单（旧版，未分页）。"""
    try:
        return {"status": "success", "orders": db_get_orders()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders/manual")
async def create_manual_order_endpoint(request: ManualOrderRequest):
    """手动下单：按物品名称匹配并运行合规检查后创建订单。"""
    item = get_item_by_name(request.item_name)
    if not item:
        raise HTTPException(status_code=404, detail="物品未找到")

    total_cost = item["unit_price"] * request.quantity
    vendor = get_vendor(item.get("default_vendor_id"))

    fake_analysis = {
        "item_id": item["id"],
        "item_name": item["name"],
        "vendor_id": vendor["id"] if vendor else None,
        "quantity": request.quantity,
        "total_cost": total_cost,
        "priority": "Normal",
        "summary": "手动下单",
    }

    compliance = await asyncio.to_thread(run_compliance, fake_analysis)

    if not compliance["passed"]:
        raise HTTPException(status_code=400, detail=f"合规检查未通过：{compliance['explanation']}")

    try:
        result = await asyncio.to_thread(
            create_order_with_pdf,
            item_id=fake_analysis["item_id"],
            vendor_id=fake_analysis["vendor_id"],
            qty=fake_analysis["quantity"],
            amount=fake_analysis["total_cost"],
            priority="Normal",
        )
        return {"status": "success", **result, "explanation": compliance["explanation"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orders/{order_id}")
async def get_order(order_id: int):
    """按 ID 获取单个订单。"""
    try:
        order = db_get_order_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="订单未找到")
        return {"status": "success", "order": order}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/orders/{order_id}")
async def delete_order_endpoint(order_id: int):
    """删除指定订单。"""
    try:
        if not db_delete_order(order_id):
            raise HTTPException(status_code=404, detail="订单未找到")
        return {"status": "success", "message": "订单已删除"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders/{order_id}/send")
async def send_order_endpoint(order_id: int):
    """发送采购订单 PDF 邮件给供应商，状态置为已发送。"""
    try:
        result = await asyncio.to_thread(send_order_email, order_id)
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result.get("message"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders/{order_id}/receive")
async def receive_order_endpoint(order_id: int):
    """确认收货：库存增加 + 订单完成。"""
    try:
        result = receive_order(order_id)
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result.get("message"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders/{order_id}/cancel")
async def cancel_order_endpoint(order_id: int):
    """取消订单（仅草稿/已发送状态）。"""
    try:
        result = cancel_order(order_id)
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result.get("message"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders/{order_id}/generate-pdf")
async def generate_pdf_endpoint(order_id: int):
    """为指定订单重新生成采购订单 PDF 并返回下载。"""
    try:
        order = db_get_order_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="订单未找到")

        order_context = {
            "item_name":   order.get("item_name", "N/A"),
            "quantity":    order.get("qty", 0),
            "unit_price":  order.get("unit_price", 0),
            "total_cost":  order.get("amount", 0),
            "vendor_name": order.get("vendor_name", "N/A"),
            "vendor_email": order.get("vendor_email", "N/A"),
            "created_at":  order.get("created_at", ""),
        }

        pdf_path = await asyncio.to_thread(generate_and_store_pdf, order_id, order_context)

        return FileResponse(
            path=pdf_path,
            filename=f"PO_{order_id}.pdf",
            media_type="application/pdf",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
