# Import frontend from akshaytheflash/notion-hackathon

## Context
The user wants to bring in the frontend of https://github.com/akshaytheflash/notion-hackathon (a Vite + React + TypeScript + Tailwind v4 "Incident Command Center" dashboard). The repo's `backend/` is a Python/FastAPI service (state machine, policy engine, Gemini/Notion/Slack/GitHub adapters, WebSocket feed) — Enter cannot run Python, so per user's decision we will **import the UI code only, as-is**. No backend wiring, no Supabase, no live data — API/WebSocket calls will be left in place but will simply fail silently (the pages already handle loading/error states gracefully), so the app renders with empty states out of the box.

This is a straight code port: adapt the source's React Router v6 + Tailwind v4 app into this project's React Router v7 + Tailwind v3 + shadcn setup, preserving structure, behavior, and visual design (custom dark "control room" theme) as closely as possible.

## Source file inventory (from `frontend/`)
- `src/App.tsx` — router setup (8 routes)
- `src/main.tsx` — entry point (not needed; Enter has its own `main.tsx`/`router.tsx`)
- `src/index.css` — Tailwind v4 `@theme` custom tokens (ink/panel/signal colors, animations)
- `src/lib/api.ts` — typed fetch wrapper + endpoint map + TS interfaces
- `src/lib/useLiveEvents.ts` — WebSocket hook for live event feed
- `src/components/Layout.tsx` — top nav + demo-run form + integration strip (uses `Outlet`)
- `src/components/StateRail.tsx` — 14-state pipeline visualization
- `src/components/ApprovalsPanel.tsx`, `EventLog.tsx`, `IntegrationStrip.tsx`, `WorkflowList.tsx`, `Skeleton.tsx` — dashboard widgets
- `src/pages/*.tsx` — Dashboard, IncidentList, IncidentDetail, WorkflowListPage, WorkflowDetail, Decisions, Policies, ActionLog

## Approach
1. **Adapt CSS tokens**: Port the `@theme` custom properties from source `index.css` into this project's `src/index.css` as plain CSS custom properties (not Tailwind v4 `@theme`, since this project uses Tailwind v3). Add them as additional `:root` variables (e.g. `--color-ink`, `--color-panel`, `--color-signal-amber`, etc.) alongside existing shadcn tokens, plus the shimmer/fade/pulse keyframes as standard `@keyframes` + utility classes in a `@layer utilities` block. Register the custom colors in `tailwind.config.ts` `extend.colors` so classes like `bg-ink`, `text-signal-cyan` work, and add the two Google Fonts (Space Grotesk, JetBrains Mono) via index.html link tags + `fontFamily` extension.
2. **Copy lib files as-is**: `src/lib/api.ts` and `src/lib/useLiveEvents.ts` copied verbatim into `src/lib/` (they're already framework-agnostic fetch/WebSocket code, will just fail gracefully against non-existent endpoints).
3. **Copy components**: `Layout.tsx`, `StateRail.tsx`, `ApprovalsPanel.tsx`, `EventLog.tsx`, `IntegrationStrip.tsx`, `WorkflowList.tsx`, `Skeleton.tsx` copied into `src/components/incident-command/` (new subfolder to avoid clashing with existing `src/components/ui/`), with import paths adjusted.
4. **Copy pages**: All 8 page files copied into `src/pages/` (Dashboard, IncidentList, IncidentDetail, WorkflowListPage, WorkflowDetail, Decisions, Policies, ActionLog), import paths adjusted to the new component folder.
5. **Wire routing**: Update `src/router.tsx` to add all 8 routes (`/`, `/incidents`, `/incidents/:incidentId`, `/workflows`, `/workflows/:workflowId`, `/decisions`, `/policies`, `/action-log`), nested under the ported `Layout` component (replacing the current single `Index` route), keeping the catch-all `*` → `NotFound` route. Existing `Index.tsx`/template page will be removed from routing (not deleted, just unrouted) — confirm this is fine since Layout becomes the new root.
6. **No dependency changes needed**: `react-router-dom` is already present (v7, API-compatible with the v6 code used). No new packages required.
7. **Leave data endpoints untouched**: `api.ts` still points to relative `/api/...` and `/ws/...` paths. Since there's no backend, these will 404/fail — pages already show their existing loading skeletons then empty/error states, so the app won't crash.

## Files to create/modify
- Modify: `src/index.css`, `tailwind.config.ts`, `index.html` (fonts), `src/router.tsx`
- Create: `src/lib/api.ts`, `src/lib/useLiveEvents.ts`
- Create: `src/components/incident-command/{Layout,StateRail,ApprovalsPanel,EventLog,IntegrationStrip,WorkflowList,Skeleton}.tsx`
- Create: `src/pages/{Dashboard,IncidentList,IncidentDetail,WorkflowListPage,WorkflowDetail,Decisions,Policies,ActionLog}.tsx`

## Verification
- App builds and lints cleanly.
- Preview loads `/` showing the Dashboard with the dark command-center theme, nav bar, and empty states (no workflows/approvals yet, since there's no backend).
- Navigate to each of the 8 routes and confirm they render without runtime errors (loading skeleton → graceful empty/error state).
