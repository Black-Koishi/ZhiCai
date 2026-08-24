"""历史需求趋势分析路由。"""
import asyncio

from fastapi import APIRouter, HTTPException

from backend.database import get_latest_forecast, get_forecast_history, get_forecast_by_id, save_forecast
from backend.forecast import get_forecast_status

router = APIRouter()


@router.get("/forecast/status")
async def api_get_forecast_status():
    """返回后台趋势分析状态（idle / generating / done / error）。"""
    try:
        return {"status": "success", "data": get_forecast_status()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast/latest")
async def api_get_latest_forecast():
    """返回最新一条需求趋势分析记录。"""
    try:
        forecast = get_latest_forecast()
        if forecast:
            return {"status": "success", "data": forecast}
        return {"status": "not_found", "message": "未找到需求趋势分析记录。"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast/history")
async def api_get_forecast_history():
    """返回需求趋势分析历史。"""
    try:
        history = get_forecast_history()
        return {"status": "success", "data": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast/{forecast_id}")
async def api_get_forecast_by_id(forecast_id: int):
    """按 ID 返回需求趋势分析记录。"""
    try:
        forecast = get_forecast_by_id(forecast_id)
        if forecast:
            return {"status": "success", "data": forecast}
        return {"status": "not_found", "message": "未找到需求趋势分析记录。"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/forecast/generate")
async def api_generate_forecast():
    """运行历史数据分析并由 LLM 整理需求趋势报告。"""
    import json

    from backend.forecast import generate_forecast_report

    try:
        # 放到线程池执行，避免 Prophet + LLM 的同步调用阻塞事件循环
        result = await asyncio.to_thread(generate_forecast_report)
        if "error" in result and result.get("error") is True:
            return result

        chart_data_json = "{}"
        if "chart_data" in result:
            chart_data_json = json.dumps(result["chart_data"])

        save_forecast(
            result.get("stats_json", "{}"),
            result.get("markdown", ""),
            chart_data_json,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
