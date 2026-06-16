# Sprint 1 Log

## Task 1 — Fix map pin tooltips
**Status:** ✅ Complete  
**Timestamp:** 2026-06-06

### What was built / verified
- Map hover tooltip already implemented in previous session; verified it meets sprint spec.
- Tooltip displays: Project name, City/State, CPI value, SPI value, Open Items count, Status badge, Open Dashboard button.
- Hover interaction: `onMouseEnter`/`onMouseLeave` on marker wrapper with 200ms debounce; tooltip stays open when cursor moves into the InfoWindow itself.
- Clicking a pin still "pins" the tooltip for button interaction.
- Status logic verified against spec:
  - HEALTHY: CPI ≥ 1.0 AND SPI ≥ 0.9
  - WARNING: CPI < 1.0 OR SPI < 0.9 (but not critical)
  - CRITICAL: CPI < 0.95 OR SPI < 0.85
  - Implementation: `computeCpiSpiStatus()` in `project.service.ts` already matches these exact boundaries.
- Pacific Northwest coordinates verified in `prisma/seed-new-projects.ts`: `latitude: 47.6062, longitude: -122.3321` (47.6062° N, 122.3321° W) — correct.

### Files modified
- None — all requirements already satisfied from prior work.

### Test results
- Full backend test suite: **456 passed, 26 suites passed**
- No failures.

### Autonomous decisions
- Determined that existing `computeCpiSpiStatus` logic already implements the sprint boundaries exactly (it uses the standard three-tier boundary approach). No code change needed.
- Determined that Pacific Northwest coordinates in the seed script already match the required values. No change needed.

---

## Task 2 — Wire all dashboard data to live API endpoints
**Status:** ✅ Complete  
**Timestamp:** 2026-06-06

### What was built
- Updated `STATUS_COLORS` in `frontend/src/styles/design-system.ts` to match CLAUDE_SiteDeck_PM.md semantic colors:
  - green `#22C55E`, amber `#F59E0B`, red `#EF4444`
- Updated `src/services/dashboard.service.ts`:
  - `metrics.plannedEffort` now computed from total attendance hours across all records for the project (live data)
  - `upcoming.nextDraw` no longer hardcoded to 14 days; now derived from next milestone daysLeft with draw value at 15% of contract value
  - Removed `cashFlow` placeholder from `MorningDashboard` interface and return object (frontend uses separate `getCashFlow` API)
  - `communications` object now returns latest 2 open RFIs from `communications.service.getRfiByProject` instead of client issues from `integration.service`
  - Field issues in communications panel still sourced from `integration.service.getIssuesByType`
- Updated `frontend/src/components/Dashboard.tsx`:
  - Removed unused `sun` icon (weather widget was not in layout)
  - Updated `DashboardData` interface to match new `communications.rfis` shape
  - Communications panel now renders "RFIs — Latest 2" with RFI-specific fields (number, subject, status, date)
- Added `mockAttendanceFindMany` and `mockRfiFindMany` mocks to `src/routes/module.routes.test.ts` to support the new live queries in route tests.

### Files modified
- `frontend/src/styles/design-system.ts`
- `src/services/dashboard.service.ts`
- `src/services/dashboard.service.test.ts`
- `src/routes/module.routes.test.ts`
- `frontend/src/components/Dashboard.tsx`

### Test results
- Full backend test suite: **456 passed, 26 suites passed**
- Frontend TypeScript check: **clean**

### Autonomous decisions
- Chose to compute `plannedEffort` from sum of all `attendance.hours` because no dedicated labor-hours budget table exists; attendance is the closest live proxy.
- Chose 15% of contract value for `drawValue` because milestone billing is the target market per CLAUDE.md; this is a reasonable default until milestone billing module is built in a later sprint.
- Determined `project_id` on attendance/equipment records and webhook contracts for `attendance.updated` + `equipment.status_updated` were already fully implemented in schema and `webhook.service.ts`; no additional work needed.
- Determined weather widget was not present in current UI layout; removed only the unused `sun` icon definition to clean up.
- Determined Profit metric was not present in Performance panel; no removal needed.

---

## Task 3 — Add monthly cash flow query
**Status:** ✅ Complete  
**Timestamp:** 2026-06-06

### What was built / verified
- `cost.service.ts` already has `getCashFlow()` returning per-month `plannedSpend`, `actualSpend`, `earnedValue`, `committed` arrays. Endpoint `GET /api/v1/projects/:id/cost/cashflow` exists in `cost.routes.ts`.
- `schedule.service.ts` already has `getSchedulePerformance()` returning daily `baselinePct`, `actualPct`, `forecastPct`. Endpoint `GET /api/v1/projects/:id/schedule/performance` exists in `schedule.routes.ts`.
- `safety.service.ts` already exists with `trirTarget`, `trirActual`, `status`. Endpoint `GET /api/v1/projects/:id/safety/performance` exists in `safety.routes.ts`.
- Safety color threshold logic verified:
  - Green: actual TRIR ≤ 50% of target
  - Amber: actual TRIR 51–80% of target
  - Red: actual TRIR ≥ 80% of target
- EVM edge case tests verified and passing: zero budget, 100% complete, cost overrun, division-by-zero SPI/CPI/TPCI.
- Safety boundary tests verified and passing: exactly 50% (green), exactly 80% (red), just below 80% (amber).

### Files modified
- None — all requirements already satisfied.

### Test results
- `cost.service.test.ts`: **42 passed**
- `safety.service.test.ts`: **13 passed**
- Full backend suite: **456 passed, 26 suites passed**

### Autonomous decisions
- Determined that all three backend query methods and endpoints were already implemented in prior work. No code changes needed.
- Verified the safety threshold boundary logic handles floating-point precision correctly using epsilon bounds; existing tests cover the exact 50% and 80% boundaries.

---

---

## Task 4 — Rebuild three dashboard visualizations
**Status:** ✅ Complete  
**Timestamp:** 2026-06-06

### What was built / verified
- **Schedule Performance card** (`Dashboard.tsx`):
  - Renamed title from "Performance" to "Schedule Performance"
  - Removed Cost and Effort `MiniBarChart` sections
  - Updated `SchedulePerformanceChart` colors: Forecast = orange dashed (`COLORS.orange`, `strokeDasharray="6 3"`), Actual = dynamic green/amber/red based on last-point variance vs baseline
  - Added current-values callout below chart showing Baseline % | Forecast % | Actual % with color-coded variance
- **Cash Flow chart** (`CashFlowChart.tsx`):
  - Added `ReferenceLine` at current month labeled "Today" (`COLORS.red`, dashed)
  - Added this-month summary below chart showing Planned, Actual, and Earned Value for the current month
- **Safety Performance panel** (`SafetyPerformancePanel.tsx`):
  - Added italic note "* Lower actual TRIR is better (goal: below target)"
  - Added TRIR status callout below chart showing TRIR Target, TRIR Actual, and % of Target
- **Crew panel** (`CrewPanelChart.tsx`):
  - Already updated in Task 2 with live equipment summary; no additional changes needed for Task 4
- Removed dead code: `MiniBarChart` component, `formatCurrencyShort` helper, `ActivityItem` component, `costBars`/`effortBars` from `DashboardData` interface

### Files modified
- `frontend/src/components/Dashboard.tsx`
- `frontend/src/components/CashFlowChart.tsx`
- `frontend/src/components/SafetyPerformancePanel.tsx`
- `frontend/src/components/SchedulePerformanceChart.tsx`

### Test results
- Full backend test suite: **456 passed, 26 suites passed**
- Frontend TypeScript check: **clean**

### Autonomous decisions
- Chose to color the Actual line in `SchedulePerformanceChart` based on the last data point's variance vs baseline, because Recharts `Line` does not support per-segment color changes without complex custom rendering. The latest point is the most relevant for status.
- Used `STATUS_COLORS.green.bg`, `STATUS_COLORS.amber.bg`, `STATUS_COLORS.red.bg` for the Actual line so it matches the dashboard's semantic status palette.
- Chose a 5% schedule variance threshold for amber vs red on the Actual line (0% or better = green, -5% to 0% = amber, below -5% = red).

---

## Task 5 — Update CLAUDE.md for VPS deployment
**Status:** ✅ Complete  
**Timestamp:** 2026-06-06

### What was built / verified
- Updated **Deploy Script (`deploy.sh`)** section in `CLAUDE.md` to accurately reflect the actual script behavior:
  - Added `SYSTEMD_SERVICE` and `SSH_KEY` env vars to the config list
  - Documented `npm ci --production` with `npm install --production` fallback (instead of just `npm install --production`)
  - Documented sync of `package-lock.json` and `prisma/` schema to the VPS
  - Documented `sudo systemctl status --no-pager` verification step
  - Documented pre-flight SSH connectivity check
  - Updated SSH key prerequisite from generic `ssh-copy-id` to specific default path `~/.ssh/hostinger-vps-key` with `SSH_KEY` override
- Updated **Dashboard Data Mapping** section to mark live items:
  - Item 1 (Crew & Equipment): marked live
  - Item 4 (Performance Bar Charts): marked removed
  - Item 7 (Project Metrics): marked live
  - Item 9 (CPI / SPI Gauges): marked live

### Files modified
- `CLAUDE.md`

### Autonomous decisions
- Updated Dashboard Data Mapping docs while editing CLAUDE.md to keep documentation truthful and avoid stale references to mocked data that is now live.

---

## Task 6 — Final checks and deploy
**Status:** ✅ Complete  
**Timestamp:** 2026-06-06

### What was built / verified
- Full backend test suite: **456 passed, 26 suites passed**
- Backend TypeScript check: `npx tsc --noEmit` — **clean**
- Frontend TypeScript check: `tsc -b && vite build` — **clean**
- SSH connectivity to Hostinger VPS (`2.24.194.23`) verified
- Full deploy executed via `npm run deploy`:
  - Frontend built and uploaded to `/opt/sitedeck-pm/frontend/dist`
  - Backend built and uploaded to `/opt/sitedeck-pm/dist`
  - `package.json`, `package-lock.json`, and `prisma/` schema synced
  - `npm ci --production` succeeded on VPS
  - `npx prisma generate` succeeded on VPS
  - `sitedeck-pm` systemd service restarted and verified active
- Deployment URL: `https://projects.sitedeck.pro`

### Autonomous decisions
- Chose to run full deploy (`npm run deploy`) rather than frontend-only or backend-only because both frontend and backend had meaningful changes in this sprint.
- Did not attempt to address the 8 moderate npm audit vulnerabilities because they are in dependencies and the user did not request a security audit in this sprint.

---

## Sprint 1 Summary
**All 6 tasks complete.** Deployed to production at `https://projects.sitedeck.pro`.
