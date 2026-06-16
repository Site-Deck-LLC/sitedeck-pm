# Dashboard Rebuild Plan

## Goal
Rebuild four dashboard panels using recharts line charts with the SiteDeck design system (navy #1B2A4A, orange #E8720C, semantic status colors).

## Files to Modify
1. `frontend/package.json` — add `recharts` dependency
2. `frontend/src/api.ts` — add `getCashFlow`, `getSchedulePerformance`, `getSafetyPerformance`, `getEquipmentDashboard`
3. `frontend/src/components/Dashboard.tsx` — rebuild panels, add recharts charts
4. `src/routes/dashboard.routes.ts` (or existing) — may need new endpoint for crew/equipment dashboard data
5. `src/services/dashboard.service.ts` — may need crew/equipment summary helper

## Layout Changes (bodyLayoutStyle 2-column grid)
**Column 1 (main):**
1. Crew & Upcoming sub-grid
2. Schedule Performance (recharts line chart)
3. Safety Performance (recharts line chart)  
4. Communications
5. Financial Overview + Task & Days sub-grid

**Column 2 (sidebar):**
1. Cash Flow (recharts line chart, replaces placeholder + value + metrics)
2. Project Health
3. Performance Index + Change Order stack
4. Quick Actions

## Panel Specs

### 1. Cash Flow Panel (replaces right-column placeholder/value/metrics)
- **API:** `GET /api/v1/projects/:id/cost/cashflow`
- **Chart:** LineChart with 4 lines — planned (navy), actual (orange), earned (green), committed (amber)
- **X axis:** months (from response)
- **Y axis:** cumulative dollar value
- **Today marker:** vertical `ReferenceLine` in navy
- **Summary below:** planned / actual / variance (colored green if positive, red if negative)

### 2. Schedule Performance Panel (replaces "Performance" card)
- **API:** `GET /api/v1/projects/:id/schedule/performance`
- **Title:** "Schedule Performance"
- **Chart:** LineChart with 3 lines
  - Baseline % complete — navy solid
  - Forecast % complete — orange dashed
  - Actual % complete — colored by variance from forecast (green/amber/red)
- **Today marker:** vertical navy `ReferenceLine`
- **Callouts below:** Baseline: X% | Forecast: Y% | Actual: Z%

### 3. Safety Performance Panel (new, below Schedule Performance in column 1)
- **API:** `GET /api/v1/projects/:id/safety/performance`
- **Chart:** LineChart with 2 lines
  - TRIR target — navy solid horizontal
  - TRIR actual running — colored green/amber/red based on threshold
- **Note:** actual BELOW target is good — label "Lower is better"
- **Callout:** "TRIR {actual} / Target {target} — {statusText}"

### 4. Crew Panel (replaces Site Data decorative counts)
- **Data:** Existing `getDashboard` crew object + `getEquipmentDashboardSummary` (new API call or existing dashboard data)
- **Content:**
  - General crew count (from attendance)
  - Equipment count, active count, idle count
  - Estimated daily burn vs budget rate
  - Idle equipment on critical path flag (amber/red)

## Implementation Order
1. Install recharts
2. Add API functions
3. Build Cash Flow panel
4. Build Schedule Performance panel
5. Build Safety Performance panel
6. Build Crew panel
7. Reassemble Dashboard layout
8. Run `npm test` (backend)
9. Run `npx tsc --noEmit` (frontend + backend)
10. Build + deploy

## Tablet Viewport (1024px)
- The existing `bodyLayoutStyle` uses `gridTemplateColumns: '1fr clamp(320px, 22%, 400px)'`. At 1024px this becomes tight.
- Charts must use `ResponsiveContainer` from recharts with `width="100%"` and explicit `height`.
- Summary callouts below charts should wrap with `flexWrap`.
- No changes to bodyLayoutStyle needed if charts are responsive; cards will auto-size.
