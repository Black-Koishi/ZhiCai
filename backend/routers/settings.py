"""设置路由：智能体模型与邮箱配置。"""
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import set_key

from backend.agents.config import get_current_model, update_agent_model, list_ollama_models
from backend.database import clear_emails

router = APIRouter()

ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


class UpdateModelRequest(BaseModel):
    agent_name: str
    model_name: str


@router.get("/settings/models")
async def get_agent_models():
    """返回每个智能体当前配置的模型。"""
    try:
        agents = ["orchestrator", "email", "compliance", "forecast"]
        models = {agent: get_current_model(agent) for agent in agents}
        return {"status": "success", "models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings/ollama-models")
async def get_ollama_models():
    """返回本地 Ollama 已安装的模型列表。"""
    try:
        models = list_ollama_models()
        return {"status": "success", "models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class EmailConfigUpdate(BaseModel):
    smtp_server: str = None
    smtp_port: int = None
    imap_server: str = None
    imap_port: int = None
    email_user: str = None
    email_pass: str = None


@router.get("/settings/email")
async def get_email_config():
    """返回当前邮箱配置（密码只返回是否已设置，不返回明文）。"""
    return {
        "status": "success",
        "config": {
            "smtp_server": os.getenv("SMTP_SERVER", "smtp.gmail.com"),
            "smtp_port": os.getenv("SMTP_PORT", "587"),
            "imap_server": os.getenv("IMAP_SERVER", "imap.gmail.com"),
            "imap_port": os.getenv("IMAP_PORT", "993"),
            "email_user": os.getenv("EMAIL_USER", ""),
            "email_pass_set": bool(os.getenv("EMAIL_PASS")),
        },
    }


@router.put("/settings/email")
async def update_email_config(request: EmailConfigUpdate):
    """保存邮箱配置到 .env（密码留空表示不修改）。"""
    try:
        # 判断邮箱源是否切换（SMTP/IMAP 服务器或账号变化）
        old_smtp = os.getenv("SMTP_SERVER", "")
        old_imap = os.getenv("IMAP_SERVER", "")
        old_user = os.getenv("EMAIL_USER", "")
        source_changed = (
            (request.smtp_server is not None and request.smtp_server != old_smtp)
            or (request.imap_server is not None and request.imap_server != old_imap)
            or (request.email_user is not None and request.email_user != old_user)
        )

        updates = {}
        if request.smtp_server is not None:
            updates["SMTP_SERVER"] = request.smtp_server
        if request.smtp_port is not None:
            updates["SMTP_PORT"] = str(request.smtp_port)
        if request.imap_server is not None:
            updates["IMAP_SERVER"] = request.imap_server
        if request.imap_port is not None:
            updates["IMAP_PORT"] = str(request.imap_port)
        if request.email_user is not None:
            updates["EMAIL_USER"] = request.email_user
        if request.email_pass:
            updates["EMAIL_PASS"] = request.email_pass

        for key, value in updates.items():
            set_key(str(ENV_PATH), key, value)
            os.environ[key] = value

        if source_changed:
            clear_emails()
            return {"status": "success", "message": "邮箱配置已保存，已清空旧邮件缓存"}
        return {"status": "success", "message": "邮箱配置已保存并生效"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings/models")
async def update_agent_model_endpoint(request: UpdateModelRequest):
    """更新指定智能体的模型。"""
    valid_agents = ["orchestrator", "email", "compliance", "forecast"]
    if request.agent_name not in valid_agents:
        raise HTTPException(status_code=400, detail=f"无效的 agent_name，必须是 {valid_agents} 之一")

    try:
        update_agent_model(request.agent_name, request.model_name)
        return {"status": "success", "message": f"已将 {request.agent_name} 的模型更新为 {request.model_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
