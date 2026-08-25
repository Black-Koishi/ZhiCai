"""物料编辑 API 的库存空值与部分更新测试。"""
from fastapi.testclient import TestClient

from backend.api import app


def _seed_item(conn, item_id=1):
    conn.execute(
        "INSERT INTO items(id, name, sku, unit, unit_price) VALUES (?, ?, ?, ?, ?)",
        (item_id, "测试物料", "TEST-001", "件", 10),
    )
    conn.commit()


def test_update_item_keeps_missing_inventory_when_nulls_are_submitted(db_conn):
    _seed_item(db_conn)
    client = TestClient(app)

    response = client.put(
        "/items/1",
        json={
            "name": "测试物料（已编辑）",
            "unit": "箱",
            "unit_price": 12.5,
            "vendor_id": None,
            "qty_on_hand": None,
            "min_qty": None,
            "max_capacity": None,
        },
    )

    assert response.status_code == 200
    item = db_conn.execute(
        "SELECT name, unit, unit_price, default_vendor_id FROM items WHERE id = 1"
    ).fetchone()
    assert dict(item) == {
        "name": "测试物料（已编辑）",
        "unit": "箱",
        "unit_price": 12.5,
        "default_vendor_id": None,
    }
    inventory = db_conn.execute(
        "SELECT * FROM inventory WHERE item_id = 1"
    ).fetchone()
    assert inventory is None


def test_update_item_only_writes_inventory_fields_with_values(db_conn):
    _seed_item(db_conn)
    client = TestClient(app)

    response = client.put(
        "/items/1",
        json={
            "name": "测试物料",
            "qty_on_hand": 12,
            "min_qty": None,
            "max_capacity": None,
        },
    )

    assert response.status_code == 200
    inventory = db_conn.execute(
        "SELECT qty_on_hand, min_qty, max_capacity FROM inventory WHERE item_id = 1"
    ).fetchone()
    assert dict(inventory) == {
        "qty_on_hand": 12,
        "min_qty": 0,
        "max_capacity": 0,
    }


def test_update_item_rejects_negative_inventory_values(db_conn):
    _seed_item(db_conn)
    client = TestClient(app)

    response = client.put(
        "/items/1",
        json={"name": "测试物料", "qty_on_hand": -1},
    )

    assert response.status_code == 422
