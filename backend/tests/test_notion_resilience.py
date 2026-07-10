import pytest

from app.adapters.notion import NotionAdapter


class _FakeResponse:
    def __init__(self, status_code, json_body=None, text=""):
        self.status_code = status_code
        self._json_body = json_body or {}
        self.text = text or str(json_body)

    def json(self):
        return self._json_body


class _FakeAsyncClient:
    """Replays a canned sequence of responses per call, and records request bodies."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    async def request(self, method, path, **kwargs):
        self.calls.append({"method": method, "path": path, **kwargs})
        return self._responses.pop(0)


async def test_create_page_parent_has_no_type_key():
    """Regression test for the 400 bug: Notion's 2025-09-03 API expects
    {"data_source_id": "..."} with NO "type" key -- {"type": "data_source", ...}
    is rejected."""
    adapter = NotionAdapter()
    adapter.token = "fake-token"
    fake_client = _FakeAsyncClient([_FakeResponse(200, {"id": "page-1"})])
    adapter._client = fake_client

    result = await adapter._create_page("ds-123", {"Name": {"title": []}})

    assert result == {"id": "page-1"}
    sent_body = fake_client.calls[0]["json"]
    assert sent_body["parent"] == {"data_source_id": "ds-123"}
    assert "type" not in sent_body["parent"]


async def test_permanent_error_returns_none_without_retry(monkeypatch):
    adapter = NotionAdapter()
    adapter.token = "fake-token"
    fake_client = _FakeAsyncClient([_FakeResponse(400, text="invalid_request")])
    adapter._client = fake_client

    result = await adapter._request("POST", "/pages", json={})

    assert result is None
    assert len(fake_client.calls) == 1, "400s are permanent and must not be retried"


async def test_transient_error_is_retried_then_succeeds(monkeypatch):
    adapter = NotionAdapter()
    adapter.token = "fake-token"
    fake_client = _FakeAsyncClient([
        _FakeResponse(503, text="temporarily unavailable"),
        _FakeResponse(200, {"id": "page-2"}),
    ])
    adapter._client = fake_client

    async def no_sleep(_):
        return None
    monkeypatch.setattr("asyncio.sleep", no_sleep)

    result = await adapter._request("POST", "/pages", json={})

    assert result == {"id": "page-2"}
    assert len(fake_client.calls) == 2


async def test_persistent_transient_error_gives_up_after_max_retries(monkeypatch):
    adapter = NotionAdapter()
    adapter.token = "fake-token"
    fake_client = _FakeAsyncClient([
        _FakeResponse(500, text="err1"),
        _FakeResponse(500, text="err2"),
        _FakeResponse(500, text="err3"),
    ])
    adapter._client = fake_client

    async def no_sleep(_):
        return None
    monkeypatch.setattr("asyncio.sleep", no_sleep)

    result = await adapter._request("POST", "/pages", json={})

    assert result is None
    assert len(fake_client.calls) == 3
