"""pytest 共享夹具：为每个测试提供独立的临时 SQLite 数据库。

原理：把 backend.database.DB_NAME 指向临时文件。
现有代码（database.py / services / agents）全部通过 get_db_connection()
读取该模块级变量来建立连接，因此无需修改任何业务代码即可隔离测试数据。
"""
import sqlite3

import pytest

# 与 scripts/db_init.py 中的 DDL 保持一致（仅建表，不播种数据）
SCHEMA = """
CREATE TABLE IF NOT EXISTS vendors(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  category TEXT,
  approved INTEGER DEFAULT 1,
  ext_score REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT,
  unit TEXT,
  unit_price REAL DEFAULT 0,
  default_vendor_id INTEGER,
  FOREIGN KEY(default_vendor_id) REFERENCES vendors(id)
);
CREATE TABLE IF NOT EXISTS inventory(
  item_id INTEGER PRIMARY KEY,
  qty_on_hand INTEGER DEFAULT 0,
  max_capacity INTEGER DEFAULT 0,
  min_qty INTEGER DEFAULT 0,
  FOREIGN KEY(item_id) REFERENCES items(id)
);
CREATE TABLE IF NOT EXISTS policies(
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER,
  qty INTEGER,
  vendor_id INTEGER,
  amount REAL,
  pdf_path TEXT,
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(item_id) REFERENCES items(id),
  FOREIGN KEY(vendor_id) REFERENCES vendors(id)
);
CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    subject TEXT,
    sender TEXT,
    date TEXT,
    body TEXT,
    folder TEXT,
    is_read BOOLEAN DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    analysis_status TEXT,
    analysis_error TEXT,
    attachments TEXT
);
CREATE TABLE IF NOT EXISTS email_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT NOT NULL,
    priority TEXT,
    summary TEXT,
    item_id INTEGER,
    item_name TEXT,
    item_unit_price REAL,
    item_quantity INTEGER,
    vendor_id INTEGER,
    vendor_name TEXT,
    vendor_email TEXT,
    vendor_phone TEXT,
    total_cost REAL,
    budget REAL,
    compliance_explanation TEXT,
    order_id INTEGER,
    FOREIGN KEY(email_id) REFERENCES emails(id),
    FOREIGN KEY(order_id) REFERENCES orders(id)
);
CREATE TABLE IF NOT EXISTS forecasts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stats_json TEXT,
    markdown TEXT,
    chart_data TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""


@pytest.fixture()
def temp_db(tmp_path, monkeypatch):
    """创建一个临时 SQLite 库并让 backend.database 指向它。"""
    import backend.database as db

    db_path = tmp_path / "test.db"
    conn = sqlite3.connect(str(db_path))
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()

    monkeypatch.setattr(db, "DB_NAME", str(db_path))
    return str(db_path)


@pytest.fixture()
def db_conn(temp_db):
    """连接临时库（row_factory 与生产代码一致），测试结束后自动关闭。"""
    import backend.database as db

    conn = db.get_db_connection()
    yield conn
    conn.close()
