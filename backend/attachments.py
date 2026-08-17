"""附件本地存储。

解耦邮件源（Mailpit / IMAP）：同步时把附件内容下载到本地落盘，
下载接口只从本地读取，不再依赖具体邮件服务的 API。
"""
import os
import re
from pathlib import Path

ATTACHMENTS_DIR = Path(__file__).resolve().parent / "data" / "attachments"


def _safe_name(name: str) -> str:
    """把文件名里的路径分隔符等危险字符替换为下划线。"""
    return re.sub(r"[^\w.\-]", "_", name)


def storage_key(email_id: str, index: int, filename: str) -> str:
    """生成一个唯一、安全的本地存储键。"""
    return f"{email_id}_{index}_{_safe_name(filename)}"


def save(email_id: str, index: int, filename: str, content: bytes) -> str:
    """保存附件到本地，返回 storage_key。"""
    ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)
    key = storage_key(email_id, index, filename)
    with open(ATTACHMENTS_DIR / key, "wb") as f:
        f.write(content)
    return key


def read(key: str) -> bytes | None:
    """读取本地附件内容；key 需通过校验，防止路径穿越。"""
    if not key or key != os.path.basename(key) or ".." in key:
        return None
    path = ATTACHMENTS_DIR / key
    if not path.is_file():
        return None
    return path.read_bytes()
