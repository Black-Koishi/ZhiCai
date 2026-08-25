"""聊天步骤中的邮件标识应面向用户，而不是暴露内部邮件 ID。"""
from fastapi.testclient import TestClient

from backend.api import app
from backend import graph
from backend.email_display import format_email_label
from backend.routers import emails as emails_router


def _seed_email(conn, *, email_id="internal-4242"):
    conn.execute(
        "INSERT INTO emails(id, subject, sender, body, folder) VALUES (?, ?, ?, ?, 'inbox')",
        (email_id, "8 月办公用品采购", "采购部 <buyer@example.com>", "请采购办公用品"),
    )
    conn.commit()


def test_email_label_uses_compact_sender_subject_format():
    label = format_email_label({
        "id": "internal-4242",
        "sender": "采购部 <buyer@example.com>",
        "subject": "8 月办公用品采购",
    })

    assert label == "「采购部 <buyer@example.com> · 8 月办公用品采购」"
    assert "internal-4242" not in label


def test_single_analysis_step_uses_sender_and_subject(monkeypatch, db_conn):
    _seed_email(db_conn)
    monkeypatch.setattr(
        emails_router,
        "analyze_email",
        lambda *_args: {"item_name": "办公用品"},
    )

    response = TestClient(app).post("/emails/internal-4242/analyze")

    assert response.status_code == 200
    step = response.json()["step"]
    assert "采购部 <buyer@example.com>" in step
    assert "8 月办公用品采购" in step
    assert "internal-4242" not in step


def test_batch_analysis_error_step_uses_sender_and_subject(monkeypatch, db_conn):
    _seed_email(db_conn)

    def fail_analysis(*_args):
        raise ValueError("无法识别采购物料")

    monkeypatch.setattr(emails_router, "analyze_email", fail_analysis)

    response = TestClient(app).post("/emails/analyze_all")

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert "采购部 <buyer@example.com>" in result["step"]
    assert "8 月办公用品采购" in result["step"]
    assert "internal-4242" not in result["step"]


def test_email_agent_graph_steps_do_not_expose_internal_id(monkeypatch):
    email = {
        "id": "internal-4242",
        "sender": "采购部 <buyer@example.com>",
        "subject": "8 月办公用品采购",
        "body": "请采购办公用品",
    }
    monkeypatch.setattr(graph, "get_unanalyzed_emails", lambda: [email])
    monkeypatch.setattr(
        graph,
        "analyze_email",
        lambda *_args: {
            "item_name": "办公用品",
            "item_quantity": 10,
            "priority": "High",
        },
    )

    result = graph.agent_email_node({"steps": []})

    rendered_steps = "\n".join(result["steps"])
    assert "采购部 <buyer@example.com>" in rendered_steps
    assert "8 月办公用品采购" in rendered_steps
    assert "internal-4242" not in rendered_steps
