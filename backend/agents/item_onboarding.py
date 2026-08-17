"""
物料建档 Agent：从自然语言提取物料信息并生成 SKU。
"""
import json

from langchain_core.messages import HumanMessage, SystemMessage

from backend.agents.config import get_email_analyzer_llm
from backend.agents.models import ItemExtraction


def onboard_item(text: str) -> dict:
    """从自然语言提取物料信息，返回结构化 dict；失败返回 None。"""
    system_prompt = """你是一个物料建档智能体。从用户提供的文本中提取物料信息。

必须提取的字段：
- name: 物料名称
- unit: 计量单位（如 件/个/米/千克/卷/套，没有则为 null）
- unit_price: 单价（数字，没有则为 0）
- vendor_name: 默认供应商名称（没有则为 null）
- sku: 根据物料名称生成一个规范的英文 SKU 编码。类别前缀用：
  RAW=原材料、ELC=电子电气、MEC=机械、ENE=能源、MFG=制造、RND=研发、ENG=工程、IT=信息、OFC=办公、OPS=运营。
  例如"冷轧钢板 2mm" -> "RAW-STEEL-2MM"

只输出符合 schema 的纯 JSON，键名保持英文，文本值使用简体中文。"""

    try:
        response = get_email_analyzer_llm().invoke([
            SystemMessage(content=system_prompt + "\nSchema: {\"name\": \"str\", \"unit\": \"str|null\", \"unit_price\": number, \"vendor_name\": \"str|null\", \"sku\": \"str\"}\n只返回纯 JSON。"),
            HumanMessage(content=text),
        ])
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:-3]
        elif content.startswith("```"):
            content = content[3:-3]

        data = json.loads(content)
        extracted = ItemExtraction(**data)
        return extracted.model_dump()
    except Exception as e:
        print(f"物料建档提取失败: {e}")
        return None
