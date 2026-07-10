import asyncio
import json
import logging
from typing import Any
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class GeminiAdapter:
    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))

    async def generate_structured(
        self, system_prompt: str, user_prompt: str, output_schema: dict | None = None
    ) -> dict[str, Any] | None:
        if not self.api_key:
            logger.warning("Gemini API key not configured")
            return None

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        body = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
        }

        if output_schema:
            body["generationConfig"] = {"response_mime_type": "application/json"}

        max_retries = 5
        last_error = None
        for attempt in range(max_retries):
            try:
                resp = await self._http.post(url, json=body)
                if resp.status_code == 429:
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
                    logger.warning(f"Gemini quota exhausted, retrying in {wait}s")
                    await asyncio.sleep(wait)
                    continue
                if resp.status_code == 403:
                    logger.error(f"GEMINI 403: {resp.text}")
                    return None
                if resp.status_code == 400:
                    logger.error(f"Gemini 400: {resp.text}")
                    return None
                resp.raise_for_status()

                data = resp.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    block_reason = data.get("promptFeedback", {}).get("blockReason", "unknown")
                    logger.warning(f"Gemini blocked response: {block_reason}")
                    return None

                text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                if not text:
                    finish_reason = candidates[0].get("finishReason", "unknown")
                    logger.warning(f"Gemini empty response, finish_reason={finish_reason}")
                    continue

                if output_schema:
                    parsed = json.loads(text)
                    return parsed
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
