# CLAUDE.md — SiteDeck PM
# Read this file at the start of every SiteDeck PM development session.
# Do not proceed without reading it fully.

---

## Product Identity

**Product:** SiteDeck PM
**Owner:** Site Deck LLC (Texas)
**Portfolio:** Second product after SiteDeck Pro — commands SiteDeck Pro
**Purpose:** Project management, scheduling, cost tracking, procurement, and communications for small EPC contractors managing utility-scale construction projects (BESS, substation, transmission, solar)
**Target customer:** EPC contractors, $1M–$50M project range, 5–100 person teams
**PMBOK alignment:** 6th Edition Knowledge Areas (10)

---

## Portfolio Context

SiteDeck PM is not a standalone tool. It is the command layer of the SiteDeck portfolio.

```
SiteDeck PM (project registry, schedule, cost, procurement, comms)
    ↕ REST API + webhooks
SiteDeck Pro (field operations, crew, safety, daily reporting, task execution)
```

**PM is the source of truth.** Postgres owned by SiteDeck PM is the project registry. SiteDeck Pro reads project metadata from PM's Postgres. One project, two tools, continuous data flow.

**SiteDeck QA** is a future product (not yet in build). Do not scope QA features into PM.

---

## Tech Stack — LOCKED

| Layer | Technology | Notes |
|-------|-----------|-------|
| Project registry DB | Postgres | Owned by SiteDeck PM. Source of truth for all products. |
| Auth | Firebase Auth | Shared across all Site Deck LLC products. Single login. |
| Offline resilience | Firestore | Replication of project metadata for mobile offline access |
| Pro integration | REST API + webhooks | Loose coupling. Neither product depends on the other being online. |
| Frontend (web) | React | PM dashboard — desktop-optimized for PM/cost views |
| Frontend (mobile) | React Native / Expo | Mobile-optimized for superintendent-facing views |
| Hosting | Vercel | |
| Payments | Stripe | Shared with SiteDeck Pro |

**Do not suggest changes to this stack.** Architecture decisions are locked.

---

## Visual Design System — LOCKED

Match SiteDeck Pro visual language exactly.

| Token | Value | Use |
|-------|-------|-----|
| Primary dark | `#1B2A4A` | Sidebar, headers, navy elements |
| Primary action | `#E8720C` | Buttons, CTAs, active states, section accents |
| Success | `#22C55E` | On track, complete, green status |
| Warning | `#F59E0B` | At risk, amber status |
| Critical | `#EF4444` | Late, overrun, red status |
| Complete | `#9CA3AF` | Gray, closed/archived states |
| Content background | `#FFFFFF` | Main content areas |
| Page background | `#F9FAFB` | App background |

**Status colors are semantic and must be consistent.** Green = healthy. Amber = attention needed. Red = action required. Gray = closed/complete.

---

## Roles and Permissions

Firebase Auth is shared. Role assignment controls access across both products.

| Role | SiteDeck Pro | SiteDeck PM |
|------|-------------|-------------|
| Owner / Admin | Full access | Full access |
| Project Manager | Read + dashboard tiles from Pro data | Full access |
| Superintendent | Full field access | Full Gantt read-only + material/RFI/submittal status (pushed from PM) + schedule change request workflow |
| Supervisor / Foreman | Full field access | None — data flows up via webhook |
| Field Crew | Tasks, timesheets, JHA, safety | None |
| Subcontractor PM | Own Pro instance | Scoped: own subcontract, schedule window, submittals only |
| Subcontractor Super | Own Pro instance | None — feeds up via webhook |
| Owner's Rep | None | V1: Dashboard (no cost) + issue tracker (owner items) + RFI status |
| Accountant / AP | None | None V1 — exported reports only |

**Critical rule:** Superintendents never log into SiteDeck PM directly. PM pushes relevant status back to Pro where the super already works.

---

## Data Architecture

### Project Structure Selection (per project, not per company)
- Admin selects at project setup: **WBS** or **Cost Codes**
- Selection cannot change after project data is entered
- Underlying data model is identical — labels and hierarchy render based on selection
- **WBS/Cost Code crosswalk** — GC and sub can use different structures; admin creates mapping table at project setup; sub transactions auto-roll up to GC structure

### Postgres Schema Principles
- `projects` table is the master registry — shared with SiteDeck Pro
- All PM data belongs to a `project_id`
- WBS elements and cost codes share the same `work_breakdown_items` table with a `structure_type` enum
- `webhooks_log` table tracks all inbound and outbound webhook events with status and retry count

### Firestore Replication
- Project metadata replicated to Firestore for Pro offline access
- Replicated fields: project_id, project_name, status, schedule start/end, active milestones, superintendent assignments
- PM is authoritative — Firestore is a read-only projection

---

## Integration Contracts — PM to Pro

All integrations are event-driven webhooks. PM fires events; Pro consumes them. Pro fires events; PM consumes them. Neither polls the other.

### PM → Pro (outbound)
| Event | Payload | Pro Action |
|-------|---------|------------|
| `activity.ready` | project_id, activity_id, name, description, start_date, crew_size, materials_required | Creates work package assignment for Superintendent |
| `material.needed` | project_id, po_id, material_name, quantity, needed_by_date, activity_id | Notifies Superintendent to initiate order |
| `rfi.status_updated` | project_id, rfi_number, status, response_text, hold_on_activity_id | Updates RFI status visible on Superintendent's activity |
| `submittal.status_updated` | project_id, submittal_id, approval_status, hold_on_activity_id | Updates submittal constraint on Superintendent's activity |
| `schedule_change.decided` | project_id, request_id, decision (approved/modified/rejected), notes, new_dates | Notifies Superintendent of PM decision |

### Pro → PM (inbound)
| Event | Payload | PM Action |
|-------|---------|-----------|
| `task.completed` | project_id, activity_id, completed_by, completed_at, notes | Marks schedule activity complete, updates earned value |
| `material.received` | project_id, po_id, line_items_received, receiver_id, received_at, discrepancies | Updates delivery log against PO, triggers 3-way match check |
| `labor.hours_logged` | project_id, crew_member_id, hours, date, cost_code | Updates incurred labor cost in cost module |
| `equipment.usage_logged` | project_id, equipment_id, hours_on_site, date | Updates equipment incurred cost |
| `safety.incident` | project_id, incident_type, severity, recordable (bool) | If recordable or above threshold: auto-creates risk item |
| `field.issue_logged` | project_id, description, reporter_id, photos[], activity_id | Creates draft RFI in PM for PM review |
| `schedule.change_requested` | project_id, activity_id, reason_code, proposed_dates, impact_description | Creates change request in PM schedule module |

---

## Module Specifications

### Morning Dashboard (hero feature)
Six tiles. All green = healthy project. Any red = morning priority.

```
[ Safety ]     [ Schedule ]    [ Cost ]
[ Materials ]  [ Client Issues ] [ Field Issues ]
```

- Safety tile: data from Pro (0 incidents, 0 open observations)
- Schedule tile: today's activities on track, no critical path slippage
- Cost tile: CPI ≥ 1.0, no overrun flags
- Materials tile: 48-hour forward look, all required materials received and allocated
- Client Issues tile: 0 open owner-raised items past due
- Field Issues tile: 0 open field-raised items from Pro

Each tile is a drill-down. Tapping a green tile shows the detail. Tapping a red tile shows the problem and who owns it.

---

### Schedule Management
- Input: P6 XER import, MS Project MPP/XML import, Excel Gantt import, native Gantt builder
- Display: field-readable Gantt, color-coded by status, critical path highlighted, milestone flags
- Baseline: locked at kickoff, variance tracked automatically, re-baseline requires PM approval and justification
- Master schedule only in V1 (no sub-schedule hierarchy)
- Pro integration: `activity.ready` fires when PM marks activity ready; `task.completed` received when Pro marks complete
- Schedule change request workflow: Super submits in Pro → PM receives in schedule module → critical path impact auto-calculated → PM approves/modifies/rejects → decision pushed back to Pro

**Reason codes for schedule change requests:**
`weather_delay | material_delay | crew_availability | scope_change | equipment | access_permit | other`

---

### Cost Management
- WBS or cost code organizing structure (selected at project setup — see Data Architecture)
- Budget baseline by WBS element or cost code
- Committed costs: POs issued, subcontracts executed
- Incurred costs: invoices approved, materials received, labor from Pro webhook, equipment from Pro webhook
- EVM: SPI, CPI, EAC, SV, CV — calculated automatically
- SPI < 0.9 or CPI < 0.9 → amber flag. Below 0.8 → red flag on morning dashboard
- Variance threshold flags: configurable per line item
- V1 export: CSV and PDF for controller (no AP login, no accounting integration)

---

### Scope Management
- WBS builder: shared tree with cost module. One tree, used by both.
- Scope statement: rich text per project, version-controlled
- Change order log: CO number, date, description, status, dollar value, schedule impact, approver
- Approved CO: auto-adjusts cost baseline + flags affected Gantt activities
- PDF export: clean formatted CO for owner attachment to their contract system
- GC-to-owner change process stays external — SiteDeck PM documents, does not own the owner's workflow

---

### Integration Management
- Project setup wizard: initializes all downstream modules, creates Postgres project record, replicates to Firestore, sends team invitations
- Unified change log: all baseline changes across all modules, timestamped and attributed
- Issue tracker: two lanes (Client Issues, Field Issues)
  - Voice-to-issue: AI transcription → structured record (type, source, description, activity link, assignee, priority)
  - Self-memo tool on PM iOS: quick capture → logs to PM issue tracker (component reuse from Pro field note UI)
- Project closeout checklist

---

### Procurement Management — Beachhead Feature
Materials lifecycle (schedule-driven):
```
Schedule activity created
→ System generates material requirement
→ Superintendent notified in Pro via webhook
→ PO created in PM (linked to WBS/cost code and activity)
→ Material ordered (status update)
→ Superintendent logs receipt in Pro
→ Webhook fires → PM delivery log updated
→ Invoice received → 3-way match (PO + receipt + invoice)
→ Invoice approved → incurred cost updated in cost module
→ Invoice paid → cost line closed
```

3-way match: PO amount + quantities received + invoice amount must align. Mismatch flags invoice before approval.

Materials tile logic:
- Green: all materials for next 48 hours received and allocated
- Amber: partial — something short but not critical path
- Red: missing material on critical path activity starting within 48 hours

Subcontract management: subcontract log, schedule of values, progress billing, retention tracking.

---

### Communications Management
- RFI log: auto-numbered, full lifecycle (draft → submitted → under review → answered → closed)
- RFI PDF export: formatted for attachment to Procore/e-Builder/email
- Submittal register: linked as Gantt predecessor constraints
- Open submittal = activity constraint — late submittal auto-flags linked activity
- Both RFI status and submittal status pushed to Pro for Superintendent visibility
- Field-to-PM RFI path: field issue in Pro → webhook → draft RFI in PM → PM formalizes

---

### Risk Management
- Risk register: description, category, probability (L/M/H), impact (L/M/H), auto-score, mitigation plan, owner, status
- 3×3 matrix: Low/Low = low, High/High = high. Color-coded green/amber/red.
- High-score risks surface on morning dashboard
- Risk linked to schedule activity or cost line item
- Pro safety incident (recordable or above threshold) → auto-creates risk item in PM

---

### Resource Management
- Labor: managed in Pro, cost data received via webhook only
- Equipment: managed by Superintendent in Pro (registry, daily usage, idle flags)
  - Equipment cost feeds PM cost module via webhook
  - Equipment schedule tie: idle equipment on critical path activity = amber flag on dashboard
- Subcontractor schedule windows in PM Gantt; cost in procurement module

---

## V1 vs Later Reference

### V1 — Build
- Schedule management (full)
- Cost management with EVM (full)
- Scope management with change order log (full)
- Integration management: setup wizard, morning dashboard, issue tracker, voice-to-issue, self-memo, closeout (full)
- Procurement management: full materials lifecycle, PO management, 3-way match, subcontract management (full)
- Communications: RFI log, submittal register, Pro integration, PDF export (full)
- Risk management: register, 3×3 matrix, dashboard surfacing, Pro safety auto-create (lightweight)
- Resource management: Pro webhook feeds only (partial)
- Owner's Rep portal: read-only dashboard + issue tracker + RFI status (V1)

### Later — Do Not Build Yet
- Sub-schedule hierarchy (master + subcontractor rollup)
- Quantitative risk analysis
- Risk trending and portfolio risk view
- E-signature and owner formal approval portal
- GC-to-sub change order workflow
- QuickBooks Online, Sage, Foundation, Viewpoint integrations (validate with controller first)
- Supplier performance scoring
- Automated PO from material takeoff
- Supplier pricing API
- Lien waiver tracking
- Formal distribution matrix
- Email inbox integration for RFI responses
- Transmittal log
- Two-way Procore / e-Builder API integration
- Equipment utilization reporting across projects
- Stakeholder management module (full)
- Portfolio dashboard across projects
- Project templates (clone)
- Lessons learned database
- Invoice and change management for Owner's Rep (V2)
- Accounting system integrations (V2)

---

## Coding Standards

Follow BUILDER_DNA.md for all cross-project standards.

PM-specific additions:
- All financial calculations (EVM, cost variance, forecasting) must be tested with edge cases: zero budget, 100% complete, cost overrun
- Webhook handlers must be idempotent — duplicate events must not create duplicate records
- All webhook events must be logged to `webhooks_log` with status, payload, and retry count
- Schedule calculations (critical path, float, baseline variance) belong in a dedicated service layer, not in components
- WBS/Cost Code structure selection must be enforced at the data layer — switching structure after data entry must be blocked with a clear error
- 3-way match logic belongs in the procurement service layer with explicit test coverage
- Every role permission check must use the shared Firebase Auth role claim, never a local state variable

---

## File Structure

```
sitedeck-pm/
├── CLAUDE.md                    ← this file
├── src/
│   ├── services/
│   │   ├── schedule.service.ts  ← CPM, baseline, variance calculations
│   │   ├── cost.service.ts      ← EVM calculations (SPI, CPI, EAC, SV, CV)
│   │   ├── procurement.service.ts ← materials lifecycle, 3-way match
│   │   ├── webhook.service.ts   ← all inbound/outbound webhook handling
│   │   └── pro-sync.service.ts  ← Postgres → Firestore replication
│   ├── modules/
│   │   ├── schedule/
│   │   ├── cost/
│   │   ├── scope/
│   │   ├── procurement/
│   │   ├── communications/
│   │   ├── risk/
│   │   ├── resource/
│   │   └── dashboard/
│   ├── components/
│   │   ├── gantt/               ← Gantt chart component
│   │   ├── dashboard-tiles/     ← Six morning dashboard tiles
│   │   └── shared/
│   └── constants/
│       ├── roles.ts
│       ├── status.ts
│       ├── webhook-events.ts    ← all event name constants
│       └── reason-codes.ts      ← schedule change request reason codes
└── prisma/
    └── schema.prisma            ← Postgres schema
```

---

## Session Startup Checklist

Before writing any code in a SiteDeck PM session:
1. Read this file fully
2. Read BUILDER_DNA.md
3. Confirm which module is being built
4. Confirm V1 scope — do not build Later features
5. Confirm whether the feature requires a Pro webhook (inbound or outbound) and whether the contract is defined above
6. Check that role permissions are correctly applied to the feature being built

---

## Migration Notes — Pro Compatibility

### Overview
SiteDeck Pro's Firebase infrastructure (Firestore, Auth, Cloud Functions, FCM, Storage) is fully compatible with PM's Postgres + webhook architecture. However, Pro's application layer must be refactored so PM becomes the source of truth for the project registry and role permissions. Pro does not break — it becomes the downstream field-operations consumer.

### ✅ No Changes Required
| Pro Feature | PM Compatibility |
|---|---|
| **Firebase Auth** | Shared auth is the plan. Pro's email/password auth transfers directly. |
| **Firestore real-time listeners** | PM replicates project metadata to Firestore for Pro offline access. Pro keeps existing listener patterns. |
| **Cloud Functions** | Pro already uses these for Stripe webhooks. Same infrastructure handles PM webhook consumption and emission. |
| **FCM / Push Notifications** | PM does not define a notification layer. Pro's FCM stack stays untouched for crew alerts. |
| **Firebase Storage** | Safety manuals, certs, photos remain Pro-only. PM does not touch these. |
| **Internal collections** (`dailyReports`, `timesheets`, `jha`, `equipment`, `certifications`, etc.) | PM schema does not touch these. They remain Pro-only in Firestore. |

### ⚠️ Requires Changes in Pro
| Area | Current Pro | PM Requirement | Migration |
|---|---|---|---|
| **Project registry** | Pro creates and owns `projects` in Firestore. | Postgres is the source of truth. Pro **reads** project metadata from PM's Firestore replica or API. | Remove project creation from Pro. PM's Integration Management wizard creates the project, replicates to Firestore, Pro sees it via listeners. |
| **User roles** | 4 roles in Firestore `users`: `member`, `supervisor`, `superintendant`, `admin`. Status: `pending`/`approved`/`rejected`. Session via AsyncStorage. | 9 roles across portfolio. "Every role permission check must use the shared Firebase Auth **role claim**, never a local state variable." | Migrate roles from Firestore `users` to Firebase Auth custom claims. Expand role enum to match PM matrix. Update `isAdmin()`, `isSupervisor()` to read claims, not Firestore. |
| **Org model** | `orgId` is the root isolation key. Every doc has `orgId`. | PM schema centers on `project_id`. No explicit `orgId` in described schema. | Bridge required: PM must add `org_id` to `projects` table, or Pro maps `project_id` to internal `orgId`. Decision needed before multi-org PM launches. |
| **Webhook contracts** | Pro has Stripe webhooks only. No PM event emitters or consumers. | 7 inbound events (Pro → PM) and 5 outbound events (PM → Pro) with strict payload contracts. | Build Cloud Functions for: `task.completed`, `material.received`, `labor.hours_logged`, `equipment.usage_logged`, `safety.incident`, `field.issue_logged`, `schedule.change_requested`. Build handlers for PM outbound events. |
| **Activity feed vs. Webhook log** | Pro logs actions to `activityFeed` for internal audit. | PM requires `webhooks_log` table with status, payload, retry count. | Keep `activityFeed` for Pro internal audit. Add outbound HTTP logging to PM's `webhooks_log` (or a Pro-side shadow). |

### ❌ Critical Gaps / Conflicts
| Gap | Risk | Recommendation |
|---|---|---|
| **Role name mismatch** | Pro uses `member`; PM uses `field_crew`. Pro misspells `superintendant`; PM uses `superintendent`. Used in security rules and UI conditionals. | Align on canonical role slugs before writing integration code. Use PM's names as source of truth. |
| **Plan tiers vs. PM access** | Pro gates features by `core`/`field`/`premium`/`enterprise`. PM defines access by role only. | Product decision needed: does PM have its own subscription tier, or does Pro's `premium`/`enterprise` unlock PM features? |
| **Project creation authority** | Pro onboarding creates `organization` and first `project`. PM's wizard does this. | Remove org/project creation from Pro. Pro becomes child of PM for project scope. Orgs may still be created in Pro for billing/tenant isolation, but project registry moves to PM. |
| **WBS/Cost Code selector** | Pro has no concept of WBS or cost codes. | Pro's `timesheets`, `equipment`, and `dailyReports` need a `cost_code` or `wbs_id` field so PM's `labor.hours_logged` and `equipment.usage_logged` webhooks map to the correct cost line item. |

### 🛤️ Recommended Migration Order
1. **Auth alignment** (prerequisite): Move roles to Firebase Auth custom claims. This is required before PM's permission model can work.
2. **Project registry cutover**: Stop creating projects in Pro. Update Pro's `projects` collection to be a read-only mirror of PM's Firestore replica.
3. **Webhook plumbing** (Pro → PM): Implement the 7 inbound event emitters as Cloud Functions. Start with `task.completed` and `labor.hours_logged` — highest value.
4. **Outbound webhook handlers** (PM → Pro): Build Pro's consumers for `activity.ready`, `material.needed`, `rfi.status_updated`, etc.
5. **Org bridge**: Define how `orgId` (Pro) maps to company/org in PM's Postgres. Decision needed before multi-org PM launches.

### Bottom Line
Pro's Firebase infrastructure does not break. Pro's application layer (project creation, role storage, event emission) must be refactored so PM is the command layer and Pro is the field-operations layer. Plan the auth and org bridge decisions before writing integration code.

---

*Last updated: June 2026 — SiteDeck PM V1 PRD complete, build begins*