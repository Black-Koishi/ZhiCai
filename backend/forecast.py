import pandas as pd
import json
import sqlite3
import threading
from pathlib import Path
import os
from langchain_core.messages import SystemMessage, HumanMessage

from backend.agents.config import get_current_model, get_llm

# DB Path matching database.py
DB_DIR = Path(__file__).resolve().parent / "data"
DB_NAME = str(DB_DIR / "procurement.db")

def analyze_seasonality():
    """ Runs mathematical Prophet analysis directly on SQLite orders table. """
    try:
        conn = sqlite3.connect(DB_NAME)
        
        # Pull required orders + item details joined
        query = '''
            SELECT o.created_at, o.qty, i.name 
            FROM orders o
            JOIN items i ON o.item_id = i.id
        '''
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        if df.empty:
             return {"error": "数据库中没有可用于分析的订单。"}

        df['created_at'] = pd.to_datetime(df['created_at'], format='mixed')
        
        # Aggregate quantity by item and month
        month_names = {1: '1月', 2: '2月', 3: '3月', 4: '4月', 5: '5月', 6: '6月',
                       7: '7月', 8: '8月', 9: '9月', 10: '10月', 11: '11月', 12: '12月'}
        df['month'] = df['created_at'].dt.month.map(month_names)
        df['month_num'] = df['created_at'].dt.month
        
        monthly_sales = df.groupby(['name', 'month', 'month_num'])['qty'].sum().reset_index()
        
        findings = {}
        
        # Analyze top 15 items by total volume
        top_items = df.groupby('name')['qty'].sum().nlargest(15).index
        
        for item in top_items:
            item_data = monthly_sales[monthly_sales['name'] == item].sort_values('month_num')
            if len(item_data) > 1:
                avg_sales = item_data['qty'].mean()
                peak_month_row = item_data.loc[item_data['qty'].idxmax()]
                peak_month = peak_month_row['month']
                peak_sales = peak_month_row['qty']
                
                # Calculate percentage increase
                if avg_sales > 0:
                    pct_increase = ((peak_sales - avg_sales) / avg_sales) * 100
                    if pct_increase > 25: # Strong seasonal trend threshold
                        findings[item] = f"需求在 {peak_month} 激增，较月度平均增长 {pct_increase:.0f}%。"
                        
        # Prophet trend decomposition on aggregate daily store sales
        chart_data = [] # Data array specifically for Recharts
        top_items_data = monthly_sales[monthly_sales['name'].isin(top_items)]
        
        # We need a stable pivot for Recharts: rows are months, columns are item quantities
        if not top_items_data.empty:
            pivot = top_items_data.pivot_table(index='month_num', columns='name', values='qty', aggfunc='sum').fillna(0)
            
            # Month mapping (reuse month_names defined above)
            for month_num in pivot.index:
                row_dict = {"name": month_names.get(month_num, str(month_num))}
                for col in pivot.columns:
                    row_dict[col] = float(pivot.at[month_num, col])
                chart_data.append(row_dict)
                
        try:
            from prophet import Prophet  # lazy import: Prophet 1.1.5 is incompatible with NumPy 2.x
            daily_sales = df.groupby(df['created_at'].dt.date)['qty'].sum().reset_index()
            daily_sales.columns = ['ds', 'y']
            
            if len(daily_sales) >= 14:
                # Initialize Prophet model
                m = Prophet(daily_seasonality=False, yearly_seasonality=False)
                m.fit(daily_sales)
                
                forecast = m.predict(daily_sales)
                
                trend_start = forecast['trend'].iloc[0]
                trend_end = forecast['trend'].iloc[-1]
                trend_direction = "上升" if trend_end > trend_start else "下降"
                pct_change = abs((trend_end - trend_start) / trend_start) * 100 if trend_start != 0 else 0
                
                findings["整体店铺趋势"] = f"Prophet 分析显示，分析周期内销量呈 {trend_direction} 趋势，变化幅度为 {pct_change:.0f}%。"
        except Exception as e:
            pass # Silently drop if Prophet fails on small datasets
            
        return {"findings": findings, "chart_data": chart_data}

    except Exception as e:
        return {"error": f"分析数据失败：{str(e)}"}


def generate_forecast_report():
    """ Generates math stats then asks Ollama to format as Markdown. """
    analysis_result = analyze_seasonality()
    
    if "error" in analysis_result:
        return _generate_error_md("数据分析错误", analysis_result["error"])

    stats_data = analysis_result.get("findings", {})
    chart_data = analysis_result.get("chart_data", [])
    
    stats_json = json.dumps(stats_data, indent=2)

    # Use the centralized dynamic configuration for consistency across agents
    model_name = get_current_model("forecast")
    
    try:
        system_prompt = (
            "你是一个高度分析性的结构化智能体。你的任务是将原始 Prophet 数据处理成结构化的 JSON 载荷。\n"
            "严格返回符合以下精确 schema 的 JSON 对象：\n"
            "{\n"
            '  "executive_summary": "一段 2-3 句的战略性执行概览字符串（简体中文）",\n'
            '  "overall_trend": {"direction": "upward/downward", "percentage": "数字字符串", "analysis": "详细评述字符串（简体中文）"},\n'
            '  "anomalies": [\n'
            '    {"item": "字符串", "insight": "解释其含义的字符串（简体中文）", "recommended_action": "可执行的采购建议（简体中文）", "severity": "High/Medium/Low"}\n'
            "  ]\n"
            "}\n"
            "不要输出 markdown，不要用代码块包裹，只输出原始 JSON。JSON 键名保持英文，所有文本值使用简体中文。\n"
            "月份一律使用中文（如「12月」「1月」），严禁输出英文月份（如 December、January）。\n"
            'overall_trend.percentage 必须是纯数字（如 "12.5"），不要带百分号 "%"。'
        )
        
        user_prompt = f"请将以下统计数据映射到严格的 JSON schema 中（文本值使用简体中文）：\n\n{stats_json}"
        
        llm = get_llm("forecast", format="json", temperature=0.1)
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ])
        
        markdown_content = response.content.strip()
        
        # Clean up any potential markdown code block wrappers
        if markdown_content.startswith("```json"):
            markdown_content = markdown_content[7:].strip()
        elif markdown_content.startswith("```"):
            markdown_content = markdown_content[3:].strip()
        if markdown_content.endswith("```"):
            markdown_content = markdown_content[:-3].strip()
            
        try:
            import json as local_json
            parsed = local_json.loads(markdown_content)
            parsed["model_used"] = model_name
            markdown_content = local_json.dumps(parsed)
        except Exception:
            pass
            
        return {
            "stats_json": stats_json,
            "markdown": markdown_content,
            "chart_data": chart_data
        }
        
    except Exception as e:
        err_dict = _generate_error_md("Ollama 智能体错误", f"无法连接 Ollama 或处理提示。详情：{str(e)}")
        err_dict["stats_json"] = stats_json
        return err_dict

def _generate_error_md(title, message):
    """Helper to generate a styled error block as a proper response dict."""
    md = f"""# ❌ {title}

**错误详情：**
{message}
"""
    return {"error": True, "markdown": md.strip()}


# ── 后台预测生成状态 ──────────────────────────────
_forecast_status = {"state": "idle"}  # idle | generating | done | error


def get_forecast_status() -> dict:
    """返回当前后台预测生成状态。"""
    return _forecast_status


def _run_forecast_and_save():
    """在后台线程中生成预测并落库。"""
    global _forecast_status
    _forecast_status = {"state": "generating"}
    try:
        result = generate_forecast_report()
        if result.get("error") is True:
            _forecast_status = {"state": "error", "message": result.get("markdown", "预测生成失败")}
            return

        from backend.database import save_forecast
        chart_data_json = json.dumps(result.get("chart_data", []))
        save_forecast(
            result.get("stats_json", "{}"),
            result.get("markdown", ""),
            chart_data_json,
        )
        _forecast_status = {"state": "done"}
    except Exception as e:
        _forecast_status = {"state": "error", "message": str(e)}


def start_forecast_generation() -> bool:
    """启动后台预测生成线程；若已在生成中则返回 False。"""
    if _forecast_status.get("state") == "generating":
        return False
    t = threading.Thread(target=_run_forecast_and_save, daemon=True)
    t.start()
    return True
