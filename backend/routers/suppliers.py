"""供应商路由：入驻、分页查询与删除。"""
import asyncio

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.database import (
    create_vendor,
    delete_vendor,
    update_vendor,
    update_vendor_score,
    get_vendors_paginated,
    count_items_by_vendor,
)
from backend.services.suppliers import onboard_supplier_from_text, score_supplier_from_text

router = APIRouter()


class OnboardSupplierRequest(BaseModel):
    text: str


class CreateSupplierRequest(BaseModel):
    name: str
    email: str = None
    phone: str = None
    category: str = None
    description: str = None


class UpdateSupplierRequest(BaseModel):
    name: str
    email: str = None
    phone: str = None
    category: str = None


class RescoreSupplierRequest(BaseModel):
    description: str = ""


@router.post("/suppliers/onboard")
async def onboard_supplier_endpoint(request: OnboardSupplierRequest):
    """从自然语言入驻一个供应商（Agent 提取 + 评分 + 建档）。"""
    try:
        result = await asyncio.to_thread(onboard_supplier_from_text, request.text)
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result.get("message", "入驻失败"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suppliers")
async def create_supplier_endpoint(request: CreateSupplierRequest):
    """结构化逐项新增供应商（评分由模型根据描述自动生成）。"""
    try:
        score = await asyncio.to_thread(score_supplier_from_text, request.description or "")
        vendor_id = create_vendor(
            name=request.name,
            email=request.email,
            phone=request.phone,
            category=request.category,
            ext_score=score.get("ext_score", 80),
        )
        return {
            "status": "success",
            "vendor_id": vendor_id,
            "name": request.name,
            "ext_score": score.get("ext_score", 80),
            "review": score.get("review", ""),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/suppliers/{vendor_id}")
async def update_supplier_endpoint(vendor_id: int, request: UpdateSupplierRequest):
    """更新供应商基本信息（名称/邮箱/电话/品类）。"""
    try:
        if not update_vendor(vendor_id, request.name, request.email, request.phone, request.category):
            raise HTTPException(status_code=404, detail="供应商未找到")
        return {"status": "success", "vendor_id": vendor_id, "name": request.name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suppliers/{vendor_id}/rescore")
async def rescore_supplier_endpoint(vendor_id: int, request: RescoreSupplierRequest):
    """根据描述重新评分供应商（评分不可由客户端直接指定）。"""
    try:
        score = await asyncio.to_thread(score_supplier_from_text, request.description or "")
        update_vendor_score(vendor_id, score.get("ext_score", 60))
        return {
            "status": "success",
            "vendor_id": vendor_id,
            "ext_score": score.get("ext_score", 60),
            "review": score.get("review", ""),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suppliers")
async def list_suppliers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    min_score: float = Query(None),
    max_score: float = Query(None),
):
    """分页返回供应商，支持搜索与评分范围筛选。"""
    try:
        result = get_vendors_paginated(
            page=page, per_page=per_page, search=search,
            min_score=min_score, max_score=max_score,
        )
        return {"status": "success", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/suppliers/{vendor_id}")
async def delete_supplier_endpoint(vendor_id: int):
    """删除指定供应商（若名下还有物料则拒绝删除）。"""
    try:
        item_count = count_items_by_vendor(vendor_id)
        if item_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"该供应商名下还有 {item_count} 个物料，请先处理这些物料后再删除。",
            )
        if not delete_vendor(vendor_id):
            raise HTTPException(status_code=404, detail="供应商未找到")
        return {"status": "success", "message": "供应商已删除"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
