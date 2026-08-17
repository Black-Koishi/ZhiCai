"""需求预测路由。"""
import asyncio

from fastapi import APIRouter, HTTPException

from backend.database import get_latest_forecast, get_forecast_history, get_forecast_by_id, save_forecast
from backend.forecast import get_forecast_status

router = APIRouter()


@router.get("/forecast/status")
async def api_get_forecast_status():
    """返回后台预测生成状态（idle / generating / done / error）。"""
    try:
        return {"status": "success", "data": get_forecast_status()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast/latest")
async def api_get_latest_forecast():
    try:
        forecast = get_latest_forecast()
        if forecast:
            return {"status": "success", "data": forecast}
        return {"status": "not_found", "message": "未找到预测记录。"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast/history")
async def api_get_forecast_history():
    try:
        history = get_forecast_history()
        return {"status": "success", "data": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast/{forecast_id}")
async def api_get_forecast_by_id(forecast_id: int):
    try:
        forecast = get_forecast_by_id(forecast_id)
        if forecast:
            return {"status": "success", "data": forecast}
        return {"status": "not_found", "message": "未找到预测记录。"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/forecast/generate")
async def api_generate_forecast():
    """运行历史数学分析 + LLM 综合，生成预测报告。"""
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
