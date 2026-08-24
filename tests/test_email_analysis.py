"""邮件分析服务（services/emails.py）的校验分支测试。

LLM 提取层用 monkeypatch 替换成可控的假实现，聚焦测试：
非采购邮件拦截、物料不存在、预算缺失、以及成功落库后的状态流转。
"""
import pytest

import backend.services.emails as emails_service


@pytest.fixture()
def mock_extract(monkeypatch):
    """把 LLM 提取函数替换为可控的假实现。"""

    def _set(result):
        monkeypatch.setattr(emails_service, "analyze_email_content", lambda body: result)

    return _set


def _seed_email(conn, email_id="e1"):
    conn.execute(
        "INSERT INTO emails(id, subject, sender, body, folder) VALUES (?, ?, ?, ?, 'inbox')",
        (email_id, "主题", "sender@example.com", "正文"),
    )
    conn.commit()


def _seed_item(conn, item_id=1, name="无绳电钻", unit_price=120, vendor_id=1):
    conn.execute(
        "INSERT INTO items(id, name, unit_price, default_vendor_id) VALUES (?, ?, ?, ?)",
        (item_id, name, unit_price, vendor_id),
    )
    conn.commit()


def _seed_vendor(conn, vendor_id=1, name="测试供应商", email="vendor@example.com"):
    conn.execute(
        "INSERT INTO vendors(id, name, email, ext_score, approved) VALUES (?, ?, ?, 90, 1)",
        (vendor_id, name, email),
    )
    conn.commit()


def _valid_extraction(**overrides):
    data = {
        "item_name": "无绳电钻",
        "quantity": 10,
        "days_available": 14,
        "priority": "High",
        "summary": "需要采购无绳电钻",
        "budget": 5000.0,
        "is_procurement_request": True,
    }
    data.update(overrides)
    return data


def test_raises_when_extraction_fails(mock_extract, db_conn):
    _seed_email(db_conn)
    mock_extract(None)

    with pytest.raises(ValueError, match="无法从邮件中提取结构化数据"):
        emails_service.analyze_email("e1", "body")


def test_raises_when_not_procurement(mock_extract, db_conn):
    _seed_email(db_conn)
    mock_extract(_valid_extraction(is_procurement_request=False))

    with pytest.raises(ValueError, match="不是采购需求"):
        emails_service.analyze_email("e1", "body")


def test_raises_when_item_not_found(mock_extract, db_conn):
    _seed_email(db_conn)
    mock_extract(_valid_extraction(item_name="不存在的物料"))

    with pytest.raises(ValueError, match="在物料库中不存在"):
        emails_service.analyze_email("e1", "body")


def test_raises_when_budget_missing(mock_extract, db_conn):
    _seed_email(db_conn)
    _seed_vendor(db_conn)
    _seed_item(db_conn)
    mock_extract(_valid_extraction(budget=None))

    with pytest.raises(ValueError, match="预算"):
        emails_service.analyze_email("e1", "body")


def test_saves_analysis_on_success(mock_extract, db_conn):
    _seed_email(db_conn)
    _seed_vendor(db_conn)
    _seed_item(db_conn)
    mock_extract(_valid_extraction())

    result = emails_service.analyze_email("e1", "body")

    assert result is not None
    assert result["item_name"] == "无绳电钻"
    assert result["total_cost"] == 1200  # 120 * 10
    row = db_conn.execute("SELECT analysis_status FROM emails WHERE id = 'e1'").fetchone()
    assert row["analysis_status"] == "analyzed"
