import sqlite3
import json
import re
from datetime import datetime
import os
from pathlib import Path

# 数据库文件位于 backend/data/procurement.db
DB_DIR = Path(__file__).resolve().parent / "data"
DB_NAME = str(DB_DIR / "procurement.db")

def get_db_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """初始化数据库(轻量迁移, 给老版本数据库做属性填充, 幂等, 对新版本无影响)"""
    # 数据库初始数据由 scripts/db_init.py 提供
    # 确保数据库目录存在
    DB_DIR.mkdir(parents=True, exist_ok=True)
    # 轻量迁移：确保 vendors 表包含 category 列、orders 表包含 status 列
    conn = get_db_connection()
    try:
        # 确保 vendors 表包含 category 列
        cols = [r["name"] for r in conn.execute("PRAGMA table_info(vendors)")]
        if "category" not in cols:
            conn.execute("ALTER TABLE vendors ADD COLUMN category TEXT")
            conn.commit()
        # 确保 orders 表包含 status 列
        ocols = [r["name"] for r in conn.execute("PRAGMA table_info(orders)")]
        if "status" not in ocols:
            conn.execute("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'draft'")
            # 迁移时的存量订单（mock 历史数据）视为已完成
            conn.execute("UPDATE orders SET status = 'received'")
            conn.commit()
        # 确保 emails 表包含 analysis_status 列、analysis_error 列、attachments 列
        ecols = [r["name"] for r in conn.execute("PRAGMA table_info(emails)")]
        if "analysis_status" not in ecols:
            conn.execute("ALTER TABLE emails ADD COLUMN analysis_status TEXT")
            conn.commit()
        if "analysis_error" not in ecols:
            conn.execute("ALTER TABLE emails ADD COLUMN analysis_error TEXT")
            conn.commit()
        if "attachments" not in ecols:
            conn.execute("ALTER TABLE emails ADD COLUMN attachments TEXT")
            conn.commit()
        # 回填存量数据：已分析的标记为 analyzed，已生成订单的标记为 processed
        conn.execute(
            "UPDATE emails SET analysis_status = 'analyzed' "
            "WHERE analysis_status IS NULL AND id IN (SELECT email_id FROM email_analysis)"
        )
        conn.execute(
            "UPDATE emails SET analysis_status = 'processed' "
            "WHERE id IN (SELECT email_id FROM email_analysis WHERE order_id IS NOT NULL)"
        )
        conn.commit()

        acols = [r["name"] for r in conn.execute("PRAGMA table_info(email_analysis)")]
        if "budget" not in acols:
            conn.execute("ALTER TABLE email_analysis ADD COLUMN budget REAL")
            conn.commit()

        conn.commit()
    finally:
        conn.close()


def save_emails(emails):
    """
    upsert一批邮件字典到数据库
    upsert: 插入或更新, 如果id重复, 则更新, 否则插入
    """
    conn = get_db_connection()
    c = conn.cursor()
    
    for email in emails:
        # 用 upsert 而不是 INSERT OR REPLACE：避免重复同步时清空 analysis_status / is_read 等字段
        attachments = email.get('attachments')
        attachments_json = json.dumps(attachments, ensure_ascii=False) if attachments else None
        c.execute('''
            INSERT INTO emails (id, subject, sender, date, body, folder, attachments)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                subject = excluded.subject,
                sender  = excluded.sender,
                date    = excluded.date,
                body    = excluded.body,
                folder  = excluded.folder,
                attachments = excluded.attachments
        ''', (
            email['id'],
            email['subject'],
            email['sender'],
            email['date'],
            email['body'],
            email['folder'],
            attachments_json
        ))
    
    conn.commit()
    conn.close()

def get_emails(folder, limit=50, offset=0):
    """
    获取特定文件夹的邮件, 支持分页
    inbox: 收件箱
    sent: 已发送
    """
    conn = get_db_connection()
    c = conn.cursor()
    
    c.execute('''
        SELECT e.*, 
               CASE WHEN ea.id IS NOT NULL THEN 1 ELSE 0 END as has_analysis,
               ea.priority
        FROM emails e 
        LEFT JOIN email_analysis ea ON e.id = ea.email_id
        WHERE e.folder = ? 
        ORDER BY CAST(e.id AS INTEGER) DESC 
        LIMIT ? OFFSET ?
    ''', (folder, limit, offset))
    
    rows = c.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        r = dict(row)
        r['has_analysis'] = bool(r['has_analysis'])
        # 解析附件 JSON（TEXT 列）为列表
        if r.get('attachments'):
            try:
                r['attachments'] = json.loads(r['attachments'])
            except Exception:
                r['attachments'] = []
        else:
            r['attachments'] = []
        result.append(r)
        
    return result

def get_email_attachments(email_id: str):
    """返回某封邮件的附件元信息列表（已解析 JSON）。"""
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT attachments FROM emails WHERE id = ?", (email_id,)).fetchone()
    finally:
        conn.close()
    if not row or not row["attachments"]:
        return []
    try:
        return json.loads(row["attachments"])
    except Exception:
        return []

def get_tables():
    """Returns a list of all table names in the database."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = [row['name'] for row in c.fetchall()]
    conn.close()
    return tables

def get_table_data(table_name: str):
    """Returns all rows from a specified table."""
    conn = get_db_connection()
    c = conn.cursor()
    # Basic validation to prevent obvious SQLi. In a real app, use stricter allowlists.
    if not table_name.isidentifier():
        raise ValueError(f"Invalid table name: {table_name}")
        
    c.execute(f"SELECT * FROM {table_name}")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def update_table_row(table_name: str, original_row: dict, updated_row: dict):
    """
    Dynamically updates a row. Uses the original_row to construct the WHERE clause
    to ensure we update the exact row that was edited.
    """
    conn = get_db_connection()
    c = conn.cursor()
    
    if not table_name.isidentifier():
        raise ValueError("Invalid table name")

    # Construct SET clause
    set_clauses = []
    set_values = []
    for key, value in updated_row.items():
        if not key.isidentifier():
            continue
        set_clauses.append(f"{key} = ?")
        set_values.append(value)
        
    # Construct WHERE clause based on ALL original row values to act as a pseudo-primary key check
    where_clauses = []
    where_values = []
    for key, value in original_row.items():
         if not key.isidentifier():
            continue
         if value is None:
             where_clauses.append(f"{key} IS NULL")
         else:
             where_clauses.append(f"{key} = ?")
             where_values.append(value)
             
    if not set_clauses or not where_clauses:
        raise ValueError("Empty update or condition")
        
    query = f"UPDATE {table_name} SET {', '.join(set_clauses)} WHERE {' AND '.join(where_clauses)}"
    
    try:
        c.execute(query, set_values + where_values)
        if c.rowcount == 0:
            raise ValueError("No matching row found to update. Data might have been concurrenty modified.")
        conn.commit()
    finally:
        conn.close()
        
    return True

def delete_table_data(table_name: str):
    """Deletes all rows from a given table."""
    conn = get_db_connection()
    c = conn.cursor()
    
    if not table_name.isidentifier():
        raise ValueError("Invalid table name")
        
    try:
        c.execute(f"DELETE FROM {table_name}")
        conn.commit()
    finally:
        conn.close()
    return True

# --- Email Analysis Features ---

def get_item_by_name(query: str):
    if not query:
        return None
        
    conn = get_db_connection()
    c = conn.cursor()
    
    # 1. Clean the query: Remove "(SKU: ...)" and other common patterns
    # Example: "Product X (SKU: SKU-123)" -> "Product X"
    clean_query = re.sub(r'\(?SKU:\s*[^)]+\)?', '', query, flags=re.IGNORECASE).strip()
    # Also extract SKU if present for direct lookup
    sku_match = re.search(r'SKU:\s*([A-Z0-9-]+)', query, flags=re.IGNORECASE)
    extracted_sku = sku_match.group(1) if sku_match else None

    # 2. Try Exact SKU match (extracted or original)
    for s in [extracted_sku, clean_query, query]:
        if s:
            c.execute("SELECT * FROM items WHERE sku = ?", (s.strip(),))
            row = c.fetchone()
            if row:
                conn.close()
                return dict(row)

    # 3. Fuzzy SKU match
    for s in [extracted_sku, clean_query]:
        if s and len(s) > 2:
            c.execute("SELECT * FROM items WHERE sku LIKE ?", (f"%{s.strip()}%",))
            row = c.fetchone()
            if row:
                conn.close()
                return dict(row)

    # 4. Fuzzy Name match (split words)
    # Use the cleaned query for name matching
    words = [w for w in clean_query.split() if len(w) > 1]
    if words:
        where_clauses = " AND ".join(["name LIKE ?"] * len(words))
        params = tuple(f"%{w}%" for w in words)
        c.execute(f"SELECT * FROM items WHERE {where_clauses}", params)
        row = c.fetchone()
        if row:
            conn.close()
            return dict(row)
            
    # 5. Fallback to simple name matching on original query
    c.execute("SELECT * FROM items WHERE name LIKE ?", (f"%{clean_query}%",))
    row = c.fetchone()
    
    conn.close()
    return dict(row) if row else None

def get_vendor(vendor_id: str):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM vendors WHERE id = ?", (vendor_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def get_vendor_by_name(name: str):
    """按名称模糊匹配供应商，返回第一条匹配。"""
    if not name:
        return None
    conn = get_db_connection()
    row = conn.execute(
        "SELECT * FROM vendors WHERE name LIKE ? ORDER BY id LIMIT 1", (f"%{name}%",)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_vendors():
    """返回所有供应商（按 id 升序）。"""
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM vendors ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_vendor(name: str, email: str, phone: str = None,
                  category: str = None, ext_score: float = 80, approved: int = 1) -> int:
    """新增供应商，返回新供应商 id。"""
    conn = get_db_connection()
    try:
        cur = conn.execute(
            "INSERT INTO vendors (name, email, phone, category, approved, ext_score) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (name, email, phone, category, approved, ext_score),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def get_vendors_paginated(page: int = 1, per_page: int = 20, search: str = None,
                          min_score: float = None, max_score: float = None):
    """分页返回供应商，支持搜索与评分范围筛选。"""
    conn = get_db_connection()
    where_clauses, params = [], []
    if search:
        where_clauses.append(
            "(name LIKE ? OR email LIKE ? OR phone LIKE ? OR category LIKE ? OR CAST(id AS TEXT) LIKE ?)"
        )
        params.extend([f"%{search}%"] * 5)
    if min_score is not None:
        where_clauses.append("ext_score >= ?")
        params.append(min_score)
    if max_score is not None:
        where_clauses.append("ext_score <= ?")
        params.append(max_score)
    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    total = conn.execute(f"SELECT COUNT(*) AS t FROM vendors {where_sql}", params).fetchone()["t"]
    offset = (page - 1) * per_page
    rows = conn.execute(
        f"SELECT * FROM vendors {where_sql} ORDER BY id DESC LIMIT ? OFFSET ?",
        params + [per_page, offset],
    ).fetchall()
    conn.close()

    total_pages = (total + per_page - 1) // per_page
    return {
        "suppliers": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }


def count_items_by_vendor(vendor_id: int) -> int:
    """统计该供应商名下的物料数量。"""
    conn = get_db_connection()
    count = conn.execute(
        "SELECT COUNT(*) FROM items WHERE default_vendor_id = ?", (vendor_id,)
    ).fetchone()[0]
    conn.close()
    return count


def delete_vendor(vendor_id: int) -> bool:
    """删除指定供应商，返回是否删除成功。"""
    conn = get_db_connection()
    try:
        cur = conn.execute("DELETE FROM vendors WHERE id = ?", (vendor_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def update_vendor(vendor_id: int, name: str, email: str = None,
                  phone: str = None, category: str = None) -> bool:
    """更新供应商基本信息（名称/邮箱/电话/品类），不影响评分。"""
    conn = get_db_connection()
    try:
        cur = conn.execute(
            "UPDATE vendors SET name = ?, email = ?, phone = ?, category = ? WHERE id = ?",
            (name, email, phone, category, vendor_id),
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def update_vendor_score(vendor_id: int, ext_score: float) -> bool:
    """更新供应商评分（仅用于重评）。"""
    conn = get_db_connection()
    try:
        cur = conn.execute("UPDATE vendors SET ext_score = ? WHERE id = ?", (ext_score, vendor_id))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def create_item(name: str, sku: str = None, unit: str = None,
                unit_price: float = 0, default_vendor_id: int = None) -> int:
    """新增物料，返回新物料 id；SKU 已存在（不区分大小写）时抛出 ValueError。"""
    conn = get_db_connection()
    try:
        if sku:
            existing = conn.execute(
                "SELECT id FROM items WHERE sku COLLATE NOCASE = ?", (sku,)
            ).fetchone()
            if existing:
                raise ValueError(f"SKU「{sku}」已存在，不能重复使用。")
        cur = conn.execute(
            "INSERT INTO items (name, sku, unit, unit_price, default_vendor_id) "
            "VALUES (?, ?, ?, ?, ?)",
            (name, sku, unit, unit_price, default_vendor_id),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def get_items_paginated(page: int = 1, per_page: int = 20, search: str = None,
                        stock_status: str = None):
    """分页返回物料（join 供应商名 + 库存），支持搜索与库存充足/低库存筛选。"""
    conn = get_db_connection()
    where_clauses, params = [], []
    if search:
        where_clauses.append(
            "(i.name LIKE ? OR i.sku LIKE ? OR v.name LIKE ? OR CAST(i.id AS TEXT) LIKE ?)"
        )
        params.extend([f"%{search}%"] * 4)
    if stock_status == "low":
        where_clauses.append("inv.qty_on_hand < inv.min_qty")
    elif stock_status == "sufficient":
        where_clauses.append("inv.qty_on_hand >= inv.min_qty")
    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    total = conn.execute(
        f"""
        SELECT COUNT(*) AS t
        FROM items i
        LEFT JOIN vendors v ON i.default_vendor_id = v.id
        LEFT JOIN inventory inv ON inv.item_id = i.id
        {where_sql}
        """,
        params,
    ).fetchone()["t"]
    offset = (page - 1) * per_page
    rows = conn.execute(
        f"""
        SELECT i.*, v.name AS vendor_name,
               inv.qty_on_hand AS qty_on_hand, inv.min_qty AS min_qty, inv.max_capacity AS max_capacity
        FROM items i
        LEFT JOIN vendors v ON i.default_vendor_id = v.id
        LEFT JOIN inventory inv ON inv.item_id = i.id
        {where_sql} ORDER BY i.id DESC LIMIT ? OFFSET ?
        """,
        params + [per_page, offset],
    ).fetchall()
    conn.close()

    total_pages = (total + per_page - 1) // per_page
    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }


def delete_item(item_id: int) -> bool:
    """删除指定物料，返回是否删除成功。"""
    conn = get_db_connection()
    try:
        cur = conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def update_item(item_id: int, name: str, unit: str = None,
                unit_price: float = 0, default_vendor_id: int = None) -> bool:
    """更新物料（名称/单位/单价/默认供应商）；SKU 不在此修改。"""
    conn = get_db_connection()
    try:
        cur = conn.execute(
            "UPDATE items SET name = ?, unit = ?, unit_price = ?, default_vendor_id = ? WHERE id = ?",
            (name, unit, unit_price, default_vendor_id, item_id),
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def update_inventory(item_id: int, qty_on_hand: int = None,
                     min_qty: int = None, max_capacity: int = None) -> bool:
    """更新物料库存（数量/最小阈值/最大容量，inventory 表 upsert）。"""
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO inventory (item_id, qty_on_hand, min_qty, max_capacity) "
            "VALUES (?, 0, 0, 0)",
            (item_id,),
        )
        sets, values = [], []
        for col, val in (("qty_on_hand", qty_on_hand), ("min_qty", min_qty), ("max_capacity", max_capacity)):
            if val is not None:
                sets.append(f"{col} = ?")
                values.append(val)
        if sets:
            values.append(item_id)
            conn.execute(f"UPDATE inventory SET {', '.join(sets)} WHERE item_id = ?", values)
        conn.commit()
        return True
    finally:
        conn.close()


def delete_order(order_id: int) -> bool:
    """删除指定订单，返回是否删除成功。"""
    conn = get_db_connection()
    try:
        cur = conn.execute("DELETE FROM orders WHERE id = ?", (order_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def clear_emails():
    """清空邮件缓存（切换邮箱源时调用，避免残留旧邮箱的邮件）。"""
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM email_analysis")
        conn.execute("DELETE FROM emails")
        conn.commit()
    finally:
        conn.close()


def update_order_status(order_id: int, status: str) -> bool:
    """更新订单状态，返回是否成功。"""
    conn = get_db_connection()
    try:
        cur = conn.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def increase_inventory(item_id: int, qty: int) -> None:
    """库存增加（只增不减）。确认收货时调用；若无库存记录则新建。"""
    if not item_id or qty <= 0:
        return
    conn = get_db_connection()
    try:
        exists = conn.execute(
            "SELECT item_id FROM inventory WHERE item_id = ?", (item_id,)
        ).fetchone()
        if exists:
            conn.execute(
                "UPDATE inventory SET qty_on_hand = qty_on_hand + ? WHERE item_id = ?",
                (qty, item_id),
            )
        else:
            conn.execute(
                "INSERT INTO inventory (item_id, qty_on_hand, max_capacity, min_qty) VALUES (?, ?, 5000, 50)",
                (item_id, qty),
            )
        conn.commit()
    finally:
        conn.close()

def get_unanalyzed_emails():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        SELECT e.* FROM emails e 
        LEFT JOIN email_analysis ea ON e.id = ea.email_id 
        WHERE ea.id IS NULL
          AND (e.analysis_status IS NULL OR e.analysis_status IN ('', 'failed'))
          AND LOWER(e.folder) = 'inbox'
        ORDER BY CAST(e.id AS INTEGER) DESC
    ''')
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_email_analysis(email_id: str):
    conn = get_db_connection()
    c = conn.cursor()
    # Join with orders/emails to get pdf_path、订单状态与邮件状态（供采购组件恢复进度）
    c.execute("""
        SELECT ea.*, o.pdf_path, o.status AS order_status, e.analysis_status
        FROM email_analysis ea
        LEFT JOIN orders o ON ea.order_id = o.id
        LEFT JOIN emails e ON ea.email_id = e.id
        WHERE ea.email_id = ?
    """, (email_id,))
    row = c.fetchone()
    
    if not row:
        conn.close()
        return None
        
    analysis = dict(row)
    
    # ── Live Repair logic ───────────────────────────
    # If the analysis exists but vendor/item mapping is missing (NULL or "N/A"), try to fix it now.
    vendor_null_or_na = analysis.get('vendor_name') is None or str(analysis.get('vendor_name')).upper() == "N/A"
    
    if vendor_null_or_na and analysis.get('item_name'):
        try:
            item_data = get_item_by_name(analysis['item_name'])
            if item_data:
                vendor_data = get_vendor(item_data['default_vendor_id'])
                if vendor_data:
                    # Update counts and costs
                    quantity = analysis.get('item_quantity', 0)
                    unit_price = item_data.get('unit_price', 0)
                    total_cost = quantity * unit_price
                    
                    # Update the record in DB
                    c.execute('''
                        UPDATE email_analysis SET
                            item_id = ?, item_name = ?, item_unit_price = ?,
                            vendor_id = ?, vendor_name = ?, vendor_email = ?, vendor_phone = ?,
                            total_cost = ?
                        WHERE email_id = ?
                    ''', (
                        item_data.get('id'), item_data.get('name'), unit_price,
                        vendor_data.get('id'), vendor_data.get('name'), vendor_data.get('email'), vendor_data.get('phone'),
                        total_cost, email_id
                    ))
                    conn.commit()
                    
                    # Update the return object
                    analysis.update({
                        'item_id': item_data.get('id'),
                        'item_name': item_data.get('name'),
                        'item_unit_price': unit_price,
                        'vendor_id': vendor_data.get('id'),
                        'vendor_name': vendor_data.get('name'),
                        'vendor_email': vendor_data.get('email'),
                        'vendor_phone': vendor_data.get('phone'),
                        'total_cost': total_cost
                    })
        except Exception as e:
            print(f"Error during live repair of analysis '{email_id}': {e}")
            
    conn.close()
    return analysis

def get_all_email_analyses():
    """Returns all email_analysis rows for standalone compliance checking."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM email_analysis ORDER BY id DESC")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_email_analyses_by_status(status: str):
    """返回指定邮件状态的 email_analysis（join emails 过滤 analysis_status）。"""
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT ea.* FROM email_analysis ea "
            "JOIN emails e ON ea.email_id = e.id "
            "WHERE e.analysis_status = ? ORDER BY ea.id DESC",
            (status,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def find_analysis_by_item_name(item_name: str):
    """
    Fuzzy-searches email_analysis by item_name.
    Returns the most recent row.
    """
    conn = get_db_connection()
    c = conn.cursor()
    words = [w for w in item_name.strip().split() if len(w) > 2]
    if not words:
        conn.close()
        return None
    where = " AND ".join(["item_name LIKE ?"] * len(words))
    params = tuple(f"%{w}%" for w in words)
    c.execute(
        f"SELECT * FROM email_analysis WHERE {where} ORDER BY id DESC LIMIT 1",
        params
    )
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def save_email_analysis(email_id: str, analysis_data: dict, item_data: dict, vendor_data: dict):
    conn = get_db_connection()
    c = conn.cursor()
    
    # 采购成本 = 目录单价 × 数量（价格由供应商确定，这里用目录价估算）
    quantity = analysis_data.get('quantity', 0)
    catalog_unit_price = item_data.get('unit_price', 0) if item_data else 0
    total_cost = quantity * catalog_unit_price
    budget = analysis_data.get('budget')
    
    c.execute('''
        INSERT OR REPLACE INTO email_analysis (
            email_id, priority, summary, item_id, item_name, item_unit_price, item_quantity,
            vendor_id, vendor_name, vendor_email, vendor_phone, total_cost, budget
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        email_id,
        analysis_data.get('priority'),
        analysis_data.get('summary'),
        item_data.get('id') if item_data else None,
        item_data.get('name') if item_data else analysis_data.get('item_name'),
        catalog_unit_price,
        quantity,
        vendor_data.get('id') if vendor_data else None,
        vendor_data.get('name') if vendor_data else None,
        vendor_data.get('email') if vendor_data else None,
        vendor_data.get('phone') if vendor_data else None,
        total_cost,
        budget
    ))
    
    # 分析成功：标记邮件为「已分析」，并清空失败原因
    c.execute("UPDATE emails SET analysis_status = 'analyzed', analysis_error = NULL WHERE id = ?", (email_id,))
    
    conn.commit()
    conn.close()
    return True


def get_item_order_history(item_id: int, limit: int = 10):
    """返回某物料的最近若干条订单（用于价格/数量对比）。"""
    if not item_id:
        return []
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT id, qty, amount, status, created_at FROM orders "
            "WHERE item_id = ? ORDER BY id DESC LIMIT ?",
            (item_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def set_email_analysis_status(email_id: str, status: str, error: str = None) -> None:
    """设置邮件的分析状态（pending / analyzed / processed / failed），可附带失败原因。"""
    conn = get_db_connection()
    try:
        conn.execute(
            "UPDATE emails SET analysis_status = ?, analysis_error = ? WHERE id = ?",
            (status, error, email_id),
        )
        conn.commit()
    finally:
        conn.close()


# --- Order Management ---

def create_order(item_id: int, vendor_id: int, qty: int, amount: float) -> int:
    """Inserts an order. Returns the new order id."""
    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute(
            "INSERT INTO orders (item_id, qty, vendor_id, amount, status) VALUES (?, ?, ?, ?, 'draft')",
            (item_id, qty, vendor_id, amount)
        )
        conn.commit()
        return c.lastrowid
    finally:
        conn.close()


def get_orders():
    """Returns all orders joined with item and vendor info."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""
        SELECT o.*, i.name AS item_name, i.unit_price,
               v.name AS vendor_name, v.email AS vendor_email
        FROM orders o
        LEFT JOIN items i ON o.item_id = i.id
        LEFT JOIN vendors v ON o.vendor_id = v.id
        ORDER BY o.id DESC
    """)
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_orders_paginated(page: int = 1, per_page: int = 20, search: str = None,
                         status: str = None, min_amount: float = None, max_amount: float = None,
                         date_from: str = None, date_to: str = None):
    """Returns paginated orders with total count, supporting search + filters."""
    conn = get_db_connection()
    c = conn.cursor()

    where_clauses = []
    params = []

    if search:
        where_clauses.append("(i.name LIKE ? OR v.name LIKE ? OR CAST(o.id AS TEXT) LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
    if status:
        where_clauses.append("o.status = ?")
        params.append(status)
    if min_amount is not None:
        where_clauses.append("o.amount >= ?")
        params.append(min_amount)
    if max_amount is not None:
        where_clauses.append("o.amount <= ?")
        params.append(max_amount)
    if date_from:
        where_clauses.append("date(o.created_at) >= date(?)")
        params.append(date_from)
    if date_to:
        where_clauses.append("date(o.created_at) <= date(?)")
        params.append(date_to)

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    # Get total count
    c.execute(f"""
        SELECT COUNT(*) as total
        FROM orders o
        LEFT JOIN items i ON o.item_id = i.id
        LEFT JOIN vendors v ON o.vendor_id = v.id
        {where_sql}
    """, params)
    total = c.fetchone()['total']

    # Get paginated rows
    offset = (page - 1) * per_page
    c.execute(f"""
        SELECT o.*, i.name AS item_name, i.unit_price,
               v.name AS vendor_name, v.email AS vendor_email
        FROM orders o
        LEFT JOIN items i ON o.item_id = i.id
        LEFT JOIN vendors v ON o.vendor_id = v.id
        {where_sql}
        ORDER BY o.id DESC
        LIMIT ? OFFSET ?
    """, params + [per_page, offset])
    rows = c.fetchall()
    conn.close()

    total_pages = (total + per_page - 1) // per_page
    return {
        'orders': [dict(row) for row in rows],
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages
    }


def get_orders_summary():
    """Returns aggregate stats for the orders header (仅统计已完成订单的金额与数量)。"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""
        SELECT
            COUNT(*) as total_count,
            COALESCE(SUM(amount), 0) as total_volume
        FROM orders
        WHERE status = 'received'
    """)
    row = c.fetchone()
    conn.close()
    return dict(row)


def get_order_by_id(order_id: int):
    """Returns a single order with full item and vendor details."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""
        SELECT o.*, i.name AS item_name, i.unit_price,
               v.name AS vendor_name, v.email AS vendor_email
        FROM orders o
        LEFT JOIN items i ON o.item_id = i.id
        LEFT JOIN vendors v ON o.vendor_id = v.id
        WHERE o.id = ?
    """, (order_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

# --- Forecast Management ---

def save_forecast(stats_json: str, markdown: str, chart_data: str):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO forecasts (stats_json, markdown, chart_data) VALUES (?, ?, ?)",
        (stats_json, markdown, chart_data)
    )
    conn.commit()
    conn.close()

def get_latest_forecast():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM forecasts ORDER BY id DESC LIMIT 1")
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def get_forecast_history():
    conn = get_db_connection()
    c = conn.cursor()
    # Fetch all, but we don't need to load huge chart data, just id and date.
    c.execute("SELECT id, created_at FROM forecasts ORDER BY id DESC")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_forecast_by_id(forecast_id: int):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM forecasts WHERE id = ?", (forecast_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

