import httpx, json, time

client = httpx.Client(base_url="http://localhost:8000", timeout=300)

print("=" * 60)
print("TEST 1: P2 - Search API Latency Spike")
print("Expected: Engineering requests < $50K, auto-approves")
print("=" * 60)

resp = client.post("/api/demo/run-primary-scenario", json={
    "name": "P2 - Search API Latency Spike",
    "severity": "P2",
    "description": "Product search API response times degraded from 200ms to 4.5 seconds over the past 2 hours. Affecting 15 percent of user sessions in the APAC region. Root cause suspected to be an unoptimized database query introduced in the latest deploy.",
    "revenue_risk_per_day": 25000,
}, timeout=300)

print(f"\nHTTP {resp.status_code}")
result = resp.json()
print(f"Final status: {result.get('status')}")
wf_id = result.get("workflow_id", "")
print(f"Workflow: {wf_id[:12]}...")

if wf_id:
    time.sleep(2)
    events = client.get(f"/api/workflows/{wf_id}/events").json()
    print(f"\nEvents ({len(events)}):")
    for e in events:
        et = e["event_type"]
        p = e["payload_json"]
        if et.startswith("STATE_"):
            print(f"  >> {et}")
        elif "agent" in p:
            amt = p.get("requested_amount", "N/A")
            print(f"  >> {et} [{p['agent']}] decision={p.get('decision','')} amt=${amt}")
            print(f"     reasoning: {p.get('reasoning_summary','')[:150]}")
        elif "passed" in p:
            print(f"  >> {et} passed={p.get('passed')} limit=${p.get('limit')} requested=${p.get('requested_amount')}")
        elif "github" in et.lower() or "issue" in et.lower():
            print(f"  >> {et} {json.dumps(p)[:120]}")
        else:
            print(f"  >> {et}")

client.close()
