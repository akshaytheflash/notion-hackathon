import json
import uuid
import logging
from typing import Any
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

NOTION_VERSION = "2025-09-03"
BASE_URL = "https://api.notion.com/v1"


class NotionAdapter:
    def __init__(self):
        self.token = settings.notion_token
        self._client = None

    def _get_client(self) -> httpx.AsyncClient | None:
        if not self.token:
            return None
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Notion-Version": NOTION_VERSION,
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )
        return self._client

    async def _request(self, method: str, path: str, **kwargs) -> dict | None:
        client = self._get_client()
        if not client:
            return None
        max_retries = 3
        last_error = None
        for attempt in range(max_retries):
            try:
                r = await client.request(method, path, **kwargs)
                if r.status_code in (200, 201):
                    return r.json()
                if r.status_code in (400, 401, 403, 404):
                    logger.error(f"Notion permanent error {r.status_code}: {r.text[:200]}")
                    return None
                if r.status_code >= 500:
                    last_error = f"{r.status_code}: {r.text[:200]}"
                    if attempt < max_retries - 1:
                        import asyncio
                        await asyncio.sleep(2 ** attempt)
                        continue
            except httpx.TimeoutException as e:
                last_error = f"timeout: {e}"
                if attempt < max_retries - 1:
                    import asyncio
                    await asyncio.sleep(2 ** attempt)
                    continue
            except Exception as e:
                last_error = str(e)
                if attempt < max_retries - 1:
                    import asyncio
                    await asyncio.sleep(2 ** attempt)
                    continue
        logger.error(f"Notion request failed: {last_error}")
        return None

    async def validate_schemas(self) -> dict[str, Any]:
        for ds_id_name in [
            "NOTION_INCIDENTS_DATA_SOURCE_ID",
            "NOTION_POLICIES_DATA_SOURCE_ID",
            "NOTION_DECISIONS_DATA_SOURCE_ID",
            "NOTION_APPROVALS_DATA_SOURCE_ID",
            "NOTION_ACTION_LOG_DATA_SOURCE_ID",
        ]:
            ds_id = getattr(settings, ds_id_name.lower(), "")
            if not ds_id:
                continue
            result = await self._request("GET", f"/data_sources/{ds_id}")
            if result:
                return {"status": "connected", "data_source_id": ds_id}
        return {"status": "no_datasource_configured"}

    async def _create_page(self, data_source_id: str, properties: dict) -> dict | None:
        body = {"parent": {"type": "data_source", "data_source_id": data_source_id}, "properties": properties}
        return await self._request("POST", "/pages", json=body)

    async def create_incident(self, incident_id: str, name: str, severity: str, description: str, revenue_risk: float, workflow_id: str) -> dict | None:
        return await self._create_page(settings.notion_incidents_data_source_id, {
            "Name": {"title": [{"text": {"content": name}}]},
            "Incident ID": {"rich_text": [{"text": {"content": incident_id}}]},
            "Severity": {"select": {"name": severity}},
            "Description": {"rich_text": [{"text": {"content": description}}]},
            "Revenue Risk Per Day": {"number": revenue_risk},
            "Status": {"select": {"name": "OPEN"}},
            "Workflow ID": {"rich_text": [{"text": {"content": workflow_id}}]},
            "Created At": {"date": {"start": __import__("datetime").datetime.now().isoformat()}},
        })

    async def get_active_policies(self) -> list[dict]:
        ds_id = settings.notion_policies_data_source_id
        result = await self._request("POST", f"/data_sources/{ds_id}/query")
        if not result:
            return []
        policies = []
        for row in result.get("results", []):
            props = row.get("properties", {})
            active = False
            for prop in props.values():
                if isinstance(prop, dict) and prop.get("type") == "checkbox":
                    active = prop.get("checkbox", False)
                    break
            if active:
                policies.append(row)
        return policies

    async def record_decision(self, decision_id: str, workflow_id: str, incident_id: str, agent: str, department: str, decision: str, reasoning: str, evidence: str, confidence: float) -> dict | None:
        return await self._create_page(settings.notion_decisions_data_source_id, {
            "Name": {"title": [{"text": {"content": f"Decision {decision_id[:8]}"}}]},
            "Decision ID": {"rich_text": [{"text": {"content": decision_id}}]},
            "Workflow ID": {"rich_text": [{"text": {"content": workflow_id}}]},
            "Incident ID": {"rich_text": [{"text": {"content": incident_id}}]},
            "Agent": {"rich_text": [{"text": {"content": agent}}]},
            "Department": {"select": {"name": department}},
            "Decision": {"rich_text": [{"text": {"content": decision}}]},
            "Reasoning Summary": {"rich_text": [{"text": {"content": reasoning}}]},
            "Evidence": {"rich_text": [{"text": {"content": evidence}}]},
            "Confidence": {"number": confidence},
            "Created At": {"date": {"start": __import__("datetime").datetime.now().isoformat()}},
        })

    async def create_approval(self, approval_id: str, workflow_id: str, incident_id: str, requested_by: str, amount: float, reason: str) -> dict | None:
        return await self._create_page(settings.notion_approvals_data_source_id, {
            "Name": {"title": [{"text": {"content": f"Approval {approval_id[:8]}"}}]},
            "Approval ID": {"rich_text": [{"text": {"content": approval_id}}]},
            "Workflow ID": {"rich_text": [{"text": {"content": workflow_id}}]},
            "Incident ID": {"rich_text": [{"text": {"content": incident_id}}]},
            "Requested By": {"rich_text": [{"text": {"content": requested_by}}]},
            "Amount": {"number": amount},
            "Reason": {"rich_text": [{"text": {"content": reason}}]},
            "Status": {"select": {"name": "PENDING"}},
            "Created At": {"date": {"start": __import__("datetime").datetime.now().isoformat()}},
        })

    async def get_approval_status(self, approval_id: str) -> str | None:
        ds_id = settings.notion_approvals_data_source_id
        result = await self._request("POST", f"/data_sources/{ds_id}/query")
        if not result:
            return None
        for row in result.get("results", []):
            props = row.get("properties", {})
            for prop in props.values():
                if isinstance(prop, dict) and prop.get("rich_text"):
                    texts = prop["rich_text"]
                    if texts and texts[0].get("text", {}).get("content", "") == approval_id:
                        status_prop = props.get("Status", {})
                        if status_prop.get("type") == "select":
                            return status_prop["select"]["name"]
        return None

    async def record_action(self, action_id: str, workflow_id: str, incident_id: str, agent: str, action: str, tool: str, execution_mode: str, result: str) -> dict | None:
        return await self._create_page(settings.notion_action_log_data_source_id, {
            "Name": {"title": [{"text": {"content": f"Action {action_id[:8]}"}}]},
            "Action ID": {"rich_text": [{"text": {"content": action_id}}]},
            "Workflow ID": {"rich_text": [{"text": {"content": workflow_id}}]},
            "Incident ID": {"rich_text": [{"text": {"content": incident_id}}]},
            "Agent": {"rich_text": [{"text": {"content": agent}}]},
            "Action": {"rich_text": [{"text": {"content": action}}]},
            "Tool": {"select": {"name": tool}},
            "Execution Mode": {"select": {"name": execution_mode}},
            "Result": {"rich_text": [{"text": {"content": result}}]},
            "Created At": {"date": {"start": __import__("datetime").datetime.now().isoformat()}},
        })
