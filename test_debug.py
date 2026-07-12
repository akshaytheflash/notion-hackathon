import httpx

client = httpx.Client(base_url="http://localhost:8000", timeout=300)

resp = client.post("/api/demo/run-primary-scenario", json={
    "name": "P2 - Search API Latency Spike",
    "severity": "P2",
    "description": "Product search API response times degraded from 200ms to 4.5 seconds over the past 2 hours.",
    "revenue_risk_per_day": 25000,
    "requested_amount": 30000,
}, timeout=300)

print(f"Status: {resp.status_code}")
print(f"Body: {resp.text[:2000]}")
client.close()
