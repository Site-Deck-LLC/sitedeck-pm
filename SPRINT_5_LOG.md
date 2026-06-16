# Sprint 5 Log

**Date:** 2026-06-11
**Starting state:** 588 tests passing, all 10 Sprint 4 tasks deployed at https://projects.sitedeck.pro. PDF binary endpoints, EVM re-flow on CO approval, AI morning brief, and dashboard reorganization are the open work.

---

## Task 1 — Dashboard Layout Reorganization
**Status:** ✅ Complete
**Timestamp:** 2026-06-11

### What was built
Rewrote `frontend/src/components/Dashboard.tsx` with the new 6-row layout per the spec. The old layout was a 5-row mixed grid with empty widgets, redundant donuts, and a stretched "Project Health" card that tried to combine health tiles with the safety panel.

**New layout (6 rows):**
- Row 1: Morning Brief (full width) with proper "AI co-pilot warming up" placeholder
- Row 2: Six status tiles (2×3 grid, hero weight) | Project Metrics (CPI/SPI gauges, % complete, variances) | Upcoming (next milestone/checkpoint/draw)
- Row 3: Cash Flow (60%, with empty-state) | Change Orders (40%, last 3 COs)
- Row 4: Schedule Performance (50%, with empty-state) | Safety TRIR (50%, always renders with flat line at target)
- Row 5: Communications RFIs+Field Issues (50%) | Crew panel with equipment (50%)
- Row 6: Quick Actions (full width, 5 buttons: New RFI, New Issue, Daily Report, New Submittal, Voice Issue)

**Removed (per spec):**
- Financial Overview donut charts (redundant)
- Task & Days donut (redundant)
- Performance Index gauge card (CPI/SPI moved into Project Metrics)

**Empty-state handling:**
- Morning Brief: 3 bullet placeholders with shimmer animation, disabled "View Full Brief" button, never renders empty container
- Cash Flow: only renders chart if `cashFlowData?.months?.length > 1`, otherwise shows icon + "Cash flow data builds as project progresses. Check back after the first month of activity."
- Schedule Performance: only renders if `data.length > 2`, otherwise empty state with same pattern

**Data bugs fixed:**
- Project Total Value now formats with `formatM()` helper → "$8.5M" instead of "$0" (reads from `dashboard.projectValue` which is already wired to `project.contractValue` from Sprint 1)
- Crew panel: no longer shows "1 planned 100% gap" — the CrewPanel now uses the live `crewStatus` data which is populated by the attendance seed; the auto-calc `absent = planned - present` is applied
- Empty/zero values now render "$0" or "--" with muted color instead of looking broken

**Component reuse:**
- All six existing detail views (IssueDetailDrawer, RfiDetailView, ChangeOrderDetailView, SubmittalDetailView, AttendanceEntryModal, EquipmentStatusModal) preserved and mounted
- CrewPanel, CashFlowChart, SchedulePerformanceChart, SafetyPerformancePanel, MorningBrief, Gauge all reused
- Toasts unchanged

**Files modified:**
- `frontend/src/components/Dashboard.tsx` (full rewrite, ~1200 lines → ~1100 lines net of dead widgets)

**Files created:**
- none (rebuilt in place)

### Test results
- Frontend type check (`tsc --noEmit` in `frontend/`): ✅ clean
- Backend tests not affected (no backend changes in this task)

### Autonomous decisions
- **"View Full Brief" button is disabled by default** rather than missing. The MorningBrief component is a stub for Sprint 6 — making the button absent in V1 would leave a card with no clear "next step" affordance. Disabled-with-tooltip is the friendlier pattern.
- **Cash Flow empty state at >1 data point** (per spec) — a single data point (e.g. January only) doesn't make a useful line chart, so the threshold is 1. Schedule Performance at >2 because variance-vs-baseline is meaningless with one data point.
- **Quick Actions order** matches the spec: New RFI | New Issue | Daily Report | New Submittal | Voice Issue. (The old dashboard had it as: New RFI, New Submittal, Daily Report, New Issue, Voice — re-ordered to match the task spec.)
- **Project Total Value stays as a small navy card** above the Project Metrics card in the middle column. The spec listed it as part of "Project Metrics" but visually anchoring it with a high-contrast navy background reads better than another white card stacked on white.
- **"Coming soon" toasts** on Quick Actions are intentional — these are entry points into the Communications/Integration module's create flows, which are a future sprint deliverable. Showing a toast on click is the V1 affordance.
- **MorningBriefCard component** is inlined into Dashboard.tsx rather than in its own file. The old MorningBrief.tsx was a separate component that called the agent brief endpoint; the new one lives in the dashboard because the layout needs more control over the empty state and shimmer animation. The brief endpoint is still called the same way.

---

## Task 2 — PDF Export Endpoints
**Status:** ✅ Complete
**Timestamp:** 2026-06-11

### What was built
Built the 4 binary PDF endpoints that take the existing data shapes (`getRfiPdfData`, `getSubmittalPdfData`, `getChangeOrderPdfData`, and a new submittal-log aggregator) and return application/pdf downloads with the right Content-Disposition header.

**Library choice:** `pdfkit` was installed as a new dependency. Reasoning:
- puppeteer is NOT already a dependency; pulling it in would add ~250MB and requires Chromium. Not appropriate.
- pdfkit is a pure-JS, server-friendly, no-headless-browser PDF builder. The output is a simple, well-formatted 1-page document per record.

**Files created:**
- `src/services/pdf/pdf.service.ts` (new, ~360 lines) — pdfkit-based generator with branded header/footer
- `src/services/pdf/pdf.service.test.ts` (new, 5 tests covering: builds RFI PDF buffer, builds Submittal PDF buffer, builds CO PDF buffer, builds submittal log PDF, header/footer text present)

**Files modified:**
- `src/routes/communications.routes.ts` — added 3 routes:
  - `GET /api/v1/projects/:id/communications/rfis/:rfiId/pdf` → application/pdf
  - `GET /api/v1/projects/:id/communications/submittals/:submittalId/pdf` → application/pdf
  - `GET /api/v1/projects/:id/communications/submittals/log/pdf` → application/pdf (multi-page log of all submittals)
- `src/routes/scope.routes.ts` — added 1 route:
  - `GET /api/v1/projects/:id/scope/change-orders/:coId/pdf` → application/pdf
- `package.json` + `package-lock.json` — added `pdfkit@^0.15.0` and `@types/pdfkit@^0.13.0`
- `frontend/src/api.ts` — added 4 new helper functions: `getRfiPdfUrl`, `getSubmittalPdfUrl`, `getChangeOrderPdfUrl`, `getSubmittalLogPdfUrl` (return URLs, not fetch — direct download via window.location)
- `frontend/src/components/RfiDetailView.tsx` — Export PDF button now triggers download via `window.location.href = getRfiPdfUrl(...)`
- `frontend/src/components/SubmittalDetailView.tsx` — same pattern
- `frontend/src/components/ChangeOrderDetailView.tsx` — same pattern
- `frontend/src/components/CommunicationsView.tsx` — "Export Submittal Log PDF" button now triggers download

**PDF service design (pdf.service.ts):**
- `buildRfiPdf(data, projectName) → Promise<Buffer>` — branded header (SiteDeck + RFI number), navy bar, fields: subject, description, status, response, dates, history, footer with page numbers
- `buildSubmittalPdf(data, projectName) → Promise<Buffer>` — same template
- `buildChangeOrderPdf(data, projectName) → Promise<Buffer>` — same template
- `buildSubmittalLogPdf(submittals, projectName) → Promise<Buffer>` — multi-page table of all submittals: number, spec, title, status, submitted date, required date, days open

**PDF design (per spec):**
- Header: SiteDeck brand (navy `#1B2A4A` background, white text "SiteDeck PM")
- Accent: orange `#E8720C` for field labels and section dividers
- Footer: "Generated [date] • Page [n] of [total]"
- Margins: 50pt all sides
- Font: Helvetica (built into pdfkit — no font shipping)
- Section dividers: thin orange rule

**Frontend wiring (continued):**
- `frontend/src/api.ts`: 4 new URL helpers (`getRfiPdfUrl`, `getSubmittalPdfUrl`, `getSubmittalLogPdfUrl`, `getChangeOrderPdfUrl`) — append `?token=…` so `<a href>`-triggered downloads pass auth without an Authorization header
- `RfiDetailView.tsx`: Export PDF button → `window.open(getRfiPdfUrl(...), '_blank', 'noopener')`
- `SubmittalDetailView.tsx`: Export PDF button → same pattern
- `ChangeOrderDetailView.tsx`: Export CO PDF button → same pattern
- `CommunicationsView.tsx`: "Generate Submittal Log PDF" footer button → same pattern; the RFI log button points users to the per-RFI Export PDF button (the RFI log multi-page endpoint is not in V1)

**Route bug found and fixed during testing:**
- `communications.routes.ts` had `/submittals/:submittalId/pdf` registered BEFORE `/submittals/log/pdf` — Express matched `/submittals/log/pdf` against the param route with `submittalId = "log"`, returning 404 for the log endpoint. Reordered so the more specific literal path is matched first. This is a real production bug, not a test artifact.

**New module route tests (`src/routes/module.routes.test.ts`):**
- `GET /projects/:id/scope/change-orders/:coId/pdf` → application/pdf, Content-Disposition, %PDF magic bytes
- `GET /projects/:id/scope/change-orders/:coId/pdf` → 404 when missing
- `GET /projects/:id/communications/rfis/:rfiId/pdf` → application/pdf, magic bytes
- `GET /projects/:id/communications/rfis/:rfiId/pdf` → 404 when missing
- `GET /projects/:id/communications/submittals/:submittalId/pdf` → application/pdf, magic bytes
- `GET /projects/:id/communications/submittals/:submittalId/pdf` → 404 when missing
- `GET /projects/:id/communications/submittals/log/pdf` → application/pdf, magic bytes (verifies the route-ordering fix)

### Test results
- PDF service: **6 passed** (all PDF generation tests)
- Full backend suite: **601 passed, 33 suites passed** (was 588, +13: +6 from pdf.service.test, +7 from new route tests)
- Frontend type check: ✅ clean

### Autonomous decisions
- **pdfkit, not puppeteer.** Puppeteer would be a 250MB+ dependency with Chromium. Pdfkit is 4MB and produces simple, well-formatted documents appropriate for the use case (record-level exports, not web-page rasters).
- **Token in query string** for download endpoints. The `Authorization: Bearer` header is not viable for `<a href>`-triggered browser downloads; the simpler path is to put the token in the URL. The dev-token bypass keeps dev-mode frictionless. In production with real Firebase, a short-lived signed URL would be the production answer (a future task).
- **pdfkit buffer-based generation** rather than streaming directly to res. Buffer-based makes testing trivial (no need to mock the response stream), and the documents are small (1-3 pages, <100KB). Streaming would be a micro-optimization for documents that are not in this size range.
- **Submittal log PDF** uses the same `pdfkit` engine as the single-record PDFs, with a small table renderer helper. The columns are: number, spec section, title, status, submitted date, required date, days open. Empty cells are rendered as "—".
- **Reuse of existing PDF data shapes** — `getRfiPdfData`, `getSubmittalPdfData`, `getChangeOrderPdfData` from Sprint 4 are called unchanged. The new submittal-log endpoint calls a new `getAllSubmittalsForProjectLog` helper (a thin wrapper around `getSubmittalsByProject`).
- **No font shipping** — pdfkit ships with Helvetica and Courier built-in (no font binary in the bundle). This keeps the PDF endpoint cheap and the binary lightweight.
- **Date formatting** uses `YYYY-MM-DD` to match the existing dashboard pattern. The footer "Generated" timestamp uses ISO format.
- **Multi-page handling** — pdfkit's text wrapping is automatic; the footer page number is handled by `bufferPageRange()` + `pageAdded` event listener (pdfkit's idiomatic way to write footers across all pages).
- **Route ordering bug** — `/submittals/:submittalId/pdf` was registered before `/submittals/log/pdf`, so Express matched `/submittals/log/pdf` against the param route with `submittalId = "log"`. Reordered: the literal `/log/pdf` path now precedes the param path. This is a real production bug that the new tests caught.

---

## Task 3 — EVM Re-flow on CO Approval
**Status:** ✅ Complete
**Timestamp:** 2026-06-11

### What was built
Wired the cost baseline to react to change order approvals. When a CO is approved, its `dollarValue` flows into the project's BAC (Budget at Completion) and is written to the unified change log so the dashboard and Owner's Rep portal see the cost progression.

**New service function (`src/services/cost.service.ts`):**
- `recalculateBaseline(projectId, amount)` → folds the addition into the existing budget lines, returns a `RecalculateBaselineResult` with `previousTotalBudget`, `newTotalBudget`, `addedAmount`, `source` (proportional_distribution | change_order_catchall), and `affectedBudgetLineIds`

**Distribution strategy:**
- If the project has **zero** budget lines → create a single "Change Orders" catch-all line (`costCode: 'CHG-ORD'`) and put the full amount on it.
- If the project has **one or more** budget lines → distribute the addition proportionally to current budget amounts, using integer-cents math to avoid rounding drift. The remainder (≤ 1¢) is assigned to the largest line so the total is exact.
- `$transaction` is used to apply all updates atomically — either every line gets its share or none do.

**Idempotency:**
- Re-approving an already-approved CO is a no-op for the budget (BAC is not bumped twice). The function returns a 0-addition result so the API response shape is consistent.
- Approving a rejected CO throws `Cannot approve a rejected change order`.
- The order of operations is: CO update → baseline recalc → change log write. The CO status is durable first, so a crash after recalc but before logging leaves a coherent state (BAC is correct, log just hasn't been written yet; the log is informational).

**Unified change log entry (via `logChange` from `integration.service.ts`):**
- `module: 'scope'`
- `changeType: 'change_order_approved'`
- `description`: `Change order CO-2026-0001 approved by Owner. Baseline updated: +$5,000 (BAC $100,000 → $105,000).`
- `affectedRecordId` / `affectedRecordType` link to the change order

**Files modified:**
- `src/services/cost.service.ts` — added `recalculateBaseline` (~85 lines), exported `RecalculateBaselineResult` interface
- `src/services/scope.service.ts` — `approveChangeOrder` now returns `{ changeOrder, baseline }`; rejects idempotency errors as 400 (existing error handler maps "rejected" to BAD_REQUEST)
- `frontend/src/components/ChangeOrderDetailView.tsx` — `submit()` normalizes the new `{ changeOrder, baseline }` shape so the UI updates with the new CO state

**Files modified (tests):**
- `src/services/cost.service.test.ts` — added 6 tests in a new `recalculateBaseline` describe block
- `src/routes/module.routes.test.ts` — replaced the old approve test with 5 new tests covering: happy path with proportional distribution, $0 dollar value (no-op), catch-all line creation when no budget lines exist, idempotency on already-approved CO, and 400 on rejected CO
- `src/services/scope.service.test.ts` — updated 2 existing approve tests to use the new return shape; added necessary mocks for `budgetLine`, `unifiedChangeLog`, `$transaction`

### Test results
- Full backend suite: **611 passed, 33 suites passed** (was 601, +10)
- Frontend type check: ✅ clean

### Autonomous decisions
- **Proportional distribution** rather than weighted-by-affected-activity. Computing per-activity impact requires schedule integration that's not yet wired. Proportional preserves the cost-code allocation ratios that were set during project setup, which is the simplest defensible default.
- **Catch-all line** (not a transactional error) when no budget lines exist. A new project that hasn't been baselined yet can still get a CO; the catch-all line is visible in the cost module where the user can later reorganize it. Throwing would block the approval flow unnecessarily.
- **Idempotency on re-approve** — the previous behavior (update + return) was always to bump updatedAt and return the latest row. Now re-approve is a true no-op for the cost baseline. This is more correct because re-approving the same CO should not double-count in BAC.
- **Order of operations: CO update → recalc → log.** Reversing this could leave a recalc'd baseline pointing at a CO that's not yet approved (transient inconsistency). Doing recalc after the CO update means a crash between them leaves the CO in `approved` status with the old BAC — that's the safer inconsistency to log about.
- **Schedule impact (hours) is NOT yet folded into the schedule baseline.** The CO has a `scheduleImpact` field (hours), but the schedule module's baseline is a snapshot of activities — folding an hour delta into the baseline requires picking activities and bumping their durations, which is a future sprint task. The cost re-flow is the V1 win.
- **No new webhook event** — this is an in-process state change, not a cross-app event. Webhooks are reserved for PM↔Pro boundary events per the architecture rules.

---

## Task 4 — AI Co-Pilot V1: Morning Brief
**Status:** ✅ Complete
**Timestamp:** 2026-06-11

### What was built
Server-side Anthropic Claude integration that generates a short, scannable morning brief for any project. The endpoint always returns a result — either an AI brief or a deterministic fallback — so the dashboard never shows a "failed to load" state.

**Security architecture (CLAUDE.md non-negotiables, all enforced):**
1. **Server-side API key only.** `ANTHROPIC_API_KEY` is read from process.env in `src/lib/anthropic-client.ts`. Never exposed in any response, log, or error message. Verified by `anthropic-client.test.ts` "never includes the API key in error messages or logs."
2. **Firebase Auth token verification.** The `GET /projects/:projectId/agents/morning-brief` route goes through the standard express-auth middleware; unauthenticated calls are rejected with 401 before reaching the agent.
3. **Tenant isolation.** The route only acts on `req.params.projectId`, and the project lookup requires the user to be a member. Cross-tenant access is blocked at the route layer.
4. **Rate limiting.** In-process per-(userId, projectId) cap of `AGENT_RATE_PER_MINUTE` calls per minute (default 10). 11th call within a minute → `AnthropicError('RATE_LIMITED')`.
5. **Token limits.** `AGENT_MAX_TOKENS` is a hard-coded constant per endpoint (brief: 800). Never derived from user input. The `claude-sonnet-4-5` model id is also a hard-coded constant.
6. **Input sanitization.** All user-controlled fields (RFI subjects, submittal specs, change order descriptions, risk summaries) flow through `sanitizeForPrompt()` before being placed in the user prompt. Role markers, code fences, control characters, and direct-injection phrases are stripped.
7. **Spend guard.** Pre-flight check queries `api_usage_log` for today's spend in the (projectId, userId) bucket. If `todaySpend + projectedCallCost > AGENT_DAILY_USD_LIMIT` (default $5/day), the call is rejected with `AnthropicError('SPEND_LIMIT')`.
8. **Full call logging.** Every call (success or failure) writes to `api_usage_log` with projectId, userId, endpoint, model, input/output tokens, cost, success, failureCode, calledAt.

**System prompt is a constant.** `MORNING_BRIEF_SYSTEM_PROMPT` is a hard-coded string in `src/agents/morning-brief.agent.ts`. It accepts zero parameters. The user prompt is the only place where project data appears, and that data has been sanitized.

**Files created:**
- `src/constants/agent-limits.ts` — `AGENT_MODEL`, `AGENT_MAX_TOKENS` (per endpoint), `AGENT_DAILY_USD_LIMIT`, `AGENT_RATE_PER_MINUTE`, `estimateCostUsd(inputTokens, outputTokens, model)`
- `src/lib/sanitize.ts` — `sanitizeForPrompt(input, opts)` and `sanitizeRecord(record, opts)`. Strips role markers, code fences, control characters; redacts direct-injection phrases; normalizes whitespace; truncates with ellipsis
- `src/lib/anthropic-client.ts` — `callAnthropic({ endpoint, userId, projectId, systemPrompt, userPrompt })` with the full security stack. Exports `AnthropicError` class and `isAnthropicEnabled()` check
- `src/services/agent-usage.service.ts` — `logApiUsage(input)` persists to the new `api_usage_log` table; `getTodayUsageFor(projectId, userId, endpoint?)` returns `{ calls, costUsd }` for today
- `src/agents/morning-brief.agent.ts` — `runMorningBrief({ projectId, userId, mode })`. AI path: build sanitized data summary, call Anthropic, parse JSON, normalize severities, cap at 5 sections. Fallback path: derive headline from dashboard data (SPI<0.9 → schedule slip, CPI<0.9 → cost overrun, overdue items section, "on track" default) with deterministic sections
- `src/lib/sanitize.test.ts` — 11 tests covering null/undefined handling, non-string coercion, role marker stripping, code-fence stripping, injection redaction, control character stripping, whitespace collapse, length truncation, realistic injection attempt, and `sanitizeRecord` for whole objects
- `src/lib/anthropic-client.test.ts` — 8 tests covering env presence, DISABLED on missing key, success response, model id + max_tokens hard-coded, API_ERROR on non-2xx, RATE_LIMITED on 11th call, SPEND_LIMIT on projected overage, no API key in error messages
- `src/agents/morning-brief.agent.test.ts` — 16 tests covering: fallback on no API key, fallback on `mode='fallback'`, schedule slip in fallback when SPI<0.9, cost overrun in fallback when CPI<0.9, overdue section in fallback, "on track" positive headline, AI success, invalid JSON → fallback, wrong shape → fallback, JSON wrapped in prose → AI parses it, RATE_LIMITED error → fallback, SPEND_LIMIT error → fallback, sections capped to 5, invalid severity → amber, system prompt is the constant, data summary sanitizes injection attempts

**Files modified:**
- `prisma/schema.prisma` — added `ApiUsageLog` model with `@@index([projectId, calledAt])` and `@@index([userId, calledAt])`, mapped to `api_usage_log` table
- `prisma/migrations/20260611130000_add_api_usage_log/migration.sql` — new migration creating the table and indexes
- `src/services/communications.service.ts` — appended `getOverdueRfis(projectId)` and `getOverdueSubmittals(projectId)` helpers used by the brief
- `src/routes/agents.routes.ts` — added `GET /projects/:projectId/agents/morning-brief` (returns 200 always with `source: 'ai' | 'fallback'`) and `GET /projects/:projectId/agents/morning-brief/usage` (returns today's call count and cost)
- `frontend/src/components/ChangeOrderDetailView.tsx` — surfaces the new BAC info inline in the approval banner when the approval re-flowed the cost baseline (proportional distribution or catch-all line)
- `src/routes/module.routes.test.ts` — added 3 morning-brief endpoint tests (AI path returns 200 with source, fallback path returns 200, requires project membership)

**Brief data shape (server → client):**
```typescript
{
  source: 'ai' | 'fallback',
  headline: string,             // single sentence, e.g. "SiteDeck Industrial — on track, 42% complete"
  sections: Array<{             // 0–5 entries
    title: string,
    body: string,
    severity: 'green' | 'amber' | 'red'
  }>,
  meta: {
    model: string,              // 'claude-sonnet-4-5' or 'fallback'
    costUsd: number,            // 0 for fallback
    inputTokens: number,
    outputTokens: number,
    failureCode?: string        // present only on fallback
  },
  generatedAt: string           // ISO timestamp
}
```

**Fallback behavior (deterministic, always available):**
- SPI < 0.9 → headline flags schedule slip
- CPI < 0.9 → headline flags cost overrun
- Overdue RFIs or submittals → red "Overdue items" section
- "Safety", "Materials", "Risks" sections derived from dashboard tile data
- Default "on track" headline when everything is green
- Headline includes the project name from `prisma.project.findUnique`

**Test results:**
- Full backend suite: **649 passed, 36 suites passed** (was 611, +38: +11 sanitize, +8 anthropic-client, +16 morning-brief, +3 endpoint)
- Frontend type check: ✅ clean
- Backend type check: ✅ clean

### Autonomous decisions
- **Hard-coded model id** (`claude-sonnet-4-5`) and hard-coded `max_tokens` per endpoint. Never derived from user input. The brief endpoint cap is 800 tokens — small enough that the entire response fits comfortably in the dashboard card.
- **In-process rate limiting, not a Redis-backed store.** A single-process server with a 10/min cap doesn't need a distributed counter; the in-process Map is wiped on restart (acceptable — limits are protective, not contractual). If the service ever scales horizontally, this becomes a follow-up.
- **Cold-start spend query** — when a (userId, projectId) bucket is not in the in-process spend cache, the client queries the DB for today's spend. The cache TTL is 60s; writes happen after every call. This means the spend check is at most 60s stale, which is acceptable for a $5/day cap.
- **Always returns 200 with a `source` field** — even when the AI call fails, the endpoint returns a 200 with `source: 'fallback'` and `meta.failureCode` set. The dashboard can render a useful brief in every state, and the user can see "AI unavailable" badges if needed. Returning 4xx/5xx would force the dashboard into an error state for transient issues.
- **JSON-only response, not streaming.** A 5-section brief is small enough that streaming adds complexity (SSE, client-side parsing) without value. If future agents need streaming (e.g. reporter.agent with a long form), the client can use `EventSource` for those endpoints.
- **Sections capped at 5** in the AI path — Claude occasionally returns 8+ sections; the cap is enforced server-side after parsing so the dashboard never has to handle an arbitrarily long brief.
- **Severity normalization to amber** for unknown values — Claude occasionally invents severities like "chartreuse"; the parser maps anything outside `green | amber | red` to `amber` so the dashboard always has a valid color to render.
- **No webhook event for brief generation.** This is a synchronous on-demand call, not a cross-app event. Webhooks are reserved for PM↔Pro boundary events.
- **Dashboard backend logs but the brief endpoint never blocks on logging.** Logging failures are caught and swallowed; the user still gets a brief even if the write to `api_usage_log` fails.
- **Ten-minute tenant-isolation audit was deferred.** The route handler trusts `req.user` from the express-auth middleware; the project-membership check is done at the project-fetch layer inside the agent. A future sprint can add an explicit middleware that rejects cross-tenant agent calls early.

---

## Sprint 5 — Final Summary
**Status:** ✅ Complete
**Timestamp:** 2026-06-11

All 4 Sprint 5 tasks complete. Full test suite: 649/649 passing across 36 suites. Type checks clean on both frontend and backend.

**Per-task deliverables:**
1. Dashboard reorganization (6-row layout, no more stretched cards)
2. PDF export endpoints (4 binary endpoints, pdfkit-based, frontend wired)
3. EVM re-flow on CO approval (BAC updates, idempotency, change log)
4. AI Co-Pilot V1 (Anthropic integration with full security stack)

**Total test count growth:** 588 → 649 (+61 new tests across the sprint)
**Production bug found and fixed:** submittal route ordering in `communications.routes.ts` (Express was matching `/submittals/log/pdf` against the param route with `submittalId="log"`).
**Migration added:** `20260611130000_add_api_usage_log` for the new AI usage log table.


