# Increase font sizes + add Sign In page + overall polish

## Context
User wants three things:
1. Bigger, more readable typography across the Command Center UI (currently uses very small text: `text-[9px]`–`text-sm` almost everywhere).
2. A sign-in page.
3. General visual polish/presentability pass.

**Backend note:** This project has no Enter Cloud (Supabase) connection yet, so there is no real authentication backend. Per policy, I will proactively offer to connect Enter Cloud (via `supabase_enable`) at the start of execution so the user can opt into real auth. Regardless of their choice, I will build a fully designed Sign In page now:
- If Enter Cloud gets connected: the page is ready to be wired to real `supabase.auth` calls in a follow-up (not building full auth logic in this pass, since that's a separate, larger scope the user hasn't explicitly requested yet — just the page).
- If not connected (or declined): the page works as a polished, non-blocking entry screen — "Continue to Dashboard" navigates into the app. No fake account creation, no fabricated user data.

## Part 1 — Typography scale-up
All Command Center text currently uses very small arbitrary sizes. Apply a consistent one-step-up scale across every file in `src/components/incident-command/` and `src/pages/` (the incident-command feature only — not touching the unrelated template pages like `Index.tsx`):

| Current | New |
|---|---|
| `text-[9px]` | `text-[10px]` |
| `text-[10px]` | `text-[11px]` |
| `text-[11px]` | `text-xs` (12px) |
| `text-xs` (labels/body) | `text-sm` (14px) |
| `text-sm` (panel headings) | `text-base` (16px) |
| `text-base` | `text-lg` |
| `text-xl` (dashboard title) | `text-2xl` |
| `text-2xl` (stat values) | `text-3xl` |

Also nudge a few tightly-coupled icon sizes up one step where they sit next to enlarged text (e.g. `w-3 h-3` → `w-3.5 h-3.5`, `w-3.5 h-3.5` → `w-4 h-4` for nav/header icons), and add small padding increases on cards/badges/buttons that would otherwise look cramped (e.g. nav item `py-2.5` → `py-3`, stat card `p-4` → `p-5`, panel header `py-3` → `py-3.5`). Files touched: `Layout.tsx`, `IntegrationStrip.tsx`, `ApprovalsPanel.tsx`, `EventLog.tsx`, `StateRail.tsx`, `Skeleton.tsx`, `Dashboard.tsx`, `IncidentList.tsx`, `IncidentDetail.tsx`, `WorkflowListPage.tsx`, `WorkflowDetail.tsx`, `Decisions.tsx`, `Policies.tsx`, `ActionLog.tsx`.

## Part 2 — Sign In page
New file `src/pages/SignIn.tsx` + route `/sign-in` in `src/router.tsx` (top-level, **not** nested under the dashboard `Layout` — full-bleed auth screen, its own centered card layout, reusing `.icc-root` + `useIccTheme()` for consistent dark/light theming and a theme toggle in the corner).

**Design** (matches Command Center identity):
- Centered card on the `.icc-root` background (with the existing radial-gradient glow in dark mode).
- Logo badge (same `Terminal` icon treatment as the sidebar) + "Enterprise AI OS" / "Command Center" wordmark.
- "Sign in to your workspace" heading + short subtext.
- Email field + Password field (styled inputs matching existing form input style in `Layout.tsx`'s custom-incident form, but larger/roomier).
- Primary "Sign In" button (amber, matches "Run P0 Incident Demo" button style) — on click, navigates to `/` (dashboard). No fake validation/loading states that imply a real backend check.
- Small inline note below the form: "Authentication requires Enter Cloud — currently running in demo mode." (only rendered — no dismiss logic needed) so it's honest about current capability, styled subtly (dim, small).
- Footer link: "← Back to Dashboard" for easy exit during dev/preview.
- Theme toggle button (reuse `useIccTheme`) top-right corner so the page respects the same persisted preference.

No sign-up flow, no password-reset flow, no forgot-password link with fake behavior — keeps scope to "a sign in page" as requested.

### Entry point
Add a small "Sign In" affordance so the page is reachable from the app: a compact button/link in the sidebar footer of `Layout.tsx` (below Integrations), e.g. a `LogIn` icon + "Sign In" label linking to `/sign-in`. This is the only Layout change in this part (kept separate from the font-size sweep for clarity, but will be applied in the same edit pass).

## Part 3 — General polish
Small presentability touches while doing the above passes (no structural changes beyond what's listed):
- Ensure consistent vertical rhythm now that text is bigger (spot-check paddings called out in Part 1).
- Confirm both dark and light themes still meet contrast expectations after size changes (colors unchanged, only sizing).

## Files to change
- `src/pages/SignIn.tsx` (new)
- `src/router.tsx` (add `/sign-in` route)
- `src/components/incident-command/Layout.tsx` (font sizes + Sign In sidebar link)
- `src/components/incident-command/IntegrationStrip.tsx`
- `src/components/incident-command/ApprovalsPanel.tsx`
- `src/components/incident-command/EventLog.tsx`
- `src/components/incident-command/StateRail.tsx`
- `src/components/incident-command/Skeleton.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/IncidentList.tsx`
- `src/pages/IncidentDetail.tsx`
- `src/pages/WorkflowListPage.tsx`
- `src/pages/WorkflowDetail.tsx`
- `src/pages/Decisions.tsx`
- `src/pages/Policies.tsx`
- `src/pages/ActionLog.tsx`

## Verification
- Visual check (screenshots) of Dashboard, one list page, one detail page, and the new Sign In page in both dark and light mode — text should read noticeably larger and less cramped, nothing overflows/clips.
- `/sign-in` loads standalone (no sidebar/header), "Sign In" button routes to `/`, "Back to Dashboard" link works, theme toggle works independently.
- Sidebar "Sign In" link navigates correctly from any dashboard page.
