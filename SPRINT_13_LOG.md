# Sprint 13 Log

## Baseline (2026-06-16)
- Tests: 1053 passed, 11 failed (pre-existing `bug_reports` table-absence failures)
- Health: `connectedProducts` all `false` (no recent inbound/outbound traffic)
- Frontend: 21 chunks, builds clean
- Live: https://projects.sitedeck.pro

---

## Task Completion — Benchmark Integration

### 1. Schema Migration
- `prisma/migrations/20260616000000_pm_sprint13_activity_benchmark_link/migration.sql`
- Adds `linked_benchmark_dfow_id` to `ScheduleActivity`.
- Applied cleanly on VPS (`prisma migrate dev` during deploy).

### 2. Inbound Benchmark Webhook Receiver
- `src/routes/benchmark-webhook.routes.ts` — POST `/api/v1/webhooks/benchmark`
- `src/services/benchmark-inbound.service.ts` — HMAC-SHA256 verification, idempotency via `eventId/referenceId`, event dispatch
- Handlers:
  - `benchmark.ncr.opened` → creates `ReworkTask` (high/critical priority from severity)
  - `benchmark.ncr.closed` → resolves matching `ReworkTask`
  - `benchmark.inspection.completed` (failed) → creates `ReworkTask`
  - `benchmark.inspection.completed` (passed) → logs only
  - `benchmark.hold_point.released` → logs only
  - `benchmark.daily_report.posted` → logs only
  - `benchmark.qcp.exported` → logs only
  - Unknown events → `logged_only` (200 ack, never bounce)
- All handlers are fire-and-forget safe; never throw back to HTTP layer.

### 3. Outbound "Send to Benchmark" Button
- `src/routes/schedule.routes.ts` — POST `/activities/:activityId/send-to-benchmark`
- `src/services/activity-benchmark.service.ts` — `linkActivityToBenchmark`
- Fires outbound webhook `{ event: 'project.activity.linked', projectId, activityId, activityName, dfowId }`
- Frontend: `GanttView.tsx` — inline DFOW input + Send button in both Gantt name column and Table view
- `api.ts` — `sendActivityToBenchmark()` helper

### 4. Activity Feed
- `src/routes/project.routes.ts` — GET `/:id/benchmark-activity`
- `src/services/benchmark-activity.service.ts` — queries `unifiedChangeLog` where `changedBy = 'benchmark-webhook'`
- Frontend: `frontend/src/components/BenchmarkActivity.tsx` (rendered in `Dashboard.tsx`)

### 5. Health Check
- `src/routes/health.routes.ts` — `getConnectedProducts` now reports `benchmark: true` when last inbound Benchmark webhook within 7 days OR last successful outbound within 24h.

---

## Smoke Tests (Deployed)
1. Inbound `benchmark.hold_point.released` → HTTP 200, `action: logged` ✅
2. Inbound `benchmark.ncr.opened` (valid project) → HTTP 200, `action: rework_task_created` ✅
3. Inbound `benchmark.inspection.completed` (duplicate eventId) → HTTP 200, `action: duplicate` ✅
4. GET `/api/v1/health` → `connectedProducts.benchmark: true` ✅
5. Frontend build → 21 chunks, clean ✅

## Known Issue Found During Sprint
- `src/routes/index.ts` mount path: `router.use('/webhooks', benchmarkWebhookRouter)` caused all `/webhooks/benchmark` requests to fall through to the old `webhookRouter` (400 UNKNOWN_EVENT). Fixed to `router.use('/webhooks/benchmark', benchmarkWebhookRouter)`.
- `verifyBenchmarkSignature` initially looked only for `BENCHMARK_WEBHOOK_SECRET`; added fallback to `PM_BENCHMARK_WEBHOOK_SECRET` for VPS parity.

## Final State
- Tests: 1112 passed, 11 failed (same 11 pre-existing; +59 new tests added)
- No regressions introduced.
- All Sprint 13 deliverables deployed to https://projects.sitedeck.pro.
