"""数据库层函数测试：物料匹配、邮件状态流转、未分析邮件过滤。"""
from backend.database import (
    get_item_by_name,
    set_email_analysis_status,
    get_email_analyses_by_status,
    get_unanalyzed_emails,
    create_vendor,
    create_item,
)


def _seed_email(conn, email_id, *, folder="inbox", analysis_status=None):
    conn.execute(
        "INSERT INTO emails(id, subject, sender, body, folder, analysis_status) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (email_id, f"主题{email_id}", "s@example.com", "正文", folder, analysis_status),
    )
    conn.commit()


# ── get_item_by_name ──────────────────────────────

def test_get_item_by_name_exact_sku(db_conn):
    create_vendor(name="供应商A", email="a@example.com")
    create_item(name="冷轧钢板 2mm", sku="RAW-STEEL-2MM", unit="sheet", unit_price=45)

    item = get_item_by_name("RAW-STEEL-2MM")

    assert item is not None
    assert item["sku"] == "RAW-STEEL-2MM"


def test_get_item_by_name_fuzzy_name(db_conn):
    create_vendor(name="供应商A", email="a@example.com")
    create_item(name="冷轧钢板 2mm", sku="RAW-STEEL-2MM", unit="sheet", unit_price=45)

    item = get_item_by_name("冷轧钢板")

    assert item is not None
    assert item["name"] == "冷轧钢板 2mm"


def test_get_item_by_name_skips_sku_parenthesis(db_conn):
    create_vendor(name="供应商A", email="a@example.com")
    create_item(name="冷轧钢板 2mm", sku="RAW-STEEL-2MM", unit="sheet", unit_price=45)

    item = get_item_by_name("钢板 (SKU: RAW-STEEL-2MM)")

    assert item is not None
    assert item["sku"] == "RAW-STEEL-2MM"


def test_get_item_by_name_not_found(db_conn):
    assert get_item_by_name("不存在的物料") is None


# ── 邮件状态流转 ──────────────────────────────────

def test_set_email_analysis_status_and_query_by_status(db_conn):
    # 已分析且存在 email_analysis 记录的邮件
    _seed_email(db_conn, "e2", analysis_status="analyzed")
    _seed_email(db_conn, "e3", analysis_status="pending_review")
    db_conn.execute(
        "INSERT INTO email_analysis(email_id, item_name) VALUES ('e2', '物料B'), ('e3', '物料C')"
    )
    db_conn.commit()

    set_email_analysis_status("e2", "pending_review")

    pending = get_email_analyses_by_status("pending_review")
    ids = {r["email_id"] for r in pending}
    assert ids == {"e2", "e3"}


def test_set_email_analysis_status_with_error(db_conn):
    _seed_email(db_conn, "e1", analysis_status="analyzed")

    set_email_analysis_status("e1", "failed", "预算缺失")

    row = db_conn.execute(
        "SELECT analysis_status, analysis_error FROM emails WHERE id = 'e1'"
    ).fetchone()
    assert row["analysis_status"] == "failed"
    assert row["analysis_error"] == "预算缺失"


# ── 未分析邮件过滤（收件箱 + 无分析记录/失败状态）─

def test_unanalyzed_filter_includes_null_and_failed_inbox(db_conn):
    _seed_email(db_conn, "e1", folder="inbox")                       # NULL → 应包含
    _seed_email(db_conn, "e2", folder="inbox", analysis_status="failed")  # failed → 应包含
    _seed_email(db_conn, "e3", folder="inbox", analysis_status="analyzed")  # 已分析 → 排除
    _seed_email(db_conn, "e4", folder="sent")                        # 非 inbox → 排除

    emails = get_unanalyzed_emails()

    ids = {e["id"] for e in emails}
    assert ids == {"e1", "e2"}


def test_unanalyzed_excludes_emails_with_analysis_record(db_conn):
    _seed_email(db_conn, "e1", folder="inbox")
    db_conn.execute(
        "INSERT INTO email_analysis(email_id, item_name) VALUES ('e1', '测试物料')"
    )
    db_conn.commit()

    emails = get_unanalyzed_emails()

    assert [e["id"] for e in emails] == []
