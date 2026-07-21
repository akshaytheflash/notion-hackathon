# Redesign Command Center dashboard UI (screenshot match) + light/dark mode

## Context
User provided two reference screenshots (dark and light variants) of a more polished "Command Center" dashboard layout and asked to:
1. Rebuild the UI to match this look (sidebar with search/nav/integrations, header with status pill, stat cards, restyled workflow/approvals/event-feed panels).
2. Remove the "Agents Online" stat card entirely.
3. Add a light/dark mode toggle.

Per user's decisions: no invented data (agent names, fake approval titles, user profiles, trend deltas, policy version strings) — only real/derived values from the existing (currently empty) data model, showing "—" when empty. Approve/Reject buttons render disabled (no backend). Search box is visual-only.

## Scope
Focused on the two files everyone sees on every page (`Layout.tsx` = sidebar+header, used app-wide) plus the `Dashboard.tsx` page shown in the screenshots. Other pages (Incidents, Workflows, Decisions, Policies, Action Log, detail pages) are NOT visually redesigned — but since they already consume the same CSS custom properties (`var(--color-*)`), they will automatically render correctly in both light and dark mode once the theme variable system is added, with zero code changes needed there.

## Approach

### 1. Light/Dark theme system (`src/index.css`, new `src/lib/incident-command/useIccTheme.ts`)
- Add a new CSS block: `.icc-root[data-theme="light"] { --color-ink: #f4f5f7; --color-panel: #ffffff; --color-panel-raised: #f8f9fb; --color-surface: #ffffff; --color-hairline: #e2e5ea; --color-text: #14171f; --color-muted: #5b6478; --color-dim: #8a93a8; --color-signal-amber: #b45309; --color-signal-cyan: #0f8a7a; --color-signal-green: #15803d; --color-signal-red: #dc2626; --color-signal-violet: #7c3aed; background-image: none; }` — darker signal-color variants for AA contrast on white.
- Because every existing component already reads colors via `var(--color-signal-cyan)` etc., overriding the variable values under `[data-theme="light"]` automatically re-themes the whole feature (all pages) with no component-level changes required.
- New hook `useIccTheme()`: reads/writes `localStorage["icc-theme"]`, defaults to `"dark"`, returns `{ theme, toggleTheme }`.
- `Layout.tsx` applies `data-theme={theme}` on the existing `.icc-root` wrapper div and renders a Sun/Moon toggle button (lucide-react `Sun`/`Moon` icons) in the header.

### 2. Sidebar + header redesign (`src/components/incident-command/Layout.tsx`)
- **Sidebar**: logo icon (lucide `Terminal` or `Command` in a rounded square) + "ENTERPRISE AI OS" / "Command Center" (kept from current). Add a visual-only search input ("Search incidents...") below the header, styled like the screenshot with a `⌘K` hint badge. Add "NAVIGATE" section label above nav links. Nav links get lucide icons (`LayoutDashboard`, `Siren`, `GitBranch`, `Scale`, `ShieldCheck`, `ScrollText`) and the "Incidents" link gets a live count badge (red pill) showing the number of active (non-terminal) workflows — fetched the same way integrations status already is, via `api.listWorkflows()` on the existing polling interval. Keep the existing bottom "Integrations" block (restyled to 2-column grid with dot+label, matching screenshot), plus a small "+" icon (decorative, no handler). Remove: no fake user/profile footer is added (none existed before either — nothing to remove there, just confirming no invented user data is introduced).
- **Header**: keep "Incident Command Center" title area, but restyle as "INCIDENT" (small mono label) + "Command Center" (bold) inline, plus a status pill computed from real data: if active workflow count is 0 → green "All systems nominal"; else amber "{n} active incident{s}". Add bell icon (decorative, no notifications data exists so no badge count). Add the new theme toggle button. Keep existing "Custom Incident" form toggle and "Run P0 Incident Demo" button (already fully functional, calls real `api.runPrimaryScenario`), just restyled with icons (`Plus`, `Play`).
- Drop the "Streaming from 12 agents" and "Auto-triage enabled by Policy v3.2" strings (fake agent count + fake policy version) — not reintroduced anywhere.

### 3. Dashboard page (`src/pages/Dashboard.tsx`)
- Header block: "OVERVIEW" label (kept) + larger bold title "Real-time workflow status across all active incidents" (kept text, restyled bigger) + subtitle showing a real, ticking "updated {n}s ago" derived from the last successful refresh timestamp (new local state + 1s interval to re-render the elapsed label). No fake "12 agents" text.
- Stat cards row: **3 cards only** (Agents Online removed per request):
  - **MTTR** — mean of `(completed_at - created_at)` across workflows that have `completed_at` set; formatted "Xm Ys"; shows "—" if none.
  - **Active Incidents** — count of workflows not in `COMPLETED`/`FAILED`/`REJECTED`.
  - **Auto-Resolved** — `(COMPLETED count / total count) * 100` formatted "XX.X%"; shows "—" if total is 0.
  - No fabricated trend deltas (no "-24%", "+1" arrows) since there's no historical baseline to compute them from.
  - Small helper module `src/lib/incident-command/dashboard-metrics.ts` computes these three values from `Workflow[]`, keeping `Dashboard.tsx` clean.
- Workflows panel: keep header + real count badge + "View All" link. Restyle each row: state-derived badge (grouped label RUNNING/WAITING/RESOLVED/FAILED/REJECTED with icon, derived purely from the real `state` field — not invented), a thin progress bar whose fill % is derived from the workflow's position in the existing `StateRail` pipeline order (exported from `StateRail.tsx`), and a relative "updated Xm ago" timestamp using `date-fns/formatDistanceToNowStrict` (already a project dependency).
- Approvals panel (`ApprovalsPanel.tsx`) restyled to card look with disabled Approve/Reject buttons (lucide `Check`/`X` icons), showing only real fields (approval id, workflow id, status) — no invented titles.
- Live Event Feed (`EventLog.tsx`) restyled with a source icon (lucide icons mapped from the real `source` string, reusing/extending the existing icon-mapping idea from `ActionLog.tsx` but with proper lucide components instead of unicode glyphs) and small tag pills (source + first segment of `event_type`), with relative timestamps via date-fns.

### Files to change
- `src/index.css` — add light theme variable overrides.
- `src/lib/incident-command/useIccTheme.ts` (new) — theme state hook.
- `src/lib/incident-command/dashboard-metrics.ts` (new) — MTTR/active/auto-resolved calculations.
- `src/components/incident-command/StateRail.tsx` — export `PIPELINE` (or a `getProgressPercent(state)` helper) for reuse by the Dashboard workflow rows.
- `src/components/incident-command/Layout.tsx` — sidebar/header redesign, theme toggle, nav icons + live badge.
- `src/components/incident-command/IntegrationStrip.tsx` — restyle to 2-col grid.
- `src/components/incident-command/ApprovalsPanel.tsx` — card restyle, disabled action buttons.
- `src/components/incident-command/EventLog.tsx` — icon + tag pill restyle.
- `src/pages/Dashboard.tsx` — stat cards, restyled workflow rows, ticking "updated" subtitle.

### Not in scope (kept as-is)
- IncidentList/IncidentDetail/WorkflowListPage/WorkflowDetail/Decisions/Policies/ActionLog pages — unchanged visually; they inherit light/dark automatically via the shared CSS variables.
- No backend wiring; Approve/Reject remain disabled; search box remains non-functional.

## Verification
- Toggle button switches the whole app (sidebar, header, dashboard, and every other page) between dark and light themes instantly, persisted across reloads via localStorage.
- Dashboard shows 3 stat cards (no Agents Online) with real/placeholder-dash values given empty data.
- Incidents nav badge, header status pill, and workflow progress bars reflect actual (currently empty) workflow data without any hardcoded/fake content.
- Visual check via screenshot in both modes against the two reference images for overall layout parity.
