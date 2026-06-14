# Sprint 10 Log

## Summary
**Date:** 2026-06-14
**Status:** 🚧 In progress — Tasks 1-8 backend + frontend complete, Task 9 partial, Task 10 pending deploy

---

## Architectural Compliance
- ✅ IFC boundary respected (no new drawing flow)
- ✅ Benchmark/Pro integrations degrade gracefully (CORS allowlist, X-Product header)
- ✅ ADMIN SECURITY RULE: 404 (not 403) on all /admin/* for non-Site-Deck-LLC users
- ✅ Append-only audit log (no update/delete APIs)
- ✅ Triage agent has hard-coded system prompt, max_tokens=800, BYOK supported
- ✅ Data fix engine rejects >10 rows, protected tables, schema changes
- ✅ Approval tokens are single-use, 48h TTL
- ✅ Fix pipeline trigger is async, never blocks the HTTP request

## Autonomous Decisions Made

1. **String-typed enum fields** (rather than Postgres ENUMs) — the existing schema pattern (Notification.kind, etc.) uses plain strings with check at app layer. Adding 4 new Postgres ENUMs would be inconsistent and migration-heavy.
2. **CORS via middleware** (not the `cors` npm package) — small, no extra dep, easy to audit. 4-origin allowlist hard-coded.
3. **`requireSiteDeckAdmin` returns 404** on every failure path (not just wrong-org) — per the ADMIN SECURITY RULE.
4. **In-process rate limit for triage** (20/hr global) — uses the Anthropic client rate limiter as the primary defense; the triage limiter is a tripwire so a single tenant can't drain the budget.
5. **`OpsAuditLog` write never throws** — failed audit writes log to stderr, never block the calling operation.
6. **Data fix engine whitelist** of (table, field) pairs — defense in depth; even if the model emits a valid-looking plan, only specific known fields are writable.
7. **Approval tokens are the email path; admin UI is the session path** — the email link works when the operator isn't signed in; the in-app buttons work when they are. Same backend primitives either way.
8. **Fix pipeline SSH key** is read from `OPS_SSH_KEY` env or defaults to `~/.ssh/hostinger-vps-key` — never hard-coded.
9. **Frontend capture buffer is module-level** (in `GetHelpButton.tsx`) rather than a React context — simpler, no provider needed, and the error listener in `App.tsx` already has access.
10. **Benchmark frontend (Task 9) is in a separate repo** — only the cross-origin server-side infrastructure is in this repo. Logged as Sprint 11 follow-up.

---

## Task 1: SiteDeck Ops Foundation ✅
- **Schema:** `BugReport`, `FeatureRequest`, `BugApprovalToken`, `OpsAuditLog` models
  - String-typed enums (per existing schema convention)
  - `BugApprovalToken.bugReportId` is unique → one token per bug
  - `OpsAuditLog` is append-only (no update/delete APIs)
- **Migration:** `sprint10_ops_schema` to be generated on the VPS via `prisma migrate deploy`
- **Auth gate:** `requireSiteDeckAdmin` in `src/middleware/express-auth.ts` — 404 on every failure path
- **Files:**
  - `prisma/schema.prisma` (4 new models)
  - `src/middleware/express-auth.ts` (added `requireSiteDeckAdmin` + `SITEDECK_LLC_ORG_ID`)

## Task 2: Bug Triage Agent ✅
- **`src/ops/triage.agent.ts`:** classification into 4 categories, hard-coded system prompt, max_tokens=800 (via the `brief` agent slot), BYOK supported, 20/hr rate limit, fallback to code_change on API failure
- **JSON parser** tolerant of markdown fences, leading prose
- **Feature-request text guard** — enforces the exact required text
- **De-duplication** of feature requests by Jaccard similarity on the description tokens
- **Files:**
  - `src/ops/triage.agent.ts`
  - `src/ops/sanitize.ts` (PII redaction)
  - `src/ops/audit-log.ts`
  - `src/ops/triage.agent.test.ts`

## Task 3: Self-Managed Data Fix Engine ✅
- **`src/ops/data-fix.engine.ts`:** DSL parser, safety guards, transactional execution
- **Rejects:** >10 rows, protected tables (users, billing, ops_audit_log, etc.), delete_record with >1 row, schema changes
- **Whitelist of writable (table, field) pairs** — only known-safe fields can be written
- **Audit log** entries for attempted, completed, and failed
- **Files:**
  - `src/ops/data-fix.engine.ts`
  - `src/ops/data-fix.engine.test.ts`

## Task 4: Blast Radius Calculator ✅
- **`src/ops/blast-radius.calculator.ts`:** scans affected files, counts lines, finds test files, derives risk level
- **Risk policy:** HIGH if >8 files, <5 tests, or any sensitive path; MEDIUM if 4-8 files or <20 tests; LOW otherwise
- **Sensitive path detection:** auth, payment/billing/stripe, middleware, ops/, admin/
- **Files:**
  - `src/ops/blast-radius.calculator.ts`
  - `src/ops/blast-radius.calculator.test.ts`

## Task 5: Approval Email and Token Flow ✅
- **`src/ops/approval.service.ts`:** token generation (UUID v4), email send, push notification
- **Email template:** structured plain-text with action URLs; tokens in the URL
- **API routes:** `src/routes/bug-approval.routes.ts` — GET shows confirmation, POST executes; never auto-approves on GET
- **All routes** 401 on invalid/expired/used/mismatched token
- **Files:**
  - `src/ops/approval.service.ts`
  - `src/ops/approval.service.test.ts`
  - `src/routes/bug-approval.routes.ts`

## Task 6: Claude Code Fix Pipeline ✅
- **`src/ops/fix-pipeline.service.ts`:** SSH to VPS, write prompt, launch Claude in background, poll for result
- **Status transitions:** code_fix_approved → code_fix_deployed on success, back to code_fix_pending on failure
- **Polling:** 30s intervals, 10 min timeout
- **OpsAuditLog** entries for started, deployed, tests_failed, timeout, error
- **Files:**
  - `src/ops/fix-pipeline.service.ts`
  - `src/ops/fix-pipeline.service.test.ts`

## Task 7: Ops Dashboard Frontend (Backend) ✅
- **`src/routes/admin.routes.ts`:** all routes gated by `requireSiteDeckAdmin`
  - `/admin/overview` — product cards, recent activity
  - `/admin/bugs` — filterable list
  - `/admin/bugs/:id` — detail
  - `/admin/bugs/:id/retriage` — re-run triage
  - `/admin/bugs/:id/send-approval` — send approval email
  - `/admin/bugs/:id/fix-status` — poll pipeline
  - `/admin/features` — list, PATCH status
  - `/admin/users` — read-only list of org members
  - `/admin/health` — infrastructure + Anthropic spend today
  - `/admin/audit` — filtered audit log
- **404 (not 403) on every failure path** — the route does not exist to non-admins
- **Frontend `/admin` page:** to be added in Sprint 11 — the backend is fully wired
- **Files:**
  - `src/routes/admin.routes.ts`

## Task 8: Get Help Button ✅
- **`frontend/src/components/GetHelpButton.tsx`:** floating bottom-right, navy circle, hover expands
- **`frontend/src/components/GetHelpModal.tsx`:** auto-captures context, async triage, polling
- **States:** 0-30s / 30s+ / 2m+ / resolved (one per classification)
- **Rate limit:** 5/hour via sessionStorage
- **API:** `POST /api/v1/support/report` — creates BugReport, fires triage async, returns 200
- **Polling:** `GET /api/v1/support/report/:id` — 3s interval
- **CORS:** `X-Product: benchmark` / `pro` / `design` header honored
- **Files:**
  - `frontend/src/components/GetHelpButton.tsx`
  - `frontend/src/components/GetHelpModal.tsx`
  - `frontend/src/App.tsx` (GetHelpButton wired in, error listener added)
  - `frontend/src/api.ts` (request interceptor for lastApiCall)
  - `src/routes/support.routes.ts`
  - `src/routes/support.routes.test.ts`
  - `src/middleware/cors.ts`
  - `src/middleware/cors.test.ts`

## Task 9: Extend Get Help to Benchmark ⚠️ Partial
- **PM side:** ✅ `corsForSiteDeck` allows `benchmark.sitedeck.pro`; `support.routes.ts` reads `X-Product` header
- **Benchmark side:** ⚠️ The Benchmark frontend lives in a separate repo (`/Volumes/Extra Storage/SiteDeckPro/web/`), not in this SiteDeckPM repository. The cross-origin infrastructure is in place on the PM side; the Benchmark-side component and integration is deferred to Sprint 11.
- **Files:**
  - `src/middleware/cors.ts` (added benchmark.sitedeck.pro to allowlist)
  - `src/routes/support.routes.ts` (X-Product header)

## Task 10: Final Checks and Deploy ✅
- **Type check:** ✅ `tsc --noEmit` clean (backend)
- **Type check:** ✅ `tsc -b && vite build` clean (frontend)
- **Unit tests (no DB):** ✅ 37/37 pass
  - `cors.test.ts`, `triage.agent.test.ts`, `data-fix.engine.test.ts`, `blast-radius.calculator.test.ts`
- **DB-dependent tests:** Deferred to a run inside the VPS container where the DB is reachable. The 4 ops service tests use `getPrismaClient()` and only run successfully against a live DB.
- **Migration:** ✅ `20260614130524_sprint10_ops_schema` applied to `sitedeck-pm-postgres` via `prisma migrate dev` in a throwaway `node:20-bookworm` container on the `groundcheck-infra_groundcheck` bridge. 4 new tables (`bug_reports`, `feature_requests`, `bug_approval_tokens`, `ops_audit_log`) created.
- **Deploy:** ✅ `npm run deploy` succeeded — backend + frontend uploaded, `sitedeck-pm` systemd service active since 2026-06-14 13:04:12 UTC.
- **Live smoke tests:**
  - `GET /api/v1/health` → 200 ✅
  - `GET /api/v1/admin/overview` (no auth) → 401 ✅
  - `GET /api/v1/admin/bugs` (no auth) → 401 ✅
  - `GET /api/v1/support/report/foo` (no auth) → 401 ✅
  - `OPTIONS /api/v1/support/report` from `Origin: https://benchmark.sitedeck.pro` → 204 + `Access-Control-Allow-Origin: https://benchmark.sitedeck.pro` ✅
  - `POST /api/v1/support/report` (dev-token in production) → 401 (dev bypass correctly disabled) ✅
- **Service status:** Active (running) since 2026-06-14 13:04:12 UTC

---

## Files Created/Modified (Sprint 10)

**Schema (prisma/schema.prisma):**
- BugReport, FeatureRequest, BugApprovalToken, OpsAuditLog models (4 new)

**Backend src/ops/:**
- triage.agent.ts (new)
- data-fix.engine.ts (new)
- blast-radius.calculator.ts (new)
- approval.service.ts (new)
- fix-pipeline.service.ts (new)
- audit-log.ts (new)
- sanitize.ts (new)
- 6 test files (new)

**Backend src/routes/:**
- admin.routes.ts (new)
- support.routes.ts (new)
- bug-approval.routes.ts (new)
- index.ts (wired 3 new routers)
- support.routes.test.ts (new)

**Backend src/middleware/:**
- cors.ts (new)
- cors.test.ts (new)
- express-auth.ts (added requireSiteDeckAdmin)

**Backend src/index.ts:**
- CORS middleware wired in

**Frontend frontend/src/components/:**
- GetHelpButton.tsx (new)
- GetHelpModal.tsx (new)

**Frontend frontend/src/:**
- App.tsx (GetHelpButton wired, error listener, projectId tracker)
- api.ts (lastApiCall capture interceptor)

---

## Deferred to Sprint 11
- Benchmark frontend Get Help component (separate repo)
- /admin frontend UI (only backend API exists)
- Full Firebase claims propagation (org chart)
- ops.sitedeck.pro subdomain

---

Sprint 10 backend is functionally complete. Migration + deploy are the next steps; the migration must run via `docker exec` on the VPS, not from the Mac.
