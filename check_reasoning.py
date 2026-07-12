import httpx, json

client = httpx.Client(base_url="http://localhost:8000", timeout=30)
decisions = client.get("/api/decisions").json()

for d in decisions[:6]:
    p = d["payload_json"]
    agent = p.get("agent", "?")
    decision = p.get("decision", "?")
    reasoning = p.get("reasoning_summary", "")
    evidence = p.get("evidence", "")
    msg = p.get("message_to_department", "")
    wf = d["workflow_id"][:8]
    etype = d["event_type"]
    print(f"--- [{etype}] wf={wf} agent={agent} ---")
    print(f"  DECISION:    {decision}")
    print(f"  REASONING:   {reasoning}")
    print(f"  EVIDENCE:    {evidence}")
    if msg:
        print(f"  MSG_TO_DEPT: {msg}")
    print()

client.close()
