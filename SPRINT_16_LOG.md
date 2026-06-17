# Sprint 16 Log — Willow Creek Real Data Seeding

Date: 2026-06-17
Agent: Claude
Scope: Seed Willow Creek project in PM and Benchmark with real quote data (Quote 0129 labor, Quote 0138 materials).

---

## PM Database (`sitedeck_pm_dev` on VPS)

### Organization Created
- **ID:** `orion-fiber-solutions`
- **Name:** Orion Fiber Solutions LLC
- **Type:** contractor

### Project Created
- **ID:** `willow-creek`
- **Name:** Willow Creek Solar + BESS
- **Contract Value:** $512,597.32
- **Start Date:** 2026-08-15
- **City:** Norton, MA
- **Client:** Ryan Company, 15 Commerce Way, Norton MA 02766
- **Contractor:** Orion Fiber Solutions LLC
- **Labor Rate:** $50/hr
- **Labor Contract:** $352,300 (Quote 0129)
- **Materials Budget:** $160,297.32 (Quote 0138)

### Jose Vasquez Provisioned
- **Firebase UID:** `YUcAjSkVx6aCvzxBpG9NzIciVFG2`
- **Email:** `vasquezj@orionfsl.com`
- **Role:** `project_manager`
- **OrgMember ID:** `cmqhbep5i0000ylnbkei2tnnu`
- **ProjectMember ID:** `cmqhbdcxs00012r42j0rp6awa`

### Schedule Activities Created (10)
| ID | Name | Start | End | Duration |
|---|---|---|---|---|
| `cmqhbepx20007ylnbzoe7ioyc` | FJB01 Fiber Splicing & Terminations | 2026-08-15 | 2026-10-01 | 34d |
| `cmqhbeq4v0009ylnby6mud0jo` | FJB02 Fiber Splicing & Terminations | 2026-08-15 | 2026-10-03 | 35d |
| `cmqhbeq9o000bylnbxl3kpu3x` | FJB03 Fiber Splicing & Terminations | 2026-08-15 | 2026-09-25 | 30d |
| `cmqhbeqf1000dylnbhr759rds` | FJB04 Fiber Splicing & Terminations | 2026-10-01 | 2026-11-12 | 31d |
| `cmqhbeqjh000fylnb4oi1154f` | FJB05 Fiber Splicing & Terminations | 2026-10-01 | 2026-11-10 | 29d |
| `cmqhbeqov000hylnbtj9wj7v1` | FJB06 Fiber Splicing & Terminations | 2026-10-01 | 2026-11-10 | 29d |
| `cmqhbeqta000jylnbikdopmg3` | CON/INV Lines UPS — FJB01-FJB03 | 2026-11-15 | 2027-04-15 | 110d |
| `cmqhbeqy4000lylnbsjq7x5ex` | CON/INV Lines UPS — FJB04-FJB06 | 2026-11-15 | 2027-04-01 | 100d |
| `cmqhber34000nylnbidhyv08i` | Fire Alarm System | 2027-04-01 | 2028-04-10 | 260d |
| `cmqhber7x000pylnb0txxn8qh` | Mobilization | 2026-08-15 | 2026-08-20 | 5d |

### Budget Lines Created (17)
- 2 summary lines (Labor $352,300 + Materials $160,297.32)
- 15 material detail lines from Quote 0138
- Total: 17 lines

---

## Benchmark Database (`sitedeck_benchmark` on VPS)

### DFOWs Updated (5)
| ID | Name | Unit References |
|---|---|---|
| `cmqgqwt900004rfuyb6aeidqx` | OTDR Testing | FJB01A1 through FJB06A2 |
| `cmqgqwt8x0002rfuytdxjtjs5` | Fiber Terminations | FJB01A1 through FJB06A2 |
| `cmqgqwt970008rfuy8ye76avj` | Splice Enclosures | FJB01A1 through FJB06A2 |
| `cmqgqwt930006rfuyv5usc5fr` | Conduit Installation | FJB01A1 through FJB06A2 |
| `cmqgqwt9a000arfuy00nl08ug` | Cable Pulling | FJB01A1 through FJB06A2 |

### Inspection Records Created (12 new + 2 pre-existing)
| Unit Reference | Status | Notes |
|---|---|---|
| FJB01A1 | locked | OTDR pass |
| FJB01A2 | locked | OTDR pass |
| FJB02A1 | locked | OTDR pass |
| FJB02A2 | locked | OTDR pass |
| FJB03A1 | locked | OTDR pass |
| FJB03A2 | locked | OTDR pass |
| FJB04A1 | locked | OTDR fail — 0.38 dB splice loss |
| FJB04A2 | locked | OTDR fail — 0.38 dB splice loss |
| FJB05A1 | in_progress | awaiting field completion |
| FJB05A2 | in_progress | awaiting field completion |
| FJB06A1 | in_progress | awaiting field completion |
| FJB06A2 | in_progress | awaiting field completion |

- **6 locked passing** (FJB01A1–FJB03A2)
- **2 locked failing** (FJB04A1, FJB04A2)
- **4 in_progress** (FJB05A1–FJB06A2)

### NCRs
| ID | Internal Number | Description | Severity | Status |
|---|---|---|---|---|
| `nchbojt44o1891yzco` | NCR-2026-WC-001 | Splice loss on FJB04A1 exceeds specification — 0.38 dB recorded against 0.3 dB maximum | high | open |

---

## Verification Queries Run

### PM
```sql
SELECT id, name, org_id, contract_value, start_date FROM projects WHERE id = 'willow-creek';
SELECT COUNT(*) FROM schedule_activities WHERE project_id = 'willow-creek'; -- 10
SELECT COUNT(*) FROM budget_lines WHERE project_id = 'willow-creek'; -- 17
```

### Benchmark
```sql
SELECT id, name, description FROM dfows WHERE benchmark_project_id = 'cmqgqwt8o0000rfuy8zyl8uwl'; -- 5
SELECT id, unit_reference, status FROM inspection_records WHERE dfow_id = 'cmqgqwt900004rfuyb6aeidqx'; -- 14 (12 new FJB + 2 pre-existing)
SELECT id, internal_number, status FROM ncrs WHERE benchmark_project_id = 'cmqgqwt8o0000rfuy8zyl8uwl' AND status = 'open'; -- 2 (1 pre-existing + 1 new)
```

---

## Files Changed
- `src/scripts/seed-willow-pm.ts` — PM seed script
- `src/scripts/seed-willow-benchmark.ts` — Benchmark seed script
- `SPRINT_16_LOG.md` — this file
- `INTEGRATION_LOG_PM.md` — updated
- `INTEGRATION_LOG_BENCHMARK.md` — updated

## Build / Tests
- `tsc --noEmit`: clean
- `npm test`: 1110 passed, 11 pre-existing failures (unchanged)
