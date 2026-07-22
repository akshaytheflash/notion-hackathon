import json
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class PagerDutyAdapter:
    def __init__(self):
        self.api_key = settings.pagerduty_api_key
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(30.0))

    async def trigger_incident(self, title: str, description: str, severity: str, dedup_key: str | None = None) -> dict | None:
        if not self.api_key:
            logger.warning("PagerDuty API key not configured")
            return None

        url = "https://api.pagerduty.com/incidents"
        severity_map = {"P0": "critical", "P1": "error", "P2": "warning", "P3": "info", "P4": "info"}
        body = {
            "incident": {
                "type": "incident",
                "title": title,
                "service": {"id": settings.pagerduty_service_id, "type": "service_reference"} if settings.pagerduty_service_id else None,
                "urgency": "high" if severity in ("P0", "P1") else "low",
                "body": {
                    "type": "incident_body",
                    "details": description,
                },
            }
        }
        if dedup_key:
            body["incident"]["dedup_key"] = dedup_key

        headers = {
            "Authorization": f"Token token={self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        try:
            resp = await self._http.post(url, json=body, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            logger.info(f"PagerDuty incident created: {data.get('incident', {}).get('id', 'unknown')}")
            return data
        except Exception as e:
            logger.error(f"PagerDuty trigger failed: {e}")
            return None

    async def acknowledge(self, incident_id: str) -> bool:
        if not self.api_key:
            return False
        url = f"https://api.pagerduty.com/incidents/{incident_id}"
        headers = {
            "Authorization": f"Token token={self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        body = {"incident": {"type": "incident_reference", "status": "acknowledged"}}
        try:
            resp = await self._http.put(url, json=body, headers=headers)
            resp.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"PagerDuty acknowledge failed: {e}")
            return False

    async def resolve(self, incident_id: str) -> bool:
        if not self.api_key:
            return False
        url = f"https://api.pagerduty.com/incidents/{incident_id}"
        headers = {
            "Authorization": f"Token token={self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        body = {"incident": {"type": "incident_reference", "status": "resolved"}}
        try:
            resp = await self._http.put(url, json=body, headers=headers)
            resp.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"PagerDuty resolve failed: {e}")
            return False