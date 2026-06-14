# SiteDeck PM — Supabase → Self-Hosted Postgres on VPS Migration Plan

**Date:** 2026-06-14
**Author:** Claude Code (agentic session, pre-flight review)
**Status:** ⚠️ PROPOSED — requires user sign-off before any execution
**Reference lessons:** `BUILD_LESSONS.md` Lesson 1 (migrations in container), Lesson 5 (health check false-positive), Lesson 6 (Supabase pivot pattern), Lesson 7 (migrate vs generate), Lesson 10 (seed scripts with source imports)

---

## Goal

Move SiteDeck PM's `DATABASE_URL` from Supabase (cloud, `db.swtsqkroigpdeskzcnib.supabase.co`) to the local Postgres container (`sitedeck-pm-postgres`) already running on the Hostinger VPS (`2.24.194.23`). After migration:

- The PM systemd service points at the local container
- Claude Code (with SSH) can fix DB issues directly on the VPS without routing through the user
- Supabase schemas (`public`, `benchmark`) are **left in place** per Lesson 6 — not dropped, not migrated, no data loss
- All 26 on-disk Prisma migrations are applied to the local container
- The seed scripts are re-run so the dashboard has data

**Out of scope:**
- Converting PM from systemd to a Docker container (Lesson 12 / Option B from the discussion — explicitly deferred)
- Touching the Supabase project (no schema drops, no settings changes)
- Adding real Stripe price IDs, monitoring, rate limiting, or any other "while we're in there" work
- Touching Benchmark, Groundcheck, or any other service
- Re-running dev user creation (`create-dev-users.ts`) — the Firebase users `dev-*@sitedeck.pro` and `support@sitedeck.pro` already exist with valid claims

---

## Current State (verified 2026-06-14)

| Component | State | Evidence |
|---|---|---|
| PM systemd service | Active, pointing at Supabase | `DATABASE_URL=postgresql://postgres:Windpower2020&@db.swtsqkroigpdeskzcnib.supabase.co:6543/...` |
| `sitedeck-pm-postgres` container | Up 39h, healthy, on `groundcheck-infra_groundcheck` network | `docker ps` shows it; `docker inspect` confirms network |
| Local container DB | `sitedeck_pm_dev`, user `sitedeck`, password `EA16G60FLXtOSP1EeNtZyr0V0jH00u` | `docker exec ... env` |
| Local container tables | **0** (empty) | `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'` → 0 |
| Supabase `public` schema | 45 PM tables, **0 rows** (verified: `public.projects` count = 0) | `scripts/seed-data-survey.ts` |
| Supabase `benchmark` schema | 18 tables, **0 rows** | same script |
| On-disk migrations | 26 directories under `prisma/migrations/` | `ls prisma/migrations/` |
| Migrations applied to Supabase | All 26 (schema intact) | `public.projects` table exists, just empty |
| Migrations applied to local container | **0** | confirmed 0 tables |
| Firebase users | `support@sitedeck.pro` (uid `BJedHsm0LTXHiJokkZStXw9N18H2`, role `owner_admin`, orgId `sWGfCibWkRJ0X5T9rJHs`) and `dev-admin@/dev-pm@/dev-super@` exist | `scripts/check-users.ts` |
| `support@` org in DB | Does not exist (org claim is orphaned) | `select count(*) from public.organizations` → 0 |
| Seed scripts | `prisma/seed.ts` and `prisma/seed-new-projects.ts` exist, idempotent-friendly | ls |

**Data loss risk: zero.** Supabase is empty for PM. Local container is empty. We're moving a pointer, not moving data.

---

## Pre-Flight Checklist (all must be ✅ before step 1)

- [ ] This plan reviewed and approved by user
- [ ] Backup of Supabase `public` schema taken via `pg_dump` (paranoid, even though data is empty — protects against any later surprises)
- [ ] Backup of `sitedeck-pm-postgres` container's data volume (it's empty, but cost is one `docker commit` for safety)
- [ ] User has the dev-role Firebase users (for rollback testing) and the `support@` user noted down with their UIDs
- [ ] User is at the keyboard, not AFK. Each step requires a confirm before the next.

---

## Step 0 — Take backups (no service impact)

**Why:** Even though both DBs are empty, an extra `pg_dump` to local disk and a `docker commit` cost nothing and protect against a "wait, I didn't know that table was important" moment.

```bash
# On your Mac (not the VPS)
ssh -i ~/.ssh/hostinger-vps-key root@2.24.194.23 \
  "pg_dump 'postgresql://postgres:Windpower2020&@db.swtsqkroigpdeskzcnib.supabase.co:5432/postgres' --schema=public --no-owner --no-privileges" \
  > /tmp/sitedeck-pm-supabase-public-backup-$(date +%Y%m%d-%H%M).sql

ssh -i ~/.ssh/hostinger-vps-key root@2.24.194.23 \
  "pg_dump 'postgresql://postgres:Windpower2020&@db.swtsqkroigpdeskzcnib.supabase.co:5432/postgres' --schema=benchmark --no-owner --no-privileges" \
  > /tmp/sitedeck-pm-supabase-benchmark-backup-$(date +%Y%m%d-%H%M).sql

# Snapshot the local container (it's empty, but cheap insurance)
ssh -i ~/.ssh/hostinger-vps-key root@2.24.194.23 \
  "docker commit sitedeck-pm-postgres sitedeck-pm-postgres:pre-migration-$(date +%Y%m%d)"
```

**Verify:** Both `pg_dump` files exist on the Mac and are non-empty (will contain only schema, no data). The `docker images` shows the new tagged image.

**Rollback from this step:** Delete the SQL files and the docker image. Nothing on prod has changed.

---

## Step 1 — Apply Prisma migrations to the local container

**Why:** The local container has 0 tables. All 26 on-disk migrations need to run.

**Where migrations run:** Inside a container on the `groundcheck-infra_groundcheck` bridge network, NOT from the host (Lesson 1: `prisma migrate deploy` from the host gets `P1001` because `sitedeck-pm-postgres` is a Docker-internal DNS name). We'll spin up a one-off migration container using the official `prisma` image with the schema mounted in.

```bash
# Copy the prisma directory to the VPS (already there from /opt/sitedeck-pm, but be explicit)
ssh -i ~/.ssh/hostinger-vps-key root@2.24.194.23

# On the VPS, run migrations from a one-off prisma container on the bridge network
docker run --rm \
  --network groundcheck-infra_groundcheck \
  -v /opt/sitedeck-pm/prisma:/app/prisma \
  -v /opt/sitedeck-pm/node_modules/.prisma:/app/node_modules/.prisma \
  -w /app \
  -e DATABASE_URL="postgresql://sitedeck:EA16G60FLXtOSP1EeNtZyr0V0jH00u@sitedeck-pm-postgres:5432/sitedeck_pm_dev" \
  node:20-bullseye \
  bash -c "npm install --no-save prisma@5.22.0 && npx prisma migrate deploy"
```

**Why this command shape:**
- `--rm` — the container is throwaway, no state to leak
- `--network groundcheck-infra_groundcheck` — required to resolve `sitedeck-pm-postgres` (Lesson 1)
- `-v /opt/sitedeck-pm/prisma:/app/prisma` — the on-disk migrations are read-only here
- `-w /app` — work in the project root
- The `node:20-bullseye` image matches the local toolchain version
- The URL uses the **direct port** (5432, not 6543) because there's no pooler in front of the local container

**Verify:**
```bash
# Table count should be 45 (all PM tables), not 0
docker exec sitedeck-pm-postgres psql -U sitedeck -d sitedeck_pm_dev -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
# Expected: 45

# _prisma_migrations table should have 26 rows
docker exec sitedeck-pm-postgres psql -U sitedeck -d sitedeck_pm_dev -c \
  "SELECT count(*) FROM _prisma_migrations;"
# Expected: 26

# Spot check: organizations table exists
docker exec sitedeck-pm-postgres psql -U sitedeck -d sitedeck_pm_dev -c \
  "\d organizations"
# Expected: shows columns id, name, type, created_by, created_at, updated_at
```

**If verify fails:** Migration step is idempotent — running it again is safe. If a specific migration fails, do NOT proceed. Investigate, fix the migration, re-run from `prisma migrate resolve` for the failed step.

**Rollback from this step:** Drop and recreate the local DB (it's still empty of app data):
```bash
docker exec sitedeck-pm-postgres dropdb -U sitedeck sitedeck_pm_dev
docker exec sitedeck-pm-postgres createdb -U sitedeck sitedeck_pm_dev
```
Or restore the docker image snapshot from Step 0.

---

## Step 2 — Update `/opt/sitedeck-pm/.env` to point at the local container

**Why:** This is the actual "switch" — the systemd service reads `DATABASE_URL` from this file.

```bash
# On the VPS — preserve the Supabase URL as a comment for rollback
ssh -i ~/.ssh/hostinger-vps-key root@2.24.194.23

# Backup current .env
cp /opt/sitedeck-pm/.env /opt/sitedeck-pm/.env.supabase-pre-migration

# Edit /opt/sitedeck-pm/.env. The two lines that change are DATABASE_URL and DIRECT_URL.
# (DIRECT_URL is used by Prisma Migrate at deploy time, not at runtime. It also needs
# to point at the local container now, otherwise `prisma migrate deploy` from the
# host would try to reach Supabase.)
#
# Change:
#   DATABASE_URL=postgresql://postgres:Windpower2020&@db.swtsqkroigpdeskzcnib.supabase.co:6543/postgres?pgbouncer=true
#   DIRECT_URL=postgresql://postgres:Windpower2020&@db.swtsqkroigpdeskzcnib.supabase.co:5432/postgres
# To:
#   DATABASE_URL=postgresql://sitedeck:EA16G60FLXtOSP1EeNtZyr0V0jH00u@sitedeck-pm-postgres:5432/sitedeck_pm_dev
#   DIRECT_URL=postgresql://sitedeck:EA16G60FLXtOSP1EeNtZyr0V0jH00u@sitedeck-pm-postgres:5432/sitedeck_pm_dev
#
# Everything else in .env stays the same: GOOGLE_APPLICATION_CREDENTIALS,
# PM_BENCHMARK_WEBHOOK_*, BYOK_ENCRYPTION_KEY, NODE_ENV, etc.

# Verify the change landed
grep -E "^(DATABASE_URL|DIRECT_URL)=" /opt/sitedeck-pm/.env
```

**Verify:** The two `*_URL=` lines point at `sitedeck-pm-postgres`, not `db.swtsqkroigpdeskzcnib.supabase.co`. The Supabase URL is preserved in `/opt/sitedeck-pm/.env.supabase-pre-migration`.

**Rollback from this step:**
```bash
cp /opt/sitedeck-pm/.env.supabase-pre-migration /opt/sitedeck-pm/.env
```
The systemd service hasn't been restarted yet, so the new values are not in effect. Reversal is trivial.

---

## Step 3 — Restart the PM systemd service and confirm it boots against the new DB

**Why:** This is the moment of truth. The service needs to connect to the local container, not Supabase.

```bash
# On the VPS
systemctl restart sitedeck-pm

# Wait for it to be active
systemctl is-active sitedeck-pm
# Expected: active

# Check the log for any DB connection errors
journalctl -u sitedeck-pm -n 50 --no-pager
# Expected: no "Can't reach database" or "P1001" errors
```

**Verify (end-to-end, the moment the dashboard will use):**
```bash
# Health endpoint — should return 200 AND report the local container as "connected"
curl -s http://localhost:3000/api/v1/health | python3 -m json.tool
# Expected: {"status":"ok", "database":"connected", "counts": {...}}
# CRITICAL: Per Lesson 5, a 200 here is NOT proof. The health endpoint historically
# only checked TCP connectivity. After this step, manually verify the schema is
# being read by hitting an endpoint that requires a real table:
curl -s -o /dev/null -w "GET /projects → %{http_code}\n" \
  -H "Authorization: Bearer $(cat /tmp/support-token-if-any)" \
  http://localhost:3000/api/v1/projects
# Expected: 200 with empty array, OR 401 if no token (both prove the service is reading the DB)
# NOT expected: 500, "database error", or P1001

# Log into Firebase with support@, get a token, and try /projects again
# (Or use the dev-token shortcut: any email + password via the dev-bypass when NODE_ENV=production
#  is NOT set. Since .env doesn't override NODE_ENV and the systemd unit sets it to production,
#  we MUST use a real Firebase token here.)
```

**If 200 with empty array:** 🎉 The service is reading the new DB. Move to Step 4.

**If 401:** Expected if no token — that's auth working, not DB broken.

**If 500 / "P1001" / "ECONNREFUSED":** The service is not connecting to the local container. STOP. Re-check `DATABASE_URL` in `/opt/sitedeck-pm/.env`. Re-check the container is up: `docker ps | grep sitedeck-pm-postgres`. If both look right, restore Supabase `.env` and restart to keep the service available while you debug.

**Rollback from this step:**
```bash
cp /opt/sitedeck-pm/.env.supabase-pre-migration /opt/sitedeck-pm/.env
systemctl restart sitedeck-pm
journalctl -u sitedeck-pm -n 20 --no-pager
# Service is back on Supabase. You can debug the local container issue without
# taking the dashboard offline.
```

---

## Step 4 — Re-seed the local container

**Why:** The local DB is now schema-complete but data-empty. The seed scripts (`prisma/seed.ts` and `prisma/seed-new-projects.ts`) populate the BESS, Pacific Northwest, NVA, and Phoenix projects that the dashboard was originally designed around.

**Where it runs:** Inside a one-off container on the bridge network, with the source tree mounted, per Lesson 10's recommendation.

```bash
# On the VPS
docker run --rm \
  --network groundcheck-infra_groundcheck \
  -v /opt/sitedeck-pm:/app \
  -w /app \
  -e DATABASE_URL="postgresql://sitedeck:EA16G60FLXtOSP1EeNtZyr0V0jH00u@sitedeck-pm-postgres:5432/sitedeck_pm_dev" \
  -e NODE_ENV=development \
  -e PATH="/usr/local/bin:/usr/bin:/bin" \
  node:20-bullseye \
  bash -c "npm install --no-save ts-node@10.9.2 prisma@5.22.0 @prisma/client@5.22.0 typescript@5.6.3 && npx ts-node prisma/seed.ts && npx ts-node prisma/seed-new-projects.ts"
```

**Why this command shape:**
- `-v /opt/sitedeck-pm:/app` — mounts the full source tree so seed scripts can import from `src/` (Lesson 10)
- `node:20-bullseye` — matches the local dev environment
- `NODE_ENV=development` — required by some seed scripts to skip production-only checks
- `npm install --no-save` — adds `ts-node` and friends temporarily; doesn't touch `package.json`

**Verify:**
```bash
docker exec sitedeck-pm-postgres psql -U sitedeck -d sitedeck_pm_dev -c \
  "SELECT count(*) FROM projects;"
# Expected: ≥ 4 (BESS, Pacific Northwest, NVA, Phoenix — depending on what the seed scripts insert)

docker exec sitedeck-pm-postgres psql -U sitedeck -d sitedeck_pm_dev -c \
  "SELECT id, name, city, state FROM projects;"
# Expected: 4+ rows with the project names

# Schedule activities seeded?
docker exec sitedeck-pm-postgres psql -U sitedeck -d sitedeck_pm_dev -c \
  "SELECT count(*) FROM schedule_activities;"
# Expected: ≥ 45 (the BESS project alone has 45 per the 2026-06-04 deploy record)
```

**If seed fails (Lesson 10 trap):** The seed script imports from `src/constants/dfow-library` (or similar). The fix from Lesson 10 is to add a try/catch dynamic `require()` to fall back from `dist/` to `src/`. If the seed imports a file that doesn't exist in the source tree at all, the right move is to inline the data, not to copy the source.

**If seed partially succeeds:** Don't run it again blindly. Some seeds are NOT idempotent. Inspect the partial state, decide whether to truncate and re-seed or to accept the partial state.

**Rollback from this step:**
```bash
# Truncate the seeded data, keep the schema
docker exec sitedeck-pm-postgres psql -U sitedeck -d sitedeck_pm_dev -c \
  "TRUNCATE projects, schedule_activities, budget_lines, cost_transactions, purchase_orders, material_deliveries, invoices, subcontracts, change_orders, rfis, submittals, risks, issues, equipment, closeout_checklists, baselines RESTART IDENTITY CASCADE;"
# Service continues working against the (now empty again) local DB
```

---

## Step 5 — Bootstrap `support@sitedeck.pro` against the new local DB

**Why:** Your Firebase user is the only one with the right `role + orgId` claim, and the local DB has no `organizations` or `project_members` rows yet. The seed scripts in Step 4 create projects owned by whoever ran them — they may not have created an `Organization` row tied to your `orgId: sWGfCibWkRJ0X5T9rJHs` claim.

This is the `scripts/bootstrap-support-user.ts` script I already wrote. It:

1. Verifies the Firebase user `BJedHsm0LTXHiJokkZStXw9N18H2` still exists
2. Inserts `Organization` row with id `sWGfCibWkRJ0X5T9rJHs`
3. Inserts `OrganizationMember` row linking the Firebase user to that org
4. Inserts (or updates) a `Project` row tied to that org
5. Inserts a `ProjectMember` row linking the user to the project

**Where it runs:** On your Mac (where I can read the script and you can see the output), pointed at the **local** container via SSH tunnel — NOT against Supabase.

```bash
# On your Mac — set up an SSH tunnel so the script can talk to the local container
ssh -i ~/.ssh/hostinger-vps-key -L 55432:sitedeck-pm-postgres:5432 -N root@2.24.194.23 &
TUNNEL_PID=$!
sleep 2

# Now run the bootstrap script pointed at the tunnel
DATABASE_URL="postgresql://sitedeck:EA16G60FLXtOSP1EeNtZyr0V0jH00u@localhost:55432/sitedeck_pm_dev" \
GOOGLE_APPLICATION_CREDENTIALS="/Volumes/Extra Storage/SiteDeckPro/functions/serviceAccountKey1.json" \
FIREBASE_PROJECT_ID="site-deck" \
npx ts-node scripts/bootstrap-support-user.ts

# Kill the tunnel
kill $TUNNEL_PID
```

**Why SSH tunnel:** The local container's port 5432 is only exposed on the `groundcheck-infra_groundcheck` Docker network, not on the host's public interface. The tunnel routes a local Mac port through SSH to the container.

**Verify:**
```bash
# From the VPS, look at the new rows
docker exec sitedeck-pm-postgres psql -U sitedeck -d sitedeck_pm_dev -c \
  "SELECT id, name FROM organizations;"
# Expected: sWGfCibWkRJ0X5T9rJHs | SiteDeck (support)

docker exec sitedeck-pm-postgres psql -U sitedeck -d sitedeck_pm_dev -c \
  "SELECT \"userId\", role, status FROM organization_members;"
# Expected: BJedHsm0LTXHiJokkZStXw9N18H2 | owner_admin | active

docker exec sitedeck-pm-postgres psql -U sitedeck -d sitedeck_pm_dev -c \
  "SELECT \"userId\", \"projectId\", role, status FROM project_members;"
# Expected: at least one row linking your UID to a project
```

**If verify fails:** The script is idempotent — re-running it will retry, not duplicate. If you want to start over:
```bash
docker exec sitedeck-pm-postgres psql -U sitedeck -d sitedeck_pm_dev -c \
  "DELETE FROM organization_members WHERE \"userId\"='BJedHsm0LTXHiJokkZStXw9N18H2';"
# Then re-run
```

**Rollback from this step:** `DELETE` the rows. Service is unaffected because `listProjects()` returns all projects regardless of membership.

---

## Step 6 — Browser-side verification

**Why:** The service is up, the DB is populated, your user is bootstrapped. Now we verify the actual user experience.

1. Open `https://projects.sitedeck.pro/` in a **private/incognito window** (so cached login state doesn't lie)
2. Sign out if you're already signed in
3. Sign in as `support@sitedeck.pro` with the password (you may need to reset it in the Firebase console first — see note below)
4. The projects list should show the seeded projects (BESS, Pacific Northwest, NVA, Phoenix)
5. Click into one — the 6-tile dashboard should render with the seed data

**If projects are empty but no error:** The seed scripts may not have created the projects under your org. Run Step 5 again to add a project explicitly tied to your org, or update the seed scripts to set `orgId: 'sWGfCibWkRJ0X5T9rJHs'` on the projects they create.

**If sign-in fails:** Firebase auth is independent of the DB. If you can't sign in, the issue is with the Firebase web config, not the DB. Check browser console for `auth/network-request-failed` or similar.

**Note on password:** When we last checked, `support@` had no password set in Firebase. If you set one during the earlier "access" debugging session, use that. Otherwise, go to Firebase console → Authentication → Users → `support@sitedeck.pro` → ⋮ → Reset password, and use the email link to set one.

---

## Step 7 — Mark done, archive old config

**Why:** Once the new architecture is verified, leave breadcrumbs so future-me (or future-Claude) doesn't get confused.

```bash
# On the VPS
# Add a comment to the systemd unit pointing at the new architecture
sed -i 's|^Environment=NODE_ENV=production$|Environment=NODE_ENV=production\n# 2026-06-14: DB moved from Supabase to local sitedeck-pm-postgres container (Lesson 6 pattern)\n# Supabase schemas public + benchmark preserved (not dropped) — see /opt/sitedeck-pm/.env.supabase-pre-migration|' /etc/systemd/system/sitedeck-pm.service
systemctl daemon-reload

# Add a comment to /opt/sitedeck-pm/.env explaining the new architecture
cat >> /opt/sitedeck-pm/.env <<'EOF'

# ─── Architecture note (2026-06-14) ────────────────────────────────
# DB moved from Supabase (cloud) to local sitedeck-pm-postgres
# container on groundcheck-infra_groundcheck bridge network.
# This is the same pattern as Benchmark (BUILD_LESSONS Lesson 6).
# Supabase schemas (public, benchmark) are intentionally NOT dropped.
# Rollback: cp /opt/sitedeck-pm/.env.supabase-pre-migration .env && systemctl restart sitedeck-pm
# Reference: MIGRATION_PM_TO_VPS.md
EOF

# Commit the plan and the updated scripts
# (on the Mac)
cd /Volumes/Extra\ Storage/SiteDeckPM
git add MIGRATION_PM_TO_VPS.md scripts/bootstrap-support-user.ts
git commit -m "Sprint 10: PM migration plan + support user bootstrap script

Move SiteDeck PM from Supabase to local sitedeck-pm-postgres
container on the Hostinger VPS (Lesson 6 pattern from Benchmark).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Verify:**
- `git log -1 --stat` shows the commit
- The systemd unit has the new comment line
- The `.env` has the architecture note

**Rollback from this step:** `git revert` the commit. Restore the systemd unit from a backup if you made the change there. Trivial.

---

## What This Plan Does NOT Do (deliberately)

- ❌ Drop the Supabase `public` or `benchmark` schemas (Lesson 6: "Don't drop the Supabase schema yet")
- ❌ Convert PM from systemd to Docker (Option B explicitly deferred)
- ❌ Touch Benchmark, Groundcheck, or any other service
- ❌ Add real Stripe price IDs, monitoring, rate limiting, or other "while we're in there" work
- ❌ Re-run `create-dev-users.ts` (the dev Firebase users already exist)
- ❌ Modify the Supabase `DATABASE_URL` from the Supabase side
- ❌ Set up automated failover between local and Supabase (out of scope)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Local container not reachable from PM | Low (already verified) | High | Step 3 verify catches it; rollback = restore .env |
| Migrations partially apply | Low | Medium | Step 1 verify catches it; rollback = drop/recreate DB |
| Seed scripts fail on source import (Lesson 10) | Medium | Low | Mounted source tree, inline data fallback |
| Seed scripts not idempotent | Medium | Low | Truncate + re-seed; accept partial state |
| Supabase-side data we forgot about | Very low (verified 0 rows) | Low | Step 0 pg_dump captures everything |
| `support@` Firebase password lost | Medium | Low | User-side issue; password reset in Firebase console |
| Bridge network DNS issue (Lesson 1) | Very low (Benchmark works) | Medium | Container join verified; step 1 verify catches it |

---

## Pre-Execution Sign-Off

Before I touch the VPS, I need you to confirm:

- [ ] I have read this plan in full
- [ ] I understand the rollback path for each step
- [ ] I am at the keyboard and can respond to verify/rollback prompts
- [ ] I am OK with the "What This Plan Does NOT Do" exclusions
- [ ] I authorize execution to begin at Step 0

If any box is unchecked, hold here and we'll discuss before proceeding.

---

**End of plan. Awaiting sign-off.**

---

## Post-Mortem — What Actually Happened (2026-06-14)

The plan above is correct in shape but a few specifics needed correction in the field. Recording them here so the next migration doesn't rediscover them.

### Corrections to the plan

1. **Step 1 — Use `node:20-bookworm`, not `node:20-bullseye`.**
   The Prisma client on the VPS was generated for `debian-openssl-3.0.x` (Debian 12). `bullseye` is Debian 11 / openssl-1.1 and crashes with `Prisma Client could not locate the Query Engine for runtime "debian-openssl-1.1.x"`. Always match the runner's openssl version to what `prisma generate` produced locally. Alternative: add `debian-openssl-1.1.x` to `binaryTargets` in `schema.prisma` and regenerate, but that touches the project.

2. **Step 2 — `.env` URL must use `127.0.0.1:5432`, not the container DNS name.**
   This is the big one. The PM Node process runs as a **systemd service on the host** (not in a container). The `groundcheck-infra_groundcheck` Docker bridge network (172.16.2.0/24) is **not routed to the host**. So `sitedeck-pm-postgres:5432` (the Docker DNS name) is unresolvable from the host. The running `sitedeck-pm-postgres` container had to be **recreated with `-p 5432:5432`** so the host can reach it on `127.0.0.1:5432`.
   - Original `docker run` (started by some prior session) had no port publish, so the host couldn't reach the DB.
   - `docker-compose.yml` at `/opt/sitedeck-pm/docker-compose.yml` had `ports: ['5432:5432']` defined but was never used (the container was started manually with different flags).
   - **Lesson for next time:** when PM stays as systemd (Option A), the local Postgres container must publish 5432 to the host. When PM moves into a container (Option B, deferred), it can use the container DNS name on the bridge network.

3. **Step 5 — `scripts/bootstrap-support-user.ts` was stale against the current schema.**
   Four field-name fixes were needed:
   - `contractAmount` → `contractValue` (Project)
   - missing `structureType: 'WBS'` (required by Project)
   - `progress` → `percentComplete` (ScheduleActivity)
   - `durationDays` → `duration` (ScheduleActivity)
   - `createdBy` field doesn't exist on ScheduleActivity (it has `createdAt`/`updatedAt` only)
   The script is now in sync with `prisma/schema.prisma` as of 2026-06-14.

### Lessons-learned (proposed for `BUILD_LESSONS.md`)

These should be added to Benchmark's BUILD_LESSONS.md so the next self-hosted DB migration in any SiteDeck service doesn't repeat them:

- **Lesson 15:** When running a Node service as systemd on the host alongside a Docker-network Postgres, the container **must** publish its port to the host. The bridge-network DNS name is not resolvable from the host. Either `-p 5432:5432` on the `docker run`, or run the Node service in a container on the same bridge network.

- **Lesson 16:** When running Prisma migrate deploy in a throwaway container, **match the runner image's openssl version to the locally-generated Prisma client binary target.** Use `node:20-bookworm` (Debian 12, openssl-3.0) for projects generated on Debian 12 hosts. `node:20-bullseye` (Debian 11, openssl-1.1) will fail with `Prisma Client could not locate the Query Engine`.

- **Lesson 17:** Orphan `containerd-shim-runc-v2` processes can keep running nodes in a zombie loop after their `docker run` parent is forgotten. When you see "Up 13 days" containers in `docker ps` and unrelated `node dist/server.js` processes, check for orphan shims via `ps -ef | grep containerd-shim`. They may not show in `docker ps` and won't be killed by `docker kill`.

- **Lesson 18:** `prisma migrate deploy` from a one-off container must mount **only** the `prisma/` and `node_modules/` directories — not the full app. If you mount the full app, the Prisma CLI auto-loads `.env` from the workdir and ignores your `-e DATABASE_URL=…`, sending the migration to the wrong host. Mount the bare minimum.

### Final state (verified 2026-06-14)

| Component | State |
|---|---|
| `sitedeck-pm-postgres` container | Up, port 5432 published to host, on `groundcheck-infra_groundcheck` network |
| Local DB | 26 migrations applied; 5 projects, 1 organization, 1 organization_member, 1 project_member, 138 schedule_activities |
| `/opt/sitedeck-pm/.env` | `DATABASE_URL` and `DIRECT_URL` point at `127.0.0.1:5432` |
| `/opt/sitedeck-pm/.env.supabase-pre-migration` | Preserved for rollback |
| systemd `sitedeck-pm.service` | Unchanged from pre-migration (no override needed once port is published) |
| Supabase `public` schema | 45 tables, 0 rows — **untouched, NOT dropped** per Lesson 6 |
| Supabase `benchmark` schema | 18 tables, 0 rows — **untouched** |
| Browser test | `https://projects.sitedeck.pro/` shows 5 projects to support@sitedeck.pro; Test EPC Project at top |
| Rollback path | `cp /opt/sitedeck-pm/.env.supabase-pre-migration /opt/sitedeck-pm/.env && systemctl restart sitedeck-pm` (instant, no data loss) |

