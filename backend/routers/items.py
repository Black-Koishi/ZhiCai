"""物料路由：分页查询、建档与删除。"""
import asyncio

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.database import create_item, delete_item, update_item, update_inventory, get_items_paginated
from backend.services.items import onboard_item_from_text

router = APIRouter()


class OnboardItemRequest(BaseModel):
    text: str


class CreateItemRequest(BaseModel):
    name: str
    sku: str = None
    unit: str = None
    unit_price: float = 0
    vendor_id: int = None


class UpdateItemRequest(BaseModel):
    name: str
    unit: str = None
    unit_price: float = 0
    vendor_id: int = None
    qty_on_hand: int = None
    min_qty: int = None
    max_capacity: int = None


@router.get("/items")
async def list_items(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    stock_status: str = Query(None),
):
    """分页返回物料，支持搜索与库存充足/低库存筛选。"""
    try:
        result = get_items_paginated(page=page, per_page=per_page, search=search, stock_status=stock_status)
        return {"status": "success", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/items/onboard")
async def onboard_item_endpoint(request: OnboardItemRequest):
    """从自然语言建档一个物料（Agent 提取 + 自动生成 SKU）。"""
    try:
        result = await asyncio.to_thread(onboard_item_from_text, request.text)
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result.get("message", "建档失败"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/items")
async def create_item_endpoint(request: CreateItemRequest):
    """结构化逐项新增物料。"""
    try:
        item_id = create_item(
            name=request.name,
            sku=request.sku,
            unit=request.unit,
            unit_price=request.unit_price,
            default_vendor_id=request.vendor_id,
        )
        return {"status": "success", "item_id": item_id, "name": request.name}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/items/{item_id}")
async def update_item_endpoint(item_id: int, request: UpdateItemRequest):
    """更新物料（名称/单位/单价/默认供应商/库存）；SKU 不可修改。"""
    try:
        if not update_item(item_id, request.name, request.unit, request.unit_price, request.vendor_id):
            raise HTTPException(status_code=404, detail="物料未找到")
        if request.qty_on_hand is not None or request.min_qty is not None or request.max_capacity is not None:
            update_inventory(item_id, request.qty_on_hand, request.min_qty, request.max_capacity)
        return {"status": "success", "item_id": item_id, "name": request.name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/items/{item_id}")
async def delete_item_endpoint(item_id: int):
    """删除指定物料。"""
    try:
        if not delete_item(item_id):
            raise HTTPException(status_code=404, detail="物料未找到")
        return {"status": "success", "message": "物料已删除"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
