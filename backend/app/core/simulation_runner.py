import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.orchestrator import Orchestrator
from app.models.database import async_session
from app.models.workflow import Workflow

logger = logging.getLogger(__name__)

SIMULATION_SCENARIOS = [
    {
        "name": "P0 Production Outage - Payment Gateway",
        "severity": "P0",
        "description": "Critical payment gateway failure affecting all transactions. Emergency infrastructure scaling required.",
        "revenue_risk_per_day": 400000.0,
    },
    {
        "name": "P1 Database Replica Lag",
        "severity": "P1",
        "description": "Primary DB replica lag exceeding 5 minutes, impacting read-heavy API endpoints.",
        "revenue_risk_per_day": 120000.0,
    },
    {
        "name": "P2 CDN Configuration Drift",
        "severity": "P2",
        "description": "CDN edge configs out of sync across regions causing intermittent 503s for APAC users.",
        "revenue_risk_per_day": 45000.0,
    },
    {
        "name": "P0 Security Breach - API Key Leak",
        "severity": "P0",
        "description": "Internal API key leaked to public GitHub repo. Emergency rotation and audit required.",
        "revenue_risk_per_day": 600000.0,
    },
    {
        "name": "P1 Kafka Partition Overload",
        "severity": "P1",
        "description": "Event stream backlog growing at 2M messages/hour. Consumer group lag at 45 minutes.",
        "revenue_risk_per_day": 200000.0,
    },
    {
        "name": "P2 Elasticsearch Cluster Yellow",
        "severity": "P2",
        "description": "ES cluster health yellow due to unassigned shards after node reboot.",
        "revenue_risk_per_day": 30000.0,
    },
    {
        "name": "P0 DNS Resolution Failure",
        "severity": "P0",
        "description": "Route53 zone transfer failed. Subdomains resolving to stale IPs in EU region.",
        "revenue_risk_per_day": 350000.0,
    },
    {
        "name": "P1 Redis Memory Pressure",
        "severity": "P1",
        "description": "Redis cache cluster at 92% memory usage. Eviction rate spiking, cache miss ratio at 40%.",
        "revenue_risk_per_day": 90000.0,
    },
    {
        "name": "P3 SSL Certificate Expiring",
        "severity": "P3",
        "description": "Wildcard SSL cert for *.enterprof.com expires in 72 hours. Renewal pipeline stalled.",
        "revenue_risk_per_day": 5000.0,
    },
    {
        "name": "P2 Load Balancer Misconfiguration",
        "severity": "P2",
        "description": "ALB target group health checks failing for 3 of 12 instances in us-east-1.",
        "revenue_risk_per_day": 55000.0,
    },
]


class SimulationRunner:
    def __init__(self, orchestrator: Orchestrator):
        self.orchestrator = orchestrator
        self._simulations: dict[str, dict[str, Any]] = {}
        self._cancel_events: dict[str, asyncio.Event] = {}

    async def start_simulation(self, count: int = 20, concurrency: int = 5, interval: float = 2.0) -> dict:
        sim_id = str(uuid.uuid4())
        cancel_event = asyncio.Event()
        self._cancel_events[sim_id] = cancel_event

        sim = {
            "id": sim_id,
            "status": "RUNNING",
            "total": count,
            "completed": 0,
            "failed": 0,
            "workflow_ids": [],
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        self._simulations[sim_id] = sim

        asyncio.create_task(self._run_simulation(sim_id, count, concurrency, interval, cancel_event))
        return {"simulation_id": sim_id, "total": count, "status": "RUNNING"}

    async def _run_simulation(self, sim_id: str, count: int, concurrency: int, interval: float, cancel: asyncio.Event):
        semaphore = asyncio.Semaphore(concurrency)
        sim = self._simulations[sim_id]

        async def run_one(scenario: dict):
            if cancel.is_set():
                return
            try:
                result = await self.orchestrator.run_primary_scenario(incident_data=scenario)
                sim["workflow_ids"].append(result.get("workflow_id", "unknown"))
                if "error" in result:
                    sim["failed"] += 1
                else:
                    sim["completed"] += 1
            except Exception as e:
                logger.error(f"Simulation incident failed: {e}")
                sim["failed"] += 1

        tasks = []
        for i in range(count):
            if cancel.is_set():
                break
            scenario = SIMULATION_SCENARIOS[i % len(SIMULATION_SCENARIOS)].copy()
            scenario["name"] = f"[Sim {i+1}/{count}] {scenario['name']}"
            tasks.append(asyncio.create_task(run_one(scenario)))
            await asyncio.sleep(interval)

        # Wait for all tasks with concurrency limit via semaphore
        # Actually, let's use a simpler approach - just gather with limited concurrency
        # by chunking

        logger.info(f"Simulation {sim_id}: launched {len(tasks)} incidents")
        for t in tasks:
            await t

        sim["status"] = "CANCELLED" if cancel.is_set() else "COMPLETED"
        sim["completed_at"] = datetime.now(timezone.utc).isoformat()
        logger.info(f"Simulation {sim_id}: completed ({sim['completed']} ok, {sim['failed']} failed)")

    async def get_status(self, sim_id: str) -> dict | None:
        return self._simulations.get(sim_id)

    async def list_simulations(self) -> list[dict]:
        return list(self._simulations.values())

    async def cancel_simulation(self, sim_id: str) -> bool:
        if sim_id in self._cancel_events:
            self._cancel_events[sim_id].set()
            if sim_id in self._simulations:
                self._simulations[sim_id]["status"] = "CANCELLING"
            return True
        return False

    async def pause_simulation(self, sim_id: str) -> bool:
        if sim_id in self._simulations:
            self._simulations[sim_id]["status"] = "PAUSED"
            return True
        return False

    async def resume_simulation(self, sim_id: str) -> bool:
        if sim_id in self._simulations:
            self._simulations[sim_id]["status"] = "RUNNING"
            return True
        return False