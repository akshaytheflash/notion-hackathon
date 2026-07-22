import json
import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class SlackAdapter:
    def __init__(self):
        self.webhook_url = settings.slack_webhook_url

    async def send_notification(self, text: str) -> bool:
        if not self.webhook_url:
            return False
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.post(self.webhook_url, json={"text": text})
                if r.status_code == 200:
                    return True
                logger.error(f"Slack notification failed: {r.status_code}")
                return False
        except Exception as e:
            logger.error(f"Slack API error: {e}")
            return False
