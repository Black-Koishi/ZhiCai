import imaplib
import smtplib
import email
import json
import os
import re
import urllib.request
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.header import decode_header
from dotenv import load_dotenv
from backend.database import save_emails
from backend.attachments import save as save_attachment

# Load environment variables
load_dotenv()


NETEASE_IMAP_SERVERS = {"imap.163.com", "imap.126.com", "imap.yeah.net"}


class EmailSyncError(RuntimeError):
    """邮箱服务器连接、认证或文件夹访问失败。"""


def _imap_response_text(data):
    """将 IMAP 响应安全地整理为可展示文本。"""
    if not data:
        return "未知原因"
    parts = []
    for value in data if isinstance(data, (list, tuple)) else [data]:
        if isinstance(value, bytes):
            parts.append(value.decode("utf-8", errors="replace"))
        elif value is not None:
            parts.append(str(value))
    return " ".join(parts) or "未知原因"


def _send_imap_client_id(mail, support_email):
    """向网易邮箱发送 RFC 2971 ID，避免被判定为 Unsafe Login。"""
    imaplib.Commands.setdefault("ID", ("AUTH",))
    safe_email = (support_email or "").replace("\\", "\\\\").replace('"', '\\"')
    payload = (
        '("name" "ZhiCai" "version" "1.0" "vendor" "ZhiCai" '
        f'"support-email" "{safe_email}")'
    )
    status, data = mail._simple_command("ID", payload)
    if status != "OK":
        raise EmailSyncError(f"邮箱服务器拒绝客户端标识：{_imap_response_text(data)}")


def _decode_mime_header(value):
    """解码 MIME 编码的邮件头（如 =?gb18030?B?...?=）。"""
    if not value:
        return ""
    try:
        parts = decode_header(value)
    except Exception:
        return str(value)
    out = []
    for part, charset in parts:
        if isinstance(part, bytes):
            try:
                out.append(part.decode(charset or "utf-8", errors="replace"))
            except (LookupError, UnicodeDecodeError):
                out.append(part.decode("utf-8", errors="replace"))
        else:
            out.append(part)
    return "".join(out)


def _decode_body_payload(payload, charset):
    """按声明字符集解码正文，回退到 utf-8 / gb18030。"""
    if not payload:
        return ""
    for enc in (charset, "utf-8", "gb18030"):
        if not enc:
            continue
        try:
            return payload.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return payload.decode("utf-8", errors="replace")


class EmailService:
    def __init__(self):
        """初始化邮箱配置：每次实例化动态读取环境变量。"""
        # 每次实例化时动态读取配置，保存后无需重启即可生效
        self.email_user = os.getenv("EMAIL_USER")
        self.email_pass = os.getenv("EMAIL_PASS")
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.imap_server = os.getenv("IMAP_SERVER", "imap.gmail.com")
        self.imap_port = int(os.getenv("IMAP_PORT", "993"))
        # 自动识别 Mailpit：SMTP 指向本机 1025 端口即视为模拟邮箱
        self.mock = self.smtp_server in ("localhost", "127.0.0.1") and self.smtp_port == 1025
        self.mailpit_http = os.getenv("MAILPIT_HTTP", "http://localhost:8025")

    # ── 收邮件 ──────────────────────────────────────────
    def fetch_emails(self, folder="INBOX", limit=20):
        """从邮箱拉取邮件并存入系统 emails 表，返回邮件列表。"""
        if self.mock:
            return self._mailpit_fetch(folder, limit)

        try:
            mail = imaplib.IMAP4_SSL(self.imap_server, self.imap_port)
            mail.login(self.email_user, self.email_pass)
            if self.imap_server.lower() in NETEASE_IMAP_SERVERS:
                _send_imap_client_id(mail, self.email_user)

            # 不同邮箱对「已发送/已删除/草稿」文件夹命名不同，先动态发现，再回退到常见名称
            def _find_folder(keywords, special_use_flag=None):
                """按标准用途标记或名称关键词查找 IMAP 文件夹。"""
                try:
                    status, folders = mail.list()
                    if status == "OK":
                        for line in folders:
                            text = line.decode("utf-8", errors="ignore") if isinstance(line, bytes) else str(line)
                            names = re.findall(r'"([^"]*)"', text)
                            if names:
                                name = names[-1]
                                flags_match = re.match(r"^\(([^)]*)\)", text)
                                flags = {
                                    flag.lower()
                                    for flag in flags_match.group(1).split()
                                } if flags_match else set()
                                matches_special_use = (
                                    special_use_flag is not None
                                    and special_use_flag.lower() in flags
                                )
                                matches_name = any(k in name.lower() for k in keywords)
                                if matches_special_use or matches_name:
                                    # 含空格等特殊字符的文件夹名需加双引号
                                    return f'"{name}"'
                except Exception:
                    pass
                return None

            key = folder.lower()
            if key == "sent":
                imap_folder = _find_folder(["sent"], "\\sent") or '"[Gmail]/Sent Mail"'
            elif key == "trash":
                imap_folder = _find_folder(["trash", "deleted"], "\\trash") or '"[Gmail]/Trash"'
            elif key == "drafts":
                imap_folder = _find_folder(["draft"], "\\drafts") or '"[Gmail]/Drafts"'
            else:
                # inbox 等标准文件夹：INBOX 大小写不敏感，直接按原名选择
                imap_folder = folder

            status, select_data = mail.select(imap_folder)
            if status != "OK":
                reason = _imap_response_text(select_data)
                raise EmailSyncError(f"邮箱服务器拒绝访问文件夹 {folder}：{reason}")

            status, data = mail.uid("SEARCH", None, "ALL")
            mail_ids = data[0].split()
            latest_email_ids = mail_ids[-limit:]
            latest_email_ids.reverse()

            email_list = []
            for i in latest_email_ids:
                try:
                    status, msg_data = mail.uid("FETCH", i, "(RFC822)")
                    for response_part in msg_data:
                        if isinstance(response_part, tuple):
                            msg = email.message_from_bytes(response_part[1])
                            subject = _decode_mime_header(msg["Subject"])
                            sender = _decode_mime_header(msg.get("From"))
                            date = msg.get("Date")

                            body = ""
                            if msg.is_multipart():
                                for part in msg.walk():
                                    content_type = part.get_content_type()
                                    content_disposition = str(part.get("Content-Disposition"))
                                    try:
                                        payload = part.get_payload(decode=True)
                                        if payload and content_type == "text/plain" and "attachment" not in content_disposition:
                                            charset = part.get_content_charset()
                                            body += _decode_body_payload(payload, charset)
                                    except Exception:
                                        pass
                            else:
                                try:
                                    payload = msg.get_payload(decode=True)
                                    charset = msg.get_content_charset()
                                    body = _decode_body_payload(payload, charset)
                                except Exception:
                                    pass

                            if not body:
                                body = "(无文本内容)"

                            email_list.append({
                                "id": str(int(i)),
                                "subject": subject,
                                "sender": sender,
                                "date": date,
                                "body": body[:500] + "..." if len(body) > 500 else body,
                                "folder": folder,
                            })
                except Exception as e:
                    print(f"解析邮件 {i} 出错: {e}")
                    continue

            mail.close()
            mail.logout()
            # 保存邮件到数据库
            save_emails(email_list)
            return email_list
        except EmailSyncError:
            raise
        except Exception as e:
            raise EmailSyncError(f"邮箱连接或认证失败：{e}") from e

    def _mailpit_fetch(self, folder="inbox", limit=20):
        """Mailpit 模式：通过 HTTP API 读取捕获的邮件。"""
        try:
            with urllib.request.urlopen(f"{self.mailpit_http}/api/v1/messages?limit={limit}", timeout=10) as resp:
                data = json.loads(resp.read())
        except Exception as e:
            print(f"Mailpit 读取失败: {e}")
            return []

        is_sent = folder.lower() == "sent"
        email_list = []
        for m in data.get("messages", []):
            mid = m.get("ID")
            # 获取详情（含正文）
            detail = {}
            try:
                with urllib.request.urlopen(f"{self.mailpit_http}/api/v1/message/{mid}", timeout=10) as resp2:
                    detail = json.loads(resp2.read())
            except Exception:
                pass

            from_addr = ""
            if isinstance(detail.get("From"), dict):
                from_addr = detail["From"].get("Address", "")
            elif isinstance(m.get("From"), dict):
                from_addr = m["From"].get("Address", "")

            is_system_sent = from_addr == "system@mailpit.local"

            if is_sent:
                # 已发送：只保留系统发出的邮件，并把「发给谁」作为显示的发件人
                if not is_system_sent:
                    continue
                to_addr = ""
                to_list = detail.get("To") or m.get("To")
                if isinstance(to_list, list) and to_list:
                    first = to_list[0]
                    if isinstance(first, dict):
                        to_addr = first.get("Address", "")
                    else:
                        to_addr = str(first)
                display_sender = to_addr or from_addr
            else:
                # 收件箱等：过滤掉系统发出的邮件（只保留「收到」的邮件）
                if is_system_sent:
                    continue
                display_sender = from_addr

            # 提取附件：下载内容到本地存储，记录中性元信息（不依赖 Mailpit 的 part_id）
            attachments = []
            for idx, att in enumerate(detail.get("Attachments") or []):
                if not isinstance(att, dict):
                    continue
                filename = att.get("FileName", "")
                part_id = att.get("PartID", "")
                content_type = att.get("ContentType", "application/octet-stream")
                size = att.get("Size", 0)
                key = None
                if part_id != "" and filename:
                    try:
                        with urllib.request.urlopen(
                            f"{self.mailpit_http}/api/v1/message/{mid}/part/{part_id}", timeout=15
                        ) as part_resp:
                            content = part_resp.read()
                        key = save_attachment(str(mid), idx, filename, content)
                    except Exception:
                        key = None
                attachments.append({
                    "filename": filename,
                    "content_type": content_type,
                    "size": size,
                    "storage_key": key,
                })

            body = detail.get("Text", "") or detail.get("HTML", "") or "(无文本内容)"
            email_list.append({
                "id": str(mid),
                "subject": m.get("Subject", "") or detail.get("Subject", ""),
                "sender": display_sender,
                "date": m.get("Date", "") or detail.get("Date", ""),
                "body": body[:500] + "..." if len(body) > 500 else body,
                "folder": folder.lower(),
                "attachments": attachments,
            })

        save_emails(email_list)
        return email_list

    # ── 发邮件 ──────────────────────────────────────────
    def send_email(self, to_email, subject, body, attachments=None):
        """发送邮件。attachments: [(文件名, 字节内容), ...]"""
        msg = MIMEMultipart()
        msg["From"] = "system@mailpit.local" if self.mock else self.email_user
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        for filename, content in (attachments or []):
            ext = os.path.splitext(filename)[1].lower().lstrip(".") or "octet-stream"
            part = MIMEApplication(content, _subtype=ext, Name=filename)
            part["Content-Disposition"] = f'attachment; filename="{filename}"'
            msg.attach(part)

        if self.mock:
            return self._mailpit_send(to_email, msg)

        try:
            if self.smtp_port == 465:
                # 465：隐式 SSL（QQ、网易等）
                server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port)
            else:
                # 587：STARTTLS（Gmail、Outlook 等）
                server = smtplib.SMTP(self.smtp_server, self.smtp_port)
                server.starttls()
            server.login(self.email_user, self.email_pass)
            server.sendmail(self.email_user, to_email, msg.as_string())
            server.quit()
            return True
        except Exception as e:
            print(f"SMTP Error: {e}")
            return False

    def _mailpit_send(self, to_email, msg):
        """Mailpit 模式：通过 SMTP（无加密无认证）发送到本地 Mailpit。"""
        try:
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.sendmail(msg["From"], [to_email], msg.as_string())
            server.quit()
            return True
        except Exception as e:
            print(f"Mailpit SMTP Error: {e}")
            return False
