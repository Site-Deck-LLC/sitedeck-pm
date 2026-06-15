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
- ~~Dashboard / Gantt — they have a 56px icon rail already. The user scoped this sprint to Projects only.~~ **Resolved in follow-up:** Dashboard swapped to a 224px navy rail via the new `ProjectSidebar` component. The Top Nav still hosts search + alerts + owner-report chip (real product features). Gantt continues to use its own layout.

## Task 2: Dashboard uses 224px navy sidebar (parity with Projects) ✅
**Date:** 2026-06-15
**Status:** Live at https://projects.sitedeck.pro (reload the dashboard)

### Built
- `frontend/src/components/ProjectSidebar.tsx` (NEW). Sibling to the cross-app `Sidebar`. Same navy `#1B2A4A`, 224px width, sticky, full-height. Nav is icon-only (per-project icons: Schedule, RFI, Comm, Meetings, Reports, Owner Reports, Lessons, Drawings, Equipment, WBS, Settings). Header slot is generic — the Dashboard hands in a project-switcher + home button + save-as-template control. ConnectedProducts and user-info footer are shared with the cross-app `Sidebar` (same `ConnectedProducts` component, same footer layout).
- `frontend/src/components/Dashboard.tsx`. Replaced the 56px white icon rail with the new `<ProjectSidebar />`. The Top Nav is preserved but slimmed: removed the "SiteDeck PM" home button (now in the rail's header slot), the project switcher button + dropdown (now in the rail's header slot), the "Save as Template" button (now in the rail's header slot), the "Mr. Robert" user block (now in the rail's footer), and the orange "Sign Out" button (now in the rail's footer as an icon button). The search bar, owner-report-due chip, and alerts bell are kept in the top nav (real product features that don't belong in a sidebar).
- `connectedProducts` is fetched from `/api/v1/health` on mount (best-effort, never throws). User info is read async from Firebase `currentUser`, with a dev-token fallback. Same pattern as Projects.

### Bundle impact
- `Dashboard-xt5rcUOC.js`: 157.94 kB → 160.38 kB (+2.44 kB). ProjectSidebar is bundled into the Dashboard chunk; the cross-app `Sidebar` is in the Projects chunk. No new top-level chunk.
- `index-Bht2qa3X.js`: 53.31 kB (no material change — the new components are loaded only when their view is mounted).

### Verification
- `tsc --noEmit -p frontend/tsconfig.app.json` — clean
- `npm run build` (frontend) — clean, 21 chunks, 33-entry precache (1337.71 KiB)
- `npm test` — 1011/1022 pass; 11 failures are the pre-existing `bug_reports` table-absence failures. No new regressions.
- `npm run deploy` — full pipeline succeeded
- `curl https://projects.sitedeck.pro/api/v1/health` — still returns the `connectedProducts` field

### Autonomous decisions
- ProjectSidebar takes `navItems: ProjectNavItem[]` rather than baking in a nav array. The Dashboard's nav model is per-project (Schedule, RFI, etc.) and shouldn't entangle with the cross-app Sidebar's nav model (Projects, Portfolio, etc.). Same ConnectedProducts and footer code is shared via the existing `ConnectedProducts` component.
- Kept the Top Nav for search + alerts + owner-report chip. Removing them would have required relocating them to the content area, which is a bigger UX change. The rail's "CONNECTED PRODUCTS" + sign-out + user footer now give PM the consistent Benchmark-style footer in both views.
- Removed the duplicate "Mr. Robert" user block and the orange "Sign Out" button from the Top Nav. The sidebar's user footer is the canonical spot now.

### Follow-up: nav items are now icon+label (Benchmark pattern)
**Date:** 2026-06-15
**Status:** Live

The Dashboard's per-project nav was icon-only with hover tooltips. The user pointed out that Benchmark has labels next to each icon and asked for parity.

- `frontend/src/components/ProjectSidebar.tsx`. Nav rows are now flex rows: 16px icon (resized from the Dashboard's 20px icons via `cloneElement` — no icon re-authoring) + label text. Active state: `rgba(255,255,255,0.1)` background + white text. Inactive: `rgba(255,255,255,0.6)` text. Hover: `rgba(255,255,255,0.05)` background + white text. Padding: `10px 12px`. Border-radius: 6px. Same 224px sidebar width.

Bundle: `index-Ci51g8FB.js`. No new chunk, no test regressions.
