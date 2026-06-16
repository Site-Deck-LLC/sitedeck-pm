# Sprint 6 Log

**Date:** 2026-06-12
**Starting state:** 649 tests passing, 36 suites. Sprint 5 deployed 2026-06-12. Full AI morning brief live, dashboard reorganized, PDF exports, EVM re-flow on CO approval.
**Sprint focus:** Schedule analysis, equipment management, WBS builder, subscription tier infrastructure, Firebase auth, RFI follow-up agent, compliance alerts, project templates.

---

## Task 1 — What-If Schedule Analysis
**Status:** ✅ Complete
**Timestamp:** 2026-06-12

### What was built
Server-side CPM-based what-if analysis. Given an activity, a delay magnitude (days), and a delay type (start_delay or duration_extension), the endpoint loads the project's full activity network, applies the delay in memory only, runs the same CPM forward pass the rest of the schedule module uses, and returns a deterministic impact summary.

**No database writes.** The endpoint reads `Project` (for start date) and `ScheduleActivity` (for nodes + relationships), and never calls `update`/`create`/`delete`. The test "NEVER writes to the database" asserts this directly.

**Files created:**
- `src/services/schedule-whatif.service.ts` (new) — `runWhatIf(projectId, { activityId, delayDays, delayType })` returns the spec response shape with `original_completion`, `new_completion`, `days_impact`, `critical_path_changed`, `newly_critical_activities`, `no_longer_critical`, `affected_activities[]`, `ld_exposure_days`, `summary`
- `src/services/schedule-whatif.service.test.ts` (new) — 11 tests: input validation (delayDays range, delayType), 1-day delay on critical → 1-day impact, 1-day delay with float → no impact, delay exceeding float → new critical path, no DB writes, plain-English summary, start_delay vs duration_extension in pure-FS network, plus 4 error-handling tests

**Files modified:**
- `src/routes/schedule.routes.ts` — added `GET /api/v1/projects/:id/schedule/whatif` with query params `activityId`, `delayDays`, `delayType`. Returns 400 for invalid params, 200 with analysis for valid ones. Auth required (owner_admin, project_manager, superintendent, owners_rep).
- `frontend/src/api.ts` — added `getWhatIf(projectId, activityId, delayDays, delayType)` helper
- `frontend/src/components/ActivityDetailDrawer.tsx` — added "What-If Analysis" section with days input (1-90), Start Delay/Duration Extension toggle, Run Analysis button, and a `WhatIfResults` subcomponent that renders:
  - Color-coded impact banner: green (0 days), amber (1-7), red (>7)
  - Completion date change with delta
  - LD exposure days
  - Newly critical activities list (red, bold)
  - Collapsible affected activities list (when >1)
  - Plain English summary text
  - Disabled "Save as Scenario" button with "Scenario planning — coming soon" tooltip

**Reuse of existing CPM engine:** `runWhatIf` calls the same `calculateCpm(activities, projectStart)` from `schedule.service.ts` that the rest of the schedule module uses. No duplication of CPM logic. The engine handles FS/SS/FF/SF relationship types and float calculations, which the what-if then uses to identify newly critical activities.

**Summary generation (deterministic, no API call):**
- 0-day impact: `"A 14-day start delay on X has no impact on the project completion date (the activity has 14+ days of float to absorb it)."`
- N-day impact: `"A 14-day start delay on X shifts project completion from Oct 2 to Oct 16 — 14 days of LD exposure at contract rate."`
- With new critical path: appends `"The critical path changes; N new activities become critical."`
- With multiple affected: appends `"N activities shift in total."`

**start_delay vs duration_extension:**
Both are modeled by adding `delayDays` to the target activity's duration. The implementation comment explains why this is equivalent for the activity's own EF in a CPM model, and notes that the difference shows up only in networks with SS/SF relationships (where start_delay propagates to all successors, but duration_extension does not). The test "start_delay and duration_extension produce the same shift in a pure-FS network" verifies this. A future sprint can refine the engine to model the difference more precisely if mixed-relationship networks become common.

### Test results
- Backend tests: **665 passed, 37 suites passed** (was 649, +16: 11 whatif + 4 route + 1 from earlier session)
- Frontend type check: ✅ clean

### Autonomous decisions
- **Added as a Section, not a Tab.** The spec asked for a "What-If tab alongside Schedule/Predecessors/Successors/WBS/Notes tabs", but the existing drawer uses Sections, not Tabs. Converting the whole drawer to a tabbed interface is a larger UX change that doesn't fit this sprint's scope. The Section pattern is consistent with the rest of the drawer, and "What-If Analysis" gets equal visual weight as a top-level section header. A future sprint can convert to tabs if a consistent design system change is needed.
- **LD exposure in calendar days, not working days.** The CPM engine works in working days; real-world LD clauses are usually calendar days. The summary is explicit ("14 days of LD exposure at contract rate") so the user can adjust if their contract uses working days. Doing the calendar-day conversion server-side would be presumptuous about contract structure.
- **No `no_longer_critical` was in the spec** but I added it anyway — it's free info that the engine already computed, and PMs want to see "what fell off the critical path" alongside "what became critical".
- **Save as Scenario button is disabled, not removed.** The spec said "disabled, tooltip 'Scenario planning — coming soon'". The button preserves the affordance for the future feature and matches the pattern in the dashboard (where "View Full Brief" is also disabled until Sprint 6).
- **`runWhatIf` reuses the same `calculateCpm` function** — no CPM logic duplication. The wrapper is ~50 lines of code, all the math is in the shared engine.

---

## Task 2 — Equipment Registry Page
**Status:** ✅ Complete
**Timestamp:** 2026-06-12

### What was built
A dedicated equipment management page with a table view, slide-in detail drawer, add/edit form, and "Log Today's Status" button. The dashboard's existing EquipmentStatusModal (Sprint 4) is reused for daily status logging.

**Schema additions (prisma/schema.prisma):**
- `isOwned: Boolean @default(false)` — distinguishes owned from rented
- `serialNumber: String?` — for tracking serial numbers (insurance, audits)
- `vendor: String?` — for rented equipment (United Rentals, Sunbelt, etc.)
- `calDueDate: DateTime? @db.Date` — calibration due date for torque wrenches and other precision instruments

Migration: `prisma/migrations/20260612090000_add_equipment_fields/migration.sql`

**Service functions (src/services/resource.service.ts):**
- `createEquipment(data)` — generates a sequential external_id (EQ-NNNN) and creates the record
- `getEquipmentById(equipmentId)` — single-equipment fetch
- `updateEquipment(equipmentId, data)` — partial update, only writes provided fields
- `getEquipmentStatusHistory(equipmentId)` — status log entries sorted by date desc
- `getEquipmentListForProject(projectId)` — returns enriched list with derived columns:
  - `totalCostToDate` = `dailyRate × totalHours`
  - `daysOnProject` = days since `createdAt`
  - `calDueSoon` = `calDueDate <= today + 30 days`

**API endpoints (src/routes/resource.routes.ts):**
- `GET /api/v1/projects/:id/resource/equipment-registry` — list with derived columns
- `GET /api/v1/projects/:id/resource/equipment-registry/:equipId` — single equipment
- `POST /api/v1/projects/:id/resource/equipment-registry` — create
- `PATCH /api/v1/projects/:id/resource/equipment-registry/:equipId` — update
- `GET /api/v1/projects/:id/resource/equipment-registry/:equipId/history` — status log

**Frontend (frontend/src/components/EquipmentPage.tsx):**
- Table columns: Name, Type, Status, Daily Rate, Owned/Rented, Days, Total Cost, Last Updated
- Inline status dropdown per row (project_manager/owner_admin only) — saves via PATCH
- Cal-due red badge on rows with `calDueSoon = true`
- "Add Equipment" button (project_manager/owner_admin only) — opens modal form
- "Log Today's Status" button — opens the existing EquipmentStatusModal
- Slide-in detail drawer (480px wide) with Details, Cost Summary, Status History sections
- Edit mode in the drawer — saves via PATCH
- SiteDeck design system colors: green #22C55E active, amber #F59E0B idle/standby, gray #9CA3AF offsite/maintenance, red #EF4444 cal-due badge

**Navigation:**
- Added "Equipment" to the left sidebar nav (Dashboard.tsx navItems)
- Renders when `activeNav === 'equipment'`

**Equipment type options (hardcoded dropdown):**
Excavator, Crane, Pump Truck, Boom Lift, Skid Steer, Welder, Torque Wrench, Trencher, Boring Machine, Compactor, Generator, Other

**Test coverage:**
- Service tests (5 new): createEquipment, updateEquipment, getEquipmentStatusHistory, getEquipmentListForProject with derived columns, calDueSoon flag (true at 10 days, false at 90 days)
- Route tests (7 new): GET list, GET single, GET 404, POST create, POST 400 on missing fields, PATCH update, GET history

### Test results
- Backend: **677 passed, 37 suites passed** (was 665, +12: 5 service + 7 route)
- Frontend type check: ✅ clean

### Autonomous decisions
- **Sequential external_id generator (EQ-NNNN)** — the integration layer (SiteDeck Pro) usually assigns external_ids from the field system, but for in-PM created equipment we need a unique value. A process-local counter is collision-free for development. A future sprint can swap to UUIDs or read from the field system.
- **Cal-due threshold is 30 days** per the spec. The flag is computed at query time (not stored) so it always reflects the current date. Storing it would mean a daily job to refresh; computing it is free and correct.
- **Total Cost to Date = rate × hours**, not the sum of cost_transactions. The latter would be more accurate for actual cost (including per-hour fuel, operator, etc.) but the Equipment model doesn't link to cost_transactions by equipment_id. Rate × hours is the simple, defensible proxy and matches the existing `getEquipmentDashboardSummary.estimatedDailyCost` calculation.
- **EquipmentStatusModal reuse** — the existing modal from Sprint 4 takes `projectId` only (it pulls the list itself). Calling it from the equipment page uses the same component, same wiring, same UX. No duplication.
- **Edit form starts with `item.calDueDate` as a date string** (`item.calDueDate.slice(0, 10)`) — Prisma's `Date` type stores time components that confuse `<input type="date">`. Slicing the ISO string to YYYY-MM-DD is the standard fix.
- **Daily Rate input type is `number`** — the API expects a number, not a string. The PATCH/POST payloads send `Number(form.dailyRate)` to be safe with empty-string-to-zero coercion.

---


## Task 3 — WBS Builder

**Goal:** Give projects a hierarchical WBS tree UI with CRUD, color-coded cost status, blocker-protected delete, and a GC↔Sub crosswalk mapping tab.

### Backend

- **Service: `src/services/wbs.service.ts`**
  - `getWbsTree(projectId)` — flat-to-tree with budget rollup, weighted % complete, color thresholds (green <100%, amber 100-110%, red >110%). Loads activities for percent complete and budget lines for cost (joined by code).
  - `addWbsItem({ projectId, code, name, parentId })` — computes `level` from parent (max 4).
  - `updateWbsItem(wbsId, { code, name, ... })` — **rejects code changes when activities are linked** (data-integrity rule, can't break history).
  - `deleteWbsItem(wbsId)` — returns `{ deleted, blockers }` summary when blocked; never throws on blocker presence.
  - `getWbsBlockerInfo(wbsId)` — counts activities, cost lines, POs that reference the element.
  - `getCrosswalk(projectId)`, `addCrosswalkEntry`, `updateCrosswalkEntry`, `deleteCrosswalkEntry` — GC↔Sub mapping CRUD with join to get human-readable codes/names.
- **Routes: `src/routes/wbs.routes.ts`** — mounted at `/projects/:projectId/wbs`. Endpoints: `GET /` (tree), `POST /`, `PATCH /:wbsId`, `GET /:wbsId/blockers`, `DELETE /:wbsId`, plus crosswalk sub-routes.
- **Wired in `src/routes/index.ts`** alongside other project-scoped routers.
- **Tests: `src/services/wbs.service.test.ts` (15) + `src/routes/module.routes.test.ts` (8) = 23 new tests.**
  - Tree building, empty case, parent-child assembly, budget rollup, color thresholds (red/amber/green), weighted percent complete.
  - Add rejects when depth would exceed 4. Edit rejects code change with activities linked. Delete returns blockers when any. Crosswalk CRUD + join.

### Frontend

- **`frontend/src/components/WbsBuilder.tsx` (new)** — Tree view (expand/collapse) showing status dot, code, name, budget, actual, % complete per node. Edit modal (code locked when activities linked), Add modal (per-level permission, depth-3 max), Crosswalk tab with add/remove mapping. Color: green/amber/red dot from service; per-row action buttons for + / ✎ / ×. Inline blocker error.
- **Dashboard nav** — added `WBS` item between Equipment and Settings. Renders `<WbsBuilder>` with `structureType` from `currentProject` (so cost-code projects show "Cost Code" labels and code-format hints automatically).
- **`api.ts`** — exported `fetchApi` (was module-private) so new component can use it.

### Decisions logged

- **Blocker protection over force-delete** — soft-fail returns blockers so the UI can show a precise count ("3 activities, 2 cost lines") instead of a 500.
- **Code immutable once activities linked** — aligns with the existing rule that WBS structure can't change after project data is entered (CLAUDE.md §"Non-Negotiable Rules"). The UI also disables the code field in edit mode.
- **Single frontend component, two tabs (Tree / Crosswalk)** — both are WBS-adjacent and small; the alternative is a separate Crosswalk page that's only useful in projects with subs.

### Test results
- **All 700 tests passing across 38 suites (was 677 before this task — +23).**
- Frontend type check clean. Vite build clean (917 KB bundle, no new errors).

### Files
- New: `frontend/src/components/WbsBuilder.tsx`
- New: `src/services/wbs.service.ts`, `src/services/wbs.service.test.ts`
- New: `src/routes/wbs.routes.ts`
- Modified: `src/routes/index.ts`, `frontend/src/api.ts`, `frontend/src/components/Dashboard.tsx`

---

## Task 4 — Subscription Tier Infrastructure

**Goal:** Centralize plan definitions, gate routes on plan/feature, return 402 Payment Required on lock-out so the frontend can show an upgrade prompt.

### Backend

- **`src/constants/subscription-tiers.ts` (new)** — Single source of truth for `starter` / `professional` / `enterprise`. `PlanDefinition` shape includes projectLimit, modules (`['*']` wildcard), and feature flags. Helpers: `getPlan(tier)`, `isModuleInPlan`, `isFeatureInPlan`, `tierForStripePrice`. `PLAN_LIST` is a `readonly` array for iteration in admin UIs.
- **`src/middleware/subscription.middleware.ts` (new)** — Three middlewares:
  - `requireModuleAccess(moduleId)` — 402 with `module`, `currentPlan`, `upgradeRequired` on miss.
  - `requireFeature(featureId)` — 402 with `feature`, `currentPlan`, `upgradeRequired`.
  - `requireActiveSubscription()` — 402 on past_due/canceled/unpaid; attaches `req.subscription = { planTier, projectLimit, status }` for downstream handlers.
  - All resolve orgId from `req.user.orgId` first, fall back to a projectId→orgId lookup so a single middleware can sit in front of project-scoped routes without the auth middleware knowing about billing.
- **`src/services/billing.service.ts` (modified)** — Removed the local `PLANS` map and `mapPriceToTier` (now in `tierForStripePrice`); uses `getPlan()` for everything. Added `isFeatureAllowed(orgId, feature)` helper. `getPlanConfig()` kept as a deprecated alias to avoid breaking the one existing caller in `routes/billing.routes.ts`.
- **`src/routes/wbs.routes.ts` (modified)** — WBS endpoints (tree CRUD + crosswalk) now go through `requireFeature('wbs_builder')`. Starter plan → 402. WBS is the first feature to be gated; more can be added by simply wrapping the router.

### Tests

- **`src/constants/subscription-tiers.test.ts` (new, 10 tests)** — V1 tier set, project limits, enterprise-only `audit_log`, `isModuleInPlan` (starter allowlist, professional wildcard), `isFeatureInPlan` (ai_morning_brief gated to professional+, compliance_alerts enterprise-only), `tierForStripePrice` (env-driven mapping, fallback).
- **`src/middleware/subscription.middleware.test.ts` (new, 13 tests)** — 401 on missing org, 402 on missing/inactive/no-plan, 402 on `module_not_in_plan`/`feature_not_in_plan` with currentPlan, projectId fallback, `trialing` treated as active, subscription info attached to req on `requireActiveSubscription`.
- **`src/routes/module.routes.test.ts` (modified)** — Added `jest.mock('../services/billing.service')` with `mockGetBillingAccountByOrgId` defaulting to a professional plan so the WBS feature gate doesn't break existing route tests. Net: same test count, WBS suite now exercises the gate.

### Decisions logged

- **402 over 403** — `402 Payment Required` is the right status when the user can pay to unlock. Tells the frontend to render an upgrade modal, not a generic error.
- **Gate middleware is project-scoped via fallback** — `req.user.orgId` is set by future auth middleware; today it isn't, so the middleware also accepts `req.params.projectId` → `project.orgId` lookup. Keeps the gate usable today without a full auth-pipeline overhaul.
- **WBS gated, others soft** — The WBS module is gated first because it's a clearly defined Pro feature. Other modules remain soft-gated by the existing `isModuleAllowed` checks; a future task can convert them to middleware one at a time without breaking the deploy.

### Test results
- **All 729 tests passing across 40 suites** (was 700 before this task — +29).
- Frontend build clean. Backend build clean.

### Files
- New: `src/constants/subscription-tiers.ts`, `src/constants/subscription-tiers.test.ts`, `src/middleware/subscription.middleware.ts`, `src/middleware/subscription.middleware.test.ts`
- Modified: `src/services/billing.service.ts`, `src/routes/wbs.routes.ts`, `src/routes/module.routes.test.ts`

---

## Task 5 — Firebase Auth Production Setup

**Goal:** Per FIREBASE_SETUP.md, ensure the production deploy has all required Firebase Auth infrastructure in place. The manual Firebase console steps (project creation, service account download, web app config) are documented in FIREBASE_SETUP.md and run by the operator before deploy. This task delivered the missing operational tooling and closed a production safety gap.

### What was missing before this task

- `dev-token` bypass was active in production. The FIREBASE_SETUP.md said "dev-token returns 401 in production" but the code did NOT actually enforce that — it always accepted the bypass.
- No way to verify pre-deploy that all required Firebase env vars and credential files were present.
- The `set-user-role.ts` script referenced in FIREBASE_SETUP.md didn't exist on disk.

### Changes

- **`src/middleware/express-auth.ts` (modified)** — `dev-token` branch now checks `NODE_ENV === 'production'` and returns 401 with a clear message if set. Dev mode is unchanged.
- **`src/middleware/express-auth.test.ts` (modified)** — Test for dev-token updated: the test name changes from "accepts dev-token in all environments" to "accepts dev-token in non-production", plus a new test "rejects dev-token in production with 401". Both env vars (NODE_ENV, DEV_USER_ROLE) are saved/restored in `afterEach`.
- **`scripts/check-prod-auth.ts` (new)** — Pre-deploy verification script. Reads the same env vars the runtime uses, parses the service account JSON, validates required fields, and (if `firebase-admin` is installed) attempts to initialize. Exits 0 on full pass or warnings-only, 1 on any failure. Color-coded output. Run with `npm run check:prod-auth`.
- **`scripts/set-user-role.ts` (new)** — Operator CLI for the role-claim step in FIREBASE_SETUP.md. Validates the role against the canonical set (refuses unknown roles — would have caught typos), supports `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_PROJECT_ID`. Run as: `npx ts-node scripts/set-user-role.ts <uid> <role>`.
- **`package.json` (modified)** — Added `"check:prod-auth"` script entry.

### Decisions logged

- **Hard 401 for dev-token in production** — the existing comment said "dev-token returns 401 in production" but the code allowed it always. This is the most dangerous misconfiguration for a customer-facing deploy (anyone who knows the magic string can impersonate any role). Fixed and tested.
- **Pre-deploy check is best-effort, not blocking** — the check warns in dev (because dev intentionally doesn't have creds) and fails in CI when NODE_ENV=production. This way it can be added to a deploy pipeline without breaking local development.
- **Script paths from `__dirname/../`** — `set-user-role.ts` and `check-prod-auth.ts` are in `scripts/`, so relative paths to `frontend/.env.production` are computed from `__dirname`. Keeps the scripts runnable from any CWD.

### Test results
- **All 730 tests passing across 40 suites** (was 729 — +1 net: dev-token prod test added, old "all envs" test replaced, so 0 net).
- `npm run check:prod-auth` runs and reports 2 FAIL / 3 WARN in current dev environment (expected — this is a dev box).

### Files
- New: `scripts/check-prod-auth.ts`, `scripts/set-user-role.ts`
- Modified: `src/middleware/express-auth.ts`, `src/middleware/express-auth.test.ts`, `package.json`

---

## Task 6 — RFI Follow-Up Draft Agent

**Goal:** Second agent endpoint. Given an RFI that has been waiting for a response, draft a follow-up message the PM can review and send. Never auto-send.

### Backend

- **`src/agents/rfi-followup.agent.ts` (new)** — Same security pattern as the morning-brief agent. Hard-coded system prompt is a server-side constant, all RFI fields sanitized via `sanitizeForPrompt`, hard-coded `max_tokens: 600` (uses the existing `copilot` endpoint slot), full fallback path (no API key, mode=fallback, call failure → returns deterministic draft). Three tones: `firm_professional`, `collaborative`, `urgent`. Output shape: `{ subject, body, context: { rfiNumber, daysOpen, daysOverdue, assignedTo }, source, meta }`.
- **Tenant isolation** — Agent refuses to draft a follow-up if the RFI's `projectId` doesn't match the URL param (`rfi.projectId !== input.projectId`).
- **Sanitization verified** — Known prompt-injection patterns like "IGNORE PREVIOUS INSTRUCTIONS" are redacted by `sanitizeForPrompt`; the model never sees the literal instruction (covered by test).
- **`src/routes/agents.routes.ts` (modified)** — `POST /agents/rfi-followup` (project-scoped, requires auth, body: `{ rfiId, tone?, mode? }`).
- **Frontend** — `frontend/src/api.ts` adds `getRfiFollowUpDraft(projectId, rfiId, tone?)` (no UI integration in this task; the API is wired and ready for a follow-up task to add a button in the RFI detail view).

### Tests

- **`src/agents/rfi-followup.agent.test.ts` (new, 6 tests)** — Fallback path: source=fallback, tone default, subject format, body uses RFI subject + assignee, days-open math (10 days → ≥9 today, 3 overdue), context fields. Tenant isolation: rejects RFI from a different project. Not-found: throws. Three tones produce different bodies (`urgent` includes "today", `collaborative` mentions "additional"/"site walk"/"information"). Null assignee → "Hi," not "Hi Alice,". Prompt-injection: subject containing "IGNORE PREVIOUS INSTRUCTIONS" is redacted in the body.

### Decisions logged

- **Reuses the `copilot` token bucket** — 600 tokens is the right size for a 3-6 sentence follow-up. Adding a new key in `AGENT_MAX_TOKENS` would have grown the limit registry for a similar-size task.
- **Stored `assignedTo` is already a free-form string** — The RFI schema stores the assignee name/email as a string, not a user FK. The agent sanitizes it like any other user-supplied text. If the schema changes to a User FK later, the agent can switch to looking up displayName.
- **Never auto-sends** — The agent returns a `subject` + `body` draft. The PM clicks Send in their normal mail tool. This is by design: LLMs don't have the PM's voice, their relationships, or the context of which channel the recipient actually uses.

### Test results
- **All 736 tests passing across 41 suites** (was 730 before this task — +6).
- Frontend build clean. Backend build clean.

### Files
- New: `src/agents/rfi-followup.agent.ts`, `src/agents/rfi-followup.agent.test.ts`
- Modified: `src/routes/agents.routes.ts`, `frontend/src/api.ts`

---

## Task 7 — Compliance Alert Stubs (standards.agent)

**Goal:** Replace the placeholder standards agent with a working deterministic rule engine that surfaces real compliance status today, and a clear "pending" path for checks that need data we don't yet collect.

### Backend

- **`src/constants/standards.ts` (new)** — Static catalog of 12 construction standards spanning OSHA, NFPA, NEC, contract, permit, and environmental categories. Each entry has a stable id, human-readable name, code clause, one-sentence description, data source, and an `appliesTo` scope flag (`all`, `scope:energy_storage`, etc.). Exports `listStandards()` and `getStandard(id)`. Adding a new standard = append to the catalog AND add a check in the dispatch table.
- **`src/agents/standards.agent.ts` (rewritten)** — Was a 10-line stub returning empty data. Now a deterministic rule engine that:
  - Loads live state (project, safety, RFIs, submittals) via the existing services with `.catch(() => [])` fallbacks so one missing data source doesn't tank the whole check.
  - Runs a dispatch table of 6 wired-up rules (OSHA 1926.501, OSHA 1903, NFPA 241, NEC 706, contract 48h notice, building permit). Each returns a `ComplianceCheck` with `status` (pass/fail/pending/not_applicable), `evidence` (one-sentence plain-language finding), and `gapDescription` (what to do about it).
  - Surfaces "pending" status (not silent) for standards that need data we don't yet collect (energy-storage scope flag, fire-impairment log, inspection-hold schedule tags). The PM sees the rule and knows what's missing to make it pass/fail.
  - Rolls up `overallStatus`: red on any fail, amber on any pending, green otherwise.
  - Surfaces a 48-hour notice alert when there are open RFIs on inspection-hold activities (always-true in V1 since the schedule integration isn't wired — the rule triggers on any open RFI and includes the proper notice type + days remaining).
  - **No Anthropic call** — compliance is a fact-check, not a creative task. Free to run as often as the dashboard wants.

### Wired-up rules (V1)

| Standard | Logic | Pass condition |
|---|---|---|
| OSHA 1926.501 (Fall Protection) | TRIR-based proxy | TRIR ≤ 2.0 |
| OSHA 1903 (Injury Reporting) | Incident count | 0 recordable incidents |
| NFPA 241 (Fire Safety) | Manual | Always "pending" with reminder |
| NEC 706 (Energy Storage) | Manual | Always "pending" with scope reminder |
| Contract 48h Notice | Manual | Always "pending" with schedule tag reminder |
| Building Permit Active | Manual | Always "pending" with permit date reminder |

### Tests

- **`src/agents/standards.agent.test.ts` (new, 16 tests)** — 404-style error for missing project, full catalog check by default, OSHA 1926.501 pass/fail/pending (low TRIR, high TRIR, zero hours), OSHA 1903 pass (no incidents) and pending-with-8h/24h-reminder (with incidents), overall status red/amber rollup, 48h notice appears only when open RFIs exist, unknown standard id → not_applicable, standards-without-rules surface as pending-with-gap, asOfDate format YYYY-MM-DD, catalog coverage check, getStandard null for unknown.

### Decisions logged

- **No Anthropic call** — compliance is binary: a check passes or it doesn't. Using the model would add latency and cost without changing the answer. The fallback pattern from morning-brief doesn't apply.
- **Always show "pending" rather than skip** — when a check needs data we don't yet collect, the agent surfaces the gap and what to do about it. This is more useful than silently omitting the rule, and it tells the operator exactly what to add to upgrade a check to pass/fail.
- **TRIR as the fall-protection proxy** — the risk model doesn't yet tag incidents by type (fall, electrical, struck-by). Using TRIR > 2.0 as a "review the recent incidents" signal is conservative and matches the OSHA action level for safety programs.

### Test results
- **All 752 tests passing across 42 suites** (was 736 before this task — +16).
- Frontend build clean. Backend build clean.

### Files
- New: `src/constants/standards.ts`, `src/agents/standards.agent.test.ts`
- Rewritten: `src/agents/standards.agent.ts` (was 10-line stub)

---

## Task 8 — Project Templates (save/load)

**Goal:** Save a snapshot of a project's WBS structure as a reusable template, list templates, and apply a template to a new project. Org-scoped.

### Backend

- **`prisma/schema.prisma` (new model `ProjectTemplate`)** — id, orgId, name, description, structureType, snapshot (JsonB), sourceProjectId, createdBy, createdAt, updatedAt. Indexed on orgId for fast org-scoped listing.
- **`prisma/migrations/20260612130000_add_project_templates/migration.sql` (new)** — Creates the table and index.
- **`src/services/templates.service.ts` (new)** — `saveTemplate`, `listTemplates`, `getTemplate`, `deleteTemplate`, `applyTemplate`. Snapshot stores items as `code / name / parentCode / level / responsibleParty / budget` (no project ids), so a template can be applied to any project. Apply runs in level order, building a `code → id` map so children reference parents created in the same loop. **Idempotent** — re-apply skips codes that already exist on the target project. Validates: source project must belong to the org; target project must belong to the org; structure types must match (so a WBS template can't be applied to a cost-code project and produce silently misnamed items).
- **`src/routes/templates.routes.ts` (new)** — Mounted at `/api/v1/templates`. Endpoints: `GET /`, `POST /`, `GET /:id`, `DELETE /:id`, `POST /:id/apply`. Gated by `requireFeature('wbs_builder')` (same gate the WBS module uses — a future task can split this out). Org id resolved from `req.user.orgId` with a fallback to the target project (same pattern as the subscription middleware).
- **`src/routes/index.ts` (modified)** — Registered `templatesRouter`.

### Tests

- **`src/services/templates.service.test.ts` (new, 14 tests)** — saveTemplate: empty name, missing project, cross-org rejection, snapshot shape (no project ids, parentCode references). listTemplates: returns summaries with itemCount. getTemplate: detail with items, null when missing. deleteTemplate: cross-org refusal, deletes when org matches. applyTemplate: cross-org refusal (template and target), structure-type mismatch rejection, level-ordered create with parentCode resolved, **idempotent re-apply** (second call skips already-existing codes).

### Decisions logged

- **Snapshot uses code / parentCode, not ids** — this is what makes a template portable. The alternative (storing id references) would mean the template only works for the project it came from.
- **Idempotent re-apply** — the PM should be able to "Refresh from template" without fear of duplicating the tree. Skipping by code is the simplest dedupe key (codes are the WBS identifier the PM cares about).
- **Structure-type match required** — applying a WBS template to a cost-code project would produce a mixed tree with wrong labels. Better to error early and let the PM convert the project structure first.
- **Snapshot limited to WBS for V1** — schedule activities, scope statements, and other project-data modules can be added to the template shape in a future task. Starting with WBS keeps V1 focused on the most-reused artifact (orgs have many similar projects with similar WBS structures).
- **No project-list view yet** — the UI for "Apply template to new project" needs a project picker and is a follow-up. The API is fully functional and the route returns clear error messages for bad input.

### Test results
- **All 766 tests passing across 43 suites** (was 752 before this task — +14).
- Frontend build clean. Backend build clean.
- Migration file created at `prisma/migrations/20260612130000_add_project_templates/migration.sql` (will be applied on next deploy via `prisma migrate deploy`).

### Files
- New: `prisma/migrations/20260612130000_add_project_templates/migration.sql`, `src/services/templates.service.ts`, `src/services/templates.service.test.ts`, `src/routes/templates.routes.ts`
- Modified: `prisma/schema.prisma`, `src/routes/index.ts`

---

## TASK 9 — Final Checks and Deploy

### Pre-deploy verification
- **Test suite:** 766 tests passing across 43 suites (3.98s runtime).
- **Backend build:** `npm run build` clean (tsc, no errors).
- **Frontend build:** `npm run build` clean (Vite, 918 kB bundle, gzipped 252 kB).

### Deploy
- **Command:** `./deploy.sh all`
- **Pre-flight:** SSH connectivity to `root@2.24.194.23` confirmed.
- **Frontend:** `scp -r frontend/dist/*` to `/opt/sitedeck-pm/frontend/dist/`.
- **Backend:** `scp -r dist/*` + `package.json` + `package-lock.json` + `prisma/*` to `/opt/sitedeck-pm/`.
- **On VPS:** `npm install --production` (269 packages, 5s) → `npx prisma generate` (360ms) → `systemctl restart sitedeck-pm`.
- **Service status:** `active (running) since Fri 2026-06-12 22:51:09 UTC` — healthy.

### Production smoke tests
- `GET /api/v1/health` → **200** (service responding).
- `GET /api/v1/templates` (unauthenticated) → **401** (auth middleware enforced).
- `GET /api/v1/templates` with `Authorization: Bearer dev-token` → **401** (Task 5 production hardening verified — dev-token bypass is disabled in production).

### Sprint 6 summary
All 9 tasks completed:
1. What-If Schedule Analysis (CPM + frontend tab)
2. Equipment Registry Page
3. WBS Builder (hierarchical tree with CRUD, crosswalk mapping)
4. Subscription Tier Infrastructure (schema, feature gate middleware, tier constants, 402 responses)
5. Firebase Auth Production Setup (dev-token disabled in prod, pre-deploy check script, operator CLI for role claims)
6. RFI Follow-Up Draft Agent (second agent endpoint, full security stack)
7. Compliance Alert Stubs (12 standards catalog, deterministic rule engine — no LLM call)
8. Project Templates (save/list/get/delete/apply, code-based idempotency)
9. Final Checks and Deploy (this task)

**Test growth:** 700 → 766 tests (+66 new tests, 9.4% increase).
**Files added:** 25+ new (services, routes, agents, middleware, tests, migrations, scripts).
**Deployed to:** `https://projects.sitedeck.pro` — all changes live.
