# Sprint 9 Log

## Summary
**Date:** 2026-06-13/14
**Status:** ✅ All 10 tasks complete and deployed

**Final test count:** 959 tests passing across 56 test suites
**TypeScript:** Clean (`tsc --noEmit` passes)
**Backend build:** Clean (`npm run build`)
**Frontend build:** Clean (`npm run build` in /frontend, PWA shell generated)
**Deploy:** ✅ VPS at 2.24.194.23, service active

---

## Task 1: IFC Drawing Propagation ✅
- **Schema:** Added DrawingAuditLog, DrawingRedline models. Added ifcReleasedAt, ifcReleasedBy, currentRevisionId fields to Document
- **Service:** `releaseAsIfc()` in documents.service.ts — idempotent, logs to audit, fires Benchmark webhook, notifies project members via email + push
- **Routes:** `POST /:id/release-ifc`, `GET /ifc` (lists IFC drawings with `summarizeIfc` helper), `GET /package` (drawing package manifest with discipline/title/revision/IFC date)
- **Standalone degradation:** Benchmark webhook failures are best-effort; Push/email degrade gracefully when keys missing
- **2026-06-14 — Tests passed, deployed to VPS**

## Task 2: Field Redline Workflow ✅
- **Schema:** DrawingRedline model with status flow: pending → reviewed/escalated_to_rfi/accepted_field_decision/incorporated
- **Service:** `submitRedline()`, `reviewRedline()` (handles escalate_rfi/field_decision/incorporate decisions, creates draft RFIs, logs to unified change log)
- **Routes:** `POST /redlines`, `GET /redlines`, `GET /redlines/:id`, `PATCH /redlines/:id/review`
- **Stub:** `asBuiltExportStub()` placeholder for future export
- **2026-06-14 — Tests passed, deployed to VPS**

## Task 3: Push Notifications (FCM) ✅
- **Schema:** FcmToken model with unique (userId, platform) for upsert
- **Service:** `saveFcmToken()` (upsert), `removeFcmToken()`, `sendPushNotification()` (lazy-loads firebase-admin, removes stale tokens on 404), `sendToProjectMembers()`
- **Routes:** `POST /users/fcm-token`, `DELETE /users/fcm-token/:platform`
- **Standalone degradation:** Never throws; no-op if FCM key missing
- **2026-06-14 — Tests passed, deployed to VPS**

## Task 4: Email Delivery (SendGrid) ✅
- **Service:** `email.service.ts` with graceful fallback to console.log when SENDGRID_API_KEY missing
- **Templates:** `sendRfiOverdueAlert()`, `sendOwnerReportReady()`, `sendDrawingIFCRelease()` (BCC), `sendWelcomeEmail()`, `sendNCRAlert()`
- **Lazy load:** `@sendgrid/mail` lazy-loaded so the bundle stays small
- **Standalone degradation:** Never throws; logs and continues
- **2026-06-14 — Tests passed, deployed to VPS**

## Task 5: PWA Shell ✅
- **vite-plugin-pwa** added; SW autoUpdate mode, manifest generated inline
- **Offline page:** `public/offline.html` with SiteDeck brand styling; service worker falls back to it for navigations
- **Install prompt:** `InstallPrompt` component shows in-app banner on `beforeinstallprompt`; iOS Safari share hint included
- **Network banner:** `NetworkBanner` surfaces offline state so the field crew sees offline status immediately
- **PWA icons:** 192px, 512px, 512-maskable generated via `scripts/generate-pwa-icons.js` (navy + orange brand bands)
- **Index.html:** PWA meta tags (theme-color, apple-mobile-web-app-capable, apple-touch-icon)
- **API runtime caching:** Intentionally NOT enabled — the dashboard, RFI list, and field data are time-sensitive and a stale cache during a site walk is worse than a clean offline page
- **2026-06-14 — Build clean, deployed to VPS, all PWA assets serving 200 OK**

## Task 6: Team Management Foundation ✅
- **Schema:** Organization, OrganizationMember, ProjectMember models
- **Service:** `team.service.ts` — `getProjectTeam()`, `addProjectMember()` (validates, soft-reactivates inactive, sends welcome email), `removeProjectMember()` (soft delete), `updateMemberRole()`, `getOrganization()`, `createOrganization()`
- **Helper:** `emailToUserId()` derives stable Firebase UID placeholder
- **Routes:** `/projects/:projectId/team/*`, `/organizations/:orgId`, `POST /organizations`
- **2026-06-14 — Tests passed, deployed to VPS**

## Task 7: Compound Risk Tile on Dashboard ✅
- **Service:** `risk-intelligence.service.ts` — `detectCompoundRisksForDashboard()`, `getRiskIntelligenceSnapshot()`, `tryRefreshRiskIntelligence()` with 5/day rate limit via api_usage_log table
- **Pattern library:** 7 compound patterns (schedule+cost, overdue RFIs+schedule/cost, change orders stacking, triple-threat safety+cost+schedule, materials+schedule, risk+schedule/cost)
- **Routes:** `GET /risk-intelligence`, `POST /risk-intelligence/refresh` (429 on rate limit)
- **Refactor:** morning-brief agent now uses the same shared detector; both surfaces show identical cascade list
- **Tests:** 24/24 morning-brief tests passing
- **2026-06-14 — Tests passed, deployed to VPS**

## Task 8: Drawing Repository Enhancements ✅
- **Status simplification:** Status field is now `current | superseded | void` (already in place from Sprint 7)
- **Drawing package endpoint:** `GET /documents/package` returns manifest with discipline/title/revision/IFC date for all IFC drawings (added in Task 1)
- **IFC listing:** `GET /documents/ifc` filters and summarizes IFC-released drawings
- **2026-06-14 — Covered by Task 1; deployed to VPS**

## Task 9: Subcontract Schedule Integration ✅
- **Schema:** SubcontractMilestone model with back-relation to Subcontract; FK migration `20260613210000_subcontract_milestone_fk` applied to live DB
- **Service:** `subcontract-milestones.service.ts` — `listMilestonesForSubcontract()`, `listMilestonesForProject()`, `createMilestone()`, `updateMilestone()` (auto-sets actualDate on completion), `deleteMilestone()`, `syncFromActivity()` (one-way sync from schedule activity; preserves completed milestones)
- **Routes:** `/projects/:projectId/subcontract-milestones` (GET/POST/PATCH/DELETE) with role gates (OWNER_ADMIN, PM, SUPERINTENDENT)
- **Error classes:** `SubcontractMilestoneNotFoundError`, `SubcontractMilestoneValidationError`
- **Unified change log:** every mutation writes to `unified_change_log` with `module: 'subcontracts'`
- **Tests:** 14/14 service tests passing
- **2026-06-14 — Tests passed, deployed to VPS**

## Task 10: Final Checks and Deploy ✅
- **Type check:** `tsc --noEmit` clean
- **Test suite:** 959 tests passing across 56 test suites
- **Backend build:** `npm run build` clean
- **Frontend build:** `npm run build` clean (PWA shell + manifest + SW generated)
- **Deploy:** `npm run deploy` — backend uploaded, prisma regenerated on VPS, service restarted, status verified
- **Smoke tests (live):**
  - `GET /api/v1/health` → 200
  - `GET /offline.html` → 200
  - `GET /manifest.webmanifest` → 200
  - `GET /sw.js` → 200
  - `GET /icons/icon-192.png` → 200
  - `GET /icons/icon-512.png` → 200
  - `GET /api/v1/projects/test/subcontract-milestones` → 401 (auth required, correct)
  - `GET /api/v1/projects/test/risk-intelligence` → 401 (auth required, correct)
  - `GET /api/v1/projects/test/team` → 401 (auth required, correct)
  - `GET /api/v1/projects/test/redlines` → 401 (auth required, correct)
- **Service status:** Active (running) since 2026-06-14 01:00:34 UTC

---

## Architectural Compliance
- ✅ IFC drawings are the only drawings that propagate (ARCHITECTURAL BOUNDARY)
- ✅ All Benchmark/Pro integrations degrade gracefully when unavailable (STANDALONE RULE)
- ✅ No Later features built
- ✅ Stack unchanged (TS strict, Prisma, Postgres, Firebase, Vite, React, Stripe)
- ✅ Webhook handlers are idempotent
- ✅ Role names are canonical (owner_admin, project_manager, superintendent, etc.)
- ✅ All new services and routes use the existing asyncHandler + requireAuth + requireRole pattern
- ✅ All new Prisma models have proper indexes

## Regressions
None. 959/959 tests pass.

## Files Created/Modified (Sprint 9)
**Schema (prisma/schema.prisma):**
- DrawingAuditLog, DrawingRedline, FcmToken, Organization, OrganizationMember, ProjectMember, SubcontractMilestone models
- Document: currentRevisionId, ifcReleasedAt, ifcReleasedBy fields

**Migrations (prisma/migrations/):**
- 20260613200000_sprint9_schema (Sprint 9 base)
- 20260613210000_subcontract_milestone_fk

**Backend services (src/services/):**
- documents.service.ts (updated)
- redline.service.ts (new)
- push-notification.service.ts (new)
- email.service.ts (new)
- team.service.ts (new)
- risk-intelligence.service.ts (new)
- subcontract-milestones.service.ts (new)
- agents/morning-brief.agent.ts (refactored to share detector)

**Backend routes (src/routes/):**
- documents.routes.ts (updated)
- redlines.routes.ts (new)
- push.routes.ts (new)
- team.routes.ts (new)
- risk-intelligence.routes.ts (new)
- subcontract-milestones.routes.ts (new)
- index.ts (updated)

**Frontend (frontend/):**
- vite.config.ts (PWA plugin)
- index.html (PWA meta tags)
- public/offline.html (new)
- public/icons/*.png (PWA icons)
- src/components/InstallPrompt.tsx (new)
- src/components/NetworkBanner.tsx (new)
- src/App.tsx (PWA components wired in)

**Scripts (scripts/):**
- generate-pwa-icons.js (new)

---

**Sprint 9 is COMPLETE and DEPLOYED.**
