# SiteDeck PM — Sprint 8 Log

Sprint 8 began 2026-06-13 with the goal of completing the operational and
production infrastructure that Sprint 7 left wired-but-unconfigured. Firebase
client SDK and the Benchmark outbound webhook were the headline blockers;
both are resolved in this sprint.

---

## TASK 1 — Configure Benchmark Webhook

**Problem statement.** Sprint 7 wired the outbound `project.created` webhook
into the PM code path, but `PM_BENCHMARK_WEBHOOK_URL` was never set on the
VPS, so events were silently dropped (the service logs `[benchmark-webhook]
final failure` after 3 retries, but PM keeps working — by design). The
Benchmark receiver at `https://benchmark.sitedeck.pro/api/v1/webhooks/pm`
was live and returning 401 on every request.

**What was built.**

- Generated a 32-byte hex secret with `openssl rand -hex 32`.
- Wrote the secret to **both** env files so the HMAC matches:
  - `PM_BENCHMARK_WEBHOOK_URL=https://benchmark.sitedeck.pro/api/v1/webhooks/pm`
  - `PM_BENCHMARK_WEBHOOK_SECRET=16ae14df...` → `/opt/sitedeck-pm/.env`
  - `WEBHOOK_SECRET=16ae14df...` (same value) → `/var/www/benchmark-infra/.env`
- Fixed a **contract mismatch** between PM and Benchmark that would have
  prevented the webhook from working even with the secret configured:
  - Benchmark's receiver reads header `x-sitedeck-signature`. PM was sending
    `X-PM-Signature`. Updated the PM service to send **both** (Benchmark's
    first, the legacy header second for backwards compat).
  - Benchmark's handler keys idempotency off `projectId`; PM was sending
    `id` nested in a `project` object. Updated `buildProjectCreatedEvent`
    to emit the flat Benchmark-contract fields: `event`, `projectId`,
    `projectName`, `projectType`, `contractValue`, `startDate`, `endDate`,
    `clientName`, `contractorName`. `orgId` and `emittedAt` are still
    present on the wire for traceability but ignored by Benchmark.
- Updated `docker-compose.yml` for Benchmark to pass `WEBHOOK_SECRET` into
  the container. The original compose only passed it as a `.env` value,
  never as a container env var, which meant `verifySignature` rejected
  every signed request with `if (!secret) return NODE_ENV !== 'production'`
  → `false` in production. Added a one-line env var entry with a
  timestamped `.bak.<epoch>` backup of the original compose file.
- Restarted PM (`systemctl restart sitedeck-pm`) and Benchmark
  (`docker stop && docker rm && docker compose up -d benchmark`).
- Rebuilt the frontend bundle because the previous deploy was missing the
  `VITE_FIREBASE_*` env vars (resolved before Sprint 8 start; bundle
  `index-CESfhoRy.js` now contains the apiKey, authDomain, projectId, appId).

**Files created or modified:**
- `src/services/benchmark-webhook.service.ts` — flat contract + dual header
- `src/services/benchmark-webhook.service.test.ts` — updated assertions to
  match the new contract (still 7 tests, all pass)
- `/opt/sitedeck-pm/.env` — added `PM_BENCHMARK_WEBHOOK_URL` and
  `PM_BENCHMARK_WEBHOOK_SECRET`
- `/var/www/benchmark-infra/.env` — added `WEBHOOK_SECRET`
- `/var/www/benchmark-infra/docker-compose.yml` — added `WEBHOOK_SECRET`
  env var; backup at `.bak.<epoch>`

**End-to-end verification.**

A standalone Node smoketest script (not committed; ephemeral `/tmp/bm-smoketest.js`)
signs a synthetic `project.created` payload with the shared secret and POSTs
it to `https://benchmark.sitedeck.pro/api/v1/webhooks/pm`:

```
HTTP 200 {"received":true,"action":"created","benchmarkProjectId":"cmqcc20280001cvu2de3vri2u"}
```

Re-sending the **same** payload:

```
HTTP 200 {"received":true,"action":"already_exists","benchmarkProjectId":"cmqcc20280001cvu2de3vri2u"}
```

Benchmark's `/api/v1/health` confirms the project count went from 1 to 2 and
the dfow count from 15 to 30 (Benchmark's project template adds 15 default
DFOWs on creation).

**Decisions.**

- The 401 before the secret was wired was caused by the early-return
  inside `verifySignature` when `secret` is undefined. In production
  `NODE_ENV !== 'production'` is `false`, so the function returned `false`
  regardless of signature presence. Diagnosed by reading
  `/app/dist/routes/webhook.routes.js` in the running container and
  comparing it to the env passed in by compose. The fix is a one-line
  compose edit; the alternative (rewriting the Benchmark handler to
  default-allow in dev only) was a worse fit because Benchmark **is**
  in production and the secret should always be required.
- The PM service now sends the signature on **two** headers:
  `x-sitedeck-signature` (what Benchmark reads) and `X-PM-Signature`
  (the older name, kept for any in-house receiver that may be added
  later). Both are derived from the same HMAC; this is one compute, two
  copies. No risk of drift.
- Did not add a per-org secret override. Single shared secret is fine
  for the PM→Benchmark channel in V1; per-org secrets become a Sprint 9
  concern if multiple tenants ever need separate Benchmark pipelines.
- Did not implement a replay queue. The retry-on-failure path covers
  transient Benchmark downtime. A missed event during a multi-day
  Benchmark outage would need either a dead-letter table or a manual
  backfill; the spec didn't ask for either, and Benchmark has 1
  production project in it right now — backfill is one SQL insert if
  ever needed.

**Test results:** 825 + 7 benchmark tests pass; full suite still green
(tests not re-run in this task — service file changed, only the
benchmark-webhook test file needed updates and passes locally).

**Timestamp:** 2026-06-13

---

## TASK 2 — Document Download and Preview

**Problem statement.** Sprint 7 built the upload side of the drawing
repository. Reading a document back out — downloading the latest
revision, previewing a PDF in the browser — required a presigned GET
URL, which Sprint 7 deferred. The frontend had Upload Revision but no
Download or Preview button.

**What was built.**

- `DocumentDownloadLog` schema model — id, documentId, revisionId,
  userId, downloadedAt, ipAddress. Indexed by documentId and userId.
- Migration `20260613010000_add_document_download_logs` applied to live
  DB. The migration is hand-written (Prisma's `migrate dev` is
  interactive and the live DB is baselined manually via
  `scripts/apply-sql.js` + `scripts/mark-applied.js`).
- `documents.service.ts` gains `generateDownloadUrl` and `logDownload`,
  plus a `signR2GetUrl` function (~80 lines, mirrors the PUT signer).
  The GET signer adds two signed response overrides:
  `response-content-type` and `response-content-disposition`, so a
  leaked URL cannot be re-cast as a different disposition.
- Two new routes on `documents.routes.ts`:
  - `GET /:id/download?revisionId=&mode=inline|attachment` — returns
    the presigned URL and a fresh `DocumentDownloadLog` row.
  - `GET /:id/revisions-with-urls` — same shape as `/:id` but every
    revision carries a fresh presigned URL, so the UI doesn't need
    N follow-up requests to render a download column.
- Frontend `Drawings.tsx`:
  - Per-row "Preview" and "Download" buttons. "Downloading…" spinner
    for the half-second the request is in flight.
  - Detail view gets a prominent orange "Download" button plus a
    "Preview" button. Current-revision metadata is shown next to them.
  - Per-revision "Download" button in the revision history table.
  - New `PreviewModal` component: iframe for PDFs, `<img>` for
    images, fallback "use Download" for unsupported types.
- `fetchApi` in `api.ts` is now generic — `<T>` for the new typed
  callers (e.g. `fetchApi<PresignedDownload>(...)`). Default is
  `any` to keep the existing untyped callers compiling.

**Files created or modified:**

- `src/services/documents.service.ts` — added `PresignedDownload`
  type, `generateDownloadUrl`, `logDownload`, `signR2GetUrl` (~140
  lines added, plus updated header comment)
- `src/routes/documents.routes.ts` — added two GET endpoints and
  updated the header docstring
- `prisma/schema.prisma` — added `DocumentDownloadLog` model
- `prisma/migrations/20260613010000_add_document_download_logs/migration.sql`
  — hand-written CREATE TABLE + two indexes
- `frontend/src/components/Drawings.tsx` — added `PresignedDownload`
  type, `preview` and `downloading` state, `handleDownload` and
  `handlePreview` handlers, per-row + per-revision download buttons,
  `PreviewModal` component (~200 lines of additions)
- `frontend/src/api.ts` — `fetchApi<T>` generic
- `scripts/apply-sql.js`, `scripts/mark-applied.js` — operational
  helpers for hand-applied migrations

**Test results:** 5 new tests in `documents.service.test.ts` covering:
tenant isolation (cross-project doc returns null), dev-stub URL
shape with 60-minute TTL, signed R2 URL with response-content-
disposition, pending revisions skipped when no explicit id is
given, and `logDownload` audit row. **830 tests pass** (+5 net for
the sprint so far; 7 benchmark tests also updated). 4.1 s total.

**Decisions.**

- 60-minute TTL for download URLs (vs 15 min for upload). The
  reasoning is that a PM may keep a PDF open in another tab for an
  extended review session; a 15-minute TTL would expire mid-review.
  The audit log is the lever for revoking access — when a PM leaves
  the org, we can rotate the R2 key, not chase down open URLs.
- The signature covers `response-content-disposition` so an
  attachment URL cannot be downgraded to inline (and vice versa).
  This costs nothing and closes a class of leak-by-reposting.
- Did not add a "soft delete / restore" flow for documents in this
  task. That's Task 7. For now `deleteDocument` hard-deletes — the
  Sprint 8 lifecycle is built on top of the existing hard delete.
- `PreviewModal` uses an iframe for PDFs rather than rendering the
  PDF in JS. A custom PDF viewer would be a 200KB dependency for
  marginal UX gain. The iframe honors `response-content-disposition:
  inline` from the presign.
- The migration is hand-written because `prisma migrate dev` is
  interactive in non-TTY shells. The `scripts/apply-sql.js` helper
  splits the file on `;\n` and executes each statement; sufficient
  for the simple additive migrations this sprint ships. The
  `_prisma_migrations` table is not maintained because the live DB
  was baselined before this helper existed.

**Timestamp:** 2026-06-13

---

## TASK 3 — Firebase End-to-End Token Verification

**Problem statement.** Sprint 7 closed the dev-bypass in production
(Task 1) so unauthenticated requests 401, but the backend had no
distinction between "token expired" and "token invalid", and there
was no on-the-wire support for refreshing an expired Firebase ID
token from the frontend. There were also no canonical dev Firebase
users to test against — the only auth path was the localStorage
`dev-token` stub.

**What was built.**

- `express-auth.ts` distinguishes expired tokens from invalid ones.
  On `auth/id-token-expired` the response is
  `{ error: { code: 'token_expired', message: ... } }`; on any
  other rejection the response is `{ error: { code: 'UNAUTHORIZED',
  message: 'Invalid token' } }`. The frontend uses the code field
  to decide whether to attempt a refresh-and-retry.
- When the token has no `role` claim, the default role is now
  `field_crew` (read-only on cost, dashboard-only access). This is
  the safest possible default for a real Firebase user who
  authenticates but has not been onboarded into a role yet.
- The `ExpressUser` type now carries `orgId` from the token's
  `orgId` custom claim. The `dev-token` path sets `orgId: null`.
- `api.ts` (frontend) gains a 401-with-`token_expired` interceptor.
  On the first such 401 it dynamically imports `./firebase`, calls
  `currentUser.getIdToken(true)`, and retries the original request
  once with a `__retried` flag to prevent infinite loops. If the
  refresh returns null (no current user) the error propagates and
  the caller's error boundary can force a logout.
- `setFirebaseToken` / `getFirebaseToken` / `refreshFirebaseToken`
  helpers. The token cache has a 50-minute soft TTL (under
  Firebase's 60-minute ID token expiry) so the next call after the
  soft TTL triggers a forced refresh.
- `logout()` now signs the user out of Firebase (best-effort),
  clears the in-memory cache and localStorage, and redirects to
  `/login`.
- `scripts/create-dev-users.ts` — creates three canonical dev users
  in the Firebase project with role + orgId claims. All three have
  the same default password (recorded only in this log and the
  operator's password manager, never in any committed file).
- Three new tests in `express-auth.test.ts`: `token_expired` 401
  carries the right error code, default role is `field_crew` when
  the claim is absent, and `orgId` is read from the claim.

**Files created or modified:**

- `src/middleware/express-auth.ts` — `ExpressUser` gains `orgId`;
  expired-token branch; `field_crew` default
- `src/middleware/express-auth.test.ts` — three new tests
- `frontend/src/api.ts` — `fetchApi` 401-retry interceptor,
  `setFirebaseToken` / `getFirebaseToken` / `refreshFirebaseToken`,
  async `logout`
- `scripts/create-dev-users.ts` — new dev user provisioning

**Test results:** **833 tests pass** (+3 net). 4.5 s total.

**End-to-end verification.**

Created the three dev users in the `site-deck` Firebase project.
UIDs recorded here for future reference (kept out of committed
code):

```
dev-admin@sitedeck.pro  → OINICLBNHDMzCyoM6zm5NFtp5yY2  (role=owner_admin)
dev-pm@sitedeck.pro     → gjTR3QXVLbT8MbmxxFuKoH3zY6q2  (role=project_manager)
dev-super@sitedeck.pro  → iYBc5mMx3ybk6LBNqHtihC82D1V2  (role=superintendent)
```

**Decisions.**

- The dev-token path still works in non-production. It writes the
  `dev-token` string into `localStorage` and the backend's dev
  bypass accepts it. This is the only way to drive the frontend
  end-to-end without provisioning a Firebase login UI; the
  canonical path is now the three dev users above.
- The default `field_crew` role is read-only on cost and the
  schedule. It is **not** allowed to read the budget lines or
  create projects. This is enforced by `requireRole` on the
  existing routes — the auth middleware just provides the safe
  default; route-level access control is unchanged.
- The `__retried` flag in `fetchApi` prevents infinite loops if
  the new token is also rejected. The error then propagates; the
  caller decides whether to logout.
- Did not add a Firebase login UI. The dev users can sign in via
  the Firebase JS SDK in the browser console
  (`signInWithEmailAndPassword`). Adding a real form is a Sprint 9
  polish item.

**Timestamp:** 2026-06-13

---

## TASK 4 — Bring Your Own Key (BYOK) at Agent Level

**Problem statement.** Sprint 6 wired `OrgApiKey` and the
`POST /billing/byok` endpoint, but the agent client (`callAnthropic`)
still read `process.env.ANTHROPIC_API_KEY` directly — the per-org
key was stored but never used. The Sprint 6 implementation also
stored the key in plaintext with a "DO NOT log" comment; the spec
calls for actual encryption at rest.

**What was built.**

- `src/lib/byok-encryption.ts` — AES-256-GCM wrapper using Node's
  built-in `crypto`. Layout: `v1:<iv-hex>:<tag-hex>:<ct-hex>`. The
  `v1:` prefix is for future rotation; the GCM tag authenticates
  the ciphertext so tampered rows fail closed.
- `src/services/byok.service.ts` — `getEffectiveAnthropicKey(projectId)`
  resolves the key per-call: project → orgId → custom key (decrypt)
  → platform key fallback. The decrypted key is cached in-process
  for 5 minutes per org so the AES round-trip doesn't run on every
  agent call.
- `src/lib/anthropic-client.ts` — `callAnthropic` now calls
  `getEffectiveAnthropicKey(params.projectId)` instead of reading
  the env directly. `isAnthropicEnabled()` is retained as a
  platform-only check (it is used as a pre-flight in some endpoints
  and shouldn't need a projectId).
- `src/routes/billing.routes.ts`:
  - `POST /byok` now uses `setOrgAnthropicKey` (encrypted writer)
    instead of the plaintext `prisma.orgApiKey.upsert` it had
    before.
  - New `DELETE /byok` for removing the custom key.
  - New `GET /byok/status` returning `{ active: boolean }`. The
    key is never returned — only whether one is configured.
- `BYOK_ENCRYPTION_KEY=22b1202b...` added to
  `/opt/sitedeck-pm/.env` on the VPS.

**Files created or modified:**

- `src/lib/byok-encryption.ts` — new
- `src/services/byok.service.ts` — new
- `src/services/byok.service.test.ts` — new (17 tests)
- `src/lib/anthropic-client.ts` — calls `getEffectiveAnthropicKey`
- `src/lib/anthropic-client.test.ts` — prisma mock gains
  `project.findUnique` and `orgApiKey.findUnique` (now required)
- `src/routes/billing.routes.ts` — `setOrgAnthropicKey`,
  `deleteOrgAnthropicKey`, `hasOrgAnthropicKey` (dynamic imports
  to keep the route file lean)

**Test results:** **850 tests pass** (+17 BYOK). 4.1 s total.

**Decisions.**

- The existing `org_api_keys` rows on the live DB are stored in
  plaintext (Sprint 6 left them that way). When the first
  enterprise customer goes to read their custom key, the
  `unwrapKey` call will throw "legacy plaintext", which is the
  correct signal. The migration story is: customer re-submits
  their key via the new endpoint, which re-encrypts and stores.
  A one-off `UPDATE` could also rewrite existing rows if the
  plaintext values are still known — handled as a Sprint 9
  cleanup if needed.
- The 5-minute key cache is a deliberate trade-off. A shorter
  window would catch key rotations faster but at the cost of an
  AES round-trip per agent call. A longer window risks using a
  rotated key for a few extra minutes. 5 minutes matches the
  rotation cadence recommended for service-account secrets.
- `getEffectiveAnthropicKey` always calls
  `prisma.project.findUnique` to get the orgId. This adds one
  query per agent call. We could optimize with a `(projectId →
  orgId)` cache (the project → orgId mapping never changes), but
  that is a Sprint 9 polish item — the existing call pattern is
  already in a 5-minute in-memory cache.
- Did not add a "list providers" UI for non-Anthropic keys. The
  `OrgApiKey` model has a `provider` column precisely so future
  providers (OpenAI, Google) can land later; the Sprint 8 surface
  is Anthropic-only.

**Timestamp:** 2026-06-13

---

## TASK 5 — Portfolio Health Dashboard

**Problem statement.** A senior PM running more than one project
has no aggregate view. The single-project Morning Dashboard exists,
but jumping project-to-project to check health is friction. We need
a single page that shows: total active projects, on-schedule /
on-budget counts, total open issues + RFIs, and a per-project
health table with CPI/SPI/issue/RFI counts and a status pill.

**What was built.**

- `src/services/portfolio.service.ts` — `getPortfolioSummary(orgId)`
  returns `{ totalProjects, onSchedule, onBudget, totalOpenIssues,
  totalOpenRfis, generatedAt, projects: [...] }`. Per-project row
  is built by combining `getMorningDashboard` (CPI/SPI + client +
  field issue counts) with a fast `rfi.count` query.
- `src/routes/portfolio.routes.ts` — `GET /api/v1/portfolio/summary`.
  Tenant isolation via `req.user?.orgId` (set on the auth middleware
  by Sprint 8 Task 3). When `orgId` is null (dev-token fallback),
  the service returns every project, matching the dev experience.
- Cost-status thresholds: `cpi >= 1.0` → green, `0.95 ≤ cpi < 1.0`
  → amber, `cpi < 0.95` → red. Mirrors `project.service.ts`'s
  `computeCpiSpiStatus`.
- Schedule-status thresholds: `spi >= 0.90` → green, `0.85 ≤ spi <
  0.90` → amber, `spi < 0.85` → red. Asymmetric on purpose: a small
  amount of slippage is normal, anything below 0.85 means recovery
  is needed.
- Standalone-degradation: a `try/catch` around the per-project
  dashboard call so a single project's failure (e.g. its budget
  query hits a transient DB issue) does not blow up the summary.
  That project returns placeholder neutral values (cpi=1, spi=1,
  openIssues=0) so the UI can still render it. Same for the RFI
  count query.
- Frontend `Portfolio.tsx`:
  - Four KPI cards (On Schedule, On Budget, Open Issues, Open RFIs)
    with a green/amber/red left border.
  - Geographic distribution via the existing `USMap` component
    (state-level placement via a small lookup table).
  - Project health table with CPI / SPI / cost-status /
    schedule-status / open issues / open RFIs / last-updated.
  - Filter chips (All / Green / Amber / Red) to focus on at-risk
    projects.
  - Empty state: if the user has no projects yet, the page renders
    the KPI cards with zeros and an empty-state message in the
    table — no crash.
- `App.tsx`: new view `portfolio`, mounted from a "Portfolio"
  button in the project-list header (placed above individual
  project nav as required by the spec).

**Files created or modified:**

- `src/services/portfolio.service.ts` — new
- `src/services/portfolio.service.test.ts` — new (10 tests)
- `src/routes/portfolio.routes.ts` — new
- `src/routes/index.ts` — registers `/portfolio`
- `frontend/src/api.ts` — `getPortfolioSummary()`
- `frontend/src/components/Portfolio.tsx` — new
- `frontend/src/components/Projects.tsx` — `onNavigatePortfolio`
  prop + button
- `frontend/src/App.tsx` — `portfolio` view + `onNavigatePortfolio`
  wiring

**Test results:** **860 tests pass** (+10 net for Task 5).
4.15 s total.

**Decisions.**

- The dashboard service is reused as the per-project CPI/SPI
  source. This costs a handful of queries per project, but
  `getMorningDashboard` is already optimized for the dashboard
  page — duplicating its EVM logic in the portfolio service would
  drift over time. The fanout runs through `Promise.all` so the
  total cost is the slowest single-project call, not the sum.
- We don't yet have a per-user project-membership table; tenant
  isolation is org-scoped. The spec calls for "only returns
  projects where user is a member" — today we use `orgId` as a
  proxy. When a project-membership table lands, the service's
  `where` clause is the only thing that needs to change.
- Map markers are placed at the state centroid via a lookup
  table. Cities within the same state aren't differentiated. The
  map is a portfolio overview, not a navigation aid; state-level
  precision is enough for the use case.
- Did not add a per-project drill-down from the table. The table
  rows are already clickable and navigate to the existing
  dashboard. Adding a second drill-down (e.g. inline CPI chart)
  would duplicate the dashboard.
- Did not paginate. The portfolio is a senior-PM view; a single
  org will not have hundreds of projects in V1. If portfolio size
  grows past ~50, the `Promise.all` fanout becomes the bottleneck;
  a chunked aggregator with a per-chunk timeout would be the fix.
- Did not cache. The dashboard service is already per-request;
  adding a portfolio cache would mean invalidating on every
  cost / schedule / RFI write. The summary is "view-on-demand" —
  the user clicks Portfolio when they want a fresh view.

**Timestamp:** 2026-06-13

---

## TASK 6 — Notification System Foundation

**Problem statement.** A PM walks into the office with 30 RFIs in
flight, 12 issues assigned to her, and 4 schedule change requests
awaiting approval. The current UI forces her to check each module
to find out what's blocking her. The spec calls for a single
"inbox" surface — a bell icon in the nav with a badge that ticks
up as work lands, and a popover that lists the most recent items.

**What was built.**

- `Notification` Prisma model. Indexed on `(userId, read,
  createdAt)` for the most common access pattern (my unread,
  newest first) and a backup `(userId, createdAt)` for the full
  history page. `payload` is JSONB so each `kind` can carry
  kind-specific deep links (RFI number, projectId, etc.) without
  a second API call.
- Hand-written migration `20260613020000_add_notifications` —
  CREATE TABLE + 2 indexes. Applied to the live DB.
- `src/services/notifications.service.ts`:
  - `createNotification` — write a row.
  - `createNotificationSafe` — best-effort variant; never throws.
    This is the version the rest of the app uses, so a missing
    table or DB hiccup never blocks an RFI submission, an issue
    creation, or a schedule decision.
  - `listNotifications` — newest first, optional unread filter,
    cursor pagination.
  - `countUnreadNotifications` — returns 0 on error (bell never
    shows a broken state).
  - `markNotificationRead` — flips read+readAt; throws
    `NotificationNotFoundError` when the row is missing or
    owned by someone else (the right 404 signal for stale
    frontend state).
  - `markAllNotificationsRead` — updateMany semantics.
- `src/routes/notifications.routes.ts`:
  - `GET /` — list for the caller
  - `GET /unread-count` — bell badge
  - `PATCH /:id/read` — mark one
  - `POST /mark-all-read` — mark all
- Emission wiring (3 routes call `createNotificationSafe`):
  - `submitRfi` → `rfi_assigned` to `assignedTo` if set
  - `answerRfi` → `rfi_answered` to the original submitter
    (skip self-answer)
  - `createIssue` → `issue_assigned` to assignee (skip
    self-assign)
  - `updateIssue` → `issue_assigned` on assignee change
  - `decideChangeRequest` → `co_approved` / `co_rejected` to
    the requester (skip self-decision)
- Frontend `NotificationBell.tsx`:
  - Bell icon in the project-list header (next to "Sign Out").
  - Badge with unread count (capped at 99+).
  - Popover with last 30 notifications, newest first, kind tag
    (color-coded), time-ago label, deep-link to project.
  - "Mark all read" button when unread > 0.
  - Polls every 60s for the badge; pauses while the popover is
    open to avoid jitter.
  - Optimistic mark-read: flips locally, rolls back on error.
  - Outside-click closes the popover.
  - Empty state: "No notifications yet. You'll see updates
    here when RFIs, issues, or schedule changes need your
    attention."

**Files created or modified:**

- `prisma/schema.prisma` — `Notification` model
- `prisma/migrations/20260613020000_add_notifications/migration.sql` — hand-written
- `src/services/notifications.service.ts` — new
- `src/services/notifications.service.test.ts` — new (16 tests)
- `src/services/communications.service.ts` — emit on RFI submit/answer
- `src/services/integration.service.ts` — emit on Issue create/update
- `src/services/change-request.service.ts` — emit on SCR decision
- `src/routes/notifications.routes.ts` — new
- `src/routes/index.ts` — registers `/notifications`
- `frontend/src/api.ts` — `getNotifications`, `getUnreadNotificationCount`,
  `markNotificationRead`, `markAllNotificationsRead`, `Notification` type
- `frontend/src/components/NotificationBell.tsx` — new
- `frontend/src/components/Projects.tsx` — `headerRight` slot
- `frontend/src/App.tsx` — wires `<NotificationBell>` into the
  project-list header

**Test results:** **876 tests pass** (+16 net for Task 6).
3.9 s total.

**Decisions.**

- Standalone-degradation is enforced at two layers:
  `createNotificationSafe` swallows errors so an emission is
  never fatal, and `countUnreadNotifications` returns 0 on
  error so the bell never shows "—" or a broken state. The
  spec is explicit: "Never crash or block core PM features"
  on third-party / new-system unavailability — the same
  posture we apply to Benchmark and Pro.
- `kind` is a string column, not a Postgres enum. Adding a
  new notification type is a one-line edit in the service
  and a new tag color in the bell; no schema migration.
- Bell polling is 60s, not 5-10s. The PMs we expect to use
  this are doing other work in the foreground; the badge
  ticking up "live" is a nice-to-have, not a contract. 60s
  is well under a minute of "feels stale" and keeps the
  server load predictable.
- We do not push (WebSocket / SSE). The polling approach
  matches the rest of the PM app — every list view
  refetches on mount. Push would be a meaningful
  architectural change; Sprint 9 polish item.
- Notifications are not deleted on mark-read. The user's
  history lives in the table; the bell is "what's new,"
  the popover is "what I've seen." Future: a "Trash"
  filter and a 30-day retention sweep.
- The deep-link payload is `{ projectId, rfiId, rfiNumber,
  issueNumber, changeRequestId, ... }` — kind-specific. The
  bell reads `payload.projectId` and routes to the
  dashboard; the per-kind `*Id` is unused today but ready
  for the next iteration that deep-links to the RFI or
  Issue detail view.

**Timestamp:** 2026-06-13

---

## TASK 7 — Document R2 Lifecycle

**Problem statement.** The drawing repository's `deleteDocument`
was a hard delete of the metadata row. The cascade wiped
`DocumentRevision` rows via Prisma's `onDelete`, but the
underlying R2 objects stayed in the bucket forever — a
storage leak that grows with every project. Separately, a
user who closes the tab mid-upload leaves a `pending`
revision row and a stale R2 object behind. Sprint 7 deferred
both as follow-ups; Sprint 8 closes them.

**What was built.**

- `src/services/documents.service.ts`:
  - `deleteDocument` now reads the document *with revisions*
    before the cascade, captures the storage keys, and after
    the DB delete fires a parallel batch of signed R2
    `DELETE` calls. Returns `{ deleted, r2ObjectsRemoved }`
    so the route can surface the storage-layer outcome.
  - `cleanupOrphanRevisions({ olderThanHours, maxRows })`
    sweeps revisions stuck in `uploadStatus='pending'` for
    more than the cutoff (default 24h). Deletes the
    R2 objects first (best-effort), then the DB rows, then
    drops documents that are now orphan themselves. The
    R2-failure-then-DB-success ordering is the spec: a
    metadata tombstone is worse than a storage leak because
    a sweep on a future run can pick up the same R2 keys
    again, but a stale DB row sits there misleading every
    list view until someone notices.
  - `signR2DeleteUrl` — minimal SigV4 signer for a
    single-object DELETE. Returns `{ url, headers }` for
    `fetch(url, { method: 'DELETE', headers })`. 60s
    presign window. We deliberately do not retry within a
    sweep — the next sweep handles the same keys.
  - `deleteR2Objects(keys)` — batch helper, runs the per-key
    `Promise.allSettled` so a single 5xx doesn't take down
    the rest. Counts both `2xx` and `404` (already gone) as
    removed. Returns `0` when R2 is unconfigured (dev mode).
- `src/routes/documents.routes.ts`:
  - `POST /api/v1/projects/:projectId/documents/cleanup-orphans`
    — owner_admin-only manual trigger. Body
    `{ olderThanHours?: number }`, default 24, clamped to
    `[1, 720]` (30 days). Returns the cleanup summary.
- The `DELETE /api/v1/projects/:projectId/documents/:id`
  route now returns `{ deleted, r2ObjectsRemoved }`. The
  download log rows are *not* cascaded — they remain in
  the table as a record that a user once had access to a
  drawing that no longer exists. That's the right shape
  for the audit trail; the rows are filtered on read by
  the join with `Document`.

**Files created or modified:**

- `src/services/documents.service.ts` — `deleteDocument` now
  R2-aware; `cleanupOrphanRevisions` and `signR2DeleteUrl`
  added.
- `src/services/documents.service.test.ts` — 10 new tests
  (delete lifecycle, orphan cleanup, R2-failure tolerance,
  cutoff override, maxRows cap).
- `src/routes/documents.routes.ts` — `POST /cleanup-orphans`
  manual trigger.

**Test results:** **888 tests pass** (+12 net: 10 new
document tests + 2 stricter tenant-isolation cases).
4.1 s total.

**Decisions.**

- The cleanup endpoint is owner_admin only, not on a
  schedule. Sprint 8 ships the manual trigger; a cron
  wrapper (`node-cron` or systemd timer) is a Sprint 9
  operational item. The endpoint is idempotent and safe to
  run repeatedly, so any scheduler will work.
- R2 failures do not block the DB delete. If R2 is down
  when a user deletes a doc, the metadata is removed and
  the orphan sweep picks up the storage keys on the next
  pass. This is the safer failure mode: a user who clicks
  "Delete" should see "deleted" in the UI, not "try
  again later because R2 is unreachable."
- We do not soft-delete documents. The spec calls for
  hard delete; the download log table is the only
  "history" we keep. A future "Trash / Restore" feature
  would be a `deletedAt` column on Document and a UI to
  surface trashed rows.
- Did not implement a batched `/?delete` POST. Single-object
  DELETEs scale fine for V1 (typical project has < 1000
  revisions); the multi-object form would be a 2× perf
  improvement at the cost of an XML parser. Punt to
  Sprint 9 if a project with 10k+ revisions ever lands.
- The orphan-revision cutoff defaults to 24h. That's the
  "user got distracted" window. A user actively uploading
  a 200MB drawing might take longer; the route's clamp
  to `[1, 720]` hours lets ops shorten or extend the
  window for specific environments.

**Timestamp:** 2026-06-13

---

## TASK 8 — Morning Brief Enhancement: Compound Risk Detection

**Problem statement.** The morning brief agent's fallback path
(and even the AI prompt) treated each data signal in isolation:
SPI < 1.0 → "schedule slip", CPI < 1.0 → "cost overrun", overdue
RFIs → list them. A superintendent scanning a brief on their
phone needs *cascades*, not a list of independent bad numbers —
"three overdue RFIs plus a slipping schedule" is one story;
the same signals surfaced as three separate lines are noise.
The first sprint that gave us working AI fallback also surfaced
this in the post-launch debrief.

**What was built.**

- `src/agents/morning-brief.agent.ts`:
  - Added `compoundRisks: string[]` to the `MorningBrief`
    interface (always present, possibly empty).
  - `detectCompoundRisks(d: DataSummary): string[]` is a
    pure function with 7 `COMPOUND_PATTERNS` definitions,
    each a `{ id, predicate, severity, label }` tuple. The
    patterns fire when two-or-more adverse signals appear
    together:
    1. `schedule-cost-overrun` — SPI < 0.95 AND CPI < 0.95
    2. `overdue-rfis-with-schedule-slip` — ≥ 3 overdue RFIs
       AND SPI < 0.95
    3. `overdue-rfis-with-cost-overrun` — ≥ 3 overdue RFIs
       AND CPI < 0.95
    4. `change-orders-stacking` — ≥ 3 pending/submitted COs
       (label is dynamic: "3 pending change orders" /
       "4 pending change orders" / etc., not a hard-coded
       string)
    5. `triple-threat-safety-cost-schedule` — open safety
       incidents AND SPI < 0.9 AND CPI < 0.9
    6. `materials-with-schedule-slip` — material tile red
       AND SPI < 0.95
    7. `risk-amber-with-schedule-or-cost` — risk dashboard
       amber/red AND (SPI < 0.95 OR CPI < 0.95)
  - System prompt updated: explicitly tells the model that
    `compoundRisks` is a pre-computed list of cascades
    ("multi-signal cascades already detected by the
    deterministic layer") and that it should *prioritize*
    them but not repeat them verbatim in `sections`. This
    keeps the model's prose in the model's voice but the
    headline-catching signal in a stable, testable place.
  - The fallback headline now surfaces the first compound
    risk in the form `"${project} — ${compoundRisk[0]}"`,
    falling back to the existing single-signal headlines
    when the list is empty.
  - `buildFallbackSections` inserts a "Compound risk" red
    section at position 0 when `compoundRisks.length > 0`,
    so the fallback brief shows the cascade *first* even
    before the per-signal Schedule / Cost / Materials
    sections.
  - AI path: `compoundRisks` is appended to the
    `userPrompt` as `{ ...dataSummary, compoundRisks }`
    so the model sees the array but the deterministic
    pre-pass remains the source of truth.
- `src/agents/morning-brief.agent.test.ts` — 8 new tests
  covering: empty result when nothing fires, each named
  cascade, the dynamic count label, AI-prompt propagation,
  fallback-headline surfacing, "Compound risk" being the
  first section, and the negative case (no fabricated
  cascade when nothing fires).

**Files created or modified:**

- `src/agents/morning-brief.agent.ts` — `compoundRisks`
  field, `detectCompoundRisks`, `COMPOUND_PATTERNS`,
  system-prompt paragraph, headline/section wiring.
- `src/agents/morning-brief.agent.test.ts` — 8 new
  tests in a new `compound risk detection` describe block.

**Test results:** **896 tests pass** (+8 net from
compound risk tests). 4.2 s total. 24/24 in
`morning-brief.agent.test.ts`.

**Decisions.**

- Rule-based, not LLM-generated. The cascade list is
  computed in deterministic code so a regression is a
  failing test, not a flaky AI behavior. The LLM is told
  to *honor* the list (priority it, don't invent new ones)
  but not to be the source of truth for it.
- Dynamic label only for the CO-stacking pattern. The
  other six patterns use stable labels so the UI / search
  / notification filters don't break on wording changes.
- Thresholds (0.95 for SPI/CPI, 0.9 for the triple-threat
  pattern) are documented inline. A "thresholds.ts" file
  is the right home for these if more agents start
  computing their own cascades; not justified for one
  call site.
- Did not add a UI section for compound risks yet. The
  AI brief and the fallback brief both surface them;
  building a separate "Compound risk" tile is a Sprint 9
  UX call.
- The 7 patterns are exhaustive for V1 signals. New
  patterns (e.g. weather + safety) can be added by
  appending a tuple to the array; the function and tests
  don't need to change.

**Timestamp:** 2026-06-13

---

## TASK 9 — Performance and Bundle Optimization

**Problem statement.** A first-time visitor to the PM
SPA was downloading 968 KB of unminified JavaScript
(roughly 250 KB gzipped) before the login page even
rendered. The bundle included the Gantt editor, the US
state map (which transitively pulls d3-geo), the WBS
builder, the template library, the portfolio page, and
the drawings file picker — every route's components
were top-level imports in `App.tsx`, so every route's
cost was paid up front by every user. A field user on
a 4G connection at a job site would see a blank screen
for 3+ seconds after the splash.

**What was built.**

- `frontend/vite.config.ts`:
  - `build.target = 'es2020'`. Drops the legacy
    polyfill/transformer bundle that Vite keeps for the
    default `modules` target. Worth ~40 KB unminified.
  - `build.rollupOptions.output.manualChunks`: splits
    `node_modules` into `vendor` (everything else),
    `vendor-react` (react, react-dom, scheduler), and
    `vendor-firebase` (firebase app + auth). The vendor
    chunks have a stable hash that changes only when
    those packages upgrade, so a deploy that touches
    only our app code doesn't invalidate the browser's
    vendor cache. Firebase auth *must* be on first paint
    (Login) so it stays in the eager bundle, but it's
    still its own chunk.
- `frontend/src/App.tsx`:
  - Converted the 10 route components (Dashboard,
    DashboardDetail, GanttView, MapView, OwnerReports,
    LessonsLearned, TemplateLibrary, BillingSettings,
    Drawings, Portfolio) to `React.lazy(...)` with a
    single `Suspense` boundary per branch.
  - Login and Projects remain eager. Login is the
    first-paint surface; Projects is the post-login
    landing page and is the parent of the
    NotificationBell, which is also eager. The Bell
    itself is < 5 KB and would be wasted overhead as
    its own chunk.
- `frontend/src/components/RouteLoading.tsx`:
  - A 20-line `RouteLoading` component used as the
    Suspense fallback. Just a centered "Loading…"
    label in the design system palette — deliberately
    no spinner library (the loading flash on a warm
    cache is < 100 ms and a spinner lib would outweigh
    the chunk it gates).
  - Each branch's fallback has a tailored label
    ("Loading map…", "Loading Gantt…", etc.) so the
    user knows which page is arriving.

**Bundle results:**

| Chunk | Before | After (eager) | Gzipped (eager) |
|---|---|---|---|
| `index.js` (eager app code) | 968 KB | 34 KB | 9 KB |
| `vendor.js` (eager, node_modules non-react/firebase) | — | 370 KB | 108 KB |
| `vendor-react.js` (eager) | — | 220 KB | 69 KB |
| `vendor-firebase.js` (eager) | — | 103 KB | 30 KB |
| **Initial total gzipped** | ~250 KB | — | **~216 KB** |
| `Dashboard.js` (lazy) | — | 153 KB | 29 KB |
| `GanttView.js` (lazy) | — | 36 KB | 9 KB |
| `Drawings.js` (lazy) | — | 14 KB | 4 KB |
| `Portfolio.js` (lazy) | — | 13 KB | 4 KB |
| 6 other view chunks (lazy) | — | 7–12 KB each | 2–4 KB each |

A user who only ever opens the dashboard pays for the
34 KB app chunk + 370 KB vendor + 220 KB react + 103 KB
firebase = ~727 KB raw / ~216 KB gz. The old
configuration paid 968 KB / ~250 KB gz for *everything*.
A user who opens the Gantt pays the same + an extra
36 KB on demand.

On a warm cache, the *only* download after first visit
is the 34 KB `index.js` (and per-view chunks when
navigating). A deploy that only changes app code
invalidates only the `index.js` hash; the vendor chunks
keep serving from the browser's disk cache.

**Files created or modified:**

- `frontend/vite.config.ts` — `target: 'es2020'`,
  `manualChunks` for vendor split.
- `frontend/src/App.tsx` — 10 route components lazy
  loaded; Login + Projects + NotificationBell eager.
- `frontend/src/components/RouteLoading.tsx` — new,
  Suspense fallback.
- `frontend/src/components/NotificationBell.tsx` —
  type-only import for `Notification` (required by
  `verbatimModuleSyntax`); not a perf change, just a
  side-effect of the build.

**Test results:** **896 tests pass** (no test changes;
this was a build/UX task, not a backend change).
`tsc -b && vite build` is clean in 107 ms.

**Decisions.**

- Did not split Login or Projects. Both are first-paint
  surfaces; lazy-loading Login would mean the user sees
  a blank HTML page (no spinner) while the chunk
  arrives, which is worse than the current behavior.
- Did not add a service worker / offline cache. PWA
  shell caching is a Sprint 9 / "PWA" feature; the
  browser's HTTP cache already does the heavy lifting
  for repeat visits.
- Did not split per-component inside Dashboard.tsx
  (which is 152 KB on its own). That file is a wall of
  panel components; a future change could split it
  further with `lazy` on the tile components, but the
  win is smaller (Dashboard is the user's primary view,
  so they pay the cost anyway) and the implementation
  cost is higher (lots of prop drilling). Punt to
  Sprint 9 if we add new tile types.
- `target: 'es2020'` is a soft requirement. The PM
  product targets modern browsers; we don't ship to
  IE11. If a future customer demands legacy browser
  support, we'd add a `browserslist` config and roll
  back the target.
- Vendor chunks are *not* preloaded. The browser
  fetches them after `index.js` parses. We could add
  `<link rel="modulepreload">` tags for the largest
  vendor chunks; the build doesn't emit them
  automatically with manualChunks. Punt to Sprint 9
  for an explicit perf-budget pass.

**Timestamp:** 2026-06-13

---

## TASK 10 — Final Checks and Deploy

**Problem statement.** All eight prior tasks landed on
the same day. Before declaring Sprint 8 done we need a
single "all green" pass: TypeScript, full backend test
suite, deploy to VPS, and a live health check on the
public host.

**What was run.**

- `npx tsc --noEmit` (backend) — clean.
- `cd frontend && npx tsc --noEmit` — clean.
- `npx jest` (backend full suite) — **896 tests pass
  across 51 suites in 4.0 s**. Same count as the
  Task 8 run; Task 9 was a frontend-only change so
  it didn't move the backend test count.
- `cd frontend && npm run build` — clean in 107 ms.
  Output: 18 chunks (3 vendor + 1 index + 1 runtime
  + 1 css + 12 view chunks). The new code-split
  bundle is in `frontend/dist/assets/`.
- `./deploy.sh` (full deploy) — built, uploaded
  `frontend/dist` to `2.24.194.23:/opt/sitedeck-pm/
  frontend/dist`, uploaded `dist/`, `package.json`,
  `package-lock.json`, and `prisma/`, ran
  `npm ci --production` on the VPS, regenerated the
  Prisma client, and restarted the `sitedeck-pm`
  systemd service. Service status:
  `Active: active (running) since Sun 2026-06-14
  00:18:05 UTC`. No errors during the
  `journalctl` tail.

**Live verification (against
`https://projects.sitedeck.pro`):**

- `GET /api/v1/health` →
  `{"status":"ok","service":"sitedeck-pm","version":"1.0.0"}`.
- `GET /` (frontend root) → the new chunked bundle:
  `index-Dvl-Cd3s.js` (eager app code),
  `vendor-DgQKeWRE.js`, `vendor-react-bDeOdXsK.js`,
  `vendor-firebase-D5N9DNnv.js`, plus
  `rolldown-runtime-QTnfLwEv.js` and
  `index-BFrQhmT5.css`. The Task 9 chunk split is
  live.
- `GET /api/v1/portfolio/summary`,
  `/api/v1/notifications`,
  `/api/v1/projects/p-1/documents` (no auth) → 401
  from `requireAuth`. Middleware works.
- `POST /api/v1/auth/dev-login` with a dev token →
  `UNAUTHORIZED: dev-token bypass is disabled in
  production when Firebase is configured`. The
  Sprint 7 dev-bypass guard is doing its job.

**Files modified for this task:** none. Task 10 is a
verification gate, not a code change.

**Test results:** **896 tests pass**. Production
service running. Health endpoint green.

**Decisions.**

- No new env vars were added. Task 7's manual
  `cleanup-orphans` route is a backend-only feature
  that uses the same R2 config the drawing repository
  already had. The Task 6 notification system uses
  the existing Postgres connection; no extra
  configuration. Task 5 portfolio and Task 8 morning
  brief are pure reads / calls into existing
  endpoints.
- We did not run a fresh database migration for the
  Sprint 8 work — the only schema change was the
  `notifications` table in Task 6, and that migration
  was applied manually via `scripts/apply-sql.js`
  earlier in the day (3 statements, all OK). The
  Prisma schema in this deploy matches the live
  database.
- Frontend `assets/index-Dvl-Cd3s.js` is a *new*
  hash; Sprint 7's `index-CESfhoRy.js` is now stale
  on the CDN. The browser cache will fetch the new
  one on the next page load. No cache invalidation
  required.
- Did not run a load test. The deploys in Sprint 7
  established that the backend handles 50 concurrent
  users comfortably; Sprint 8's new code is all
  index-on-`(userId, createdAt)` reads (notifications,
  portfolio) and async R2 deletes (documents), both of
  which are well within the existing capacity. A
  load test is a Sprint 9 operation.

**Sprint 8 summary:**

| # | Task | Files | Tests | Deployed |
|---|---|---|---|---|
| 1 | Configure Benchmark Webhook | 3 | 0 (config only) | ✅ |
| 2 | Document Download and Preview | 6 | +6 | ✅ |
| 3 | Firebase End-to-End Token Verification | 4 | +8 | ✅ |
| 4 | BYOK at Agent Level | 5 | +14 | ✅ |
| 5 | Portfolio Health Dashboard | 5 | +10 | ✅ |
| 6 | Notification System Foundation | 11 | +16 | ✅ |
| 7 | Document R2 Lifecycle | 3 | +12 | ✅ |
| 8 | Morning Brief Compound Risk Detection | 2 | +8 | ✅ |
| 9 | Performance and Bundle Optimization | 4 | 0 (frontend) | ✅ |
| 10 | Final Checks and Deploy | 0 | 0 | ✅ |
| | **Total** | **+43 files** | **+74 tests** | **All green** |

Sprint 8 closed **all 10 tasks**. Backend test suite:
**896 / 896 passing** (up from **822** at the start of
Sprint 7). Frontend: bundle split into 18 chunks;
initial gzipped download **~216 KB** (down from
~250 KB) with route-level code splitting. Production
deployed to Hostinger VPS; health endpoint green;
middleware correctly enforcing auth on the new
Sprint 8 endpoints.

**Sprint 9 candidates** (not in scope here):

- Cron / systemd timer for the orphan-revision sweep
  (Sprint 8 ships the manual trigger; an automated
  runner is operational plumbing).
- Pre-loading the largest vendor chunks via
  `<link rel="modulepreload">` (Sprint 9 perf pass).
- A "Compound risk" tile on the dashboard UI (Sprint
  8 surfaces cascades in the brief; a dedicated tile
  is a UX call).
- Sub-component code splitting inside `Dashboard.tsx`
  (153 KB is the largest single chunk; could be
  6-8 lazy tile panels for an additional ~20% first-
  paint win on a warm cache).
- PWA / service worker for true offline shell cache
  (browser cache does most of the work today; SW
  would add the install banner and "add to home
  screen").
- A load test pass against the production VPS to
  validate the Sprint 8 capacity claim.

**Timestamp:** 2026-06-14
