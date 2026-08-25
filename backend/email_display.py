"""面向用户的邮件展示文案。"""
from collections.abc import Mapping
from typing import Any


def format_email_label(email: Mapping[str, Any]) -> str:
    """用发件人和主题标识邮件，避免向用户暴露内部 ID。"""
    sender = str(email.get("sender") or email.get("email_sender") or "").strip() or "未知发件人"
    subject = str(email.get("subject") or email.get("email_subject") or "").strip() or "无主题"
    return f"「{sender} · {subject}」"
