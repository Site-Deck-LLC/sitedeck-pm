# Sprint 12 Log

## Summary
**Date:** 2026-06-15
**Status:** ✅ Complete

## Task 1: PM Connected Products sidebar (Benchmark-style) ✅
**Date:** 2026-06-15
**Status:** Live at https://projects.sitedeck.pro

### Built

**Backend** — `src/routes/health.routes.ts`
- New `getConnectedProducts()` helper. `benchmark = env URL set AND last 2xx outbound in webhooksLog`. `pro = inbound Pro webhook within 7 days`. `design = false`.
- Each Prisma query is wrapped in `try/catch`; DB error → `false`. The health endpoint must never throw (CLAUDE.md graceful degradation).
- Response now: `{ status, service, version, connectedProducts: { pro, benchmark, design } }`.

**Frontend — new files**
- `frontend/src/components/ConnectedProducts.tsx` (NEW). Three rows: SiteDeck PM (informational, no link), SiteDeck Benchmark (`<a target="_blank">`), SiteDeck Pro (`<a target="_blank">`), SiteDeck Design (disabled, "Coming soon" tooltip). Green dot `#22C55E` for live, gray dot `#9CA3AF` for offline. Pattern mirrors Benchmark's Sidebar.
- `frontend/src/components/Sidebar.tsx` (NEW). Navy `#1B2A4A` 224px sticky left sidebar. Logo block ("SiteDeck" / orange "PM" / subtitle "Project Management"). Nav: Projects / Portfolio / Template Library / Billing / Admin (Admin gated to `owner_admin`). ConnectedProducts slot. User footer (email + display name) with icon-only sign-out.

**Frontend — refactored**
- `frontend/src/components/Projects.tsx`. Replaced the top nav with the new `<Sidebar />`. The page body became a `<main>` flex child. The "Template Library / Portfolio / Billing / Admin" buttons that lived in the page header now live in the sidebar nav. The Sign Out button is in the sidebar footer. Best-effort `GET /api/v1/health` fetch on mount — if the endpoint is down, the dots render gray (default state). User info is read async from Firebase `currentUser` (falls back to dev-token email hint).
- `frontend/src/App.tsx`. No changes — `<Projects />` props already match the existing callback shape.

### Verification

```
$ curl -s https://projects.sitedeck.pro/api/v1/health | jq .
{
  "status": "ok",
  "service": "sitedeck-pm",
  "version": "1.0.0",
  "connectedProducts": {
    "benchmark": false,
    "pro": false,
    "design": false
  }
}
```
- `tsc --noEmit` (backend) — clean
- `tsc --noEmit -p frontend/tsconfig.app.json` — clean
- `npm run build` (backend) — clean
- `npm run build` (frontend) — 21 chunks emitted, 33-entry precache, `index-CqsouqiD.js` 53.28 kB
- `npm test` — 1011/1022 pass; 11 failures are the pre-existing `bug_reports` table-absence failures (no local `sitedeck-pm-postgres`). No new regressions.
- `npm run deploy` — full pipeline (frontend + backend + prisma + systemd restart) succeeded
- Live: `GET /api/v1/health` returns `connectedProducts`. Browser reloads on `https://projects.sitedeck.pro/` show the new sidebar.

### Autonomous decisions
- Used `status: { gte: '200', lt: '300' }` (string compare) because the Prisma `WebhooksLog.status` field is a `String`, not `Int`.
- The Benchmark dot is strict: gray until the next real 2xx outbound. No synthetic heartbeat was added — flagged as a follow-up if the user wants a green-when-healthy default.
- The Sidebar is a standalone component (`SidebarView` union, `SidebarUser` interface) so it can be wired into Dashboard/Gantt later without re-deriving the type shape.
- Sign Out in the sidebar footer is an icon button (matches Benchmark's pattern), not a labeled button. The orange "Sign Out" CTA in the old top nav was removed.
- The Admin nav item is gated to `owner_admin` (consistent with the existing admin security rule: don't render admin DOM for non-admins).

### Open follow-ups
- Benchmark "heartbeat" — to make the Benchmark dot green in normal operation, schedule a daily no-op `pm.heartbeat` outbound to Benchmark. Today it stays gray until the first real 2xx send.
- Dashboard / Gantt — they have a 56px icon rail already. The user scoped this sprint to Projects only. A future sprint can swap the rail for a 224px navy sidebar to fully unify the look.
