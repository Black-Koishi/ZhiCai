"""
供应商入驻 Agent：从自然语言/邮件文本中提取供应商信息，并生成初始评分与审核意见。
"""
import json

from langchain_core.messages import HumanMessage, SystemMessage

from backend.agents.config import get_email_analyzer_llm
from backend.agents.models import SupplierExtraction


def score_supplier(description: str) -> dict:
    """根据供应商描述，用现有评分逻辑生成初始评分与审核意见。

    返回 {"ext_score": int, "review": str}；描述为空或模型失败时回退默认分 80。
    """
    default = {"ext_score": 60, "review": "供应商信息不全，暂评为较低分。"}
    if not description or not description.strip():
        return default

    system_prompt = """你是一个供应商入驻审核智能体。根据用户对供应商的描述，给出初始评分与审核意见。

评分规则（ext_score 为 0-100 的整数）：
- 有 ISO 认证、多年行业经验、知名品牌、上市公司等 → 高分（85-95）
- 信息完整但无特别资质 → 中等（75-85）
- 信息不全或描述可疑 → 较低（60-75）

review 为 1-2 句简体中文审核意见，说明评分理由。

只输出纯 JSON：{"ext_score": int, "review": "str"}"""

    try:
        response = get_email_analyzer_llm().invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=description),
        ])
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:-3]
        elif content.startswith("```"):
            content = content[3:-3]

        data = json.loads(content)
        score = int(data.get("ext_score", 80))
        score = max(0, min(100, score))
        return {"ext_score": score, "review": data.get("review", "")}
    except Exception as e:
        print(f"供应商评分失败: {e}")
        return default


def onboard_supplier(text: str) -> dict:
    """从自然语言提取供应商信息，返回结构化 dict；失败返回 None。"""
    system_prompt = """你是一个供应商入驻审核智能体。从用户提供的文本中提取供应商信息。

必须提取的字段：
- name: 供应商名称
- email: 供应商邮箱（没有则为 null）
- phone: 供应商电话（没有则为 null）
- category: 主营品类/主营业务（没有则为 null）
- ext_score: 初始评分（0-100 的整数），根据描述中的资质信息判断：
  - 有 ISO 认证、多年行业经验、知名品牌、上市公司等 → 高分（85-95）
  - 信息完整但无特别资质 → 中等（75-85）
  - 信息不全或描述可疑 → 较低（60-75）
- review: 审核意见（1-2 句简体中文，说明评分理由）

只输出符合 schema 的纯 JSON，键名保持英文，文本值使用简体中文。"""

    try:
        response = get_email_analyzer_llm().invoke([
            SystemMessage(content=system_prompt + "\nSchema: {\"name\": \"str\", \"email\": \"str|null\", \"phone\": \"str|null\", \"category\": \"str|null\", \"ext_score\": int, \"review\": \"str\"}\n只返回纯 JSON。"),
            HumanMessage(content=text),
        ])
        content = response.content.strip()
        # 去掉可能的 markdown 代码块包裹
        if content.startswith("```json"):
            content = content[7:-3]
        elif content.startswith("```"):
            content = content[3:-3]

        data = json.loads(content)
        extracted = SupplierExtraction(**data)
        return extracted.model_dump()
    except Exception as e:
        print(f"供应商入驻提取失败: {e}")
        return None
