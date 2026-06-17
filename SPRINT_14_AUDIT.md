# Sprint 14 Integration Audit — 2026-06-16

Files read:
- `/Volumes/ExtraStorage/SiteDeckPM/INTEGRATION_LOG_PM.md`
- `/Volumes/ExtraStorage/Benchmark/INTEGRATION_LOG_BENCHMARK.md`
- `/Volumes/ExtraStorage/SiteDeckPro/INTEGRATION_LOG_PRO.md`

---

## Findings

### PM Log Stale / Incorrect Entries

1. **Env vars still flagged as "NOT YET ADDED"** (line 21)
   - `PRO_SERVICE_TOKEN`, `PM_SERVICE_TOKEN`, `FIREBASE_FUNCTIONS_URL` all listed as ⚠️ NOT YET ADDED
   - Sprint 14 Task 2 must add these to `/opt/sitedeck-pm/.env`

2. **`/webhooks/pro` receiver marked ❌ NOT BUILT** (lines 45–60)
   - Sprint 14 Task 3 will build this

3. **`benchmark.rework.required` listed as ⚠️ NOT BUILT** (line 112)
   - Sprint 14 Task 4 will build handler

4. **`pm.rework.complete` outbound listed as ⚠️ NOT BUILT** (line 78)
   - Sprint 14 Task 5 will build emitter

5. **Jose not added to a PM project/org** (gap #6 in Missing Dependencies)
   - Sprint 14 Task 7 will provision him

6. **Notification preferences gap still open** (gap #7)
   - Sprint 14 Task 8 will wire them

7. **"Last updated" header says Sprint 16** but content only reflects Sprint 13 changes
   - Header is a forecast, not reality — content is actually Sprint 13 state

### Benchmark Log Stale / Incorrect Entries

1. **`benchmark.rework.required` marked ✅ Sprint 15** (line 86)
   - Benchmark fires it, but PM does not yet fully handle it (no Pro createTask call)
   - Sprint 14 Task 4 will close the gap

2. **`pro.user.approved` handler marked ✅ Sprint 16** (line 64)
   - Benchmark built this handler, but PM has not yet built the receiver
   - Wait — PM should receive `pro.user.approved`, but PM log doesn't list it in inbound events
   - Actually: Pro fires `pro.user.approved` → Benchmark receives it (Benchmark built handler)
   - PM is NOT in this flow for user approval (Benchmark is the receiver, not PM)
   - But Sprint 14 Task 3 says PM should handle `pro.user.approved` — so PM log needs updating

### Pro Log Stale / Incorrect Entries

1. **PM `/webhooks/pro` receiver dependency still open** (gap #1)
   - Sprint 14 Task 3 will close this

2. **"Assign to Field" button dependency still open** (gap #2)
   - Sprint 14 Task 6 will close this

3. **Jose welcome email still ❌ NOT SENT**
   - Out of scope for PM Sprint 14 — belongs to Pro/PM manual step

4. **All four Pro Firebase Function triggers are LIVE but blocked on PM receiver**
   - `onTaskStatusChanged` → PM
   - `onDailyReportCreated` → PM
   - `onIncidentCreated` → PM
   - `onUserApproved` → Benchmark (not PM)

---

## Action Items

| # | Finding | Sprint 14 Task | File to Update |
|---|---|---|---|
| 1 | Env vars missing on VPS | Task 2 | `INTEGRATION_LOG_PM.md` |
| 2 | `/webhooks/pro` receiver not built | Task 3 | All three logs |
| 3 | `benchmark.rework.required` not fully handled in PM | Task 4 | `INTEGRATION_LOG_PM.md`, `INTEGRATION_LOG_BENCHMARK.md` |
| 4 | `pm.rework.complete` outbound not built | Task 5 | `INTEGRATION_LOG_PM.md` |
| 5 | Jose not in PM org/project | Task 7 | `INTEGRATION_LOG_PM.md` |
| 6 | Notification preferences not wired | Task 8 | `INTEGRATION_LOG_PM.md` |
| 7 | `pro.user.approved` in PM receiver | Task 3 | `INTEGRATION_LOG_PM.md` |
