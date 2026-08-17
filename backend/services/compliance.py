"""合规服务：对邮件分析记录运行守门检查并生成解释。

供 LangGraph 节点与 REST 端点共用，统一「合规 = 检查 + 解释」的行为。
"""
from backend.agents import run_gatekeeper_checks, explain_compliance_result
from backend.database import get_db_connection


def format_review(review: dict) -> str:
    """把结构化评审格式化为可读文本（用于存库与简单展示）。"""
    lines = [f"风险等级：{review.get('risk_level', '未知')}"]
    points = review.get('risk_points') or []
    if points:
        lines.append("主要风险点：")
        lines += [f"- {p}" for p in points]
    suggestions = review.get('suggestions') or []
    if suggestions:
        lines.append("建议动作：")
        lines += [f"- {s}" for s in suggestions]
    return "\n".join(lines)


def run_compliance(analysis: dict) -> dict:
    """运行合规检查并生成结构化评审，返回 {passed, failures, warnings, review, explanation}。"""
    gate = run_gatekeeper_checks(analysis)
    review = explain_compliance_result(analysis, gate)
    return {
        "passed": bool(gate["passed"]),
        "failures": gate.get("failures", []),
        "warnings": gate.get("warnings", []),
        "review": review,
        "explanation": format_review(review),
    }


def save_compliance_explanation(email_id: str, explanation: str) -> None:
    """把合规解释写回 email_analysis 表。"""
    conn = get_db_connection()
    try:
        conn.execute(
            "UPDATE email_analysis SET compliance_explanation = ? WHERE email_id = ?",
            (explanation, email_id),
        )
        conn.commit()
    finally:
        conn.close()


def _email_sender(email_id: str):
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT sender FROM emails WHERE id = ?", (email_id,)).fetchone()
    finally:
        conn.close()
    return row["sender"] if row and row["sender"] else None


def send_order_confirmation(email_id: str, order_id: int) -> bool:
    """下单后给发件人发简洁的「通过 + 已下单」通知（不含废话）。"""
    from backend.email_service import EmailService

    to_email = _email_sender(email_id)
    if not to_email:
        return False

    subject = "采购需求已通过，订单已创建"
    body = f"您好，您提交的采购需求已通过审核，订单 #{order_id} 已创建，采购部门将尽快处理。"
    try:
        EmailService().send_email(to_email, subject, body)
        return True
    except Exception:
        return False


def send_cancel_notification(email_id: str, reason: str) -> bool:
    """人工审核未通过后，把未通过原因发给发件人。"""
    from backend.email_service import EmailService

    to_email = _email_sender(email_id)
    if not to_email:
        return False

    subject = "采购需求未通过审核"
    body = f"您好，您提交的采购需求未通过审核，原因如下：\n\n{reason}"
    try:
        EmailService().send_email(to_email, subject, body)
        return True
    except Exception:
        return False
