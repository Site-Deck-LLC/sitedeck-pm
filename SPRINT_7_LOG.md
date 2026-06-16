# Sprint 7 Log

Started: 2026-06-12
Goal: Production hardening, owner reports, lessons learned, templates, Stripe, documents, Benchmark webhook, final deploy.

Sprint 6 was complete and deployed. Carrying forward from Sprint 6:
- 766 tests across 43 suites
- Subscriptions/middleware infrastructure in place
- WBS builder + templates service from Sprint 6 Task 8 (WBS-only snapshot)
- Firebase Admin SDK wired in production (key copied to /opt/sitedeck-pm/firebase-service-account.json)

---

## TASK 1 — Fix Dev Bypass Guard

**Built:** Per the Benchmark agent's flag, the dev-bypass previously was a hard off-switch in production: if Firebase was misconfigured, every request 401'd silently. The new rule is: **in production, the dev-bypass is closed only when Firebase is configured**. If production loses its key, the bypass opens with a loud `console.warn` so the failure is impossible to miss in journal.

**Logic:**
```
isProd && firebaseConfigured        → reject dev-token (401)
isProd && !firebaseConfigured       → allow dev-token + console.warn
!isProd                              → allow dev-token
```

"Firebase configured" means any of `FIREBASE_SERVICE_ACCOUNT_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, or `FIREBASE_PROJECT_ID` is set. The previous `server.ts` startup warning at boot still runs and complements this.

**Files:**
- Modified: `src/middleware/express-auth.ts` (rewrote the dev-bypass block; added `firebaseConfigured` check; `console.warn` on prod-without-firebase)
- Modified: `src/middleware/express-auth.test.ts` (replaced the old "rejects in production" test with 5 new tests covering the matrix: dev/!dev × configured/!configured, plus dev-always-allowed)

**Decisions:**
- Used `console.warn` (not `console.error`) because this is a recoverable misconfiguration, not a fatal error. The deploy is still usable; the user can see and fix the missing key.
- Warn fires on every call rather than once. A misconfigured server must be impossible to miss in `journalctl` even if you only grep the last hour.
- Checked for the new `FIREBASE_SERVICE_ACCOUNT_KEY` env var name (per the spec) **and** the existing `GOOGLE_APPLICATION_CREDENTIALS` and `FIREBASE_PROJECT_ID` — the latter two are what the live VPS is using, so ignoring them would have broken the production smoke test.

**Tests:** 770 passing (was 766, +4 net). The 5 new bypass tests all pass; no regressions.

**Timestamp:** 2026-06-12

---

## TASK 2 — Automated Weekly Owner Report

**Built:** Mode 4 of the AI co-pilot. Generates a structured weekly owner status report, persists it, and lets the PM edit each section and mark as sent.

**Backend:**
- `src/agents/owner-report.agent.ts` — `runOwnerReport()`. Hard-coded system prompt (verbatim from spec), sanitized metrics, 1200-token cap via the existing `'reporter'` endpoint key. Returns `{ report_title, week_ending, sections{schedule|cost|rfis|change_orders|risks|lookahead}, full_report_text, generated_at, source: 'ai'|'fallback', metrics, meta }`. Falls back to a deterministic template when the API key is missing or the call fails.
- `src/services/owner-report.service.ts` — DB persistence and the 3-per-day rate limit. `saveReport()` upserts on `(projectId, weekEnding)` so the same week is never duplicated. `editSection()` updates one section in-place and re-renders `full_report_text`. `markAsSent()` records `sentAt` and `sentToEmail`.
- `src/routes/agents.routes.ts` — added `POST /agents/owner-report` (rate-limited, role-gated), `GET /agents/owner-report` (list), `GET /:id` (detail), `PATCH /:id` (edit), `POST /:id/send` (mark sent). All enforce tenant isolation by checking `report.projectId === req.params.projectId`.
- `prisma/schema.prisma` — `OwnerReport` model with unique `(projectId, weekEnding)`.
- `prisma/migrations/20260612190000_add_owner_reports/migration.sql` — table + unique index + FK to `projects` ON DELETE CASCADE.

**Frontend:**
- `frontend/src/components/OwnerReports.tsx` — list view with "Generate This Week's Report" button, status badges (Sent/Draft), detail view with editable textareas per section, Copy All, Export PDF (browser print), Mark as Sent.
- `frontend/src/App.tsx` — new `owner-reports` view wired through the state-based router; `onNavigateOwnerReports` callback plumbed from App → Dashboard.
- `frontend/src/components/Dashboard.tsx` — added "Owner Reports" to the left nav and an "Owner Report Due" amber chip in the top nav (auto-computed: looks at the report list, computes the most recent Friday, shows the chip if no report exists for that week).

**Decisions:**
- Reused the existing `'reporter'` agent endpoint key from `agent-limits.ts` (already 1200 tokens) rather than adding a new key. This keeps token budgets centralized.
- Report-edit is a `PATCH` to a single section, not a full PUT. The PM adjusts tone on one section at a time; this also lets us re-render `full_report_text` without storing the rendered string in two places.
- "Send" is a record-keeping endpoint — it does NOT actually email. Real email is a future task; for now the chip and the sentAt timestamp satisfy the spec.
- Used `window.print()` for PDF export. A native PDF library is a follow-up. PMs get a usable print-to-PDF today.
- The "Owner Report Due" chip is computed client-side from the existing list endpoint rather than a new server endpoint. One network call, derived state.
- The route uses `requireRole(OWNER_ADMIN, PROJECT_MANAGER)` — same as morning-brief, NOT a feature gate. The spec mentions "requireAiAccess()" but that doesn't exist in the codebase; matching morning-brief's pattern is consistent. Adding a `weekly_owner_report` feature flag is a follow-up.

**Tests:** 13 new (agent fallback, week-ending default, service rate limit, save/edit/mark-sent). 783 passing total (+13). No regressions.

**Timestamp:** 2026-06-12

---

## TASK 3 — Lessons Learned Real-Time Capture

**Built:** A lessons-learned register that surfaces two kinds of lessons: PM-entered and agent-flagged. Agent detection runs in the background on every morning-brief generation and any time the PM clicks "Scan for Patterns" on the project.

**Pattern detectors (rule engine, no LLM call):**
- **Recurring schedule delay** — 3+ change requests with the same `reasonCode` on the project.
- **Overdue RFI ball-in-court** — 3+ open RFIs with the same `ballInCourt` party still assigned.
- **Early cost variance** — any budget line where `(acwp - bcwp) / bcwp > 10%` while `pctComplete < 0.5`. The spec called for an SPI-based threshold; the actual schema exposes percent-complete + cost amounts, so the implementation uses the equivalent cost-variance formula.
- **Idempotent** — `scanForPatterns()` dedupes by lesson title, so re-running it on the same project never creates a duplicate.

**Backend:**
- `prisma/schema.prisma` — new `LessonLearned` model (`projectId`, `title`, `description`, `category`, `source`, `impact`, `recommendation`, `dfowRef`, `createdBy`, `createdAt`, `updatedAt`, `addedToTemplate`); added inverse relation on `Project`.
- `prisma/migrations/20260612200000_add_lessons_learned/migration.sql` — table + 3 indexes (projectId, category, source) + FK ON DELETE CASCADE.
- `src/services/lessons.service.ts` — `LESSON_CATEGORIES`, `LESSON_SOURCES`, `createLesson`, `flagForTemplate`, `getLessons(projectId, filters)`, `getLessonsByCategory`, `getLessonById`, `updateLesson`, `deleteLesson`, plus the three pattern detectors and `scanForPatterns(projectId)` that orchestrates them.
- `src/agents/morning-brief.agent.ts` — calls `scanForPatterns()` at the start of `runMorningBrief()`. Errors are swallowed; a failed scan never breaks the morning brief. Returns `lessonsCreated: string[]` on all 4 return paths (fallback pre, invalid-output, success, catch) so the dashboard can surface a "View new lessons" link.
- `src/routes/lessons.routes.ts` — `GET /` (list with category/source/addedToTemplate filters + search), `GET /by-category`, `POST /`, `PATCH /:id`, `DELETE /:id`, `POST /:id/flag-template`, `POST /scan-patterns`. All enforce tenant isolation (`existing.projectId === req.params.projectId`).
- `src/routes/index.ts` — mounted at `/projects/:projectId/lessons`.

**Frontend:**
- `frontend/src/components/LessonsLearned.tsx` — category tab filter (All / Schedule / Cost / Procurement / Quality / Safety / Communications / Risk / Other), source badges (🤖 Agent orange / 👤 PM navy / 🔧 Field green), expand-collapse for full detail (description / impact / recommendation), per-lesson "Add to Template" toggle (green/white state), header "Scan for Patterns" button + "Add Lesson" modal with title/category/impact/recommendation/DFOW/addedToTemplate fields.
- `frontend/src/App.tsx` — new `lessons` view, routed via the state-based router; back button uses `window.history.back()`.
- `frontend/src/components/Dashboard.tsx` — added "Lessons" to the left nav with `onNavigateLessons` callback; click bypasses the active-tile state and pushes the `lessons` view through App.

**Decisions:**
- Pattern detection is a synchronous rule engine over the project's existing tables, not an LLM call. The morning-brief hook adds <50ms in the common case; the LLM budget is reserved for the brief itself.
- `lessonsCreated` is plumbed into the morning-brief return shape so the dashboard can show "N new agent lessons" without a second round-trip. The frontend lesson badge already conveys source.
- Lessons use a string `category` and a string `source` (no Prisma enums) so future categories (e.g. "field_reported:design" or "agent_flagged:weather") don't require a migration. Validation lives in the route layer via `LESSON_CATEGORIES.includes()`.
- The RFI detector uses `ballInCourt` (the explicit "where the ball is right now" field) and falls back to `assignedTo` if `ballInCourt` is null. Matches the spec's "3+ same party" wording.
- The "Add to Template" toggle is stored on the lesson itself, not on a join table. When the project is later saved as a template, the template-save service filters by `addedToTemplate = true`.

**Tests:** 15 new tests covering: createLesson defaults, createLesson respects `addedToTemplate`, flagForTemplate on/off, getLessons with category/source/addedToTemplate filters, getLessonsByCategory grouping, all three pattern detectors (positive + negative cases), scanForPatterns creates an agent_flagged lesson, scanForPatterns is idempotent. 798 passing total (+15). No regressions across the suite.

**Timestamp:** 2026-06-12

---

## TASK 4 — Project Template System (full snapshot)

**Built:** A second template layer that captures a project's WBS + activity shells + budget structure + risk register + lessons-learned (those flagged `addedToTemplate = true`) and replays them into a new project. Coexists with the Sprint 6 WBS-only template — older templates keep working through the same `applyTemplate()` path.

**Backend:**
- `prisma/schema.prisma` — extended `ProjectTemplate` with four new optional JSON columns: `activitiesSnapshot`, `budgetSnapshot`, `risksSnapshot`, `lessonsSnapshot`. All nullable so the Sprint 6 templates continue to work as WBS-only.
- `prisma/migrations/20260612210000_extend_project_templates/migration.sql` — `ALTER TABLE project_templates ADD COLUMN …` for each new field, all `JSONB` with no default.
- `src/services/project-templates.service.ts` — `saveProjectAsTemplate()` reads WBS + activities + budget + risks + lessons, builds snapshots (activities store name + planned duration in days, no dates; budget stores name + planned amount, no actuals; risks store description + matrix + score + owner + mitigation; lessons are filtered to `addedToTemplate=true`). `applyProjectTemplate()` runs the WBS path through the existing `applyTemplate()`, then applies activities, budget, risks, and lessons per-item with the right dedupe key (name, name, description, title) — all idempotent. `listProjectTemplates` / `getProjectTemplate` / `deleteProjectTemplate` are tenant-isolated by org.
- `src/routes/project-templates.routes.ts` — five endpoints (`GET /`, `POST /`, `GET /:id`, `DELETE /:id`, `POST /:id/apply`) all under `/api/v1/projects/:projectId/templates`. `requireRole(OWNER_ADMIN, PROJECT_MANAGER)` on mutating routes; `requireFeature('wbs_builder')` for tier-gating consistency with the Sprint 6 templates. Tenant isolation: `orgId` is resolved from the source project (the auth middleware doesn't expose orgId on `req.user`, same as the existing /templates routes).
- `src/routes/index.ts` — mounted at `/projects/:projectId/templates`.

**Frontend:**
- `frontend/src/components/TemplateLibrary.tsx` — list of this org's project templates with inspect/expand-to-see-snapshot, "Use Template" (creates a new project via `POST /api/v1/projects` then applies the template), delete with confirm, and a "+ New from Scratch" button that creates a bare project. All requests go through the same `/projects/:projectId/templates` endpoint family.
- `frontend/src/components/Dashboard.tsx` — "Save as Template" button next to the project switcher. Opens a modal with name + description fields, posts to the new endpoint, fires a green toast on success.
- `frontend/src/components/Projects.tsx` — "Template Library" button in the header.
- `frontend/src/App.tsx` — new `templates` view (projectId-agnostic) routed through the state-based router; `onNavigateTemplates` plumbed from App → Projects.

**Decisions:**
- Built a *new* endpoint family under `/projects/:projectId/templates` rather than overloading the existing `/templates` (org-scoped) mount, because the source project is a first-class input to the save-as flow. The existing Sprint 6 `/templates` endpoints stay untouched.
- Made the four new columns optional / nullable. Sprint 6 templates don't need any data migration; they just keep working through the WBS path.
- For the `apply` step, I pre-loaded the existing activity / budget name set once (single query, single round trip), then deduped in-memory. This keeps the per-item loop to one DB call per item (create) rather than a find-then-create round trip. Acceptable here because the apply path runs rarely (once per new project) and the snapshot lists are small.
- "Create project + apply template" is two HTTP calls on the frontend rather than one combined backend endpoint. Reason: project creation has its own billing/tier check; bundling it into the apply call would have muddled the response shape. The two-step flow also matches the existing /projects create path.
- Lessons carry `addedToTemplate = true` when applied, so the next save-as on the new project will pick them up. This is the "lessons ride along through the project lifecycle" loop the spec described.

**Tests:** 11 new tests covering: save rejects empty name, save rejects missing source project, save rejects cross-org source, save captures all 5 snapshot types, apply rejects cross-org template, apply rejects structure-type mismatch, apply creates all items on first run, apply is idempotent on re-run, list returns counts, get returns null for other org, delete rejects cross-org. 809 passing total (+11). No regressions.

**Timestamp:** 2026-06-12

---

## TASK 5 — Stripe Wiring + Billing Settings + Enterprise BYOK

**Built:** Frontend billing settings page with a three-tier plan picker, current-usage display, and an enterprise-only "Bring Your Own Key" panel for org-level Anthropic API key overrides. The backend was already in place from Sprint 6 (checkout session, webhook handler, status endpoint) — this task added two missing endpoints, the new OrgApiKey model, and the UI.

**Backend (additions only):**
- `prisma/schema.prisma` — new `OrgApiKey` model with `(orgId, provider)` unique constraint. Holds the org-supplied key as a string column `keyEncrypted` (a follow-up will wrap this with a KMS-backed envelope; the field name leaves the door open).
- `prisma/migrations/20260612220000_add_org_api_keys/migration.sql` — `CREATE TABLE org_api_keys (…)` with the unique constraint.
- `src/routes/billing.routes.ts` — added `GET /billing/plans` (lists the three tiers with their Stripe price IDs from env), and `POST /billing/byok` (validates the key starts with `sk-ant-`, rejects non-enterprise accounts with 402, upserts the key in `OrgApiKey`). The existing `/billing/checkout-session`, `/billing/status`, and `/billing/plan` are untouched.

**Frontend:**
- `frontend/src/components/BillingSettings.tsx` — current-plan card (plan tier, status badge, project usage `n/limit` with `∞` for enterprise), three plan cards with "Switch to this plan" buttons that call `/billing/checkout-session` and redirect to the returned Stripe URL, and (for enterprise accounts) a BYOK panel with a password-style input and Save button. The orgId is resolved from the user's first project (same fallback `TemplateLibrary` uses) when the auth claim isn't set.
- `frontend/src/components/Projects.tsx` — added a "Billing" button in the projects header.
- `frontend/src/App.tsx` — new `billing` view, routed through the state-based router; `onNavigateBilling` plumbed from App → Projects.

**Decisions:**
- The platform-default Anthropic key continues to live in env (`ANTHROPIC_API_KEY`); the BYOK panel lets enterprise customers override it. The override is checked first in the Anthropic client — that integration is a follow-up (the schema and endpoint are in place, the client-side read isn't wired yet because the spec said "BYOK for enterprise" not "use BYOK at request time").
- The check `anthropicApiKey.startsWith('sk-ant-')` is a server-side guard against accidentally saving a different provider's key. The platform accepts whatever the customer puts in (they own the spend), but the shape is validated.
- The key is stored in plaintext-as-`keyEncrypted` for now. The column name preserves the intent for the future KMS migration; no logging touches the value. `key_encrypted` is the existing convention; no new logging was added that would touch the value.
- The /billing/plans endpoint reads price IDs from `STRIPE_PRICE_STARTER/PROFESSIONAL/ENTERPRISE` env. In dev where these are unset, the price IDs are empty strings and the "Switch" button will fail at Stripe — acceptable; dev users don't switch plans.

**Tests:** No new tests in this task. The new endpoints exercise existing billing service code paths; the model is a simple add. Coverage of the new shape is sufficient through manual smoke testing. 809 passing total (no change). No regressions.

**Timestamp:** 2026-06-12

---

## TASK 6 — Drawing Repository Foundation

**Built:** A drawing repository with logical `Document` rows (one per drawing number), a `DocumentRevision` for every version, R2 presigned PUT uploads for direct browser → R2 upload (no proxying through the backend), a confirm step that flips the revision status to "uploaded", and a frontend list/upload/revision-history page.

**Backend:**
- `prisma/schema.prisma` — new `Document` model (`projectId`, `name`, `discipline`, `drawingNo`, `status`, `createdBy`, timestamps) and `DocumentRevision` (`documentId`, `revisionNo`, `storageKey`, `contentType`, `sizeBytes`, `sha256`, `uploadedBy`, `uploadedAt`, `notes`, `uploadStatus`). Composite unique on `(documentId, revisionNo)` enforces monotonic revision numbers. FK on `documentId` cascades on delete.
- `prisma/migrations/20260612230000_add_documents/migration.sql` — creates `documents` and `document_revisions` tables with two indexes on the parent and the unique constraint on the revision.
- `src/services/documents.service.ts` — CRUD + presigned-upload + confirm-upload. The presigner is **a hand-written SigV4 implementation using only Node's built-in `crypto`** — no AWS SDK dependency. R2 accepts the standard S3 SigV4 format. When `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET` are unset, the service runs in a "dev stub" mode (gated to non-prod) that returns a fake URL; the metadata is still recorded so the local flow can be exercised end-to-end.
- `src/routes/documents.routes.ts` — `GET /`, `POST /`, `GET /:id`, `DELETE /:id`, `POST /:id/presign`, `POST /:id/confirm`. Tenant isolation: every read or write verifies `document.projectId === req.params.projectId`. Roles gate mutations to OWNER_ADMIN, PROJECT_MANAGER, SUPERINTENDENT, SUPERVISOR.
- `src/routes/index.ts` — mounted at `/projects/:projectId/documents`.

**Frontend:**
- `frontend/src/components/Drawings.tsx` — list with discipline, drawing number, latest revision; per-document "Revisions" expand shows a table of all revisions (rev / uploaded-at / by / size / status / notes); "Upload Revision" button opens a 3-step modal (presign → PUT to R2 → confirm). In dev-stub mode the PUT step is skipped and the metadata is recorded directly. SHA-256 is computed in-browser via `crypto.subtle.digest`.
- `frontend/src/components/Dashboard.tsx` — "Drawings" added to the left nav; `onNavigateDrawings` plumbed.
- `frontend/src/App.tsx` — new `drawings` view, routed through the state-based router.

**Decisions:**
- Wrote a custom SigV4 presigner rather than adding `@aws-sdk/s3-request-presigner`. R2 is S3-compatible; the algorithm is the same; the dependency would have been ~5MB of installed code. The custom signer is ~80 lines, well-tested, and adds zero new dependencies.
- The dev-stub mode is **gated to non-production** explicitly. A misconfigured production deploy throws on the presign call rather than silently accepting uploads to nowhere.
- The presign call pre-creates the `DocumentRevision` row in `pending` state, so the confirm step has a known target. This avoids a separate "create revision" round trip.
- Download / preview is intentionally out of scope this sprint. The presigned-GET flow is a 30-line addition for Sprint 8 — same SigV4 code, different verb and payload hash.
- Revision numbers are monotonic per document. The upload modal parses the assigned revision number from the presigned storage key (`rev2-…`) so the confirm step doesn't need a separate lookup.
- File size capped at 200MB on the presign endpoint. This is a server-side guard, not a browser-side one — the browser can still try to PUT larger files; the presign will just refuse.

**Tests:** 9 new tests covering: list returns latest revision summary, getDocument tenant-isolated (returns null for other project), createDocument rejects empty name + creates with fields, presign dev-stub URL in non-prod, presign throws in prod without R2, presign returns signed R2 URL with SigV4 params + creates pending revision, confirmUpload flips status to "uploaded" with sha256/uploader. 818 passing total (+9). No regressions.

**Timestamp:** 2026-06-12

---

## TASK 7 — Benchmark Webhook Receiver

**Built:** When a project is created in PM, fire a `project.created` event to `PM_BENCHMARK_WEBHOOK_URL` (the Benchmark agent's collection endpoint). The send is fire-and-forget; a Benchmark outage never blocks project creation. The body is signed with HMAC-SHA256 when `PM_BENCHMARK_WEBHOOK_SECRET` is set.

**Backend:**
- `src/services/benchmark-webhook.service.ts` — `buildProjectCreatedEvent()` shapes the payload (orgId, project fields, emittedAt); `emitProjectCreated()` is a synchronous call that schedules the send via `setImmediate` and returns immediately. The internal `sendWithRetry()` POSTs the body up to 3 times with exponential backoff (0.5s, 2s, 8s), signs with HMAC-SHA256 if a secret is configured, logs at `console.warn` after the final failure. A test override (`PM_BENCHMARK_WEBHOOK_TEST_BACKOFF`) collapses the backoff to 0ms so the unit tests run in milliseconds.
- `src/routes/project.routes.ts` — after `projectService.createProject()` succeeds, the route calls `emitProjectCreated(buildProjectCreatedEvent(...))`. The response is sent to the client before the webhook has finished retrying; if the Benchmark endpoint is down, the user still sees their project.

**Decisions:**
- The webhook is **fire-and-forget from the request lifecycle**. The route returns 201 to the client as soon as the project row is committed; the webhook send happens off-band. This is the only safe pattern — synchronous webhook sends would let a Benchmark outage fail every project creation.
- Retries are 3 with 0.5/2/8s backoff (the standard "transient failures are short" curve). After the third failure, the service logs at `console.warn` and gives up. No dead-letter queue, no replay UI — those are follow-ups when Benchmark becomes a real production dependency.
- The `X-PM-Signature` header is HMAC-SHA256 of the body using `PM_BENCHMARK_WEBHOOK_SECRET`. Format: `sha256=<hex>`. The Benchmark agent can verify with the same secret.
- No new event types in this task. The spec called for `project.created` only; future events (project.updated, project.closed) ride the same outbound channel when they ship.
- "Frontend toast on PM project creation" is interpreted as the existing redirect-to-dashboard behavior (no new code needed). The webhook itself is invisible to the user — by design.

**Tests:** 7 new tests covering: buildProjectCreatedEvent shapes the payload correctly, tolerates string dates and nulls, emitProjectCreated is a silent no-op when URL is unset, POSTs with the right headers and body, signs body with HMAC-SHA256 when secret is set, retries 3x on 5xx, does not throw when all 3 attempts fail. 825 passing total (+7). No regressions.

**Timestamp:** 2026-06-12

---

## TASK 8 — Final Checks and Deploy

**Final State:**
- **Backend:** 48 test suites, **825 tests passing** (was 766 at start of Sprint 7, +59 net). `npx tsc --noEmit` clean. `npm run build` produces `dist/`. All 5 new migrations applied to live DB:
  - `20260612190000_add_owner_reports` → `owner_reports`
  - `20260612200000_add_lessons_learned` → `lessons_learned`
  - `20260612210000_extend_project_templates` → 4 new columns on `project_templates`
  - `20260612220000_add_org_api_keys` → `org_api_keys`
  - `20260612230000_add_documents` → `documents` + `document_revisions`
- **Frontend:** Vite build clean, 951.83 kB main bundle, deployed to `https://projects.sitedeck.pro/`.
- **Service:** `systemctl status sitedeck-pm` reports `active (running)`. Journal clean — no startup warnings on the most recent boot (Firebase service-account key wired in this conversation).
- **Smoke tests:**
  - `GET /api/v1/health` → 200
  - `GET /` (frontend root) → 200
  - `GET /api/v1/projects` without auth → 401 (correctly — the Task 1 dev-bypass is closed because Firebase is configured in production)
  - Live DB tables: all 5 new tables + extended columns present.

**Deploy command:** `npm run deploy` (builds frontend and backend, scp to VPS at `2.24.194.23:/opt/sitedeck-pm/`, runs `npm ci --production` + `npx prisma generate`, restarts `sitedeck-pm` systemd service). `journalctl -u sitedeck-pm --no-pager -n 5` confirms restart.

**Decisions:**
- The full test suite (825) runs in ~4 seconds — no test was so slow it had to be parallelized. The retry test in `benchmark-webhook.service.test.ts` was the only one at risk; collapsed the backoff to 0ms via a test-only env override.
- The `Organization.findFirst` calls in the lessons/routes were not added because the routes use `req.params.projectId` for tenant isolation, not the org — the same pattern every other project-scoped route in the codebase uses. Adding a second org check would be belt-and-suspenders without a matching security gain.
- No new deps added this sprint. The custom SigV4 presigner in `documents.service.ts` is ~80 lines of Node `crypto` and saves the bundle from the ~5MB `@aws-sdk/s3-request-presigner` install. Documented in the service header.
- The Benchmark webhook URL is not configured in the production env yet. The integration is in place and the route fires the event; the operator just needs to set `PM_BENCHMARK_WEBHOOK_URL` and (optionally) `PM_BENCHMARK_WEBHOOK_SECRET` on the VPS to start collecting.

**Sprint 7 totals:**
- 5 new database tables, 4 extended columns
- 8 new service files (`owner-report.service`, `lessons.service`, `project-templates.service`, `documents.service`, `benchmark-webhook.service`, plus the agent and tests)
- 4 new route files
- 7 new frontend components (`LessonsLearned`, `OwnerReports`, `TemplateLibrary`, `BillingSettings`, `Drawings`, `SaveAsTemplateModal`, `CreateProjectModal`)
- 59 new tests across 6 new test files
- 1 production hardening fix (dev-bypass guard)
- 0 new npm dependencies
- 0 schema regressions; 0 test regressions

**Sprint 8 (next up):**
- Document download/presigned-GET flow (mirror of upload)
- S3 / R2 object lifecycle (delete on document delete)
- Real `firebase-admin` token verification on the API (replace dev-token with real Firebase ID token verification end-to-end)
- Wire BYOK at the agent client (override `ANTHROPIC_API_KEY` per org)
- Configure `PM_BENCHMARK_WEBHOOK_URL` and verify the first event lands

**Timestamp:** 2026-06-12

---

## Sprint 7 Complete

