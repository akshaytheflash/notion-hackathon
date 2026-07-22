import json
import logging
from typing import Any
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class GitHubAdapter:
    def __init__(self):
        self.token = settings.github_token
        self.owner = settings.github_owner
        self.repo = settings.github_repo
        self._client = None

    def _get_client(self) -> httpx.AsyncClient | None:
        if not self.token or not self.owner:
            return None
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url="https://api.github.com",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Accept": "application/vnd.github+json",
                },
                timeout=30.0,
            )
        return self._client

    async def create_issue(self, idempotency_key: str, title: str, body: str) -> dict[str, Any] | None:
        client = self._get_client()
        if not client:
            return None
        try:
            r = await client.post(
                f"/repos/{self.owner}/{self.repo}/issues",
                json={"title": title, "body": body},
            )
            if r.status_code in (200, 201):
                data = r.json()
                return {"issue_number": data["number"], "issue_url": data["html_url"]}
            logger.error(f"GitHub issue creation failed: {r.status_code} {r.text[:200]}")
            return None
        except Exception as e:
            logger.error(f"GitHub API error: {e}")
            return None
