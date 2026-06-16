# SiteDeck PM — Project Rules & Multi-Agent Workflow

## Read First
Read `CLAUDE_SiteDeck_PM.md` for the full product context, stack, schema, webhook contracts, roles, and V1 scope.
This file governs the multi-agent workflow only. CLAUDE_SiteDeck_PM.md governs product decisions.

---

## Tech Stack
- **Language:** TypeScript (strict mode)
- **Database:** Postgres via Prisma ORM
- **Auth:** Firebase Auth (shared with SiteDeck Pro)
- **Offline:** Firestore (project metadata replication only)
- **Frontend web:** React (Vite SPA)
- **Frontend mobile:** React Native / Expo
- **Hosting:** Hostinger VPS (`2.24.194.23`) — Ubuntu, systemd-managed Node.js backend, static file frontend
- **Payments:** Stripe

## AI Agent Security — Non-Negotiable Rules

CRITICAL: The Anthropic API key is a server-side secret only.
It must NEVER appear in:
- Frontend code or components
- Client-side environment variables
- API responses
- Log files
- Error messages

ALL agent endpoints must enforce:
1. Firebase Auth token verification (no unauthenticated calls)
2. Tenant isolation (user can only call agent on their projects)
3. Rate limiting (see constants/agent-limits.ts)
4. Token limits (max_tokens hard-coded, never dynamic)
5. Input sanitization (sanitizeForPrompt() on all user data)
6. Spend guard check before every API call
7. Full call logging (user, project, tokens, cost estimate)

The system prompt is a server-side constant.
It is never constructed from user input.
It never accepts parameters from the request.

Any PR that violates these rules must be rejected.
## Automated Commands
- Build: `npm run build`
- Test: `npm test`
- Test (service layer only): `npm test src/services/`
- Test (coverage): `npm test -- --coverage`
- DB migrate: `npx prisma migrate dev`
- DB generate: `npx prisma generate`
- Type check: `npx tsc --noEmit`
- Deploy (full): `npm run deploy`
- Deploy (frontend only): `npm run deploy:frontend`
- Deploy (backend only): `npm run deploy:backend`

### Deploy Script (`deploy.sh`)
- Builds frontend (`frontend/dist/`) and backend (`dist/`)
- Uploads to Hostinger VPS (`2.24.194.23`) via `scp` to `/opt/sitedeck-pm/`
- Syncs `package.json`, `package-lock.json`, and `prisma/` schema to the VPS
- Runs `npm ci --production` (falls back to `npm install --production`) + `npx prisma generate` on the VPS
- Restarts `sitedeck-pm` systemd service and verifies status with `systemctl status --no-pager`
- Requires SSH key auth; default key is `~/.ssh/hostinger-vps-key`. Override with `SSH_KEY` env var
- Config env vars: `VPS_HOST`, `VPS_USER`, `REMOTE_APP_DIR`, `REMOTE_WEB_DIR`, `SYSTEMD_SERVICE`, `SSH_KEY`
- Pre-flight: checks `ssh`/`scp` availability and validates SSH connectivity before building

---

## Multi-Agent Workflow

### Agents
- `@builder` — writes application source code
- `@tester` — writes and runs tests
- `@debugger` — fixes failures, invoked only when tests fail

### Standard Build Sequence
```
Orchestrator defines the feature and module
    ↓
@builder reads CLAUDE_SiteDeck_PM.md + implements feature
    ↓
@builder reports files created, webhooks used, migrations needed
    ↓
@tester reads the new code + writes test cases
    ↓
@tester runs npm test + reports results
    ↓
All pass → Orchestrator reviews + marks feature complete
Failures → @debugger receives trace + fixes + re-runs failing tests
    ↓
@debugger confirms fix + runs full suite for regressions
    ↓
Orchestrator reviews + marks feature complete
```

### Delegation Rules
1. **Orchestrator** manages the feature roadmap and sequencing. Does not write code.
2. **@builder** receives: feature name, module, relevant AGENTS.md section. Returns: files created/modified, webhook contracts used, migrations needed, blockers.
3. **@tester** receives: files to test, feature description. Returns: pass/fail, full trace on failures, coverage gaps.
4. **@debugger** receives: failing test name, full stack trace, suspected source file. Returns: root cause, files modified, before/after, whether tester assertions need updating.
5. Never invoke @debugger speculatively. Only invoke when @tester reports a failure.

### Escalation to Orchestrator
Any agent must stop and notify the orchestrator when:
- A feature requires a "Later" item from CLAUDE_SiteDeck_PM.md
- A bug requires a Postgres schema change
- A design conflict between PM and Pro is discovered
- A product decision is needed to proceed
- A new webhook event contract is required that isn't in CLAUDE_SiteDeck_PM.md

---

## V1 Build Order — Module Sequence

Build in this order. Do not start the next module until the current one is tested and passing.

1. **Auth alignment** — Firebase Auth custom claims, canonical role names, permission middleware
2. **Project registry** — Postgres schema, project setup wizard, Firestore replication, org bridge
3. **Schedule module** — Gantt, baseline, P6/MPP/Excel import, native builder, change request workflow
4. **Cost module** — WBS/cost code structure, budget, EVM (SPI/CPI/EAC), variance flags
5. **Morning dashboard** — six tiles, drill-downs, data from PM + Pro via Firestore replica
6. **Procurement module** — materials lifecycle, PO management, 3-way match, 48-hour alert, subcontract management
7. **Scope module** — WBS builder (shared with cost), scope statement, change order log, PDF export
8. **Communications module** — RFI log, submittal register, Pro integration, PDF export
9. **Risk module** — risk register, 3x3 matrix, dashboard surfacing, Pro safety auto-create
10. **Integration module** — issue tracker, voice-to-issue, self-memo iOS tool, unified change log, closeout
11. **Owner's Rep portal** — read-only dashboard + issue tracker + RFI status
12. **Resource module** — Pro webhook feeds, equipment cost/schedule visibility

---

## Non-Negotiable Rules (Enforced Across All Agents)

- No "Later" features. If it's in the Later list in CLAUDE_SiteDeck_PM.md, it does not get built.
- No stack changes. The stack is locked.
- No role name variations. Canonical names only: `owner_admin`, `project_manager`, `superintendent`, `supervisor`, `field_crew`, `subcontractor_pm`, `subcontractor_super`, `owners_rep`, `accountant_ap`
- No permission checks from local state. Firebase Auth custom claims only.
- No new webhook event names without orchestrator approval.
- Webhook handlers must be idempotent. Always.
- WBS/cost code structure cannot be changed after project data is entered. Enforce at data layer.
- Financial calculations live in `cost.service.ts` only. Never in components.
- Schedule calculations live in `schedule.service.ts` only. Never in components.

---

## Dashboard Data Mapping — Future Tasks

The Morning Dashboard (`frontend/src/components/Dashboard.tsx`) now matches the target design with mock data for fields not yet wired. Each mock section below needs a data mapping decision before replacing the mock:

### 1. Crew & Equipment Counts (Site Data tile)
**Status:** ✅ Wired to live API via `getMorningDashboard` → `crew` object + `getEquipmentDashboardSummary`.
**Data:** `speciality`, `general`, `equipment`, `equipmentActive`, `equipmentIdle`, `dailyBurnRate`.

### 2. Weather Widget
**Mock:** Midland, TX — 94°F.
**Need:** Real weather API (OpenWeatherMap, NOAA). Should be configurable per project site location.

### 3. Upcoming Milestones / Checkpoints / Draws
**Mock:** `MOCK_UPCOMING` — hardcoded milestone names and days.
**Need:** Schedule activities tagged by type (`milestone`, `checkpoint`, `draw`). The schedule module can surface these by filtering `scheduleActivity` where `type` or `category` matches. Draws likely come from billing module (not in V1).

### 4. Performance Bar Charts (Cost / Effort / Profit)
**Status:** ❌ Removed. The "Performance" card was rebuilt as "Schedule Performance" in Sprint 1 Task 4. Cost/Effort mini bar charts were removed. Re-add only when the cost module supports per-WBS planned vs actual breakdown.

### 5. Financial Overview Donuts (Bid Value / Current Value)
**Mock:** Fake donut segments for Task Cost / Overhead / Profit.
**Need:** Budget line categorization into direct cost, overhead, and profit margin. The cost module's `budget_line` table may need `category` enum (`direct`, `overhead`, `profit`).

### 6. Task & Days Progress Bars
**Mock:** Actual Days 400, Estimate Days 326.
**Need:** Schedule module to report cumulative actual duration vs original duration from baseline. Add `actual_duration` to schedule activities or derive from daily reports.

### 7. Project Metrics Circles (Planned Days / Effort / Completed %)
**Status:** ✅ Wired to live API.
- `plannedDays` = sum of original durations from baseline (`schedule.service.ts`)
- `plannedEffort` = sum of `attendance.hours` for the project (live proxy until labor-hours budget table exists)
- `completedPct` = `pctComplete` from EVM (`cost.service.ts`)

### 8. Change Order Summary
**Mock:** `MOCK_CHANGE_ORDERS` — Approved: 5, Pending: 4, with cost/schedule impact.
**Need:** Scope module change order model with `cost_impact` and `schedule_impact_hours` fields. Not yet built (Scope is module #7).

### 9. CPI / SPI Gauges on Dashboard
**Status:** ✅ Wired to live API. `GET /api/v1/projects/:id/dashboard/morning` returns `performance` object with `cpi`, `spi`, `costVariance`, `scheduleVariance`, `pctComplete` from `getMorningDashboard`.

### 10. Critical Issues Tiles
**Real:** Already uses `clientIssues` and `fieldIssues` tile data from backend.
**Note:** Works today. Keep as-is.

---

**Decision required:** For each item above, either (a) build the data model now, (b) wire an existing Pro webhook, or (c) keep mocked and build the model when that module is reached in the V1 sequence.

---

## Design Context (for agent reference)

See `PRODUCT.md` for strategy and `DESIGN.md` for visual system details.

- **Register:** `product` — app UI, dashboard, tool (not marketing/brand)
- **Palette:** Navy `#1B2A4A` (primary), Orange `#E8720C` (accent/action), Green `#22A06B` / Amber `#D68A00` / Red `#C9372D` (status)
- **Typography:** System font stack; sizes xs–display; weights 400–700
- **Key principles:** Status at a glance; decisions, not dashboards; one action per view; proven over novel; wear it outside
- **Anti-references:** No construction clip art, no startup SaaS minimalism, no Procore density
- **Tokens:** `frontend/src/styles/design-system.ts` (COLORS, FONTS, SHADOWS, BORDERS, STATUS_COLORS)
- **Live mode:** Configured at `.impeccable/live/config.json` (Vite SPA, `frontend/index.html`)
