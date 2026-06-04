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
- **Frontend web:** React
- **Frontend mobile:** React Native / Expo
- **Hosting:** Vercel
- **Payments:** Stripe

## Automated Commands
- Build: `npm run build`
- Test: `npm test`
- Test (service layer only): `npm test src/services/`
- Test (coverage): `npm test -- --coverage`
- DB migrate: `npx prisma migrate dev`
- DB generate: `npx prisma generate`
- Type check: `npx tsc --noEmit`

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
2. **@builder** receives: feature name, module, relevant CLAUDE.md section. Returns: files created/modified, webhook contracts used, migrations needed, blockers.
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
