import httpx, json

client = httpx.Client(base_url="http://localhost:8000", timeout=30)
workflows = client.get("/api/workflows").json()

for w in workflows:
    iid = w["incident_id"]
    inc = client.get(f"/api/incidents/{iid}").json()
    ctx = inc.get("context", {})
    if "Authentication" in ctx.get("name", ""):
        wf_id = w["id"]
        print("=== WINNER: P0 - Authentication Service Total Outage ===")
        print(json.dumps(ctx, indent=2))
        print()
        events = client.get(f"/api/workflows/{wf_id}/events").json()
        for e in events:
            p = e["payload_json"]
            et = e["event_type"]
            if et.startswith("STATE_"):
                print(f"  >> {et}")
            else:
                print(f"  >> {et} [{e['source']}]")
                if "agent" in p:
                    print(f"     agent: {p['agent']}")
                    print(f"     decision: {p.get('decision','')}")
                    print(f"     confidence: {p.get('confidence','')}")
                    print(f"     reasoning: {p.get('reasoning_summary','')}")
                    print(f"     evidence: {p.get('evidence','')}")
                    print(f"     requested_action: {p.get('requested_action','')}")
                    print(f"     requires_escalation: {p.get('requires_escalation','')}")
                    print(f"     message_to_dept: {p.get('message_to_department','')}")
                elif "passed" in p:
                    print(f"     passed={p.get('passed')} limit={p.get('limit')} requested={p.get('requested_amount')}")
                    print(f"     violation={p.get('violation','')}")
                elif "amount" in p:
                    print(f"     amount={p.get('amount')}")
                else:
                    print(f"     {json.dumps(p)[:200]}")
        break

client.close()
