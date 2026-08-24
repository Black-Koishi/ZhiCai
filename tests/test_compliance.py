"""合规检查（run_gatekeeper_checks）规则测试。

覆盖：库存上限/下限提醒、订单金额政策、供应商批准与评分、预算、
重复在途与数量异常等软提醒。
"""
from backend.agents.compliance import run_gatekeeper_checks


def _seed_policies(conn, **kv):
    for key, value in kv.items():
        conn.execute("INSERT OR REPLACE INTO policies(key, value) VALUES (?, ?)", (key, str(value)))
    conn.commit()


def _seed_vendor(conn, vendor_id=1, *, approved=1, ext_score=90):
    conn.execute(
        "INSERT INTO vendors(id, name, approved, ext_score) VALUES (?, ?, ?, ?)",
        (vendor_id, f"供应商{vendor_id}", approved, ext_score),
    )
    conn.commit()


def _seed_inventory(conn, item_id=1, *, qty_on_hand=100, min_qty=50, max_capacity=5000):
    conn.execute(
        "INSERT INTO inventory(item_id, qty_on_hand, min_qty, max_capacity) VALUES (?, ?, ?, ?)",
        (item_id, qty_on_hand, min_qty, max_capacity),
    )
    conn.commit()


def _seed_order(conn, order_id, *, item_id=1, qty=10, status="draft"):
    conn.execute(
        "INSERT INTO orders(id, item_id, qty, amount, status, vendor_id) VALUES (?, ?, ?, 1000, ?, 1)",
        (order_id, item_id, qty, status),
    )
    conn.commit()


def _base_analysis(**overrides):
    analysis = {
        "item_id": 1,
        "vendor_id": 1,
        "item_name": "测试物料",
        "quantity": 10,
        "total_cost": 1000,
        "priority": "Low",
        "budget": 5000,
    }
    analysis.update(overrides)
    return analysis


def test_passes_when_all_rules_ok(db_conn):
    _seed_vendor(db_conn, ext_score=90)
    _seed_inventory(db_conn, qty_on_hand=100, min_qty=50, max_capacity=5000)
    _seed_policies(db_conn, max_single_order_amount=100000, min_vendor_score=80)

    result = run_gatekeeper_checks(_base_analysis())

    assert result["passed"] is True
    assert result["failures"] == []
    assert result["warnings"] == []


def test_fails_when_inventory_exceeds_capacity(db_conn):
    _seed_vendor(db_conn)
    _seed_inventory(db_conn, qty_on_hand=100, min_qty=50, max_capacity=105)
    _seed_policies(db_conn, max_single_order_amount=100000, min_vendor_score=80)

    result = run_gatekeeper_checks(_base_analysis(quantity=10))  # 100 + 10 > 105

    assert result["passed"] is False
    assert any("超过最大容量" in f for f in result["failures"])


def test_fails_when_item_missing_from_inventory(db_conn):
    _seed_vendor(db_conn)
    _seed_policies(db_conn, max_single_order_amount=100000, min_vendor_score=80)

    result = run_gatekeeper_checks(_base_analysis(item_id=999))

    assert result["passed"] is False
    assert any("未找到 item_id=999" in f for f in result["failures"])


def test_fails_when_no_item_id(db_conn):
    _seed_policies(db_conn, max_single_order_amount=100000, min_vendor_score=80)

    result = run_gatekeeper_checks(_base_analysis(item_id=None))

    assert result["passed"] is False
    assert any("目录中未找到该物品" in f for f in result["failures"])


def test_warns_when_stock_above_3x_min(db_conn):
    _seed_vendor(db_conn)
    _seed_inventory(db_conn, qty_on_hand=200, min_qty=50, max_capacity=5000)
    _seed_policies(db_conn, max_single_order_amount=100000, min_vendor_score=80)

    result = run_gatekeeper_checks(_base_analysis())

    assert result["passed"] is True
    assert any("高于最小阈值三倍" in w for w in result["warnings"])


def test_fails_when_amount_exceeds_policy(db_conn):
    _seed_vendor(db_conn)
    _seed_inventory(db_conn)
    _seed_policies(db_conn, max_single_order_amount=500, min_vendor_score=80)

    result = run_gatekeeper_checks(_base_analysis(total_cost=1000))

    assert result["passed"] is False
    assert any("超出单笔上限" in f for f in result["failures"])


def test_fails_when_vendor_not_approved(db_conn):
    _seed_vendor(db_conn, approved=0)
    _seed_inventory(db_conn)
    _seed_policies(db_conn, max_single_order_amount=100000, min_vendor_score=80)

    result = run_gatekeeper_checks(_base_analysis())

    assert result["passed"] is False
    assert any("未获批准" in f for f in result["failures"])


def test_fails_when_vendor_score_below_min(db_conn):
    _seed_vendor(db_conn, ext_score=70)
    _seed_inventory(db_conn)
    _seed_policies(db_conn, max_single_order_amount=100000, min_vendor_score=80)

    result = run_gatekeeper_checks(_base_analysis())

    assert result["passed"] is False
    assert any("低于最低要求" in f for f in result["failures"])


def test_fails_when_over_budget(db_conn):
    _seed_vendor(db_conn)
    _seed_inventory(db_conn)
    _seed_policies(db_conn, max_single_order_amount=100000, min_vendor_score=80)

    result = run_gatekeeper_checks(_base_analysis(total_cost=1000, budget=500))

    assert result["passed"] is False
    assert any("超出申请方预算" in f for f in result["failures"])


def test_warns_on_open_duplicate_orders(db_conn):
    _seed_vendor(db_conn)
    _seed_inventory(db_conn)
    _seed_policies(db_conn, max_single_order_amount=100000, min_vendor_score=80)
    _seed_order(db_conn, 1, status="draft")

    result = run_gatekeeper_checks(_base_analysis())

    assert result["passed"] is True
    assert any("重复在途" in w for w in result["warnings"])


def test_warns_on_quantity_anomaly(db_conn):
    _seed_vendor(db_conn)
    _seed_inventory(db_conn)
    _seed_policies(db_conn, max_single_order_amount=100000, min_vendor_score=80)
    _seed_order(db_conn, 1, qty=10, status="received")

    result = run_gatekeeper_checks(_base_analysis(quantity=60))  # 60 > 5 * 10

    assert result["passed"] is True
    assert any("数量异常" in w for w in result["warnings"])


def test_warns_on_high_priority_delivery_risk(db_conn):
    _seed_vendor(db_conn)
    _seed_inventory(db_conn)
    _seed_policies(db_conn, max_single_order_amount=100000, min_vendor_score=80)
    _seed_order(db_conn, 1, qty=10, status="received")

    result = run_gatekeeper_checks(_base_analysis(quantity=25, priority="High"))  # 25 > 2 * 10

    assert result["passed"] is True
    assert any("交期风险" in w for w in result["warnings"])
