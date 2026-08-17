import imaplib
import smtplib
import email
import json
import os
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


class EmailService:
    def __init__(self):
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

            imap_folder = folder
            if folder.lower() == "sent":
                imap_folder = '"[Gmail]/Sent Mail"'
            elif folder.lower() == "trash":
                imap_folder = '"[Gmail]/Trash"'
            elif folder.lower() == "drafts":
                imap_folder = '"[Gmail]/Drafts"'

            status, _ = mail.select(imap_folder)
            if status != "OK":
                return []

            status, data = mail.search(None, "ALL")
            mail_ids = data[0].split()
            latest_email_ids = mail_ids[-limit:]
            latest_email_ids.reverse()

            email_list = []
            for i in latest_email_ids:
                try:
                    status, msg_data = mail.fetch(i, "(RFC822)")
                    for response_part in msg_data:
                        if isinstance(response_part, tuple):
                            msg = email.message_from_bytes(response_part[1])
                            subject, encoding = decode_header(msg["Subject"])[0]
                            if isinstance(subject, bytes):
                                subject = subject.decode(encoding if encoding else "utf-8")
                            sender = msg.get("From")
                            date = msg.get("Date")

                            body = ""
                            if msg.is_multipart():
                                for part in msg.walk():
                                    content_type = part.get_content_type()
                                    content_disposition = str(part.get("Content-Disposition"))
                                    try:
                                        payload = part.get_payload(decode=True)
                                        if payload and content_type == "text/plain" and "attachment" not in content_disposition:
                                            body += payload.decode(errors="ignore")
                                    except Exception:
                                        pass
                            else:
                                try:
                                    payload = msg.get_payload(decode=True)
                                    if payload:
                                        body = payload.decode(errors="ignore")
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
            save_emails(email_list)
            return email_list
        except Exception as e:
            print(f"IMAP Error: {e}")
            return []

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
