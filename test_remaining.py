import httpx, json, time

BASE = "http://localhost:8000"
client = httpx.Client(base_url=BASE, timeout=300)

remaining = [
    {
        "name": "P0 - Data Center Power Failure",
        "severity": "P0",
        "description": "Primary data center lost grid power. UPS battery backup has 20 minutes remaining. Diesel generator failed to start. All 500+ production servers will go offline. DR site in another region can take over but requires 45 minutes for failover and data sync.",
        "revenue_risk_per_day": 800000,
    },
    {
        "name": "P1 - ML Model Poisoning Detected",
        "severity": "P1",
        "description": "Recommendation engine ML model is producing nonsensical outputs for the past 2 hours. Investigation reveals training data pipeline was compromised with poisoned data injected 6 hours ago. Model accuracy dropped from 94 percent to 31 percent. Revenue impact from bad recommendations estimated at Rs. 1,00,000/day.",
        "revenue_risk_per_day": 100000,
    },
    {
        "name": "P0 - SSL Certificate Expiry All Domains",
        "severity": "P0",
        "description": "Wildcard SSL certificate expires in 4 hours. Automated renewal via Let Encrypt failed due to DNS validation issue. All HTTPS traffic will show security warnings and browsers will block access. Covers production, API, admin panel, and all subdomains.",
        "revenue_risk_per_day": 300000,
    },
    {
        "name": "P1 - Memory Leak Causing Production Node Failures",
        "severity": "P1",
        "description": "Gradual memory leak in the Java order-processing service has caused 3 of 8 production nodes to OOM crash in the last hour. Leak rate suggests remaining 5 nodes will fail within 90 minutes. Traffic is being redistributed to healthy nodes, accelerating their degradation. Heap dump analysis shows uncleared WebSocket connections.",
        "revenue_risk_per_day": 250000,
    },
]

SEP = "=" * 60

for i, inc in enumerate(remaining):
    idx = i + 7
    print(f"\n{SEP}")
    print(f"  INCIDENT {idx}/10: {inc['name']}")
    print(f"  Severity: {inc['severity']} | Risk: Rs. {inc['revenue_risk_per_day']:,.0f}/day")
    print(SEP)
    resp = client.post(f"{BASE}/api/demo/run-primary-scenario", json=inc, timeout=300)
    result = resp.json()
    print(f"  -> Status: {result.get('status', 'UNKNOWN')}")
    wf_id = result.get("workflow_id")
    if wf_id:
        time.sleep(1)
        evts = client.get(f"{BASE}/api/workflows/{wf_id}/events", timeout=10).json()
        for e in evts:
            et = e.get("event_type", "")
            if "ANALYSIS" in et or "DECISION" in et or "POLICY" in et or "APPEAL" in et:
                p = e.get("payload_json", {})
                if et == "POLICY_EVALUATED":
                    print(f"    [{et}] passed={p.get('passed')} limit={p.get('limit')} requested={p.get('requested_amount')}")
                else:
                    print(f"    [{et}] agent={p.get('agent','?')} decision={p.get('decision','?')[:80]} conf={p.get('confidence',0)}")
                    print(f"      reasoning: {p.get('reasoning_summary','?')[:150]}")
    if i < len(remaining) - 1:
        print("  Waiting 15s...")
        time.sleep(15)

client.close()
print(f"\n{SEP}")
print("  ALL 10 INCIDENTS COMPLETE")
print(SEP)
