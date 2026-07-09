import json
import logging
from typing import Any
import google.genai as genai
from app.config import settings

logger = logging.getLogger(__name__)


class GeminiAdapter:
    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model
        self._client = None

    def _get_client(self):
        if self._client is None and self.api_key:
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    async def generate_structured(
        self, system_prompt: str, user_prompt: str, output_schema: dict | None = None
    ) -> dict[str, Any] | None:
        client = self._get_client()
        if not client:
            return None

        full_prompt = f"{system_prompt}\n\n{user_prompt}"
        if output_schema:
            full_prompt += f"\n\nRespond with valid JSON matching this schema: {json.dumps(output_schema)}"

        max_retries = 3
        last_error = None
        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model=self.model,
                    contents=full_prompt,
                    config={
                        "response_mime_type": "application/json" if output_schema else "text/plain",
                    } if output_schema else None,
                )
                if not response.text:
                    continue
                if output_schema:
                    return json.loads(response.text)
                return {"text": response.text}
            except Exception as e:
                last_error = str(e)
                if attempt < max_retries - 1:
                    import asyncio
                    await asyncio.sleep(2 ** attempt)

        logger.error(f"Gemini call failed after {max_retries} retries: {last_error}")
        return None
