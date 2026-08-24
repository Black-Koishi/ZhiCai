"""合规服务：对邮件分析记录运行守门检查并生成解释。

供 LangGraph 节点与 REST 端点共用，统一「合规 = 检查 + 解释」的行为。
"""
from backend.agents import run_gatekeeper_checks, explain_compliance_result
from backend.database import get_db_connection, repair_analysis, set_email_analysis_status


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


def run_compliance_and_record(email_id: str, analysis: dict) -> dict:
    """对一封邮件的分析执行完整合规流程并落库：修复 → 检查 → 存解释 → 更新状态 → 失败通知。

    批量合规节点、单邮件合规 API、按物品名合规 API 共用本函数，
    保证同一封邮件在任何入口下的输入（含 Live Repair）、检查、状态流转与通知完全一致。
    返回 run_compliance 的结果 dict（passed/failures/warnings/review/explanation）。
    """
    analysis = repair_analysis(analysis)
    result = run_compliance(analysis)
    save_compliance_explanation(email_id, result["explanation"])
    set_email_analysis_status(email_id, "pending_review" if result["passed"] else "failed_compliance")
    if not result["passed"]:
        send_cancel_notification(email_id, result["explanation"])
    return result


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
    """查询某封邮件的发件人地址。"""
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
