"""往 Mailpit 模拟邮箱发一封邮件（模拟供应商发来采购需求）。

用法：
    python scripts/deliver_mock_email.py
    python scripts/deliver_mock_email.py --sender "sales@abc.com" --subject "采购需求" --body "请订购 5 件冷轧钢板 2mm"
"""
import argparse
import smtplib
from email.mime.text import MIMEText

SMTP_HOST = "localhost"
SMTP_PORT = 1025


def main():
    parser = argparse.ArgumentParser(description="往 Mailpit 发一封邮件（模拟供应商采购需求）")
    parser.add_argument("--sender", default="sales@vertexindustrial.com", help="发件人")
    parser.add_argument("--to", default="procurement@aurora.com", help="收件人")
    parser.add_argument("--subject", default="采购需求 - 冷轧钢板", help="主题")
    parser.add_argument("--body", default="您好，请订购 10个人体工学办公椅，预算1000000元, 需求 100 天内到货。", help="正文")
    args = parser.parse_args()

    msg = MIMEText(args.body, "plain", "utf-8")
    msg["From"] = args.sender
    msg["To"] = args.to
    msg["Subject"] = args.subject

    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
    server.sendmail(args.sender, [args.to], msg.as_string())
    server.quit()
    print(f"已发送邮件到 Mailpit：{args.subject}")


if __name__ == "__main__":
    main()
