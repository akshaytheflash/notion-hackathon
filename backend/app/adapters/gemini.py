import asyncio
import json
import logging
from typing import Any, Callable
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class GeminiAdapter:
    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0))

    async def generate_structured(
        self, system_prompt: str, user_prompt: str, output_schema: dict | None = None,
        on_token: Callable | None = None,
    ) -> dict[str, Any] | None:
        if not self.api_key:
            logger.warning("Gemini API key not configured")
            return None

        if on_token:
            return await self._generate_structured_streaming(system_prompt, user_prompt, output_schema, on_token)
        return await self._generate_structured_blocking(system_prompt, user_prompt, output_schema)

    async def _generate_structured_blocking(
        self, system_prompt: str, user_prompt: str, output_schema: dict | None = None
    ) -> dict[str, Any] | None:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        body = self._build_body(system_prompt, user_prompt, output_schema)

        max_retries = 5
        last_error = None
        for attempt in range(max_retries):
            try:
                resp = await self._http.post(url, json=body)
                if resp.status_code == 429:
                    wait = await self._parse_retry_delay(resp)
                    logger.warning(f"Gemini quota exhausted, retrying in {wait}s")
                    await asyncio.sleep(wait)
                    continue
                if resp.status_code in (403, 400):
                    logger.error(f"Gemini {resp.status_code}: {resp.text}")
                    return None
                resp.raise_for_status()

                text = self._extract_text(resp.json())
                if text is None:
                    continue

                if output_schema:
                    return json.loads(text)
                return {"text": text}

            except json.JSONDecodeError as e:
                last_error = f"Invalid JSON: {e}"
                logger.warning(f"Gemini malformed JSON (attempt {attempt + 1})")
                await asyncio.sleep(2 ** attempt)
            except httpx.TimeoutException as e:
                last_error = f"Timeout: {e}"
                logger.warning(f"Gemini timeout (attempt {attempt + 1})")
                await asyncio.sleep(2 ** attempt)
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Gemini error (attempt {attempt + 1}): {e}")
                await asyncio.sleep(2 ** attempt)

        logger.error(f"Gemini call failed after {max_retries} retries: {last_error}")
        return None

    async def _generate_structured_streaming(
        self, system_prompt: str, user_prompt: str, output_schema: dict | None = None,
        on_token: Callable | None = None,
    ) -> dict[str, Any] | None:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:streamGenerateContent?alt=sse&key={self.api_key}"
        body = self._build_body(system_prompt, user_prompt, output_schema)

        max_retries = 3
        last_error = None
        for attempt in range(max_retries):
            try:
                async with self._http.stream("POST", url, json=body) as resp:
                    if resp.status_code == 429:
                        wait = 15
                        logger.warning(f"Gemini quota exhausted (stream), retrying in {wait}s")
                        await asyncio.sleep(wait)
                        continue
                    if resp.status_code in (403, 400):
                        logger.error(f"Gemini {resp.status_code}: {resp.text}")
                        return None
                    resp.raise_for_status()

                    full_text = ""
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            text = self._extract_text(chunk)
                            if text:
                                full_text += text
                                if on_token:
                                    await on_token(text)
                        except json.JSONDecodeError:
                            continue

                    if not full_text:
                        continue
                    if output_schema:
                        return json.loads(full_text)
                    return {"text": full_text}

            except httpx.TimeoutException as e:
                last_error = f"Timeout: {e}"
                logger.warning(f"Gemini stream timeout (attempt {attempt + 1})")
                await asyncio.sleep(2 ** attempt)
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Gemini stream error (attempt {attempt + 1}): {e}")
                await asyncio.sleep(2 ** attempt)

        logger.error(f"Gemini streaming call failed after {max_retries} retries: {last_error}")
        return None

    def _build_body(self, system_prompt: str, user_prompt: str, output_schema: dict | None = None) -> dict:
        body = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
        }
        if output_schema:
            body["generationConfig"] = {
                "response_mime_type": "application/json",
                "response_schema": output_schema,
            }
        return body

    async def _parse_retry_delay(self, resp: httpx.Response) -> int:
        wait = 15
        try:
            details = resp.json().get("error", {}).get("details", [])
            for d in details:
                if d.get("@type") == "type.googleapis.com/google.rpc.RetryInfo":
                    delay = d.get("retryDelay", "")
                    if delay.endswith("s"):
                        wait = max(wait, int(float(delay[:-1])) + 5)
        except Exception:
            pass
        return wait

    def _extract_text(self, data: dict) -> str | None:
        candidates = data.get("candidates", [])
        if not candidates:
            block_reason = data.get("promptFeedback", {}).get("blockReason", "unknown")
            logger.warning(f"Gemini blocked response: {block_reason}")
            return None
        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        if not text:
            finish_reason = candidates[0].get("finishReason", "unknown")
            logger.warning(f"Gemini empty response, finish_reason={finish_reason}")
            return None
        return text
