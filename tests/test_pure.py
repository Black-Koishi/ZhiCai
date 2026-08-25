"""纯函数测试：PDF 文本处理 / 评审格式化 / 附件存储键。"""
from backend.agents.pdf_generator import sanitize_text, _build_po_body, generate_order_pdf
from backend.services.compliance import format_review
from backend.attachments import _safe_name, storage_key


def test_sanitize_text_replaces_special_chars():
    text = "A\u2014B \u2013 C \u2018Q\u2019 \u201cD\u201d \u2026 \u00a9 \u20ac 30\u00b0"
    out = sanitize_text(text)
    assert "\u2014" not in out and "\u2013" not in out
    assert "\u201c" not in out and "\u201d" not in out
    assert "\u2018" not in out and "\u2019" not in out
    assert "\u2026" not in out
    assert "(C)" in out
    assert "EUR" in out
    assert "30 deg" in out


def test_sanitize_text_keeps_chinese():
    out = sanitize_text("采购订单——无绳电钻")
    assert "采购订单" in out
    assert "无绳电钻" in out


def test_build_po_body_includes_order_fields():
    body = _build_po_body({
        "vendor_name": "测试供应商",
        "item_name": "无绳电钻",
        "qty": 10,
        "amount": 1200,
        "priority": "High",
    })
    assert "测试供应商" in body
    assert "无绳电钻" in body
    assert "数量：10" in body
    assert "$1,200.00" in body
    assert "加急" in body


def test_build_po_body_default_priority_note():
    body = _build_po_body({
        "vendor_name": "V",
        "item_name": "I",
        "qty": 1,
        "amount": 100,
        "priority": "Low",
    })
    assert "按约定周期" in body
    assert "加急" not in body


def test_generate_order_pdf_supports_chinese_on_every_platform(tmp_path):
    pdf_path = generate_order_pdf({
        "order_id": 42,
        "vendor_name": "测试供应商",
        "vendor_email": "vendor@example.com",
        "item_name": "办公用品",
        "qty": 3,
        "unit_price": 25,
        "amount": 75,
        "priority": "标准",
    }, str(tmp_path))

    data = open(pdf_path, "rb").read()
    assert data.startswith(b"%PDF-")
    assert len(data) > 1_000


def test_format_review_renders_all_sections():
    text = format_review({
        "risk_level": "高",
        "risk_points": ["库存不足", "超预算"],
        "suggestions": ["先补货"],
    })
    assert "风险等级：高" in text
    assert "主要风险点" in text
    assert "- 库存不足" in text
    assert "建议动作" in text
    assert "- 先补货" in text


def test_format_review_handles_empty_points():
    text = format_review({"risk_level": "低", "risk_points": [], "suggestions": []})
    assert "风险等级：低" in text
    assert "主要风险点" not in text
    assert "建议动作" not in text


def test_safe_name_removes_path_separators():
    out = _safe_name("a/b\\c:d")
    assert "/" not in out
    assert "\\" not in out
    assert ":" not in out


def test_storage_key_contains_parts():
    key = storage_key("email-1", 2, "报表.pdf")
    assert key.startswith("email-1_2_")
    assert "报表.pdf" in key
