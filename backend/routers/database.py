"""数据库浏览与编辑路由。"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.database import (
    get_tables as db_get_tables,
    get_table_data as db_get_table_data,
    update_table_row as db_update_table_row,
    delete_table_data as db_delete_table_data,
)

router = APIRouter()


class UpdateRowRequest(BaseModel):
    original_row: dict
    updated_row: dict


@router.get("/database/tables")
async def api_get_tables():
    """查询所有表名"""
    try:
        tables = db_get_tables()
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/database/tables/{table_name}")
async def api_get_table_data(table_name: str):
    """查询一个表的所有行"""
    try:
        data = db_get_table_data(table_name)
        return {"data": data}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/database/tables/{table_name}")
async def api_update_table_row(table_name: str, request: UpdateRowRequest):
    """更新某个表的某行"""
    try:
        db_update_table_row(table_name, request.original_row, request.updated_row)
        return {"status": "success"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/database/tables/{table_name}")
async def api_delete_table_data(table_name: str):
    """删除某个表的所有行"""
    try:
        db_delete_table_data(table_name)
        return {"status": "success", "message": f"已删除 {table_name} 中的所有记录"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
