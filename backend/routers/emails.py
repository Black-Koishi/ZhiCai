"""邮件功能路由：同步、收发与 AI 分析。"""
import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from backend.attachments import read as read_attachment
from backend.email_service import EmailService, EmailSyncError
from backend.email_display import format_email_label
from backend.database import (
    get_emails as db_get_emails,
    get_email_analysis,
    get_unanalyzed_emails,
    get_db_connection,
    get_email_attachments,
    set_email_analysis_status,
)
from backend.services.emails import analyze_email

router = APIRouter()


class EmailItem(BaseModel):
    id: str
    subject: str
    sender: str
    date: str
    body: str
    folder: str
    has_analysis: bool = False
    priority: str | None = None
    analysis_status: str | None = None
    analysis_error: str | None = None
    attachments: list = []


class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    body: str


class IgnoreEmailRequest(BaseModel):
    reason: str = ""


@router.get("/emails/unanalyzed-count")
async def unanalyzed_count():
    """返回当前待分析（收件箱中未分析）的邮件数量，供前端先提示再分析。

    注意：必须定义在 /emails/{folder} 之前，否则会被 {folder} 匹配到。
    """
    try:
        count = len(get_unanalyzed_emails())
        return {"status": "success", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/emails/{folder}", response_model=list[EmailItem])
async def get_emails(folder: str, limit: int = 20):
    """分页返回某文件夹的邮件列表。"""
    try:
        return db_get_emails(folder, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/emails/{email_id}/attachment/{storage_key}")
async def download_email_attachment(email_id: str, storage_key: str):
    """从本地存储读取邮件附件（同步时已落盘，与邮件源解耦）。"""
    attachments = get_email_attachments(email_id)
    meta = next((a for a in attachments if a.get("storage_key") == storage_key), None)
    if not meta:
        raise HTTPException(status_code=404, detail="附件不存在")

    content = read_attachment(storage_key)
    if content is None:
        raise HTTPException(status_code=404, detail="附件不存在")

    filename = meta.get("filename", storage_key)
    content_type = meta.get("content_type", "application/octet-stream")
    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/emails/sync")
async def sync_emails(folder: str = "INBOX"):
    """从邮箱同步邮件到本地库。"""
    try:
        emails = await asyncio.to_thread(EmailService().fetch_emails, folder, 20)
        return {"status": "success", "count": len(emails), "message": f"已从 {folder} 同步 {len(emails)} 封邮件"}
    except EmailSyncError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/emails/send")
async def send_email_endpoint(request: SendEmailRequest):
    """发送一封邮件。"""
    success = await asyncio.to_thread(EmailService().send_email, request.to_email, request.subject, request.body)
    if success:
        return {"status": "success", "message": "邮件发送成功"}
    raise HTTPException(status_code=500, detail="邮件发送失败")


@router.post("/emails/{email_id}/analyze")
async def analyze_single_email(email_id: str):
    """分析单封邮件并保存结果。"""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT body, subject, sender FROM emails WHERE id = ?", (email_id,))
        row = c.fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="邮件未找到")

        body = row["body"]
        email_label = format_email_label(dict(row))
        try:
            result = await asyncio.to_thread(analyze_email, email_id, body)
        except Exception as e:
            set_email_analysis_status(email_id, "failed", str(e))
            raise
        step_msg = f"邮件智能体：已分析邮件{email_label}"
        if result and result.get("item_name"):
            step_msg += f" -> {result.get('item_name')}"
        return {"status": "success", "data": result, "step": step_msg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/emails/analyze_all")
async def analyze_all_emails():
    """批量分析所有未分析邮件。"""
    try:
        unanalyzed = get_unanalyzed_emails()
        results = []
        for email in unanalyzed:
            email_label = format_email_label(email)
            try:
                res = await asyncio.to_thread(analyze_email, email["id"], email["body"])
                step_msg = f"邮件智能体：已分析邮件{email_label}"
                if res and res.get("item_name"):
                    step_msg += f" -> {res.get('item_name')}"
                results.append({"email_id": email["id"], "status": "success", "data": res, "step": step_msg})
            except Exception as e:
                set_email_analysis_status(email["id"], "failed", str(e))
                results.append({
                    "email_id": email["id"],
                    "status": "error",
                    "message": str(e),
                    "step": f"邮件智能体：分析邮件{email_label}失败：{str(e)}",
                })
        return {"status": "success", "processed_count": len(results), "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/emails/{email_id}/ignore")
async def ignore_email_endpoint(email_id: str, request: IgnoreEmailRequest):
    """把邮件标记为「已忽略」，可附带忽略理由。"""
    try:
        reason = (request.reason or "").strip()
        set_email_analysis_status(email_id, "ignored", reason or None)
        return {"status": "success", "email_id": email_id, "message": "邮件已忽略"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/emails/{email_id}/analysis")
async def get_email_analysis_endpoint(email_id: str):
    """返回某封邮件的分析记录。"""
    try:
        data = get_email_analysis(email_id)
        if data:
            return {"status": "success", "data": data}
        return {"status": "not_found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
