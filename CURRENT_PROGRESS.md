# Enterprise AI OS — Current Progress

## Last Session: 2026-07-09 ~18:24 UTC
## Author: Claude (claude.ai, sandboxed — no network access this session)

---

## IMPORTANT CAVEAT FOR NEXT SESSION

This session ran in a network-isolated sandbox (no access to api.notion.com,
api.github.com, registry.npmjs.org, pypi.org, etc.). That means everything
below is **code-complete and syntax-checked but not runtime-verified**:

- The Notion fix was diagnosed from official docs + community reports, not
  confirmed against the live API.
- No `pip install` / `pytest` run was possible — new tests are unrun.
- No `npm install` / `npm run dev` / `npm run build` was possible — the
  frontend has never actually been started or type-checked with `tsc`.
- Nothing was pushed to GitHub — this environment has no git network access.
  **You (or a Claude Code session with real network/git access) need to pull
  these changes, run the test suite, run the frontend, and commit/push.**

First thing next session: `cd backend && pip install -r requirements.txt &&
PYTHONPATH=. python -m pytest tests/ -v`, then `cd frontend && npm install &&
npm run dev`, confirm the demo button lights up the state rail, *then* try
the Notion fix live via `POST /api/demo/run-primary-scenario` before trusting
any of this.

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
| **Orchestrator** | `app/core/orchestrator.py` | ✅ Full primary scenario flow + **new idempotency wrapper (see below)** |
| **Approval watcher** | `app/core/approval_watcher.py` | ✅ Async polling loop, detects PENDING→APPROVED/REJECTED, auto-resumes workflows |
| **Agents** | `app/agents/base.py`, `engineering.py`, `finance.py`, `operations.py` | ✅ BaseAgent with Gemini structured output, 3 department agents |
| **Gemini adapter** | `app/adapters/gemini.py` | ✅ `google-genai` SDK v0.3.0, structured JSON, bounded retries |
| **Notion adapter** | `app/adapters/notion.py` | ✅ All 5 data sources, CRUD, exponential backoff retry, **parent-format bug fixed (unverified live, see caveat)** |
| **GitHub adapter** | `app/adapters/github.py` | ✅ Issue creation, now called through orchestrator's idempotency wrapper |
| **Slack adapter** | `app/adapters/slack.py` | ✅ Incoming webhooks with bounded retry |
| **REST API** | `app/routes/api.py` | ✅ All endpoints per spec + WebSocket, **listener-leak fix (see below)** |
| **Tests** | `tests/test_policy.py`, `test_state_machine.py`, `test_agents.py` (pre-existing) + `test_idempotency.py`, `test_approval_flow.py`, `test_gemini_resilience.py`, `test_notion_resilience.py` (new) + `conftest.py`, `pytest.ini` | ⚠️ Written, syntax-checked (`py_compile` clean), **not run** — no network to install deps |

### This Session's Changes (Backend)

1. **Notion page-creation parent format bug — fixed in code**
   `app/adapters/notion.py::_create_page` was sending
   `{"parent": {"type": "data_source", "data_source_id": "..."}}`. Per Notion's
   official `POST /v1/pages` docs, the 2025-09-03+ shape for a data-source
   parent is `{"parent": {"data_source_id": "..."}}` — **no `"type"` key at
   all**, and `"data_source"` was never a valid `type` value to begin with
   (community reports show `"data_source_id"` as the type string when one is
   present). Changed to match the documented shape exactly.
   **Not yet confirmed against the live API** — do that first next session.
   Also bumped the permanent-error log line from 200→500 chars of response
   body so a future 400 is diagnosable without guessing.

2. **Real idempotency for GitHub issue creation**
   `IntegrationAction` existed as a DB model but nothing ever wrote to it —
   `create_issue`'s `idempotency_key` parameter was accepted and ignored.
   Added `Orchestrator._run_idempotent_action()`: checks for an existing
   `SUCCESS` row before calling the adapter, records `SUCCESS`/`FAILED` +
   error text after, and returns the cached result on a repeat call with the
   same key. Wired into `_execute_approved()`'s GitHub call. This means a
   crash-and-resume or a duplicate `resume_approved_workflow` call can no
   longer file two GitHub issues for one workflow.

3. **WebSocket listener leak fixed**
   `/ws/workflows/{workflow_id}` registered a listener on `orchestrator` per
   connection but never removed it on disconnect — every browser tab/reload
   over the life of the process added another live listener. Now deregisters
   in a `finally` block.
   **Known pre-existing limitation, not fixed this session:** the handler
   broadcasts every workflow's events to every socket regardless of
   `{workflow_id}` — it's a global firehose, not filtered per workflow. The
   frontend works around this today (see `frontend/README.md`) but the
   backend should eventually filter by id.

4. **New tests** (unrun — see caveat above):
   - `test_idempotency.py` — runs-once, retries-on-failure, exception-capture
     for `_run_idempotent_action`.
   - `test_approval_flow.py` — `resume_approved_workflow` /
     `resume_rejected_workflow` happy paths, wrong-state error path, and an
     `ApprovalWatcher` duplicate-processing regression test.
   - `test_gemini_resilience.py` — malformed JSON retried then recovered,
     persistent malformed JSON returns `None` (not an exception), empty
     response text handled.
   - `test_notion_resilience.py` — regression test asserting the exact
     corrected parent payload shape, 400s not retried, 5xx retried then
     recovers, 5xx retried then gives up after 3 attempts.
   - `conftest.py` — `isolated_db` fixture: shared-cache in-memory SQLite,
     monkeypatched over `app.models.database.async_session` (and the
     orchestrator/approval_watcher modules' references to it) so tests don't
     touch the real `workflow.db`.
   - `pytest.ini` — `asyncio_mode = auto` so the new async tests run without
     per-test `@pytest.mark.asyncio` decorators (pre-existing tests are sync
     and unaffected).

### Verified API Endpoints (from prior session, unchanged)
- `GET /health` → `{"status":"ok"}`
- `GET /api/integrations/status` → all 4 configured
- `GET /api/notion/schema-status` → returns datasource status

### Credentials Present (not re-verified live this session — no network)
- **Gemini**: previously verified `gemini-2.5-flash` responds
- **GitHub**: previously verified `akshaytheflash/notion-system` repo accessible
- **Slack**: previously verified webhook returns 200
- **Notion**: token present; page-creation 400 addressed in code, unverified live

---

## What's Built (Frontend — v1 this session)

`frontend/` now exists (previously not started):
Vite + React + TypeScript + Tailwind v4, wired to the backend's REST API and
WebSocket. **Not installed or run** — no npm registry access this session.

- `src/App.tsx` — Command Center shell: header with integration-status strip
  + demo button, workflow list, approvals panel, live event feed.
- `src/components/StateRail.tsx` — signature visual: the 14-state pipeline
  rendered as a literal lit signal path, color-coded (cyan = active, amber =
  awaiting human, violet = appeal/reeval loop, green = completed, red =
  rejected/failed).
- `src/components/WorkflowList.tsx`, `ApprovalsPanel.tsx`, `EventLog.tsx`,
  `IntegrationStrip.tsx` — supporting panels.
- `src/lib/api.ts` — typed REST client matching `app/routes/api.py` exactly.
- `src/lib/useLiveEvents.ts` — WebSocket hook with auto-reconnect/backoff.
- `src/index.css` — design tokens (graphite/ink base, cyan/amber/green/red/violet
  signal colors, Space Grotesk + JetBrains Mono).
- `frontend/README.md` — setup instructions and the known-limitations note
  about the backend's unfiltered WebSocket broadcast.

**Only one page was built** (Command Center), not the full eight-page IA
(Incident Detail, Workflow Detail, Decisions, Policies, Action Log as
separate routes) — a time tradeoff for this session, tracked below.

---

## What's NOT Built (Needs Work)

### 1. Verify Notion fix against the live API (CRITICAL, BLOCKING)
The parent-format fix in `app/adapters/notion.py` is unverified — this
session had no network access to test it. Run the primary scenario end to
end and confirm a real Notion page gets created under each data source.

### 2. Install & runtime-verify everything (CRITICAL, BLOCKING)
Neither the backend test suite nor the frontend has ever actually been run
by this session. Do this before trusting any of it:
```bash
cd backend && pip install -r requirements.txt --break-system-packages
PYTHONPATH=. python -m pytest tests/ -v
cd ../frontend && npm install && npm run dev
```

### 3. Remaining Frontend Pages
Incident Detail, Workflow Detail (drill-down with full event timeline and
decision history), Decisions, Policies (view/edit), Action Log — all still
need dedicated views. The Command Center's workflow list currently shows
every workflow's state rail inline rather than linking to a detail page.

### 4. WebSocket per-workflow filtering
`/ws/workflows/{workflow_id}` ignores the id and broadcasts globally. Either
filter server-side by id, or formalize the "global firehose" as the intended
design and rename the route/remove the unused path param.

### 5. Additional Tests Still Wanted
- End-to-end primary-scenario test once Notion is verified live
- Notion `get_approval_status` / `get_active_policies` resilience (only
  `_request` and `_create_page` got resilience tests this session)
- Frontend component tests (none exist yet — no test runner configured)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/.env` | All live credentials (committed, private repo) |
| `backend/app/routes/api.py` | REST endpoints + WebSocket |
| `backend/app/core/orchestrator.py` | Main workflow engine + idempotency wrapper |
| `backend/app/core/approval_watcher.py` | Async poller for Notion approval status |
| `backend/app/adapters/notion.py` | Notion API integration (parent-format fix here) |
| `backend/app/core/state_machine.py` | State definitions + transition validation |
| `backend/app/adapters/gemini.py` | Gemini LLM calls |
| `backend/tests/conftest.py` | Isolated in-memory DB fixture for async tests |
| `frontend/src/App.tsx` | Command Center dashboard shell |
| `frontend/src/components/StateRail.tsx` | Pipeline visualization (signature element) |

---

## How to Run

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

```bash
cd frontend
npm install   # not yet run this session
npm run dev
```

## How to Run Tests

```bash
cd backend
pip install -r requirements.txt --break-system-packages   # not yet run this session
PYTHONPATH=. python -m pytest tests/ -v -p no:typeguard
```

---

## Priority for Next Session

1. **CRITICAL**: Install deps and actually run `pytest` — confirm the new
   tests pass (they've only been syntax-checked, never executed).
2. **CRITICAL**: Verify the Notion parent-format fix against the live API by
   running the primary scenario end to end.
3. **HIGH**: `npm install && npm run dev` the frontend for the first time;
   fix whatever `tsc`/Vite turns up (untested code, expect at least minor
   issues).
4. **HIGH**: Push all of this to GitHub — nothing has been pushed yet.
5. **MEDIUM**: Build remaining frontend pages (Incident/Workflow Detail,
   Decisions, Policies, Action Log).
6. **MEDIUM**: Filter the WebSocket broadcast per workflow_id, or formalize
   it as global.
7. **LOW**: Final audit per completion gate in PROMPT.md.
