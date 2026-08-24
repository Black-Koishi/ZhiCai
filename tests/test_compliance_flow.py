"""合规统一入口（run_compliance_and_record）测试。

验证批量节点 / 单邮件 API / 按物品名 API 共用的统一合规函数：
修复缺失映射 → 运行检查 → 存解释 → 更新状态 → 失败通知。
"""
import pytest

import backend.services.compliance as compliance_service
from backend.services.compliance import run_compliance_and_record
from backend.database import get_email_analysis


@pytest.fixture(autouse=True)
def _no_llm(monkeypatch):
    """测试不调用真实 LLM：用确定性规则替换 explain_compliance_result。"""

    def fake_explain(analysis, gate_result):
        failures = gate_result.get("failures", [])
        warnings = gate_result.get("warnings", [])
        return {
            "risk_level": "高" if failures else ("中" if warnings else "低"),
            "risk_points": (failures + warnings)[:4],
            "suggestions": [],
        }

    monkeypatch.setattr(compliance_service, "explain_compliance_result", fake_explain)


def _seed_email(conn, email_id="e1", analysis_status="analyzed"):
    conn.execute(
        "INSERT INTO emails(id, subject, sender, body, folder, analysis_status) "
        "VALUES (?, '主题', 's@example.com', '正文', 'inbox', ?)",
        (email_id, analysis_status),
    )
    conn.commit()


def _seed_vendor(conn, vendor_id=1, *, approved=1, ext_score=90):
    conn.execute(
        "INSERT INTO vendors(id, name, approved, ext_score) VALUES (?, '测试供应商', ?, ?)",
        (vendor_id, approved, ext_score),
    )
    conn.commit()


def _seed_item(conn, item_id=1, name="无绳电钻", unit_price=120, vendor_id=1):
    conn.execute(
        "INSERT INTO items(id, name, unit_price, default_vendor_id) VALUES (?, ?, ?, ?)",
        (item_id, name, unit_price, vendor_id),
    )
    conn.commit()


def _seed_inventory(conn, item_id=1, qty_on_hand=100, min_qty=50, max_capacity=5000):
    conn.execute(
        "INSERT INTO inventory(item_id, qty_on_hand, min_qty, max_capacity) VALUES (?, ?, ?, ?)",
        (item_id, qty_on_hand, min_qty, max_capacity),
    )
    conn.commit()


def _seed_analysis(conn, email_id="e1", *, item_id=1, vendor_name="测试供应商", vendor_id=1, total_cost=1200):
    conn.execute(
        "INSERT INTO email_analysis(email_id, item_id, item_name, item_quantity, vendor_name, vendor_id, total_cost, priority, budget) "
        "VALUES (?, ?, '无绳电钻', 10, ?, ?, ?, 'Low', 5000)",
        (email_id, item_id, vendor_name, vendor_id, total_cost),
    )
    conn.commit()


def _status(conn, email_id="e1"):
    return conn.execute("SELECT analysis_status FROM emails WHERE id = ?", (email_id,)).fetchone()["analysis_status"]


def test_passed_sets_pending_review(db_conn, monkeypatch):
    _seed_email(db_conn)
    _seed_vendor(db_conn)
    _seed_item(db_conn)
    _seed_inventory(db_conn)
    _seed_analysis(db_conn)
    notified = []
    monkeypatch.setattr(compliance_service, "send_cancel_notification", lambda *a, **k: notified.append(a))

    result = run_compliance_and_record("e1", get_email_analysis("e1"))

    assert result["passed"] is True
    assert _status(db_conn) == "pending_review"
    assert notified == []


def test_failed_sets_failed_compliance_and_notifies(db_conn, monkeypatch):
    _seed_email(db_conn)
    _seed_vendor(db_conn)
    _seed_item(db_conn)
    _seed_inventory(db_conn)
    _seed_analysis(db_conn)
    db_conn.execute("UPDATE email_analysis SET budget = 100 WHERE email_id = 'e1'")
    db_conn.commit()
    notified = []
    monkeypatch.setattr(
        compliance_service,
        "send_cancel_notification",
        lambda email_id, reason: notified.append((email_id, reason)),
    )

    result = run_compliance_and_record("e1", get_email_analysis("e1"))

    assert result["passed"] is False
    assert _status(db_conn) == "failed_compliance"
    assert len(notified) == 1
    assert notified[0][0] == "e1"
    assert "超出" in notified[0][1] or "预算" in notified[0][1]


def test_repairs_missing_vendor_before_compliance(db_conn):
    """缺供应商、金额旧的分析记录：统一入口先修复映射，再带着修复后的数据做检查。"""
    _seed_email(db_conn)
    _seed_vendor(db_conn)
    _seed_item(db_conn)
    _seed_inventory(db_conn)
    _seed_analysis(db_conn, vendor_name=None, vendor_id=None, total_cost=0)

    # 等价于批量节点从库中取到的「原始存储行」（未修复）
    raw = dict(db_conn.execute("SELECT * FROM email_analysis WHERE email_id = 'e1'").fetchone())
    assert raw["vendor_name"] is None

    result = run_compliance_and_record("e1", raw)

    # 修复已写回数据库：供应商补齐、金额按目录价重算
    fixed = get_email_analysis("e1")
    assert fixed["vendor_name"] == "测试供应商"
    assert fixed["total_cost"] == 1200  # 10 * 120
    # 修复后供应商检查真实执行（approved=1, score=90 → 通过），最终待审核
    assert result["passed"] is True
    assert _status(db_conn) == "pending_review"


def test_batch_style_raw_rows_also_repaired(db_conn):
    """批量节点的取数（get_email_analyses_by_status）同样会经过修复，与单邮件路径一致。"""
    _seed_email(db_conn)
    _seed_vendor(db_conn)
    _seed_item(db_conn)
    _seed_inventory(db_conn)
    _seed_analysis(db_conn, vendor_name=None, vendor_id=None, total_cost=0)

    from backend.database import get_email_analyses_by_status

    rows = get_email_analyses_by_status("analyzed")

    assert len(rows) == 1
    assert rows[0]["vendor_name"] == "测试供应商"
    assert rows[0]["total_cost"] == 1200
