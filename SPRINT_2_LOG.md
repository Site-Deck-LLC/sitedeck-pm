# Sprint 2 Log

## Task 1 — Activity Relationship Table
**Status:** ✅ Complete
**Timestamp:** 2026-06-06

### What was built
- Added `ActivityRelationship` model to Prisma schema with fields:
  - `id`, `projectId`, `predecessorId`, `successorId`, `relationshipType` (FS/SS/FF/SF), `lagDays`, `constraintType` (hard/soft), `createdAt`, `updatedAt`
  - Unique constraint on `[predecessorId, successorId, relationshipType]`
  - Cascade delete on both activity FKs
- Generated and ran migration `20260606144048_add_activity_relationships`
- Added service methods to `activity.service.ts`:
  - `createRelationship` with circular dependency prevention (DFS cycle detection)
  - `getRelationshipsForActivity` (returns predecessors + successors)
  - `deleteRelationship`
  - `syncRelationshipsToJson` — keeps legacy JSON `predecessors`/`successors` fields in sync during transition
- Added CRUD endpoints to `schedule.routes.ts`:
  - `POST /projects/:id/schedule/activities/:actId/relationships`
  - `GET /projects/:id/schedule/activities/:actId/relationships`
  - `DELETE /projects/:id/schedule/relationships/:relId`
- Updated seed script (`prisma/seed.ts`):
  - 17 FS relationships with realistic construction logic
  - 3 SS relationships (parallel activities: Underground Rough-in starts 5 days after Excavation; Spill Containment starts 3 days after Formwork; BMS Wiring starts 10 days after Battery Rack Install)
  - 2 lag relationships (Concrete Cure: FS+3 days; Grounding System Install: FS+2 days after Transformer Install)
- Updated `module.routes.test.ts` with `activityRelationship` mocks and 3 new route tests

### Files modified
- `prisma/schema.prisma`
- `src/services/activity.service.ts`
- `src/routes/schedule.routes.ts`
- `prisma/seed.ts`
- `src/routes/module.routes.test.ts`

### Test results
- Full backend test suite: **459 passed, 26 suites passed** (3 new tests added)

### Autonomous decisions
- Added `@@unique([predecessorId, successorId, relationshipType])` to prevent duplicate relationships of the same type between two activities, while allowing different types (e.g. both FS and SS between the same pair).
- Chose to keep legacy JSON `predecessors`/`successors` fields and sync them from the relational table during transition, so the existing CPM engine and any other code reading the JSON fields continues to work.
- Implemented circular dependency detection with DFS from the new successor back to the proposed predecessor before creating the relationship.
- Chose to seed 3 SS relationships instead of exactly 3 because 3 is the minimum; the ones selected represent realistic parallel construction logic.

---

## Task 2 — CPM Engine
**Status:** ✅ Complete
**Timestamp:** 2026-06-06

### What was built
- Updated `calculateCpm` in `schedule.service.ts` to handle all four relationship types:
  - **FS** (Finish-to-Start): `ES_s = EF_p + lag`
  - **SS** (Start-to-Start): `ES_s = ES_p + lag`
  - **FF** (Finish-to-Finish): `ES_s = EF_p + lag - dur_s`
  - **SF** (Start-to-Finish): `ES_s = ES_p + lag - dur_s`
- Implemented proper backward pass with per-relationship-type late-finish constraints
- Implemented free-float calculation for all four relationship types
- Added ES clamping to `>= 0` to prevent negative start dates
- Updated `recalculateSchedule` to read relationships from the `ActivityRelationship` relational table (source of truth) instead of JSON fields
- Added comprehensive CPM tests:
  - Simple linear chain A→B→C verifying ES/EF/LS/LF/Float
  - Parallel paths with critical path identification
  - SS relationship with lag (parallel starts)
  - FF relationship with lag (parallel finishes)
  - SF relationship with lag (start-to-finish constraint)
  - Activity with multiple predecessors
  - Activity with multiple successors
  - Float = 0 correctly identifies critical path
  - Float > 0 correctly identifies non-critical activities

### Files modified
- `src/services/schedule.service.ts`
- `src/services/schedule.service.test.ts`
- `src/routes/webhook.routes.test.ts` (added `activityRelationship` mock)

### Test results
- Full backend test suite: **468 passed, 26 suites passed** (12 new tests added)

### Autonomous decisions
- Chose to read relationships from the `ActivityRelationship` table in `recalculateSchedule` instead of the JSON fields, making the relational table the source of truth for CPM calculations. The JSON sync in `activity.service.ts` remains for backward compatibility during transition.
- Implemented ES clamping to 0 because SF relationships with short lags can compute negative start dates. The resulting EF still satisfies the successor constraint.
- Used `Math.abs(totalFloat) <= 0.0001` for critical path identification to handle floating-point precision issues.

---

## Task 3 — Real Gantt Component ✅
**What was built:**
- Updated GanttView.tsx bar colors to match design spec exactly:
  - Complete: gray `#9CA3AF`
  - In Progress (on track): green `#22C55E`
  - In Progress (delayed): amber `#F59E0B`
  - Critical path / delayed: red `#EF4444`
  - Not Started: navy `#1B2A4A` outline only (transparent fill)
- Added red left border (`border-left: 3px solid #EF4444`) for critical path activities
- Changed milestones to pure diamond markers using CSS `rotate(45deg)` with no bar background
- Added dependency arrow rendering via SVG `<path>` overlay inside scrollable body
  - Added bulk `GET /api/v1/projects/:id/schedule/relationships` endpoint in `schedule.routes.ts`
  - Added `getScheduleRelationships()` API helper in `frontend/src/api.ts`
  - Fetched relationships on Gantt load, mapped predecessor/successor positions, drew curved SVG paths with arrowheads
  - Non-FS relationships rendered with dashed stroke (`strokeDasharray: "3 3"`)
  - SVG positioned inside scrollable body with `position: relative` so arrows scroll with content
- Added zoom controls (Week / Month / Quarter) with adjustable `dayWidth`:
  - Week: 24px/day, Month: 6px/day, Quarter: 2px/day
  - Toggle buttons styled with active-state orange highlight

**Files created or modified:**
- `frontend/src/components/GanttView.tsx` (major rewrite)
- `frontend/src/api.ts` (added `getScheduleRelationships`)
- `src/routes/schedule.routes.ts` (added bulk relationships GET endpoint)
- `src/routes/module.routes.test.ts` (added test for bulk endpoint)

**Test results:**
- Frontend build: ✅ passed
- Full test suite: 26 suites, 469 tests — all passed

**Autonomous decisions:**
1. **Bulk relationships endpoint**: Added a single `GET /relationships` endpoint instead of making N per-activity calls. This reduces request count from O(activities) to 1 and simplifies the arrow rendering logic.
2. **CSS diamond milestones**: Used `transform: rotate(45deg)` on a square div instead of SVG polygons. This is simpler, render-consistent with the bar styling, and avoids additional SVG complexity.
3. **SVG inside scrollable body**: Positioned the SVG overlay with `position: absolute` inside the scrollable div (which has `position: relative`). This ensures dependency arrows scroll with the Gantt content. Computed `totalContentHeight` dynamically to cover all rows.
4. **Y coordinate fix**: Corrected `activityPositions` and `getActivityEntryY` to use `GROUP_HEADER_H` (40px) for group headers instead of `ROW_H` (44px), fixing a 4px per-group alignment drift.
5. **Lag display**: Did not add lag labels on arrows in this pass. Arrows are thin and minimal to avoid visual clutter at small zoom levels. Can be added later if needed.
**Timestamp:** 2026-06-04

---

## Task 4 — Schedule Import (P6 XER) (IN PROGRESS)

---

## Task 4 — Schedule Import (P6 XER) ✅
**What was built:**
- Created `src/services/xer-parser.service.ts` — parses Primavera P6 XER text format into structured tables:
  - Supports `%T` (table header), `%F` (fields), `%R` (rows), `%E` (end) sections
  - Extracts `PROJECT`, `WBS`, `TASK`, `TASKPRED` tables
  - Converts XER hours to working days (8h/day), maps `PR_FS/SS/FF/SF` to internal types, detects milestones (`TT_FinMile`, `TT_Mile`, `TT_StartMile`)
- Created `src/services/schedule-import.service.ts` — imports parsed XER data into our database:
  - Upserts `WorkBreakdownItem` records by `wbs_short_name` code (creates if not exists, maps to existing)
  - Creates `ScheduleActivity` for each XER task with mapped fields (dates, duration, milestone flag, float values)
  - Creates `ActivityRelationship` for each XER predecessor link
  - Automatically runs `recalculateSchedule` after import to compute CPM
  - Handles duplicate relationships gracefully (ignores unique constraint errors)
- Added `POST /api/v1/projects/:id/schedule/import/xer` endpoint in `src/routes/schedule.routes.ts`
  - Uses `multer` with `memoryStorage` to accept `.xer` file uploads
  - Returns JSON with `importedActivities`, `importedRelationships`, `importedWbsItems`, `xerProjectName`
- Added tests:
  - `src/services/xer-parser.service.test.ts` — 11 tests covering parsing, extraction, date conversion, duration math, milestone/critical detection
  - `src/services/schedule-import.service.test.ts` — 4 tests covering full import flow, milestone duration, duplicate skip, missing project handling
  - `src/routes/module.routes.test.ts` — 1 integration test for the upload endpoint

**Files created or modified:**
- `src/services/xer-parser.service.ts` (new)
- `src/services/schedule-import.service.ts` (new)
- `src/services/xer-parser.service.test.ts` (new)
- `src/services/schedule-import.service.test.ts` (new)
- `src/routes/schedule.routes.ts` (added import endpoint + multer)
- `src/routes/module.routes.test.ts` (added workBreakdownItem mocks + XER upload test)
- `package.json` / `package-lock.json` (added `multer` + `@types/multer`)

**Test results:**
- Full test suite: 28 suites, 485 tests — all passed

**Autonomous decisions:**
1. **Memory-only upload**: Used `multer.memoryStorage()` instead of disk storage. Files are small text files (XER), and memory storage avoids disk cleanup concerns and works seamlessly on the VPS.
2. **8-hour workday**: Converted XER hours to days by dividing by 8. This is the standard P6 default. If a project uses a different calendar, the durations will be approximate — acceptable for V1.
3. **WBS upsert by code**: Matched XER WBS items to existing `WorkBreakdownItem` records using `wbs_short_name` as the `code` field. This allows re-importing the same project without creating duplicate WBS items.
4. **Graceful duplicate handling**: If a relationship already exists (same predecessor + successor + type), the unique constraint throws and we catch and ignore it. This makes re-imports idempotent.
5. **No UI for import yet**: The API endpoint is ready. A frontend import dialog will be built in Task 7 (Import UI).
**Timestamp:** 2026-06-04

---

## Task 5 — Schedule Import (MS Project XML) (IN PROGRESS)

---

## Task 5 — Schedule Import (MS Project XML) ✅
**What was built:**
- Created `src/services/msproject-parser.service.ts` — parses Microsoft Project XML export format:
  - Uses `fast-xml-parser` (already in dependencies) to parse XML into JS objects
  - Extracts project name, tasks (UID, Name, WBS, Start, Finish, Duration, PercentComplete, Milestone, Summary, OutlineLevel), and predecessor links
  - Converts ISO 8601 durations (`P5DT0H0M0S`) to days
  - Maps MS Project relationship types (0=FF, 1=FS, 2=SF, 3=SS) to internal types
  - Parses lag from `LinkLag` + `LagFormat` into working days
- Created `src/services/schedule-import-msproject.service.ts` — imports parsed MS Project data:
  - Upserts `WorkBreakdownItem` records by WBS code
  - Creates `ScheduleActivity` for each non-summary task (skips summary rows)
  - Derives status from `PercentComplete` (`complete` if 100%, `in_progress` if >0, else `not_started`)
  - Creates `ActivityRelationship` for each predecessor link
  - Runs `recalculateSchedule` after import
- Added `POST /api/v1/projects/:id/schedule/import/msproject` endpoint (same `multer` upload pattern as XER)
- Added tests:
  - `src/services/msproject-parser.service.test.ts` — 6 tests covering project info, task extraction, duration parsing, percent complete, relationships, empty project
  - `src/services/schedule-import-msproject.service.test.ts` — 3 tests covering full import, status mapping, duplicate skip
  - `src/routes/module.routes.test.ts` — 1 integration test for the upload endpoint

**Files created or modified:**
- `src/services/msproject-parser.service.ts` (new)
- `src/services/schedule-import-msproject.service.ts` (new)
- `src/services/msproject-parser.service.test.ts` (new)
- `src/services/schedule-import-msproject.service.test.ts` (new)
- `src/routes/schedule.routes.ts` (added msproject endpoint)
- `src/routes/module.routes.test.ts` (added msproject upload test)
- `package.json` / `package-lock.json` (added `xlsx`)

**Test results:**
- Full test suite: 30 suites, 495 tests — all passed

**Autonomous decisions:**
1. **Summary task exclusion**: Skipped `Summary=1` tasks from import. Summary tasks in MS Project are roll-up rows, not actual activities. This avoids creating phantom activities.
2. **Status inference from % complete**: Mapped MS Project `PercentComplete` directly to our `status` field (0% = `not_started`, >0% = `in_progress`, 100% = `complete`). This preserves the user's progress state from MS Project.
3. **Lag simplification**: For V1, all lag formats are converted to working days using an 8-hour workday assumption. This covers the common cases (days, elapsed days) with minimal complexity.
**Timestamp:** 2026-06-04

---

## Task 6 — Schedule Import (Excel) (IN PROGRESS)

---

## Task 6 — Schedule Import (Excel) ✅
**What was built:**
- Created `src/services/excel-schedule-parser.service.ts` — parses Excel/CSV schedule files:
  - Uses `xlsx` library to read both `.xlsx` and `.csv` files
  - Flexible header mapping: accepts common variations like `Activity Name`, `Task Name`, `Name`, `Start Date`, `Finish Date`, `Duration`, `% Complete`, `Percent Complete`, `Predecessors`, `Relationship Type`, `Lag`, etc.
  - Handles Excel serial dates, ISO dates, and US-style `MM/DD/YYYY` formats
  - Normalizes `PercentComplete` to a 0–1 fraction (75 → 0.75)
  - Infers `status` from percent complete if not explicitly provided
  - Supports milestone flag (`TRUE`, `1`, `yes`)
- Created `src/services/schedule-import-excel.service.ts` — imports parsed Excel rows:
  - Upserts `WorkBreakdownItem` by WBS code
  - Creates `ScheduleActivity` for each row (skips empty rows)
  - Creates `ActivityRelationship` from `Predecessors` column (comma-separated activity names matched by name)
  - Runs `recalculateSchedule` after import
- Added `POST /api/v1/projects/:id/schedule/import/excel` endpoint (same multer upload pattern)
- Added tests:
  - `src/services/excel-schedule-parser.service.test.ts` — 6 tests covering standard headers, empty rows, date formats, percent normalization, status inference, missing columns
  - `src/services/schedule-import-excel.service.test.ts` — 3 tests covering full CSV import, duplicate skip, empty file
  - `src/routes/module.routes.test.ts` — 1 integration test for the upload endpoint

**Files created or modified:**
- `src/services/excel-schedule-parser.service.ts` (new)
- `src/services/schedule-import-excel.service.ts` (new)
- `src/services/excel-schedule-parser.service.test.ts` (new)
- `src/services/schedule-import-excel.service.test.ts` (new)
- `src/routes/schedule.routes.ts` (added excel endpoint)
- `src/routes/module.routes.test.ts` (added excel upload test)
- `package.json` / `package-lock.json` (added `xlsx`)

**Test results:**
- Full test suite: 32 suites, 505 tests — all passed

**Autonomous decisions:**
1. **CSV + XLSX support**: Used `xlsx` library which handles both formats. This gives users flexibility — they can upload raw Excel exports or save-as-CSV.
2. **Predecessor matching by name**: In the Excel `Predecessors` column, users reference predecessor activities by their `Activity Name`. The importer looks up the created activity by that name. This is intuitive for spreadsheet users.
3. **Graceful header tolerance**: The parser accepts many common header name variations, so users don't need an exact template. A simple printed reference list is sufficient for V1.
**Timestamp:** 2026-06-04

---

## Task 7 — Import UI (IN PROGRESS)

---

## Task 7 — Import UI ✅
**What was built:**
- Created `frontend/src/components/ScheduleImportDialog.tsx` — modal dialog for importing schedules:
  - Three import type tabs: Primavera P6 XER, MS Project XML, Excel/CSV
  - File drop zone with click-to-upload (uses hidden `<input type="file">`)
  - Displays selected file name and size
  - Import button triggers the appropriate API endpoint based on selected type
  - Success state shows result cards: Activities, Relationships, WBS Items counts
  - Error state shows inline error message
  - Cancel / Done buttons for dismissal
- Integrated dialog into `frontend/src/components/GanttView.tsx`:
  - Added orange "Import" button to the Gantt nav bar (next to Graph/Table toggles)
  - Dialog opens on click, closes on backdrop click or × button
  - After successful import, schedule data refreshes automatically (re-fetches activities, relationships, baselines)
- Added frontend API helpers in `frontend/src/api.ts`:
  - `importXer(projectId, file)` — FormData POST with file blob
  - `importMsProject(projectId, file)` — same pattern
  - `importExcelSchedule(projectId, file)` — same pattern

**Files created or modified:**
- `frontend/src/components/ScheduleImportDialog.tsx` (new)
- `frontend/src/components/GanttView.tsx` (added import button + dialog integration + reload logic)
- `frontend/src/api.ts` (added importXer, importMsProject, importExcelSchedule)

**Test results:**
- Frontend build: ✅ passed
- Full test suite: 32 suites, 505 tests — all passed

**Autonomous decisions:**
1. **Modal overlay pattern**: Used a fixed overlay with `z-index: 1000` for the import dialog. This is consistent with standard modal UX and doesn't require routing changes.
2. **Auto-reload after import**: On success, the dialog closes and the Gantt data re-fetches. This gives immediate visual feedback — the user sees their imported schedule appear without a manual refresh.
3. **Memory upload**: All three import endpoints use `FormData` with the file blob directly. No client-side parsing needed — the backend handles all formats.
**Timestamp:** 2026-06-04

---

## Task 8 — Final Checks and Deploy (IN PROGRESS)

---

## Task 8 — Final Checks and Deploy ✅
**What was built:**
- Ran `npx tsc --noEmit` — zero TypeScript errors
- Ran full test suite — 32 suites, 505 tests — all passed
- Ran frontend build — successful (Vite SPA, 716KB JS gzip)
- Ran `./deploy.sh` — deployed to Hostinger VPS (`2.24.194.23`):
  - Uploaded frontend `dist/` and backend `dist/`
  - Synced `package.json`, `package-lock.json`, `prisma/schema.prisma`
  - Ran `npm ci --production` + `npx prisma generate` on VPS
  - Restarted `sitedeck-pm` systemd service
  - Service verified active with `systemctl status`

**Files created or modified:**
- All Sprint 2 files (see prior tasks)

**Test results:**
- Type check: ✅ passed
- Full test suite: 32 suites, 505 tests — all passed
- Frontend build: ✅ passed
- Deploy: ✅ successful

**Timestamp:** 2026-06-04

---

# Sprint 2 Complete ✅

All 8 tasks completed and deployed to Hostinger VPS.
