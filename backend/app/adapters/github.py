import json
import logging
import base64
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

    async def get_file_content(self, path: str, ref: str = "main") -> dict[str, Any] | None:
        client = self._get_client()
        if not client:
            return None
        try:
            r = await client.get(f"/repos/{self.owner}/{self.repo}/contents/{path}?ref={ref}")
            if r.status_code == 200:
                data = r.json()
                content = base64.b64decode(data["content"]).decode("utf-8")
                return {"content": content, "sha": data["sha"], "path": path}
            logger.error(f"GitHub get file failed: {r.status_code} {r.text[:200]}")
            return None
        except Exception as e:
            logger.error(f"GitHub API error: {e}")
            return None

    async def create_or_update_file(self, path: str, content: str, message: str, sha: str | None = None, branch: str = "main") -> dict[str, Any] | None:
        client = self._get_client()
        if not client:
            return None
        try:
            body = {
                "message": message,
                "content": base64.b64encode(content.encode("utf-8")).decode("utf-8"),
                "branch": branch,
            }
            if sha:
                body["sha"] = sha
            r = await client.put(f"/repos/{self.owner}/{self.repo}/contents/{path}", json=body)
            if r.status_code in (200, 201):
                data = r.json()
                return {"commit_sha": data["commit"]["sha"], "path": path}
            logger.error(f"GitHub create/update file failed: {r.status_code} {r.text[:200]}")
            return None
        except Exception as e:
            logger.error(f"GitHub API error: {e}")
            return None

    async def get_default_branch_sha(self) -> str | None:
        client = self._get_client()
        if not client:
            return None
        try:
            r = await client.get(f"/repos/{self.owner}/{self.repo}/git/refs/heads/main")
            if r.status_code == 200:
                return r.json()["object"]["sha"]
            r = await client.get(f"/repos/{self.owner}/{self.repo}")
            if r.status_code == 200:
                return r.json()["default_branch"]
            logger.error(f"GitHub get branch sha failed: {r.status_code} {r.text[:200]}")
            return None
        except Exception as e:
            logger.error(f"GitHub API error: {e}")
            return None

    async def create_branch(self, branch_name: str, base_sha: str) -> bool:
        client = self._get_client()
        if not client:
            return False
        try:
            r = await client.post(f"/repos/{self.owner}/{self.repo}/git/refs", json={
                "ref": f"refs/heads/{branch_name}",
                "sha": base_sha,
            })
            if r.status_code == 201:
                logger.info(f"Branch '{branch_name}' created from sha {base_sha[:8]}")
                return True
            logger.error(f"GitHub create branch failed: {r.status_code} {r.text[:200]}")
            return False
        except Exception as e:
            logger.error(f"GitHub API error: {e}")
            return False

    async def create_pull_request(self, title: str, body: str, head: str, base: str = "main") -> dict[str, Any] | None:
        client = self._get_client()
        if not client:
            return None
        try:
            r = await client.post(f"/repos/{self.owner}/{self.repo}/pulls", json={
                "title": title,
                "body": body,
                "head": head,
                "base": base,
            })
            if r.status_code in (200, 201):
                data = r.json()
                return {"pr_number": data["number"], "pr_url": data["html_url"]}
            logger.error(f"GitHub create PR failed: {r.status_code} {r.text[:200]}")
            return None
        except Exception as e:
            logger.error(f"GitHub API error: {e}")
            return None

    async def merge_pull_request(self, pr_number: int, commit_title: str = "") -> dict[str, Any] | None:
        client = self._get_client()
        if not client:
            return None
        try:
            r = await client.put(f"/repos/{self.owner}/{self.repo}/pulls/{pr_number}/merge", json={
                "commit_title": commit_title or f"Auto-fix: merged PR #{pr_number}",
                "merge_method": "merge",
            })
            if r.status_code == 200:
                data = r.json()
                return {"merged": data.get("merged", True), "sha": data.get("sha", "")}
            logger.error(f"GitHub merge PR failed: {r.status_code} {r.text[:200]}")
            return None
        except Exception as e:
            logger.error(f"GitHub API error: {e}")
            return None

    async def check_pr_merged(self, pr_number: int) -> bool:
        client = self._get_client()
        if not client:
            return False
        try:
            r = await client.get(f"/repos/{self.owner}/{self.repo}/pulls/{pr_number}")
            return r.status_code == 200 and r.json().get("merged", False)
        except Exception:
            return False
