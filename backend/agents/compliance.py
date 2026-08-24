"""
Compliance / Gatekeeper Agent: Rule-based checks and LLM-powered explanations.
"""
import json

from langchain_core.messages import HumanMessage, SystemMessage

from backend.agents.config import get_compliance_llm


def run_gatekeeper_checks(analysis: dict) -> dict:
    """
    使用确定性规则检查库存、预算、重复订单、仓库容量与采购政策。
    返回：{ 'passed': bool, 'failures': [str], 'warnings': [str] }
    """
    from backend.database import get_db_connection

    failures, warnings = [], []
    item_id    = analysis.get('item_id')
    vendor_id  = analysis.get('vendor_id')
    total_cost = analysis.get('total_cost', 0) or 0
    quantity   = analysis.get('quantity', analysis.get('item_quantity', 0)) or 0
    item_name  = analysis.get('item_name', '未知物品')

    conn = get_db_connection()
    c = conn.cursor()
    try:
        # ── Check 1: 库存 ──────────────────────────
        if item_id:
            c.execute("SELECT qty_on_hand, min_qty, max_capacity FROM inventory WHERE item_id = ?", (item_id,))
            inv = c.fetchone()
            if inv:
                if inv['qty_on_hand'] > 3*inv['min_qty']:
                    warnings.append(
                        f"库存：'{item_name}' 的库存为 {inv['qty_on_hand']} 件 "
                        f"（高于最小阈值三倍 {3*inv['min_qty']}）。订单可能不紧急。"
                    )
                projected = inv['qty_on_hand'] + quantity
                if inv['max_capacity'] > 0 and projected > inv['max_capacity']:
                    failures.append(
                        f"库存：订购 {quantity} 件将超过最大容量 "
                        f"（{projected} > {inv['max_capacity']}）。"
                    )
            else:
                failures.append(f"库存：未找到 item_id={item_id} 的记录。")
        else:
            failures.append("库存：目录中未找到该物品 — 已跳过检查。")

        # ── Check 2: 政策 ───────────────────────────
        c.execute("SELECT value FROM policies WHERE key = 'max_single_order_amount'")
        row = c.fetchone()
        if row and total_cost > float(row['value']):
            failures.append(
                f"政策：订单金额 ${total_cost:,.2f} 超出单笔上限 ${float(row['value']):,.2f}。"
            )

        c.execute("SELECT value FROM policies WHERE key = 'min_vendor_score'")
        row = c.fetchone()
        if row and vendor_id:
            min_score = float(row['value'])
            c.execute("SELECT name, ext_score, approved FROM vendors WHERE id = ?", (vendor_id,))
            vendor = c.fetchone()
            if vendor:
                if not vendor['approved']:
                    failures.append(f"政策：供应商 '{vendor['name']}' 未获批准。")
                if vendor['ext_score'] < min_score:
                    failures.append(
                        f"政策：供应商 '{vendor['name']}' 的评分 {vendor['ext_score']} "
                        f"低于最低要求 {min_score}。"
                    )

        # ── Check 2b: 预算（申请方预算，硬性）──
        budget = analysis.get('budget')
        if budget is not None and budget > 0 and total_cost > budget:
            failures.append(
                f"预算：采购成本 ${total_cost:,.2f} 超出申请方预算 ${budget:,.2f}。"
            )

        # ── Check 3: 软提醒：不拦截──
        if item_id:
            from backend.database import get_item_order_history
            history = get_item_order_history(item_id, limit=10)
            open_orders = [o for o in history if o.get('status') in ('draft', 'sent')]
            if open_orders:
                ids = ", ".join(f"#{o['id']}" for o in open_orders)
                warnings.append(f"重复在途：该物料已有 {len(open_orders)} 笔未关闭订单（{ids}），请确认是否重复采购。")

            received = [o for o in history if o.get('status') == 'received' and o.get('qty')]
            if received:
                avg_qty = sum(o['qty'] for o in received) / len(received)
                if avg_qty > 0:
                    if quantity > avg_qty * 5:
                        warnings.append(f"数量异常：本次数量 {quantity} 远超历史平均 {avg_qty:.0f}。")
                    if analysis.get('priority') == 'High' and quantity > avg_qty * 2:
                        warnings.append(f"交期风险：高优先级且数量 {quantity} 明显高于历史平均 {avg_qty:.0f}，请核实交期。")
    finally:
        conn.close()

    return {'passed': len(failures) == 0, 'failures': failures, 'warnings': warnings}


def explain_compliance_result(analysis: dict, gate_result: dict) -> dict:
    """
    用 LLM 做结构化「组合评审」，返回 {risk_level, risk_points, suggestions}。
    """
    passed     = gate_result['passed']
    failures   = gate_result.get('failures', [])
    warnings   = gate_result.get('warnings', [])
    item_name  = analysis.get('item_name', '所请求的物品')
    quantity   = analysis.get('item_quantity', analysis.get('quantity', 0)) or 0
    total_cost = analysis.get('total_cost', 0) or 0
    priority   = analysis.get('priority', '未知')
    vendor     = analysis.get('vendor_name', '未知')
    budget     = analysis.get('budget')
    catalog    = analysis.get('item_unit_price')

    status_str = "通过" if passed else "未通过"
    failures_str = "\n".join(f"- {f}" for f in failures) if failures else "无"
    warnings_str = "\n".join(f"- {w}" for w in warnings) if warnings else "无"
    budget_line = f"申请方预算：${budget:,.2f}" if budget else "申请方预算：未提取到"
    catalog_line = f"单价（目录价）：${catalog:,.2f}" if catalog else "单价（目录价）：无"

    def fallback_risk() -> str:
        """LLM 不可用时按失败/提醒项回退判定风险等级。"""
        if failures:
            return "高"
        if warnings:
            return "中"
        return "低"

    def fallback_review() -> dict:
        """LLM 不可用时回退构造结构化评审结果。"""
        return {
            "risk_level": fallback_risk(),
            "risk_points": (failures + warnings)[:4],
            "suggestions": [],
        }

    prompt = f"""你是一名资深采购合规专员。请对该采购请求做一次「组合评审」。

请求详情：
- 物品：{item_name}
- 数量：{quantity}
- {budget_line}
- {catalog_line}
- 采购成本（单价 × 数量）：${total_cost:,.2f}
- 优先级：{priority}（这是交期紧急程度，不是风险等级）
- 供应商：{vendor}

硬规则结果：{status_str}
未通过项（必须拦截）：
{failures_str}
软提醒项（仅提醒）：
{warnings_str}

风险等级判定规则（必须严格遵守）：
- 存在「未通过项」→ 高
- 全部通过但存在「软提醒项」→ 中
- 全部通过且无任何提醒 → 低

请只输出一个 JSON Scheam（不要输出其他文字），格式：
{{"risk_level": "低/中/高", "risk_points": ["...", "..."], "suggestions": ["...", "..."]}}

要求：
- risk_points 只引用上面「未通过项/软提醒项」里的具体数据，2-4 条，不要编造。
- suggestions 给 1-3 条可执行建议。"""

    try:
        response = get_compliance_llm().invoke([
            SystemMessage(content="你是一名专业的采购合规专员。请只输出一个 JSON Schema，不要输出其他文字。"),
            HumanMessage(content=prompt)
        ])
        content = response.content.strip()

        if content.startswith("```json"):
            content = content[7:-3]
        elif content.startswith("```"):
            content = content[3:-3]

        data = json.loads(content)
        risk_points = [str(p) for p in data.get("risk_points", [])][:4]
        suggestions = [str(s) for s in data.get("suggestions", [])]
        return {
            "risk_level": data.get("risk_level") or fallback_risk(),
            "risk_points": risk_points or (failures + warnings)[:4],
            "suggestions": suggestions,
        }
    except Exception:
        return fallback_review()
