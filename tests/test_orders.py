"""订单服务（services/orders.py）状态流转测试。

覆盖：发送邮件（草稿→已发送）、确认收货（已发送→已收货 + 库存增加）、
取消订单（草稿/已发送→已取消）以及各状态机的非法流转拒绝。
供应商不填邮箱时 send_order_email 会跳过 SMTP，因此测试无需网络。
"""
from backend.services.orders import send_order_email, receive_order, cancel_order


def _seed_vendor(conn, vendor_id=1, email=None):
    conn.execute(
        "INSERT INTO vendors(id, name, email, ext_score, approved) VALUES (?, ?, ?, 90, 1)",
        (vendor_id, "测试供应商", email),
    )
    conn.commit()


def _seed_item(conn, item_id=1, name="测试物料", unit_price=100):
    conn.execute(
        "INSERT INTO items(id, name, unit_price, default_vendor_id) VALUES (?, ?, ?, 1)",
        (item_id, name, unit_price),
    )
    conn.commit()


def _seed_order(conn, order_id, *, status="draft", item_id=1, qty=5, amount=500):
    conn.execute(
        "INSERT INTO orders(id, item_id, qty, vendor_id, amount, status) VALUES (?, ?, ?, 1, ?, ?)",
        (order_id, item_id, qty, amount, status),
    )
    conn.commit()


def test_send_order_email_marks_sent(db_conn):
    _seed_vendor(db_conn, email=None)  # 无供应商邮箱 → 跳过 SMTP
    _seed_item(db_conn)
    _seed_order(db_conn, 1, status="draft")

    result = send_order_email(1)

    assert result["status"] == "success"
    assert result["email_sent"] is False
    row = db_conn.execute("SELECT status FROM orders WHERE id = 1").fetchone()
    assert row["status"] == "sent"


def test_send_order_email_rejects_non_draft(db_conn):
    _seed_vendor(db_conn, email=None)
    _seed_item(db_conn)
    _seed_order(db_conn, 1, status="sent")

    result = send_order_email(1)

    assert result["status"] == "error"
    assert "仅草稿状态" in result["message"]


def test_send_order_email_order_not_found(db_conn):
    result = send_order_email(999)

    assert result["status"] == "error"
    assert "未找到" in result["message"]


def test_receive_order_increases_inventory(db_conn):
    _seed_vendor(db_conn, email=None)
    _seed_item(db_conn)
    _seed_order(db_conn, 1, status="sent", qty=5)
    db_conn.execute(
        "INSERT INTO inventory(item_id, qty_on_hand, min_qty, max_capacity) VALUES (1, 10, 5, 500)"
    )
    db_conn.commit()

    result = receive_order(1)

    assert result["status"] == "success"
    row = db_conn.execute("SELECT qty_on_hand FROM inventory WHERE item_id = 1").fetchone()
    assert row["qty_on_hand"] == 15  # 10 + 5
    status = db_conn.execute("SELECT status FROM orders WHERE id = 1").fetchone()
    assert status["status"] == "received"


def test_receive_order_creates_inventory_when_missing(db_conn):
    _seed_vendor(db_conn, email=None)
    _seed_item(db_conn)
    _seed_order(db_conn, 1, status="sent", qty=3)

    result = receive_order(1)

    assert result["status"] == "success"
    row = db_conn.execute("SELECT qty_on_hand FROM inventory WHERE item_id = 1").fetchone()
    assert row["qty_on_hand"] == 3


def test_receive_order_recovers_null_current_stock(db_conn):
    _seed_vendor(db_conn, email=None)
    _seed_item(db_conn)
    _seed_order(db_conn, 1, status="sent", qty=3)
    db_conn.execute(
        "INSERT INTO inventory(item_id, qty_on_hand, min_qty, max_capacity) VALUES (1, NULL, NULL, NULL)"
    )
    db_conn.commit()

    result = receive_order(1)

    assert result["status"] == "success"
    row = db_conn.execute("SELECT qty_on_hand FROM inventory WHERE item_id = 1").fetchone()
    assert row["qty_on_hand"] == 3


def test_receive_order_rejects_non_sent(db_conn):
    _seed_vendor(db_conn, email=None)
    _seed_item(db_conn)
    _seed_order(db_conn, 1, status="draft")

    result = receive_order(1)

    assert result["status"] == "error"
    assert "仅已发送状态" in result["message"]


def test_cancel_order_from_draft(db_conn):
    _seed_vendor(db_conn, email=None)
    _seed_item(db_conn)
    _seed_order(db_conn, 1, status="draft")

    result = cancel_order(1)

    assert result["status"] == "success"
    row = db_conn.execute("SELECT status FROM orders WHERE id = 1").fetchone()
    assert row["status"] == "cancelled"


def test_cancel_order_rejects_received(db_conn):
    _seed_vendor(db_conn, email=None)
    _seed_item(db_conn)
    _seed_order(db_conn, 1, status="received")

    result = cancel_order(1)

    assert result["status"] == "error"
    assert "不可取消" in result["message"]
