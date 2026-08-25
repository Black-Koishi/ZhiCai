"""
订单服务：统一「创建订单 → 生成采购订单 PDF → 写回 pdf_path」的公共逻辑，
消除各 API 端点中重复的订单 + PDF 生成代码。
"""
import os

from backend.database import (
    create_order, get_order_by_id, get_db_connection,
    update_order_status, increase_inventory, delete_order,
)
from backend.agents import generate_order_pdf
from backend.email_service import EmailService


def _save_pdf_path(order_id: int, pdf_path: str) -> None:
    """把 PDF 本地路径写回 orders 表。"""
    conn = get_db_connection()
    try:
        conn.execute("UPDATE orders SET pdf_path = ? WHERE id = ?", (pdf_path, order_id))
        conn.commit()
    finally:
        conn.close()


def generate_and_store_pdf(order_id: int, order_data: dict) -> str:
    """为订单生成 PDF 并写回 pdf_path，返回本地文件路径。"""
    order_data = dict(order_data or {})
    order_data["order_id"] = order_id
    pdf_path = generate_order_pdf(order_data)
    _save_pdf_path(order_id, pdf_path)
    return pdf_path


def create_order_with_pdf(item_id, vendor_id, qty, amount, priority: str = "Normal") -> dict:
    """创建订单并生成 PDF。返回 {"order_id": int, "pdf_path": str(URL)}。"""
    order_id = create_order(item_id=item_id, vendor_id=vendor_id, qty=qty, amount=amount)
    try:
        order_data = get_order_by_id(order_id) or {}
        order_data["priority"] = priority
        pdf_path = generate_and_store_pdf(order_id, order_data)
    except Exception:
        # PDF 是订单创建的必要产物；生成失败时不保留半成品订单。
        delete_order(order_id)
        raise
    return {"order_id": order_id, "pdf_path": f"/static/orders/{os.path.basename(pdf_path)}"}


def link_analysis_order(email_id: str, order_id: int) -> None:
    """把订单号写回 email_analysis 表，并把邮件标记为「已处理」。"""
    conn = get_db_connection()
    try:
        conn.execute("UPDATE email_analysis SET order_id = ? WHERE email_id = ?", (order_id, email_id))
        conn.execute("UPDATE emails SET analysis_status = 'processed' WHERE id = ?", (email_id,))
        conn.commit()
    finally:
        conn.close()


def send_order_email(order_id: int) -> dict:
    """把采购订单 PDF 发送给供应商邮箱，并将订单状态置为 sent。

    仅在 draft 状态可发送。若 SMTP 未配置则仍记录状态（闭环可走通）。
    """
    order = get_order_by_id(order_id)
    if not order:
        return {"status": "error", "message": "订单未找到"}
    if order.get("status") != "draft":
        return {"status": "error", "message": "仅草稿状态订单可发送邮件"}

    vendor_email = order.get("vendor_email")
    subject = f"采购订单 #{order_id} - 智采 ZhiCai"
    body = (
        f"您好，请查收采购订单 #{order_id}：\n\n"
        f"物料：{order.get('item_name')}\n"
        f"数量：{order.get('qty')}\n"
        f"金额：${order.get('amount', 0):,.2f}\n"
        f"供应商：{order.get('vendor_name')}\n\n"
        f"采购订单 PDF 请通过系统下载。\n"
    )

    email_sent = False
    if vendor_email:
        attachments = []
        pdf_path = order.get("pdf_path")
        if pdf_path:
            full_path = pdf_path if os.path.isabs(pdf_path) else os.path.abspath(pdf_path)
            if os.path.exists(full_path):
                with open(full_path, "rb") as f:
                    attachments.append((os.path.basename(full_path), f.read()))
        try:
            email_sent = EmailService().send_email(vendor_email, subject, body, attachments)
        except Exception:
            email_sent = False

    update_order_status(order_id, "sent")
    return {
        "status": "success",
        "order_id": order_id,
        "email_sent": email_sent,
        "message": "订单已标记为已发送" + ("，邮件已发出" if email_sent else "（邮件服务未配置，仅记录状态）"),
    }


def receive_order(order_id: int) -> dict:
    """确认收货：库存增加 + 订单状态置为 received。"""
    order = get_order_by_id(order_id)
    if not order:
        return {"status": "error", "message": "订单未找到"}
    if order.get("status") != "sent":
        return {"status": "error", "message": "仅已发送状态的订单可确认收货"}

    increase_inventory(order.get("item_id"), order.get("qty") or 0)
    update_order_status(order_id, "received")
    return {
        "status": "success",
        "order_id": order_id,
        "message": f"已确认收货，物料「{order.get('item_name')}」库存 +{order.get('qty')}",
    }


def cancel_order(order_id: int) -> dict:
    """取消订单（仅 draft / sent 状态可取消）。"""
    order = get_order_by_id(order_id)
    if not order:
        return {"status": "error", "message": "订单未找到"}
    if order.get("status") not in ("draft", "sent"):
        return {"status": "error", "message": "已完成或已取消的订单不可取消"}

    update_order_status(order_id, "cancelled")
    return {"status": "success", "order_id": order_id, "message": "订单已取消"}
