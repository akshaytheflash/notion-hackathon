import httpx, json, time

client = httpx.Client(base_url="http://localhost:8000", timeout=300)

# Clear first
client.post("/api/admin/clear-database")
print("DB cleared.")

print("Running P2 - Search API Latency Spike (requested=$30K, under $50K limit)...")
print("This should auto-approve without human approval...\n")

resp = client.post("/api/demo/run-primary-scenario", json={
    "name": "P2 - Search API Latency Spike",
    "severity": "P2",
    "description": "Product search API response times degraded from 200ms to 4.5 seconds over the past 2 hours. Affecting 15 percent of user sessions in the APAC region. Root cause suspected to be an unoptimized database query introduced in the latest deploy.",
    "revenue_risk_per_day": 25000,
    "requested_amount": 30000,
}, timeout=300)

print(f"Response status: {resp.status_code}")
result = resp.json()
print(f"Final status: {result.get('status')}")
print(f"Workflow: {result.get('workflow_id', 'N/A')[:12]}")

wf_id = result.get("workflow_id")
if wf_id:
    time.sleep(1)
    events = client.get(f"/api/workflows/{wf_id}/events").json()
    print(f"\nTotal events: {len(events)}")
    for e in events:
        et = e["event_type"]
        p = e["payload_json"]
        if et.startswith("STATE_"):
            print(f"  >> {et}")
        elif "agent" in p:
            esc = p.get("requires_escalation", "")
            print(f"  >> {et} [{p['agent']}] decision={p.get('decision','')} conf={p.get('confidence','')} esc={esc}")
            print(f"     reasoning: {p.get('reasoning_summary','')[:200]}")
        elif "passed" in p:
            print(f"  >> {et} passed={p.get('passed')} limit={p.get('limit')} requested={p.get('requested_amount')}")
        elif "approval_id" in p:
            print(f"  >> {et} approval_id={p.get('approval_id','')[:8]} amount={p.get('amount','')}")
        elif et == "WORKFLOW_PAUSED":
            print(f"  >> {et}")
        else:
            print(f"  >> {et}")

client.close()
