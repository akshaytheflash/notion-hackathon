"""
Run 10 custom incidents through the Enterprise AI OS backend.
Each incident runs sequentially with delays to respect Gemini rate limits.
Results are collected and ranked for hackathon demo quality.
"""

import httpx
import json
import time
import sys

BASE = "http://localhost:8000"

INCIDENTS = [
    {
        "name": "P0 - Payment Gateway Complete Failure",
        "severity": "P0",
        "description": "Stripe payment processing is returning 500 errors for all transaction types. All customer payments are failing across web and mobile apps. Revenue loss estimated at Rs. 4,00,000 per day. No fallback payment provider available.",
        "revenue_risk_per_day": 400000,
    },
    {
        "name": "P0 - Database Primary Node Corruption",
        "severity": "P0",
        "description": "Production PostgreSQL primary node has table corruption in the users and orders tables. Read replicas are serving stale data from 3 hours ago. Customer-facing APIs are returning inconsistent data. Immediate failover and data recovery required.",
        "revenue_risk_per_day": 350000,
    },
    {
        "name": "P0 - DDoS Attack on API Gateway",
        "severity": "P0",
        "description": "Massive DDoS attack at 2.5 Tbps targeting our API gateway. All public endpoints are unreachable. Legitimate traffic is being dropped. CDN provider reports their capacity is saturated. Customers cannot access any services.",
        "revenue_risk_per_day": 500000,
    },
    {
        "name": "P1 - Critical Security Breach - Data Exfiltration",
        "severity": "P0",
        "description": "SOC team detected unauthorized access to production Kubernetes cluster. Anomalous data transfers of 15GB detected to an external IP. Suspected credential compromise in CI/CD pipeline. Customer PII may be exposed. Must isolate, investigate, and report within 72 hours per compliance.",
        "revenue_risk_per_day": 200000,
    },
    {
        "name": "P0 - Authentication Service Total Outage",
        "severity": "P0",
        "description": "Auth0 authentication service is completely down. All login, signup, and token refresh flows are failing. No user can authenticate. Session cache expired 30 minutes ago. Impacting all 2M+ daily active users across all platforms.",
        "revenue_risk_per_day": 600000,
    },
    {
        "name": "P1 - Cascading Microservice Failure",
        "severity": "P1",
        "description": "Order service crashed due to OOM, triggering cascading failures in inventory, shipping, and notification services. Circuit breakers have tripped. Message queue is backing up with 50K unprocessed messages. New orders cannot be placed but existing order tracking works.",
        "revenue_risk_per_day": 150000,
    },
    {
        "name": "P0 - Data Center Power Failure",
        "severity": "P0",
        "description": "Primary data center lost grid power. UPS battery backup has 20 minutes remaining. Diesel generator failed to start. All 500+ production servers will go offline. DR site in another region can take over but requires 45 minutes for failover and data sync.",
        "revenue_risk_per_day": 800000,
    },
    {
        "name": "P1 - ML Model Poisoning Detected",
        "severity": "P1",
        "description": "Recommendation engine ML model is producing nonsensical outputs for the past 2 hours. Investigation reveals training data pipeline was compromised - poisoned data was injected 6 hours ago. Model accuracy dropped from 94% to 31%. Revenue impact from bad recommendations estimated at Rs. 1,00,000/day.",
        "revenue_risk_per_day": 100000,
    },
    {
        "name": "P0 - SSL Certificate Expiry - All Domains",
        "severity": "P0",
        "description": "Wildcard SSL certificate for *.ourcompany.com expires in 4 hours. Automated renewal via Let's Encrypt failed due to DNS validation issue. All HTTPS traffic will show security warnings and browsers will block access. Covers production, API, admin panel, and all subdomains.",
        "revenue_risk_per_day": 300000,
    },
    {
        "name": "P1 - Memory Leak Causing Production Node Failures",
        "severity": "P1",
        "description": "Gradual memory leak in the Java order-processing service has caused 3 of 8 production nodes to OOM crash in the last hour. Leak rate suggests remaining 5 nodes will fail within 90 minutes. Traffic is being redistributed to healthy nodes, accelerating their degradation. Heap dump analysis shows uncleared WebSocket connections.",
        "revenue_risk_per_day": 250000,
    },
]


def run_incident(client: httpx.Client, incident: dict, index: int) -> dict:
    print(f"\n{'='*70}")
    print(f"  INCIDENT {index+1}/10: {incident['name']}")
    print(f"  Severity: {incident['severity']} | Revenue Risk: Rs. {incident['revenue_risk_per_day']:,.0f}/day")
    print(f"{'='*70}")

    try:
        resp = client.post(f"{BASE}/api/demo/run-primary-scenario", json=incident, timeout=300)
        result = resp.json()
        print(f"  -> Status: {result.get('status', 'UNKNOWN')}")
        print(f"  -> Workflow: {result.get('workflow_id', 'N/A')[:12]}...")
        return result
    except httpx.TimeoutException:
        print(f"  -> TIMEOUT (request took too long)")
        return {"status": "TIMEOUT", "error": "Request timed out after 5 minutes"}
    except Exception as e:
        print(f"  -> ERROR: {e}")
        return {"status": "ERROR", "error": str(e)}


def fetch_events(client: httpx.Client, workflow_id: str) -> list:
    try:
        resp = client.get(f"{BASE}/api/workflows/{workflow_id}/events", timeout=10)
        return resp.json()
    except Exception:
        return []


def fetch_decisions(client: httpx.Client) -> list:
    try:
        resp = client.get(f"{BASE}/api/decisions", timeout=10)
        return resp.json()
    except Exception:
        return []


def rank_incidents(results: list) -> list:
    """Rank incidents based on demo quality factors."""
    scored = []
    for r in results:
        score = 0
        incident = r.get("incident", {})
        outcome = r.get("outcome", {})
        events = r.get("events", [])

        # 1. Did it complete the full flow? (reaches WAITING_FOR_APPROVAL or COMPLETED)
        status = outcome.get("status", "")
        if status in ("WAITING_FOR_APPROVAL", "COMPLETED", "EXECUTING"):
            score += 30
        elif status == "UNKNOWN":
            score += 5

        # 2. Did policy enforcement work? (POLICY_EVALUATED event exists)
        has_policy = any(e.get("event_type") == "POLICY_EVALUATED" for e in events)
        if has_policy:
            score += 20

        # 3. Did Finance reject? (shows adversarial agent behavior - great for demo)
        has_rejection = any(e.get("event_type") == "FINANCE_DECISION_CREATED" for e in events)
        if has_rejection:
            score += 10

        # 4. Did engineering appeal? (shows multi-agent negotiation)
        has_appeal = any(e.get("event_type") == "ENGINEERING_APPEAL_CREATED" for e in events)
        if has_appeal:
            score += 15

        # 5. Did finance reevaluate? (shows the full loop)
        has_reeval = any("FINANCE_REEVALUATION" in e.get("event_type", "") or
                         e.get("event_type") == "STATE_FINANCE_REEVALUATION"
                         for e in events)
        if has_reeval:
            score += 10

        # 6. Revenue risk - higher is more dramatic
        risk = incident.get("revenue_risk_per_day", 0)
        if risk >= 500000:
            score += 10
        elif risk >= 300000:
            score += 7
        elif risk >= 200000:
            score += 5

        # 7. Severity P0 is more dramatic
        if incident.get("severity") == "P0":
            score += 5

        # 8. Description quality - longer, more detailed is better for Gemini reasoning
        desc_len = len(incident.get("description", ""))
        if desc_len > 200:
            score += 5
        elif desc_len > 100:
            score += 3

        # 9. Number of Gemini events (more events = more agent interaction)
        gemini_events = [e for e in events if e.get("source") in ("engineering", "finance", "operations")]
        score += min(len(gemini_events) * 3, 15)

        r["score"] = score
        scored.append(r)

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored


def main():
    print("=" * 70)
    print("  ENTERPRISE AI OS - INCIDENT DEMO GENERATOR")
    print("  Running 10 custom incidents to find the best demo scenario")
    print("=" * 70)

    client = httpx.Client(base_url=BASE, timeout=300)
    all_results = []

    # First clear the database
    print("\nClearing database...")
    try:
        client.post(f"{BASE}/api/admin/clear-database")
        print("  Database cleared.")
    except Exception as e:
        print(f"  Could not clear database: {e}")

    for i, incident in enumerate(INCIDENTS):
        outcome = run_incident(client, incident, i)
        all_results.append({
            "incident": incident,
            "outcome": outcome,
            "events": [],
        })

        # Fetch events for this workflow
        wf_id = outcome.get("workflow_id")
        if wf_id:
            time.sleep(1)
            events = fetch_events(client, wf_id)
            all_results[-1]["events"] = events

            # Print key events
            for e in events:
                etype = e.get("event_type", "")
                if "ANALYSIS" in etype or "DECISION" in etype or "POLICY" in etype or "APPEAL" in etype:
                    payload = e.get("payload_json", {})
                    if etype == "POLICY_EVALUATED":
                        print(f"    [{etype}] passed={payload.get('passed')} limit={payload.get('limit')} requested={payload.get('requested_amount')}")
                    else:
                        agent = payload.get("agent", "?")
                        decision = payload.get("decision", "?")[:80]
                        confidence = payload.get("confidence", 0)
                        reasoning = payload.get("reasoning_summary", "?")[:120]
                        print(f"    [{etype}] agent={agent} decision={decision} confidence={confidence}")
                        print(f"      reasoning: {reasoning}")

        # Delay between incidents to respect rate limits
        # Each incident takes ~30-40s due to internal sleeps, so 15s extra is safe
        if i < len(INCIDENTS) - 1:
            print(f"\n  Waiting 15s before next incident (rate limit safety)...")
            time.sleep(15)

    # Rank
    print("\n\n" + "=" * 70)
    print("  RANKING - BEST TO WORST FOR HACKATHON DEMO")
    print("=" * 70)

    ranked = rank_incidents(all_results)

    for rank, r in enumerate(ranked, 1):
        inc = r["incident"]
        out = r["outcome"]
        events = r["events"]
        score = r["score"]

        print(f"\n  #{rank} [Score: {score}/100] {inc['name']}")
        print(f"      Severity: {inc['severity']} | Risk: Rs. {inc['revenue_risk_per_day']:,.0f}/day")
        print(f"      Outcome: {out.get('status', 'UNKNOWN')}")

        # Count event types
        event_types = {}
        for e in events:
            et = e.get("event_type", "?")
            event_types[et] = event_types.get(et, 0) + 1
        print(f"      Events: {', '.join(f'{k}({v})' for k, v in event_types.items())}")

        # Get agent decisions
        for e in events:
            if e.get("event_type") in ("ENGINEERING_ANALYSIS_COMPLETED", "FINANCE_DECISION_CREATED",
                                        "ENGINEERING_APPEAL_CREATED", "FINANCE_REEVALUATION_COMPLETED"):
                p = e.get("payload_json", {})
                print(f"      [{e['event_type']}] {p.get('agent','?')}: {p.get('decision','?')[:100]}")

    print("\n\n" + "=" * 70)
    print(f"  BEST DEMO CANDIDATE: #{ranked[0]['incident']['name']}")
    print(f"  Score: {ranked[0]['score']}/100")
    print("=" * 70)

    # Save full results
    with open("demo_results.json", "w") as f:
        json.dump(all_results, f, indent=2, default=str)
    print("\n  Full results saved to demo_results.json")

    client.close()


if __name__ == "__main__":
    main()
