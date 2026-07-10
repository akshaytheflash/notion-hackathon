# Frontend — Incident Command Center

Vite + React + TypeScript + Tailwind v4 dashboard for the Enterprise AI OS backend.

## What's here (v1)

A single-page **Command Center** rather than the full 8-page IA from the original
plan — given the time available this session, one solid, real-time page beats
eight thin ones. It covers:

- **State Rail** — a literal render of the 14-state workflow pipeline (the
  signature visual element: since the backend genuinely is a state machine,
  showing the exact node the workflow is sitting on is more honest than a
  generic progress bar).
- **Workflow list** — every workflow with its live state rail.
- **Approvals panel** — pending vs resolved human-approval requests.
- **Live event feed** — streamed over `/ws/workflows/live`, color-coded by
  event type.
- **Integration status strip** — Gemini / Notion / GitHub / Slack, green/red dot.
- **"Run P0 Incident Demo"** button — calls `POST /api/demo/run-primary-scenario`.

Not yet built (see root `CURRENT_PROGRESS.md` for the full backlog): dedicated
Incident Detail / Workflow Detail / Decisions / Policies / Action Log pages,
and a Policies editor.

## Setup

This was scaffolded without network access, so dependencies have **not**
been installed or build-verified. From this directory:

```bash
npm install
npm run dev
```

The dev server proxies `/api` and `/ws` to `http://localhost:8000` (see
`vite.config.ts`), so run the backend first:

```bash
cd ../backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Then open the Vite dev server URL it prints (typically `http://localhost:5173`).

## Known backend limitation this UI works around

`/ws/workflows/{workflow_id}` currently broadcasts **every** workflow's events
to **every** connected socket, ignoring `{workflow_id}` — so the frontend just
connects once (path `/ws/workflows/live`, the id is unused) and treats it as a
single global feed. If the backend is later changed to filter per-workflow,
`useLiveEvents.ts` will need a workflow id passed in and the "live" placeholder
removed.
