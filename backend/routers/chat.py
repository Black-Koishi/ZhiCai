"""编排器对话与健康检查路由。"""
import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.graph import app as workflow

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    user_id: str = "default_user"
    agent_email_enabled: bool = True
    agent_compliance_enabled: bool = True
    agent_pdf_enabled: bool = True
    agent_forecast_enabled: bool = True


class ChatResponse(BaseModel):
    response_text: str
    steps: list[str]
    ui_actions: list[dict] = []


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    initial_state = {
        "input_text": request.message,
        "steps": [],
        "agent_email_enabled": request.agent_email_enabled,
        "agent_compliance_enabled": request.agent_compliance_enabled,
        "agent_pdf_enabled": request.agent_pdf_enabled,
        "agent_forecast_enabled": request.agent_forecast_enabled,
        "routing_decision": "unknown",
        "output_text": "",
        "ui_actions": [],
        "gatekeeper_results": [],
        "order_ids": [],
    }

    try:
        # 放到线程池执行，避免同步的 LLM 调用阻塞 FastAPI 事件循环
        # 超时由底层 LLM 调用各自控制（config.get_llm 里 60 秒），这里不设整体超时，
        # 否则「分析邮件」这类需要多封邮件逐封调 LLM 的批量任务会被误判超时
        result = await asyncio.to_thread(workflow.invoke, initial_state)

        return ChatResponse(
            response_text=result.get("output_text", "Error processing request."),
            steps=result.get("steps", []),
            ui_actions=result.get("ui_actions", []),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    return {"status": "ok"}
