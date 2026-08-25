"""邮箱同步的 IMAP 客户端标识与错误透传测试。"""
import imaplib

import pytest
from fastapi.testclient import TestClient

from backend.api import app
from backend.email_service import EmailService


class FakeIMAP:
    instances = []
    select_result = ("OK", [b"0"])
    list_result = ("OK", [])

    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.events = []
        type(self).instances.append(self)

    def login(self, user, password):
        self.events.append(("login", user, password))
        return "OK", [b"logged in"]

    def _simple_command(self, command, payload):
        self.events.append((command, payload))
        return "OK", [b"ID accepted"]

    def select(self, folder):
        self.events.append(("select", folder))
        return type(self).select_result

    def list(self):
        self.events.append(("list",))
        return type(self).list_result

    def uid(self, command, *args):
        self.events.append(("uid", command, *args))
        return "OK", [b""]

    def close(self):
        self.events.append(("close",))

    def logout(self):
        self.events.append(("logout",))


def _configure_email(monkeypatch, *, imap_server="imap.126.com"):
    monkeypatch.setenv("EMAIL_USER", "system@example.com")
    monkeypatch.setenv("EMAIL_PASS", "client-authorization-code")
    monkeypatch.setenv("IMAP_SERVER", imap_server)
    monkeypatch.setenv("IMAP_PORT", "993")
    monkeypatch.setenv("SMTP_SERVER", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "465")


def test_netease_imap_id_is_sent_after_login_before_select(monkeypatch, temp_db):
    _configure_email(monkeypatch)
    FakeIMAP.instances = []
    FakeIMAP.select_result = ("OK", [b"0"])
    monkeypatch.setattr(imaplib, "IMAP4_SSL", FakeIMAP)

    assert EmailService().fetch_emails("INBOX") == []

    events = FakeIMAP.instances[0].events
    event_names = [event[0] for event in events]
    assert "ID" in event_names
    assert event_names.index("login") < event_names.index("ID") < event_names.index("select")


def test_non_netease_imap_does_not_send_id(monkeypatch, temp_db):
    _configure_email(monkeypatch, imap_server="imap.example.com")
    FakeIMAP.instances = []
    FakeIMAP.select_result = ("OK", [b"0"])
    monkeypatch.setattr(imaplib, "IMAP4_SSL", FakeIMAP)

    assert EmailService().fetch_emails("INBOX") == []

    event_names = [event[0] for event in FakeIMAP.instances[0].events]
    assert "ID" not in event_names


def test_select_rejection_is_raised_instead_of_becoming_empty_inbox(monkeypatch, temp_db):
    _configure_email(monkeypatch)
    FakeIMAP.instances = []
    FakeIMAP.select_result = (
        "NO",
        [b"EXAMINE Unsafe Login. Please contact kefu@188.com for help"],
    )
    monkeypatch.setattr(imaplib, "IMAP4_SSL", FakeIMAP)

    with pytest.raises(RuntimeError, match="Unsafe Login"):
        EmailService().fetch_emails("INBOX")


def test_sent_folder_is_found_by_imap_special_use_flag(monkeypatch, temp_db):
    _configure_email(monkeypatch)
    FakeIMAP.instances = []
    FakeIMAP.select_result = ("OK", [b"0"])
    FakeIMAP.list_result = (
        "OK",
        [
            b'() "/" "INBOX"',
            b'(\\Sent) "/" "&XfJT0ZAB-"',
        ],
    )
    monkeypatch.setattr(imaplib, "IMAP4_SSL", FakeIMAP)

    assert EmailService().fetch_emails("sent") == []

    events = FakeIMAP.instances[0].events
    assert ("select", '"&XfJT0ZAB-"') in events


def test_sync_endpoint_returns_upstream_error(monkeypatch, temp_db):
    import backend.email_service as email_module

    error_type = getattr(email_module, "EmailSyncError", RuntimeError)

    def fail_sync(*_args, **_kwargs):
        raise error_type("邮箱服务器拒绝访问收件箱：Unsafe Login")

    monkeypatch.setattr(EmailService, "fetch_emails", fail_sync)

    response = TestClient(app).post("/emails/sync?folder=inbox")

    assert response.status_code == 502
    assert "Unsafe Login" in response.json()["detail"]
