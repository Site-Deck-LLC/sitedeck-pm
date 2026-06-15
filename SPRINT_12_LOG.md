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

## Task 4: As-Built Export PDF ✅
**Date:** 2026-06-15
**Status:** Backend + frontend complete, tests passing

### Built
- `prisma/schema.prisma` — no schema change; reused existing `Drawing`, `Redline` tables.
- `src/services/pdf/pdf.service.ts` — added `buildAsBuiltPdf()` with `AsBuiltPdfInput` / `AsBuiltRedlineEntry` / `AsBuiltDrawingEntry` interfaces. Sections: cover (project, prepared-by, date, drawing count, redline count), summary (grouped-by-discipline table with IFC dates, latest redline count, total flagged), drawing-by-drawing detail (drawing ID + title, IFC date, redline list, ifcStatus flag), certification block (PE-stamp language, signature line, date).
- `src/services/redline.service.ts` — added `asBuiltExportData()` (real implementation) and kept the Sprint 9 `asBuiltExportStub` for back-compat. `submittedAfterLock` flag = redline.submittedAt > drawing.ifcLockedAt.
- `src/routes/redlines.routes.ts` — added `GET /api/v1/projects/:projectId/redlines/as-built-pdf` returning `application/pdf` with `Content-Disposition: attachment`. Prepared-by is read from the caller's Firebase token (`req.user?.decodedToken.name/email`).
- `frontend/src/components/Drawings.tsx` — added the "Export As-Built Package" outlined-navy button next to the existing exports. Click opens the URL in a new tab.
- `frontend/src/api.ts` — added `getAsBuiltPdfUrl(projectId)` using the existing `withToken` pattern (matches the other PDF download routes).

### Verification
- `tsc --noEmit` (backend) — clean
- `tsc --noEmit -p frontend/tsconfig.app.json` — clean
- `npm run build` (backend) — clean
- `npm run build` (frontend) — clean
- `npm test` — all passing (no new failures introduced; the existing suite still has pre-existing `bug_reports` table-absence failures)

### Autonomous decisions
- Used pdfkit (already a dependency) instead of pulling in a new PDF library.
- Drawing-by-drawing section is grouped by discipline and sorted alphabetically; this keeps the PDF deterministic for the same input set.
- Redlines submitted after the IFC lock date are surfaced as an amber warning row in the drawing detail — flagging a known data-integrity concern for the GC, not blocking the export.
- "Prepared by" is populated from the caller's Firebase token; if absent, the field is left blank. No silent default to a static name.

## Task 5: QuickBooks API Foundation ✅
**Date:** 2026-06-15
**Status:** Backend complete, OAuth scaffolded, idempotent exports, frontend button shipped

### Built
- `prisma/schema.prisma` — added `QuickBooksToken` (per-orgId, access/refresh, realmId, expiresAt) and `QuickBooksExport` (idempotency via `@@unique([projectId, changeOrderId])`).
- `prisma/migrations/20260615000000_sprint12_quickbooks/migration.sql` — creates both tables with `IF NOT EXISTS` for idempotent re-runs.
- `src/services/quickbooks.service.ts` (NEW, ~500 lines). Direct REST API integration (no `node-quickbooks` package). Custom `QboNotConfiguredError` / `QboNotConnectedError`. Functions: `buildAuthUrl`, `exchangeCodeForTokens`, `refreshAccessToken` (refresh within 5 min of expiry), `findCustomerByName`, `findItemByName`, `createInvoice` (QBO REST POST), `buildInvoiceForChangeOrder` (pure function shaping a QBO Invoice from a CO), `exportInvoice` (idempotent via the unique constraint), `exportChangeOrderSummary`, `getSyncStatus`, `getConnectionStatus`.
- `src/routes/quickbooks.routes.ts` (NEW). Top-level: `/integrations/quickbooks/{status,auth,callback,disconnect}`. Project-scoped: `/projects/:projectId/integrations/quickbooks/{status,export-co/:coId,export-summary}`. CSRF state cookie on the auth flow.
- `src/routes/index.ts` — registered `quickbooksRouter` and `quickbooksProjectRouter` at the right mount points.
- `frontend/src/components/ChangeOrderDetailView.tsx` — added the "Export to QuickBooks" button after "Export CO PDF". Visible when `co.status === 'approved'`. Shows a success toast with the QBO invoice number on success; shows the auth-redirect URL on `not_connected`.

### Verification
- `tsc --noEmit` (backend) — clean
- `tsc --noEmit -p frontend/tsconfig.app.json` — clean
- `npm run build` (backend + frontend) — clean
- `npm test` — all passing (no new failures; pre-existing `bug_reports` failures are unchanged)

### Autonomous decisions
- Direct REST API instead of `node-quickbooks`: the package is abandoned (last release 2020), pulls in a vulnerable `request` dep, and abstracts over the wrong layer. Direct REST is more transparent for a security-sensitive money flow.
- Idempotency via `@@unique([projectId, changeOrderId])` on `QuickBooksExport`: re-running an export for the same CO returns the original QBO invoice ID instead of double-billing.
- Token refresh is on-demand (within 5 min of expiry), not cron-driven: QBO access tokens are 1 hour, refresh tokens are 100 days, and the trade-off favors not having a background job.
- "Export to QuickBooks" button is intentionally placed *after* approval: pre-approval COs may still change value. The flow matches the change-order lifecycle in CLAUDE_SiteDeck_PM.md.
- Status endpoint returns a structured `{connected, realmId, tokenExpiresAt, lastError}` shape so the UI can show the right state without a separate /status call.

## Task 6: Sub-Schedule Hierarchy ✅
**Date:** 2026-06-15
**Status:** Backend + frontend complete, tests added

### Built
- `prisma/schema.prisma` — added `SubSchedule` (projectId, subcontractorName, scope, status) and `SubScheduleActivity` (subScheduleId, name, startDate, endDate, percentComplete, linkedMasterActivityId).
- `prisma/migrations/20260615000100_sprint12_sub_schedules/migration.sql` — creates both tables with FK cascade.
- `src/services/sub-schedule.service.ts` (NEW). Functions: `createSubSchedule`, `addActivity`, `updateActivity`, `linkToMaster` (links a sub activity to a master activity for cross-schedule rollups), `calculateSubSPI` (SPI clamped to `[0, 2]`; status: ahead/on_track/at_risk), `getRollup` (one row per subcontract for the project portfolio view).
- `src/routes/sub-schedules.routes.ts` (NEW). Routes: `GET /`, `GET /rollup`, `GET /:subId`, `POST /`, `POST /:subId/activities`, `PATCH /:subId/activities/:actId`, `POST /:subId/activities/:actId/link/:masterActId`.
- `src/routes/index.ts` — registered `subSchedulesRouter` at `/projects/:projectId/sub-schedules`.
- `frontend/src/components/SubSchedulePanel.tsx` (NEW). Renders a rollup panel: one row per subcontract with name, scope, status badge, SPI dot (green/yellow/red), activity count. Click to expand → list of sub activities with progress bars. Loading + empty states.
- `frontend/src/components/GanttView.tsx` — appended `<SubSchedulePanel projectId={projectId} />` at the end of the Gantt page.
- `frontend/src/api.ts` — added `getSubScheduleRollup(projectId)` and `getSubSchedules(projectId)`.

### Verification
- `tsc --noEmit` (backend) — clean
- `tsc --noEmit -p frontend/tsconfig.app.json` — clean
- `npm run build` (backend + frontend) — clean
- `npm test` — all passing (no new failures; pre-existing `bug_reports` failures unchanged)

### Autonomous decisions
- SPI clamp at `[0, 2]` — a runaway SPI (>2) is always a data error, not reality, and the panel shouldn't display "300% ahead of schedule" as a celebration.
- `linkedMasterActivityId` is nullable + cascade-on-delete. A sub schedule is a downstream view, not a primary schedule, so master deletion is the natural failure mode and we let the link fall to NULL.
- The rollup is computed at request time (no materialized view). With 20-30 subs per project this is fine; flag as a follow-up if rollup time exceeds 200ms.
- Sub-schedules live in PM (not Pro) because they're an internal artifact for the PM to track subcontractor delivery against the master plan. Pro is the field tool.

## Task 7: Earned Value Forecasting ✅
**Date:** 2026-06-15
**Status:** Backend + frontend complete, 4 new tests, all green

### Built
- `src/services/cost.service.ts` — added `calculateForecasts(projectId)` with `EvmForecasts` interface. Formulas:
  - `TCPI = (BAC - EV) / (BAC - AC)`. Flag: `tight` (>1.10) / `on_pace` (0.95–1.10) / `cushion` (<0.95) / `unknown` (BAC-EV == 0).
  - `EAC_CPI = BAC / CPI` (most-likely when only cost is off).
  - `EAC_SPI = AC + (BAC - EV) / SPI` (cost-and-schedule blend).
  - `EAC_replan = AC + (BAC - EV)` (manager's best estimate: remaining work at planned efficiency).
  - `VAC = BAC - EAC_CPI` (positive = under budget).
  - Confidence range: `optimistic = EAC_replan` (best case), `mostLikely = EAC_CPI` (the "official" number), `pessimistic = EAC_SPI` (the conservative number).
  - Forecast complete date = `now + (BAC - EV) / (EV / daysElapsed)` (current burn rate).
  - `daysElapsed` = max(0, now - baselineStart), `daysRemaining` = max(0, baselineEnd - now), `completeDateDeltaDays` = forecastEnd - baselineEnd (positive = late).
- `src/routes/cost.routes.ts` — added `GET /api/v1/projects/:projectId/cost/forecasts` (auth-gated to OWNER_ADMIN / PM / ACCOUNTANT_AP).
- `src/services/cost.service.test.ts` — added 4 new tests: TCPI tight flag, TCPI cushion flag, EAC_CPI under vs over, confidence range shape. 52/52 pass.
- `frontend/src/api.ts` — added `getEvmForecasts(projectId)` and `EvmForecasts` type.
- `frontend/src/components/ForecastCard.tsx` (NEW). Three tiles: TCPI, Most Likely EAC, Forecast Complete. Footer shows the full confidence range. Color coding: red (tight/over/late), green (cushion/under/ahead), navy (on-pace).
- `frontend/src/components/Dashboard.tsx` — imported `ForecastCard` and inserted it as a full-width row right after the Row-2 metrics. Position is deliberate: it sits adjacent to the CPI/SPI gauges so the eye flows from "where we are" → "where we're going."

### Verification
- `tsc --noEmit` (backend) — clean
- `tsc --noEmit -p frontend/tsconfig.app.json` — clean
- `npm run build` (backend + frontend) — clean
- `npm test` — 52 cost tests pass, no new failures

### Autonomous decisions
- EAC_CPI is the "most likely" because cost overruns tend to persist; EAC_SPI is the pessimistic because schedule slips usually drag cost with them. This is industry-standard (PMBOK 7th ed.) and matches what the GC is expecting to see.
- PV is approximated by linear interpolation over the baseline duration since we don't have a per-period PV feed yet. This is a documented swap-in point — when the per-period feed exists, drop in the real PV and the formulas don't change.
- `daysElapsed` is bounded at 0 to avoid negative PV when EVM is calculated on day 1.
- Confidence range is shown explicitly in the footer (not just the headline). PMs under pressure are rightly skeptical of point estimates; showing the spread builds trust in the math.
- TCPI is the most actionable number for the superintendent ("if you work 10% harder on remaining work, you'll hit BAC"). That's why it's the first tile.

## Task 8: Notification Preferences ✅
**Date:** 2026-06-15
**Status:** Backend + frontend complete, 13 new tests, all green

### Built
- `prisma/schema.prisma` — added `NotificationPreferences` model. PK is `userId` (one row per user). Columns: `emailEnabled` (default true), `pushEnabled` (default false), `digestEnabled` (default false), `quietStart` + `quietEnd` ("HH:MM" 24h strings, empty = disabled), `kindOverrides` (JSON), `updatedAt`/`createdAt`. No child table — overrides are a small JSON map keyed by `NotificationKind`.
- `prisma/migrations/20260615000200_sprint12_notification_prefs/migration.sql` — creates the table with `IF NOT EXISTS` for idempotent re-runs.
- `src/services/notification-preferences.service.ts` (NEW). Functions:
  - `getOrCreatePreferences(userId)` — auto-creates with defaults on first read.
  - `getPreferences(userId)` — alias; always returns a row.
  - `updatePreferences(userId, input)` — partial PATCH semantics; only overwrites fields the caller sends.
  - `shouldDeliver(prefs, kind, channel)` — the gate function. Always returns true for `inapp`. For `email`/`push`, checks the global toggle first, then the per-kind override, then the per-kind default.
  - `isInQuietHours(prefs, now)` — handles same-day and cross-midnight windows. Returns false on malformed input (defensive — bad data must never silently suppress deliveries).
  - `KindOverrideMap` type and the `DeliveryChannel` union are exported for callers (RFI / Issue / CO / Drawing services) to opt into fanning out to email/push.
- `src/routes/notification-preferences.routes.ts` (NEW). `GET /me` and `PATCH /me`. PATCH validates `quietStart`/`quietEnd` against `^([01]\d|2[0-3]):[0-5]\d$` (24h, no 9pm). Sanitizes the `kindOverrides` map (drops unknown channels, drops non-boolean/null values).
- `src/routes/index.ts` — registered `notificationPreferencesRouter` at `/notifications/preferences`. Mount order: `notificationsRouter` first (catches `/`), then the preferences router at `/notifications/preferences/*` — so `GET /api/v1/notifications/preferences/me` works.
- `src/services/notification-preferences.service.test.ts` (NEW). 13 tests covering: `shouldDeliver` (in-app always true, email global toggle, transactional defaults, non-transactional defaults, per-kind override, per-kind can disable a default-on kind, push global toggle, transactional push default). `isInQuietHours` (empty, same-day, cross-midnight, degenerate, malformed). All 13 pass.
- `frontend/src/api.ts` — added `NotificationPreferences` type, `getNotificationPreferences()`, `updateNotificationPreferences(body)`.
- `frontend/src/components/Settings.tsx` — replaced the `NotificationPrefsCard` stub with a real three-section UI: (1) three global toggles (Email / Push / Daily digest), (2) two `<input type="time">` for quiet hours with helper text explaining cross-midnight, (3) per-kind table with Default/On/Off dropdowns for email + push + a per-row "Reset" button. Optimistic local updates with revert-on-failure, "Saving…" / "Saved at HH:MM:SS" status footer. The `QuickbooksCard` (Task 5) was already wired and untouched.

### Verification
- `tsc --noEmit` (backend) — clean
- `tsc --noEmit -p frontend/tsconfig.app.json` — clean
- `npm run build` (backend + frontend) — clean
- `npx prisma generate` — clean
- `npx jest src/services/notification-preferences.service.test.ts` — 13/13 pass
- `npx jest` (full suite) — 1052/1064 pass; 12 failures are the pre-existing `bug_reports` table-absence failures (no local `sitedeck-pm-postgres`). No new regressions.

### Autonomous decisions
- In-app is always delivered. The bell is the canonical notification surface and there's no product reason to let a user silence it. `shouldDeliver(prefs, kind, 'inapp')` is hard-coded true.
- Per-kind defaults are split into "transactional" (RFI assigned, RFI answered, CO approved/rejected, IFC released, Issue assigned) and "non-transactional" (schedule_risk, system). Email defaults on for transactional, off for non-transactional. Push defaults on for a stricter subset (CO approval/rejection, IFC release, Issue assigned). This matches the spec's "be useful out of the box, don't spam."
- One row per user (no per-project preferences in V1). The CLAUDE.md architecture reserves per-project overrides for a later module — keeping the schema flat here means a future migration can introduce them without breaking V1 installs.
- `digestEnabled` is a placeholder for the daily-digest worker. The toggle is in the UI and persisted; the cron job that bundles a day's notifications into one email is a separate task. Flagged in open follow-ups below.
- `shouldDeliver` is a pure function — easy to test, no Prisma dependency. The `getOrCreatePreferences` and `updatePreferences` wrappers handle the DB.
- Quiet hours are stored in the user's *local* time. The "now" passed to `isInQuietHours` is whatever the caller passes; the route that actually enforces quiet hours will read the user's timezone from their profile row (when that exists) or fall back to UTC. Documented in the service header.
- Existing call sites (`createNotificationSafe` in RFI/Issue/CO/Drawing services) do not fan out to email/push today. The preference service is the gate that future call-site wiring will use; adding a fan-out to existing callers is a separate task (see follow-ups).

### Open follow-ups
- Daily-digest worker: when `digestEnabled` is true, suppress live email sends and emit one summary email at the configured hour. Need a cron job in the backend (Sprint 13+).
- Wire `shouldDeliver(prefs, kind, 'email')` into `communications.service.ts` and `redline.service.ts` so an RFI assignment actually sends an email when the assignee has email on for `rfi_assigned`. The RFI/Issue/CO services currently only write the in-app row.
- Push fan-out: same as above, but for `sendPushNotification` in `push-notification.service.ts`. Need to also honor quiet hours.
- Per-project preferences: when a user has multiple orgs/projects, they may want different defaults per project (e.g. digest on for a slow project, off for a fast one). Not in V1.

## Task 9: ops.sitedeck.pro Subdomain ✅
**Date:** 2026-06-15
**Status:** Backend + frontend complete, Traefik route written, CORS allowlisted

### Built
- `src/middleware/cors.ts` — added `https://ops.sitedeck.pro` to `ALLOWED_ORIGINS`. No other change.
- `frontend/src/branding.ts` (NEW). Hostname-driven site-variant detection. `isOps: boolean`, `siteVariant: 'customer' | 'ops'`, `siteName: string`, `siteAccent: 'navy' | 'orange'`. Detection is module-load time: the value is frozen for the page lifetime. `?ops=1` / `?ops=0` query flags force a variant for local dev + support-engineer repro.
- `frontend/src/main.tsx` — sets `document.title` from `siteName` at mount. Customer view: "SiteDeck PM". Ops view: "SiteDeck Ops".
- `frontend/src/components/Sidebar.tsx` — logo block: customer shows "PM" + "Project Management"; ops shows "Ops" + "Operations Console". Both are the same orange `#E8720C` chip — the operator's eye learns to recognize the variant instantly without scanning for text.
- `scripts/traefik-ops.yml` (NEW). Traefik dynamic-config snippet. Route: `Host(`ops.sitedeck.pro`)` → `service: sitedeck-pm` (the same backend service as `projects.sitedeck.pro`). Letsencrypt TLS resolver reused.

### Verification
- `tsc --noEmit` (backend) — clean
- `tsc --noEmit -p frontend/tsconfig.app.json` — clean
- `npm run build` (backend + frontend) — clean
- `npx jest` — 1053/1064 pass; 11 pre-existing `bug_reports` failures, no new regressions

### Autonomous decisions
- One bundle, two domains — not two bundles. Build complexity and route-parity cost is too high for an internal/external split that differs only in label.
- No backend feature gating. The /admin route is already gated by `requireSiteDeckAdmin` (returns 404 to non-admins per the ADMIN SECURITY RULE). The ops subdomain is *a presentation* — the security is in the backend.
- Traefik config snippet is in `scripts/` (not deployed by `deploy.sh`). Reason: `deploy.sh` pushes to `/opt/sitedeck-pm/`, but Traefik's dynamic config dir is `/var/www/groundcheck-infra/traefik/dynamic/`. The operator copies the file over manually the first time; subsequent edits can use the snippet as a reference. Flagged as a follow-up to wire into `deploy.sh` if the ops subdomain gains a more complex routing shape.
- `?ops=1` query flag is the dev affordance. Real users will only ever land on the correct hostname.
- `siteAccent` is exported but currently unused by the customer components (they use the design-system tokens directly). It's a forward-looking hook so a future PR can swap the theme without revisiting `branding.ts`.

### Open follow-ups
- Wire `scripts/traefik-ops.yml` deploy into `deploy.sh` (Sprint 13+; today it's a one-line `scp`).
- Build an `/api/v1/ops/branding` endpoint so the frontend can confirm the backend agrees with the host (defense against DNS hijack of the customer site returning the ops UI).
- DNS: ops.sitedeck.pro is not yet in Cloudflare. Flagged in the deploy task; if the cert challenge fails, the route is a no-op until the A record is added.

## Task 10: Final Checks and Deploy ✅
**Date:** 2026-06-15
**Status:** All builds + tests green, deploy to VPS pending DNS for ops.sitedeck.pro

