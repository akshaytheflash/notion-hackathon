import pytest

from app.adapters.gemini import GeminiAdapter


import json


class _FakeResponse:
    def __init__(self, text, status_code=200):
        self.text = text
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=self)

    def json(self):
        return json.loads(self.text)


class _FakeHttpClient:
    def __init__(self, texts):
        self._texts = list(texts)
        self.calls = 0
        self.responses = []

    async def post(self, url, json=None, timeout=None):
        self.calls += 1
        text = self._texts[min(self.calls - 1, len(self._texts) - 1)]
        resp = _FakeResponse(text)
        self.responses.append(resp)
        return resp


@pytest.mark.parametrize("sleep_patch", [True])
async def test_malformed_json_is_retried_then_recovers(monkeypatch, sleep_patch):
    import httpx
    adapter = GeminiAdapter()
    adapter.api_key = "fake-key"
    adapter._http = _FakeHttpClient(["not json at all", "{broken", '{"agent": "Eng", "confidence": 0.9}'])

    async def no_sleep(_):
        return None
    monkeypatch.setattr("asyncio.sleep", no_sleep)

    result = await adapter.generate_structured("system", "user", {"type": "object"})

    assert result == {"agent": "Eng", "confidence": 0.9}
    assert adapter._http.calls == 3


async def test_persistent_malformed_json_returns_none_not_exception(monkeypatch):
    import httpx
    adapter = GeminiAdapter()
    adapter.api_key = "fake-key"
    adapter._http = _FakeHttpClient(["not json", "still not json", "nope"])

    async def no_sleep(_):
        return None
    monkeypatch.setattr("asyncio.sleep", no_sleep)

    result = await adapter.generate_structured("system", "user", {"type": "object"})

    assert result is None
    assert adapter._http.calls == 3


async def test_empty_response_text_is_treated_as_retry_not_crash(monkeypatch):
    import httpx
    adapter = GeminiAdapter()
    adapter.api_key = "fake-key"
    adapter._http = _FakeHttpClient(["", "", ""])

    async def no_sleep(_):
        return None
    monkeypatch.setattr("asyncio.sleep", no_sleep)

    result = await adapter.generate_structured("system", "user", {"type": "object"})

    assert result is None
