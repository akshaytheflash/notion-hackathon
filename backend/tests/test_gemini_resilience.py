import pytest

from app.adapters.gemini import GeminiAdapter


class _FakeResponse:
    def __init__(self, text):
        self.text = text


class _FakeModels:
    def __init__(self, texts):
        self._texts = list(texts)
        self.calls = 0

    def generate_content(self, model, contents, config=None):
        self.calls += 1
        text = self._texts[min(self.calls - 1, len(self._texts) - 1)]
        return _FakeResponse(text)


class _FakeClient:
    def __init__(self, texts):
        self.models = _FakeModels(texts)


@pytest.mark.parametrize("sleep_patch", [True])
async def test_malformed_json_is_retried_then_recovers(monkeypatch, sleep_patch):
    adapter = GeminiAdapter()
    adapter.api_key = "fake-key"
    adapter._client = _FakeClient(["not json at all", "{broken", '{"agent": "Eng", "confidence": 0.9}'])

    async def no_sleep(_):
        return None
    monkeypatch.setattr("asyncio.sleep", no_sleep)

    result = await adapter.generate_structured("system", "user", {"type": "object"})

    assert result == {"agent": "Eng", "confidence": 0.9}
    assert adapter._client.models.calls == 3


async def test_persistent_malformed_json_returns_none_not_exception(monkeypatch):
    adapter = GeminiAdapter()
    adapter.api_key = "fake-key"
    adapter._client = _FakeClient(["not json", "still not json", "nope"])

    async def no_sleep(_):
        return None
    monkeypatch.setattr("asyncio.sleep", no_sleep)

    result = await adapter.generate_structured("system", "user", {"type": "object"})

    assert result is None
    assert adapter._client.models.calls == 3


async def test_empty_response_text_is_treated_as_retry_not_crash(monkeypatch):
    adapter = GeminiAdapter()
    adapter.api_key = "fake-key"
    adapter._client = _FakeClient(["", "", ""])

    async def no_sleep(_):
        return None
    monkeypatch.setattr("asyncio.sleep", no_sleep)

    result = await adapter.generate_structured("system", "user", {"type": "object"})

    assert result is None
