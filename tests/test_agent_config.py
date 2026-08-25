"""模型设置更新后，运行中的服务必须立即使用新配置。"""

from backend.agents import config


def test_cloud_config_update_invalidates_cached_clients(monkeypatch):
    monkeypatch.setattr(config, "set_key", lambda *args, **kwargs: None)
    monkeypatch.setenv("CLOUD_BASE_URL", "https://old.example.com")
    monkeypatch.setenv("CLOUD_API_KEY", "old-key")
    monkeypatch.setitem(config.llm_instances, "orchestrator_openai_json_None_old", object())

    config.update_cloud_config("https://api.deepseek.com", "new-key")

    assert config.llm_instances == {}
    assert config.get_cloud_base_url() == "https://api.deepseek.com"
    assert config.get_cloud_api_key() == "new-key"


def test_model_update_invalidates_only_the_changed_agent(monkeypatch):
    monkeypatch.setattr(config, "set_key", lambda *args, **kwargs: None)
    monkeypatch.setenv("ORCHESTRATOR_MODEL", "old-model")
    monkeypatch.setenv("ORCHESTRATOR_PROVIDER", "ollama")
    config.llm_instances.update({
        "orchestrator_openai_json_None_old": object(),
        "email_openai_default_None_old": object(),
    })

    config.update_agent_model("orchestrator", "deepseek-chat", "openai")

    assert "orchestrator_openai_json_None_old" not in config.llm_instances
    assert "email_openai_default_None_old" in config.llm_instances
