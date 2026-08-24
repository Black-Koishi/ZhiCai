"""插入测试邮件，用于在没有真实邮箱时测试采购全流程。

用法:
    python scripts/insert_test_email.py

插入后，到前端:
    1. 聊天框输入「分析邮件」    -> 邮件智能体提取需求并保存
    2. 聊天框输入「运行合规检查」 -> 规则审核，通过后进入待人工审核
    3. 在待审核状态中确认下单       -> 创建订单并生成 PDF
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "backend" / "data" / "procurement.db"

# 三条测试邮件，覆盖「通过」和「拦截」两种场景
TEST_EMAILS = [
    {
        "id": "9001",
        "subject": "Purchase request - Lithium-ion Battery Pack",
        "sender": "procurement@aurora.com",
        "date": "2026-08-17",
        "body": "Hi, we need to order 5 units of Lithium-ion Battery Pack 75kWh Model X, required within 15 days. Please process this order.",
        "folder": "inbox",
    },
    {
        "id": "9002",
        "subject": "Urgent order - battery pack",
        "sender": "procurement@aurora.com",
        "date": "2026-08-17",
        "body": "We need to order 20 units of Lithium-ion Battery Pack 75kWh Model X, needed within 10 days.",
        "folder": "inbox",
    },
    {
        "id": "9003",
        "subject": "Brake pads order",
        "sender": "procurement@aurora.com",
        "date": "2026-08-17",
        "body": "Please order 10 sets of Brake Pad Set Model X Front, required in 20 days.",
        "folder": "inbox",
    },
]


def main():
    conn = sqlite3.connect(str(DB_PATH))
    for e in TEST_EMAILS:
        conn.execute(
            "INSERT OR REPLACE INTO emails(id, subject, sender, date, body, folder) VALUES (?,?,?,?,?,?)",
            (e["id"], e["subject"], e["sender"], e["date"], e["body"], e["folder"]),
        )
    conn.commit()
    total = conn.execute("SELECT COUNT(*) FROM emails").fetchone()[0]
    conn.close()

    print(f"已插入 {len(TEST_EMAILS)} 条测试邮件，emails 表现有 {total} 条。")
    for e in TEST_EMAILS:
        print(f"  - [{e['id']}] {e['subject']}")


if __name__ == "__main__":
    main()
