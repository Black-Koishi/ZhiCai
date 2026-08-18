"""
Shared LLM configuration and model instances for all agents.

支持两种模型提供方：
  - ollama：本地 Ollama（默认）
  - openai ：云端 OpenAI 兼容 API（OpenAI / DeepSeek / Qwen / Moonshot / 智谱 等）
"""
import os
from dotenv import load_dotenv, set_key
from langchain_ollama import ChatOllama

# Load environment variables
load_dotenv()

# 本地 Ollama 配置
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# 各智能体对应的模型环境变量 key
AGENT_ENV_KEYS = {
    "orchestrator": "ORCHESTRATOR_MODEL",
    "email": "EMAIL_MODEL",
    "compliance": "COMPLIANCE_MODEL",
    "forecast": "FORECAST_MODEL",
}

# 缓存已实例化的模型，避免每次调用重复创建
llm_instances = {}


def get_current_model(agent_name: str) -> str:
    """获取指定智能体当前配置的模型名。"""
    key = AGENT_ENV_KEYS.get(agent_name, "ORCHESTRATOR_MODEL")
    return os.getenv(key, "mistral")


def get_provider(agent_name: str) -> str:
    """获取指定智能体的模型提供方：ollama（本地）或 openai（云端）。"""
    key = AGENT_ENV_KEYS.get(agent_name)
    if not key:
        return "ollama"
    prov_key = key.replace("_MODEL", "_PROVIDER")
    return os.getenv(prov_key, "ollama")


def get_cloud_base_url() -> str:
    return os.getenv("CLOUD_BASE_URL", "")


def get_cloud_api_key() -> str:
    return os.getenv("CLOUD_API_KEY", "")


def get_llm(agent_name: str, format: str = None, temperature: float = None):
    """
    返回指定智能体的 LLM 实例。
    根据该智能体配置的 provider 返回 ChatOllama（本地）或 ChatOpenAI（云端）。
    """
    model_name = get_current_model(agent_name)
    provider = get_provider(agent_name)
    instance_key = f"{agent_name}_{provider}_{format or 'default'}_{temperature}_{model_name}"

    if instance_key in llm_instances:
        return llm_instances[instance_key]

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        kwargs = {
            "model": model_name,
            "api_key": get_cloud_api_key() or "not-needed",
            "base_url": get_cloud_base_url() or None,
            "request_timeout": 60.0,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature
        if format == "json":
            # OpenAI 兼容的 JSON 输出模式（OpenAI / DeepSeek / Qwen / Moonshot 等均支持）
            kwargs["model_kwargs"] = {"response_format": {"type": "json_object"}}
        llm = ChatOpenAI(**kwargs)
    else:
        kwargs = {"model": model_name, "base_url": OLLAMA_BASE_URL, "client_kwargs": {"timeout": 60.0}}
        if format:
            kwargs["format"] = format
        if temperature is not None:
            kwargs["temperature"] = temperature
        llm = ChatOllama(**kwargs)

    llm_instances[instance_key] = llm
    return llm


def update_agent_model(agent_name: str, model_name: str, provider: str = None):
    """更新指定智能体的模型（可选 provider），并持久化到 .env。"""
    key = AGENT_ENV_KEYS.get(agent_name)
    if not key:
        raise ValueError(f"Unknown agent name: {agent_name}")

    os.environ[key] = model_name
    dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
    set_key(dotenv_path, key, model_name)

    if provider:
        prov_key = key.replace("_MODEL", "_PROVIDER")
        os.environ[prov_key] = provider
        set_key(dotenv_path, prov_key, provider)


def update_cloud_config(base_url: str = None, api_key: str = None):
    """更新云端（OpenAI 兼容）配置并持久化到 .env；api_key 留空表示不修改。"""
    dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
    if base_url is not None:
        os.environ["CLOUD_BASE_URL"] = base_url
        set_key(dotenv_path, "CLOUD_BASE_URL", base_url)
    if api_key:
        os.environ["CLOUD_API_KEY"] = api_key
        set_key(dotenv_path, "CLOUD_API_KEY", api_key)


def list_ollama_models() -> list[str]:
    """从本地 Ollama 获取已安装（已 pull）的模型名称列表。"""
    import json
    import urllib.request
    try:
        with urllib.request.urlopen(f"{OLLAMA_BASE_URL}/api/tags", timeout=5) as resp:
            data = json.loads(resp.read())
        return [m.get("name") for m in data.get("models", [])]
    except Exception as e:
        print(f"获取 Ollama 模型列表失败: {e}")
        return []


# 兼容旧调用：各智能体的 LLM 快捷访问器
def get_router_llm(): return get_llm("orchestrator", format="json")
def get_email_analyzer_llm(): return get_llm("email")
def get_compliance_llm(): return get_llm("compliance")
