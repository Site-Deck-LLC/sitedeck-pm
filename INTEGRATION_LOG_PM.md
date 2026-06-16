# SiteDeck PM — Integration Log
Last updated: Sprint 15 (2026-06-16)
Maintainer: Update this file at the END of every sprint that touches any integration point.

---

## Shared Service Token (all three products)
```
PRO_SERVICE_TOKEN=9936BD06-C760-472C-AC36-FCA33F7806FA
PM_SERVICE_TOKEN=9936BD06-C760-472C-AC36-FCA33F7806FA
```
(Same token, different env var names across products)
Header name: `X-Service-Token`

Must be in `/opt/sitedeck-pm/.env`:
```
PRO_SERVICE_TOKEN=9936BD06-C760-472C-AC36-FCA33F7806FA
FIREBASE_FUNCTIONS_URL=https://us-central1-site-deck.cloudfunctions.net
PM_SERVICE_TOKEN=9936BD06-C760-472C-AC36-FCA33F7806FA
```
Status: ⚠️ NOT YET ADDED — blocked in Pro Integration Sprint 1 (VPS SSH unavailable from Pro session)

---

## Shared Webhook Secret (PM ↔ Benchmark)
```
PM_BENCHMARK_WEBHOOK_URL=https://benchmark.sitedeck.pro/api/v1/webhooks/pm
PM_BENCHMARK_WEBHOOK_SECRET=16ae14df...  (full value in /opt/sitedeck-pm/.env)
```
PM sends header: `x-sitedeck-signature` AND `X-PM-Signature` (both, same HMAC value)
Status: ✅ LIVE (Sprint 8) — verified end-to-end with smoke test

---

## Firebase Project
Project ID: `site-deck`
Shared across PM, Benchmark, and Pro.
PM frontend config: `VITE_FIREBASE_*` in frontend build
PM backend: Firebase Admin SDK for auth verification and user management

---

## Endpoints PM Exposes (inbound)

### POST /api/v1/webhooks/pro  ← MISSING — NOT BUILT
Receives events from SiteDeck Pro Firebase Functions.
Auth: `X-Service-Token` header against `PRO_SERVICE_TOKEN`
Status: ❌ NOT BUILT (blocked in Pro Integration Sprint 1 — Tasks 12 and 13 incomplete)

Events that should be handled:
| Event | Action | Status |
|---|---|---|
| `pro.work.complete` | Update ScheduleActivity status, fire Benchmark queue | ❌ NOT BUILT |
| `pro.rework.complete` | Fire Benchmark re-inspection | ❌ NOT BUILT |
| `pro.daily_report_submitted` | Update activity % complete, flag schedule risk if delays | ❌ NOT BUILT |
| `pro.safety_incident` | Safety tile red, compound risk detection, notify PM | ❌ NOT BUILT |

File to create: `src/services/proIntegration.service.ts`
Route to create: `src/routes/pro-webhook.routes.ts` → `POST /api/v1/webhooks/pro`
Register in: `src/routes/index.ts`

---

## Endpoints PM Calls (outbound)

### → SiteDeck Benchmark
URL: `https://benchmark.sitedeck.pro/api/v1/webhooks/pm`
Auth: HMAC-SHA256 `x-sitedeck-signature`
Status: ✅ LIVE (Sprint 8)
Service: `src/services/benchmark-webhook.service.ts`

Events PM fires to Benchmark:
| Event | Trigger | Status |
|---|---|---|
| `project.created` | New project created in PM | ✅ LIVE Sprint 8 |
| `drawing.ifc_released` | Document released as IFC | ✅ LIVE Sprint 9 |
| `pm.activity.ready_for_inspection` | ScheduleActivity marked work_complete | ✅ LIVE Sprint 15 |
| `pm.rework.complete` | Rework task completed from Pro | ⚠️ NOT BUILT (depends on Pro webhook receiver) |
| `project.activity.linked` | PM links an activity to a Benchmark DFOW | ✅ LIVE Sprint 15 |

> **Sprint 15 addition:** `project.activity.linked` sends `{ pmProjectId, pmActivityId, dfowName }` to Benchmark. Benchmark finds/creates the DFOW and stores `pmActivityId` on it.

### → SiteDeck Pro (Firebase Function)
URL: `https://us-central1-site-deck.cloudfunctions.net/createTask`
Auth: `X-Service-Token: 9936BD06-C760-472C-AC36-FCA33F7806FA`
Status: ❌ NOT BUILT — "Assign to Field" button (Tasks 13 from Pro Integration Sprint 1)

PM needs:
```
FIREBASE_FUNCTIONS_URL=https://us-central1-site-deck.cloudfunctions.net
PM_SERVICE_TOKEN=9936BD06-C760-472C-AC36-FCA33F7806FA
```

---

## Endpoints PM Receives (inbound from Benchmark)

### POST /api/v1/webhooks/benchmark  ← ✅ LIVE (Sprint 13)
URL: `https://projects.sitedeck.pro/api/v1/webhooks/benchmark`
Auth: HMAC-SHA256 `x-benchmark-signature`
Handler: `src/routes/benchmark-webhook.routes.ts` → `src/services/benchmark-inbound.service.ts`

Events Benchmark fires that PM handles:
| Event | Trigger | Payload highlights | Status |
|---|---|---|---|
| `benchmark.inspection.completed` | Inspection locked or returned | `{ status: "passed" \| "failed", dfowId, unitReference, completedBy }` | ✅ Sprint 13 |
| `benchmark.ncr.opened` | NCR created | `{ ncrId, internalNumber, severity, dfowId }` | ✅ Sprint 13 |
| `benchmark.ncr.closed` | NCR closed | `{ ncrId, internalNumber, closedBy }` | ✅ Sprint 13 |
| `benchmark.hold_point.released` | Hold point released | `{ holdPointId, dfowId, releasedBy }` | ✅ Sprint 13 |
| `benchmark.daily_report.posted` | Daily QC report signed | `{ reportId, reportDate, inspectionsCount, ncrsOpenedCount }` | ✅ Sprint 13 |
| `benchmark.qcp.exported` | QCP PDF exported | `{ versionId, versionNumber, dfowCount }` | ✅ Sprint 13 |
| `benchmark.rework.required` | NCR closed with `resolution: requires_rework` | `{ ncrId, ncrNumber, dfowId, unitReference, description }` | ⚠️ NOT BUILT — maps to `ncr.opened`/`ncr.closed` today |

> **Note:** The old separate `benchmark.inspection.passed` and `benchmark.inspection.failed` events were replaced by the unified `benchmark.inspection.completed` event.

---

## PM Registry (Supabase)
PM's own project registry that Benchmark reads.
This is a Supabase Postgres instance (separate from PM's main VPS Postgres).
Benchmark reads it via `PM_DATABASE_URL` in Benchmark's .env.
Status: ✅ LIVE — Benchmark health shows `pmRegistry: connected`
Note: PM itself runs on VPS Postgres at `/opt/sitedeck-pm/`. Supabase is only the registry layer.

---

## Email (outbound)
Provider: Postfix on VPS (self-hosted)
From address: `helper@modestintent.com`
Status: ✅ LIVE (Sprint 11 — DKIM, SPF, DMARC configured)
Used for: welcome emails, RFI alerts, owner reports, NCR alerts, reset passwords
SendGrid: configured in PM as fallback (`SENDGRID_API_KEY` in .env); Benchmark uses Postfix only

---

## Firebase Auth (PM)
PM uses Firebase Auth for user authentication.
Backend verifies Firebase ID tokens via firebase-admin SDK.
Status: ✅ LIVE
Push notifications: FCM via `push-notification.service.ts`
FCM token storage: `FcmToken` model in PM Postgres

---

## Account Deletion (App Store Guideline 5.1.1)
Benchmark handles this via `DELETE /api/v1/account`.
Status: ✅ LIVE in Benchmark (Sprint 15)
PM implication: If PM allows account deletion, it should call Benchmark's endpoint or fire an `auth.user.deleted` event so Benchmark can clean up.

---

## ops.sitedeck.pro
Ops console shares the same PM backend and frontend bundle.
Hostname-driven variant: `isOps: boolean` in `frontend/src/branding.ts`
DNS: ⚠️ `ops.sitedeck.pro` A record NOT yet confirmed in Cloudflare (Sprint 12 follow-up)
Traefik config: `scripts/traefik-ops.yml` — must be copied to `/var/www/groundcheck-infra/traefik/dynamic/` manually

---

## Known Users
| Name | Email | Firebase UID | PM Role | Status |
|---|---|---|---|---|
| Jose Vasquez | vasquezj@orionfsl.com | YUcAjSkVx6aCvzxBpG9NzIciVFG2 | project_manager | Created in Pro, NOT yet added to PM project/org |

---

## Missing Dependencies (unresolved as of Sprint 13)

| # | Gap | Blocks | Owned By | Target Sprint |
|---|---|---|---|---|
| 1 | `PRO_SERVICE_TOKEN` not in `/opt/sitedeck-pm/.env` | Pro → PM auth | PM | PM Sprint 14 |
| 2 | `FIREBASE_FUNCTIONS_URL` not in `/opt/sitedeck-pm/.env` | PM → Pro createTask call | PM | PM Sprint 14 |
| 3 | `POST /api/v1/webhooks/pro` receiver not built | Full Pro→PM loop | PM | PM Sprint 14 |
| 4 | "Assign to Field" button not built | PM→Pro task assignment | PM | PM Sprint 14 |
| 5 | `ops.sitedeck.pro` DNS A record not in Cloudflare | Ops console unreachable | PM infra | PM Sprint 14 |
| 6 | Jose not added to a PM project/org | Jose can't use PM | PM | PM Sprint 14 |
| 7 | Notification preferences `shouldDeliver` not wired into email/push call sites | Preferences silently ignored | PM | PM Sprint 14 |
| 8 | Daily-digest worker not built (`digestEnabled` persisted but no cron) | Digest email | PM | PM Sprint 14 |

**Resolved in Sprint 13:**
- ✅ PM `/webhooks/benchmark` receiver built and deployed
- ✅ `benchmark.ncr.opened` → creates `ReworkTask`
- ✅ `benchmark.ncr.closed` → resolves `ReworkTask`
- ✅ `benchmark.inspection.completed` (failed) → creates `ReworkTask`
- ✅ `benchmark.inspection.completed` (passed) → logs only
- ✅ `benchmark.hold_point.released` / `daily_report.posted` / `qcp.exported` → logged
- ✅ HMAC signature verification with `PM_BENCHMARK_WEBHOOK_SECRET`
- ✅ Send-to-Benchmark button (Gantt + Table views)
- ✅ Benchmark Activity Feed on Dashboard

**Resolved in Sprint 15 (prior):**
- ✅ `pm.activity.ready_for_inspection` → Benchmark confirmed end-to-end
- ✅ `project.activity.linked` → Benchmark confirmed end-to-end
- ✅ PRO_SERVICE_TOKEN now verified on Benchmark's `/webhooks/pro`

---

## Do Not Break (regression-protected integrations)
- PM → Benchmark webhook HMAC (`PM_BENCHMARK_WEBHOOK_SECRET` and `WEBHOOK_SECRET` must always match)
- `project.created` webhook fires on every new PM project → creates Benchmark project automatically
- `drawing.ifc_released` webhook fires on IFC release → Benchmark notification
- Firebase Auth — PM backend verifies real tokens in production
- Postfix email via `helper@modestintent.com` — DKIM/SPF/DMARC configured; changing the mail server requires DNS updates
- PM Supabase registry (`PM_DATABASE_URL`) — Benchmark reads this; never change the schema of registry tables without updating Benchmark's `project-registry.service.ts`
