# Enterprise AI OS — Current Progress

## Last Session: 2026-07-09 ~22:30
## Author: opencode (big-pickle)

---

## What's Built (Backend Complete)

### Python/FastAPI Backend (`backend/`)

| Layer | Files | Status |
|-------|-------|--------|
| **App entry** | `app/main.py` | ✅ FastAPI with lifespan, CORS, startup DB init |
| **Config** | `app/config.py` | ✅ Pydantic-settings loading from `.env` |
| **DB models** | `app/models/workflow.py`, `database.py`, `schemas.py` | ✅ SQLAlchemy + aiosqlite: Workflow, WorkflowEvent, IntegrationAction, ApprovalTracking |
| **State machine** | `app/core/state_machine.py` | ✅ 14 states, legal transitions, InvalidTransitionError |
| **Policy engine** | `app/core/policy_engine.py` | ✅ Pure Python AUTONOMOUS_SPENDING_LIMIT evaluation |
| **Orchestrator** | `app/core/orchestrator.py` | ✅ Full primary scenario flow with state transitions, agent invocations, policy checks, approval creation, resume/reject |
| **Approval watcher** | `app/core/approval_watcher.py` | ✅ Async polling loop, detects PENDING→APPROVED/REJECTED, auto-resumes workflows |
| **Agents** | `app/agents/base.py`, `engineering.py`, `finance.py`, `operations.py` | ✅ BaseAgent with Gemini structured output, 3 department agents |
| **Gemini adapter** | `app/adapters/gemini.py` | ✅ `google-genai` SDK v0.3.0, structured JSON, bounded retries |
| **Notion adapter** | `app/adapters/notion.py` | ✅ All 5 data sources, CRUD, exponential backoff retry |
| **GitHub adapter** | `app/adapters/github.py` | ✅ Issue creation with idempotency support |
| **Slack adapter** | `app/adapters/slack.py` | ✅ Incoming webhooks with bounded retry |
| **REST API** | `app/routes/api.py` | ✅ All endpoints per spec + WebSocket |
| **Tests** | `tests/test_policy.py`, `test_state_machine.py`, `test_agents.py` | ✅ 10/10 passing |

### Verified API Endpoints
- `GET /health` → `{"status":"ok"}`
- `GET /api/integrations/status` → all 4 configured
- `GET /api/notion/schema-status` → returns datasource status

### Credentials Verified
- **Gemini**: ✅ `gemini-2.5-flash` returns responses (key: `AIzaSyBPxUusvuz-lQ3-YQRg0DbYsKQh271i_Sc`)
- **GitHub**: ✅ `akshaytheflash/notion-system` repo exists and accessible
- **Slack**: ✅ Webhook returned 200
- **Notion**: ⚠️ Token present but API returned 400 on page creation (parent format needs fix)

---

## What's NOT Built (Needs Work)

### 1. Notion API Parent Format (BLOCKING for e2e)
`POST /v1/pages` returns 400 when using `parent: {type: "data_source", data_source_id: "..."}`. The Notion 2025-09-03 API may expect a different structure. Current workaround: Notion calls wrapped in try/except so they don't crash the workflow. Fix needed for actual Notion writes to work.

**Suspect**: The data source query API works but page creation under a data source might need different parent semantics. Check Notion API changelog for 2025-09-03.

### 2. Frontend (NOT STARTED)
React + Vite + TypeScript + Tailwind dashboard needs to be built from scratch:
- `cd frontend && npm create vite@latest . -- --template react-ts`
- `npm install tailwindcss @tailwindcss/vite`
- Pages: Command Center, Incident Detail, Workflow Detail, Decisions, Approvals, Policies, Action Log, Integration Status
- WebSocket connection to `/ws/workflows/{id}` for real-time updates
- Workflow visualization (Engineering → Policy → Finance → Appeal → Reeval → Human → Ops)
- "RUN P0 INCIDENT DEMO" button calling `POST /api/demo/run-primary-scenario`

### 3. Primary Scenario Full E2E Test
`POST /api/demo/run-primary-scenario` currently hits 500 because:
- ~~State machine double-transition bug~~ (FIXED in last session)
- ~~Notion page creation 400~~ (try/except wrapped, but Notion writes won't execute until parent format is fixed)

Once Notion fix is in, the full flow should: create incident → engineering analysis → resource request → policy check → finance review → rejection → engineering appeal → finance reeval → approval required → waiting for approval → (human approves in Notion) → approved → github issue → slack notify → operations review → completed.

### 4. Additional Tests
- IntegrationAction idempotency tests
- Approval pause/resume tests
- Duplicate approval processing safety
- Malformed JSON recovery from Gemini
- Notion transient/permanent failure handling

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/.env` | All live credentials (committed, private repo) |
| `backend/app/routes/api.py` | REST endpoints + WebSocket |
| `backend/app/core/orchestrator.py` | Main workflow engine (600+ lines) |
| `backend/app/core/approval_watcher.py` | Async poller for Notion approval status |
| `backend/app/adapters/notion.py` | Notion API integration |
| `backend/app/core/state_machine.py` | State definitions + transition validation |
| `backend/app/adapters/gemini.py` | Gemini LLM calls |

---

## How to Run

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## How to Run Tests

```bash
cd backend
$env:PYTHONPATH = "."
python -m pytest tests/ -v -p no:typeguard
```

---

## Priority for Next Session

1. **CRITICAL**: Fix Notion page creation parent format for 2025-09-03 API
2. **HIGH**: Scaffold frontend (Vite + React + Tailwind)
3. **HIGH**: Connect frontend to backend API + WebSocket
4. **MEDIUM**: Build workflow visualization component
5. **MEDIUM**: Add remaining tests (idempotency, approval resume, etc.)
6. **LOW**: Final audit per completion gate in PROMPT.md
