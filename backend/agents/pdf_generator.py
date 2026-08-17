"""
PDF Purchase Order Generator（纯固定模板，代码填字段，不依赖 LLM）。
"""
import os
from datetime import datetime


def _build_po_body(order: dict) -> str:
    """按固定模板生成采购订单正文（代码填字段）。"""
    vendor_name = order.get('vendor_name', '无')
    item_name = order.get('item_name', '无')
    qty = order.get('qty', order.get('quantity', '无'))
    total = order.get('amount', order.get('total_cost', 0))
    priority = order.get('priority', '标准')

    if priority == "High":
        delivery_note = "本单为加急订单，请贵方在约定期限内优先安排生产与发货。"
    elif priority == "Medium":
        delivery_note = "请在约定期限内安排生产与发货。"
    else:
        delivery_note = "请按约定周期安排生产与发货。"

    return (
        f"致 {vendor_name}：\n\n"
        f"我方特此向贵方订购以下物料：\n"
        f"物料：{item_name}\n"
        f"数量：{qty}\n"
        f"总金额：${total:,.2f}\n\n"
        f"{delivery_note}\n\n"
        f"付款条款：30 天账期。\n\n"
        f"感谢贵方长期以来的支持。\n"
        f"此致\n智采 ZhiCai 采购部"
    )


def sanitize_text(text: str) -> str:
    """Replace certain special characters for stable PDF rendering (keep Chinese)."""
    replacements = {
        "\u2014": "-",    # em dash
        "\u2013": "-",    # en dash
        "\u2018": "'",    # left single quote
        "\u2019": "'",    # right single quote / apostrophe
        "\u201c": '"',    # left double quote
        "\u201d": '"',    # right double quote
        "\u2026": "...",  # ellipsis
        "\u00a0": " ",    # non-breaking space
        "\u00ae": "(R)",  # registered trademark
        "\u00a9": "(C)",  # copyright
        "\u2122": "(TM)", # trademark
        "\u20ac": "EUR",  # euro sign
        "\u00b0": " deg", # degree sign
    }
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)
    return text


def _load_cjk_font(pdf) -> str:
    """Register a CJK-capable font and return its family name (fallback to Helvetica)."""
    font_candidates = [
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\SourceHanSansCN-Normal.ttf",
        r"C:\Windows\Fonts\msyh.ttc",
    ]
    for fp in font_candidates:
        if os.path.exists(fp):
            try:
                pdf.add_font("CNFont", "", fp, uni=True)
                pdf.add_font("CNFont", "B", fp, uni=True)
                pdf.add_font("CNFont", "I", fp, uni=True)
                return "CNFont"
            except Exception:
                continue
    return "Helvetica"


def generate_order_pdf(order: dict, output_dir: str = "orders") -> str:
    """
    Generates a PDF Purchase Order using fpdf2.
    Returns the path to the saved PDF file.
    """
    from fpdf import FPDF, Align

    os.makedirs(output_dir, exist_ok=True)
    order_id  = order.get('order_id') or order.get('id', 'unknown')
    file_path = f"{output_dir}/order_{order_id}.pdf"

    # 用固定模板生成正文，并清理特殊字符
    po_body = sanitize_text(_build_po_body(order))

    pdf = FPDF()
    pdf.add_page()
    pdf.set_margins(20, 20, 20)

    # Register CJK font if available so Chinese text renders correctly
    font_name = _load_cjk_font(pdf)

    # ── Header ──────────────────────────────────
    pdf.set_font(font_name, "B", 20)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 10, text="采购订单", align=Align.C)
    pdf.ln(10)

    pdf.set_font(font_name, "", 11)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, text=f"采购订单号：# {order_id}", align=Align.C)
    pdf.ln(6)
    pdf.cell(0, 6, text=f"日期：{order.get('created_at', datetime.now().strftime('%Y-%m-%d'))}", align=Align.C)
    pdf.ln(4)
    pdf.set_draw_color(200, 200, 200)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(6)

    # ── Summary Table ───────────────────────────
    pdf.set_font(font_name, "B", 10)
    pdf.set_text_color(30, 30, 30)
    fields = [
        ("物品",          order.get('item_name', '无')),
        ("数量",          str(order.get('qty', order.get('quantity', '无')))),
        ("单价",          f"${order.get('unit_price', 0):,.2f}"),
        ("总金额",        f"${order.get('amount', order.get('total_cost', 0)):,.2f}"),
        ("供应商",        order.get('vendor_name', '无')),
        ("供应商邮箱",    order.get('vendor_email', '无')),
        ("优先级",        order.get('priority', '标准')),
    ]
    for label, value in fields:
        pdf.set_font(font_name, "B", 10)
        pdf.cell(50, 7, text=label + "：")
        pdf.set_font(font_name, "", 10)
        pdf.cell(0, 7, text=str(value))
        pdf.ln(7)
    pdf.ln(4)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(6)

    # ── LLM-Generated PO Body ───────────────────
    pdf.set_font(font_name, "B", 11)
    pdf.cell(0, 8, text="采购订单详情")
    pdf.ln(8)
    pdf.set_font(font_name, "", 10)
    pdf.set_text_color(50, 50, 50)
    pdf.multi_cell(0, 6, text=po_body)
    pdf.ln(6)

    # ── Footer ──────────────────────────────────
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(4)
    pdf.set_font(font_name, "I", 9)
    pdf.set_text_color(130, 130, 130)
    pdf.cell(0, 6, text="智采 ZhiCai", align=Align.C)
    pdf.ln(6)
    pdf.cell(0, 6, text="本文件为系统生成的采购订单。", align=Align.C)

    pdf.output(file_path)
    return file_path
