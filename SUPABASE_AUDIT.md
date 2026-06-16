# SiteDeck PM — Supabase Reference Audit

**Date:** 2026-06-14
**Author:** Claude Code (read-only audit, post Sprint 10 migration)
**Context:** PM was migrated from Supabase cloud Postgres to local `sitedeck-pm-postgres` container on the VPS on 2026-06-14. Cloud schema preserved per `BUILD_LESSONS.md` Lesson 6. This is the complete inventory of remaining Supabase references in the repo and on the VPS, with no changes made.

**Method:** The four `grep` commands the user specified, plus three follow-up inspections:
- `dist/` and `src/` for runtime code
- All `.env*` variants (including hidden ones)
- SPRINT log context lines

---

## Summary

| Total files with Supabase references | 10 |
|---|---|
| LIVE (actively executed) | **0** |
| CONFIG (env files / config) | **5** (one is intentional backup) |
| DOCS (markdown / comments) | **5** (informational only) |
| DEAD (code that is no longer executed) | **2** (`scripts/list-schemas.ts`, `scripts/grant-support-admin.ts`) |
| BACKUP (intentional rollback) | **1** (`.env.supabase-pre-migration` on VPS) |
| Mac-side `.env` files pointing at Supabase | **2** (`.env` and `frontend/.env`) — **not in CI/deploy path, low risk** |

**Bottom line:** The runtime is clean. Zero Supabase references in compiled `dist/` or in `src/`. The references that remain are in 4 categories: (1) intentional rollback config on the VPS, (2) a setup doc that pre-dates the migration, (3) old scripts that probe the cloud DB for one-time audits, (4) permission-allowlist entries in `.claude/settings.local.json` that may be useful for future rollback testing, (5) Mac-side `.env` files that only matter if you run scripts locally that target Supabase.

---

## File-by-file inventory

### 1. `.env.example` (Mac + VPS) — **CONFIG / UPDATE-COMMENT**

```
1: # Database — Supabase Postgres
2: DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:6543/postgres?pgbouncer=true"
3: DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres"
```

**Locations:**
- `/Volumes/Extra Storage/SiteDeckPM/.env.example` (Mac, 526 bytes)
- `/opt/sitedeck-pm/.env.example` (VPS, identical content, 526 bytes)

**Status:** The canonical new-starter config. Still tells the user to provision a Supabase project. This was written before the migration; it has not been updated.

**Specific lines (CONFIG):**
- L1: comment naming Supabase as the database
- L2: `DATABASE_URL` template with Supabase hostname
- L3: `DIRECT_URL` template with Supabase hostname

**Recommendation:** **Update comment to note it is legacy, add a second example block showing the self-hosted form.** Keep both forms so the file works for either deployment topology (Supabase for free-tier dev, local container for self-hosted). Do not delete — `.env.example` is a template and removing the Supabase form would break a developer following the file's instructions in a Supabase-based deployment.

---

### 2. `/Volumes/Extra Storage/SiteDeckPM/.env` (Mac) — **CONFIG / KEEP-BUT-OUTDATED**

```
1: DATABASE_URL="postgresql://postgres:Windpower2020%26@db.swtsqkroigpdeskzcnib.supabase.co:6543/postgres?pgbouncer=true"
2: DIRECT_URL="postgresql://postgres:Windpower2020%26@db.swtsqkroigpdeskzcnib.supabase.co:5432/postgres"
3: DEV_USER_ROLE=project_manager
```

**Status:** Mac-side `.env` for **local dev runs of one-off scripts** (`scripts/inspect-prod.ts`, `scripts/list-schemas.ts`, `scripts/seed-data-survey.ts`, `scripts/check-benchmark-seed.ts`, etc.). These were used in the pre-migration era to probe the Supabase DB. The PM systemd service on the VPS does **not** read this file — it reads `/opt/sitedeck-pm/.env`. The frontend build also doesn't read it.

**Specific lines (CONFIG):**
- L1: `DATABASE_URL` pointing at Supabase
- L2: `DIRECT_URL` pointing at Supabase

**Risk:** Low. Only matters if a developer runs a script from the Mac that uses `.env` instead of the explicit `DATABASE_URL=…` env var. The audit script that produced this report was itself run with an inline `DATABASE_URL=…` override, not from this `.env`.

**Recommendation:** **Update the comment to flag it as legacy / one-off-probe only.** Two equally valid options:
- **Option A (safer):** Update comment only. The file still works for probing Supabase if a developer needs to verify the cloud schema is still preserved.
- **Option B (cleaner):** Replace the URLs with the local container form (`127.0.0.1:5432/sitedeck_pm_dev` with the right credentials). Breaks any future Supabase-probe script that reads `.env`.

I recommend **Option A**. The Mac `.env` is a personal-dev-config file, not part of the deploy path. The user's mental model is "I probe Supabase from this file when I need to" — preserving that affordance costs nothing.

---

### 3. `/Volumes/Extra Storage/SiteDeckPM/frontend/.env` (Mac) — **CONFIG / DEAD**

```
1: DATABASE_URL="postgresql://postgres:Windpower2020%26@db.swtsqkroigpdeskzcnib.supabase.co:6543/postgres?pgbouncer=true"
2: DIRECT_URL="postgresql://postgres:Windpower2020%26@db.swtsqkroigpdeskzcnib.supabase.co:5432/postgres"
3: DEV_USER_ROLE=project_manager
4: VITE_GOOGLE_MAPS_API_KEY=AIzaSyC0nAg_Dw9rUHH-eGP6k85g_0A-riloaJI
5: (blank)
6: # Firebase Client SDK — site-deck project
7: VITE_FIREBASE_API_KEY=AIzaSyADR8wVfW5MhMDwiHDYSvPIKBUsA-YgbPA
8: VITE_FIREBASE_AUTH_DOMAIN=site-deck.firebaseapp.com
9: VITE_FIREBASE_PROJECT_ID=site-deck
10: VITE_FIREBASE_APP_ID=1:677357288309:web:17af96bc6bbe544f84313c
```

**Status:** Frontend build-time env. Vite only injects `VITE_*` prefixed variables into the JS bundle. The non-`VITE_*` lines (`DATABASE_URL`, `DIRECT_URL`, `DEV_USER_ROLE`) are **inert** — they never reach the browser. The deployed bundle on the VPS confirms this: the only env-derived constants in the bundle are `VITE_FIREBASE_*` and `VITE_GOOGLE_MAPS_API_KEY`. The `DATABASE_URL` and `DIRECT_URL` lines here are misleading cargo from an earlier era.

**Specific lines (CONFIG but inert):**
- L1: `DATABASE_URL` pointing at Supabase
- L2: `DIRECT_URL` pointing at Supabase
- L3: `DEV_USER_ROLE` (not Supabase, but also inert since no `VITE_` prefix)

**Recommendation:** **Update comment, leave `DATABASE_URL` and `DIRECT_URL` as-is for now.** They are inert in the build. Removing them is a stylistic change, not a functional one. A future cleanup pass should:
- Replace the `DATABASE_URL`/`DIRECT_URL` lines with a comment explaining the frontend has no DB credentials (it never did — the API server holds them)
- Keep all `VITE_FIREBASE_*` and `VITE_GOOGLE_MAPS_API_KEY` lines

---

### 4. `/opt/sitedeck-pm/.env.supabase-pre-migration` (VPS) — **BACKUP / KEEP**

```
1: DATABASE_URL=postgresql://postgres:Windpower2020&@db.swtsqkroigpdeskzcnib.supabase.co:6543/postgres?pgbouncer=true
2: DIRECT_URL=postgresql://postgres:Windpower2020&@db.swtsqkroigpdeskzcnib.supabase.co:5432/postgres
... (other env vars from before the migration)
```

**Status:** The single-source-of-truth rollback file. The migration plan (`MIGRATION_PM_TO_VPS.md`) and the `.env` architecture note both reference this file as the rollback path:
```bash
cp /opt/sitedeck-pm/.env.supabase-pre-migration /opt/sitedeck-pm/.env
systemctl restart sitedeck-pm
```

**Specific lines (BACKUP):**
- L1: `DATABASE_URL` for Supabase (rollback form)
- L2: `DIRECT_URL` for Supabase (rollback form)

**Recommendation:** **Keep as-is, do not delete.** This is the literal "fallback" the user asked about. Per `BUILD_LESSONS.md` Lesson 6 ("Don't drop the Supabase schema yet"), both the schema and the rollback config should remain until the team is confident no rollback is needed. Removal criteria: zero requests to roll back for 30+ days AND a verified second deploy to confirm the new architecture is stable.

---

### 5. `/opt/sitedeck-pm/.env` (VPS) — **CONFIG / DOCS-COMMENT**

```
... (active config, no Supabase URLs)
# ─── Architecture note (2026-06-14) ─────────────────────────────────
# DB moved from Supabase (cloud) to local sitedeck-pm-postgres
# container on the Hostinger VPS (groundcheck-infra_groundcheck
# bridge network, port 5432 published to host).
# This follows the same pattern as Benchmark
# (BUILD_LESSONS.md Lesson 6).
#
# Supabase schemas (public, benchmark) are intentionally NOT dropped.
# They still count against Supabase storage quota — drop only when
# we confirm no rollback is needed.
#
# Rollback procedure:
#   cp /opt/sitedeck-pm/.env.supabase-pre-migration /opt/sitedeck-pm/.env
#   systemctl restart sitedeck-pm
# (instant, no data loss on either side)
```

**Status:** This is the **active config** that the PM systemd service uses. It does NOT point at Supabase — the active URLs are `127.0.0.1:5432` (local container). The "Supabase" mentions in the file are all in the architecture comment that I appended during Step 7 of the migration, explaining the choice and pointing at the rollback file.

**Specific lines (DOCS within CONFIG):**
- The architecture comment block refers to "Supabase" 4 times (in explaining the migration history, the rollback procedure, the storage-quota consideration, and the BUILD_LESSONS reference).

**Recommendation:** **Keep as-is.** This is the right kind of breadcrumb — anyone reading `.env` six months from now should know why it's not pointing at Supabase, where the rollback lives, and what the lessons reference is.

---

### 6. `/Volumes/Extra Storage/SiteDeckPM/SETUP.md` — **DOCS / UPDATE**

The entire `SETUP.md` is a 5-step guide that pre-dates the migration. It walks the user through:
1. Create a free database (Supabase)
2. Configure the app (paste Supabase connection string)
3. Create tables & seed data
4. Start the server
5. Test it
6. Deploy to Vercel

**Status:** Stale. The current architecture is:
- Database: self-hosted Postgres container on the VPS (not Supabase)
- Deploy: not Vercel; the VPS runs systemd + Docker

**Specific lines (DOCS):**
- L5: "Go to [supabase.com](https://supabase.com) → Sign up → New Project"
- L8: Connection string example `postgresql://postgres:password@db.xxx.supabase.co:5432/postgres`
- L16: "Paste your Supabase connection string into `.env`:"
- L19: `DATABASE_URL=postgresql://postgres:your-password@db.xxx.supabase.co:5432/postgres`
- L55: "`DATABASE_URL` → your Supabase connection string"
- L69: "| Database | Supabase (free tier) |"

**Recommendation:** **Update comment to note it is legacy. Replace Step 1 with a one-liner pointing at the migration plan and a stub showing the local container form, OR delete the file entirely.** Two equally valid options:
- **Option A:** Rewrite `SETUP.md` to reflect the new architecture (self-hosted container + systemd + Traefik). Significant edit but produces a doc that's actually useful.
- **Option B:** Delete `SETUP.md` and replace with a 5-line pointer to `MIGRATION_PM_TO_VPS.md`. Simpler; the migration plan has all the operational context.

I recommend **Option A** if there's likely to be future new-hire setup; **Option B** if `MIGRATION_PM_TO_VPS.md` is the only on-ramp going forward.

---

### 7. `/Volumes/Extra Storage/SiteDeckPM/MIGRATION_PM_TO_VPS.md` — **DOCS / KEEP**

**Status:** The migration plan itself. Mentions Supabase 39 times across 504 lines, by design — every place the old architecture, the rollback path, or the "what we left in place" decision is discussed.

**Specific lines (DOCS):**
- L1, L6, L12, L16, L22, L33, L37, L38, L40, L46, L53, L67-72, L148, L152, L157, L160, L161, L173, L177, L185, L224, L228, L231, L304, L376, L383, L386, L387, L397, L414, L419, L420, L432, L499, L501, L502, L504

These are all in: the title, the goal statement, the "what we left in place" callouts, the pre-flight checklist, the step-by-step commands (which use Supabase as the source of the rollback), the rollback procedures, and the final-state summary.

**Recommendation:** **Keep as-is.** This is the canonical record of the migration. Every Supabase mention here is intentional and informative. Removing them would make the doc meaningless.

---

### 8. `/Volumes/Extra Storage/SiteDeckPM/SPRINT_3_LOG.md` — **DOCS / KEEP**

**Status:** Historical sprint log. The 4 Supabase references are in the migration-applied log entries from Sprint 3:
- L93: "Migration applied to Supabase"
- L204: "`20260606222411_add_meetings_table` (applied to Supabase)"
- L330: "`20260607114417_add_required_date_to_rfis_submittals` (applied to Supabase)"
- L467: "Migrations deployed in this sprint (already applied to Supabase from local dev)"

**Recommendation:** **Keep as-is.** Sprint logs are historical records. Rewriting them to say "applied to local container" would be retroactive and incorrect — at the time of Sprint 3, the migrations WERE applied to Supabase. They were later moved to the local container on 2026-06-14 (a future sprint from Sprint 3's perspective). The current state is what the migration plan documents; the Sprint 3 log describes what happened during Sprint 3.

---

### 9. `/Volumes/Extra Storage/SiteDeckPM/SPRINT_4_LOG.md` — **DOCS / KEEP**

**Status:** Same as SPRINT_3_LOG.md. Two references:
- L13: "Ran per-project trirTarget updates against the production Supabase database"
- L114: "`20260607125504_add_issue_notes` (applied to Supabase)"

**Recommendation:** **Keep as-is.** Historical record. Same justification as Sprint 3.

---

### 10. `/Volumes/Extra Storage/SiteDeckPM/scripts/grant-support-admin.ts` — **DEAD / KEEP-BUT-MARK**

**Status:** A pre-migration script. Reads from a Supabase `DATABASE_URL` (via the user's env, with the `db.swtsqkroigpdeskzcnib.supabase.co` URL shown in the JSDoc usage example on L12). The script does a Firebase UID lookup, sets custom claims, and upserts org/project rows. It was used before the migration to give `support@sitedeck.pro` access to a Supabase-backed PM.

**Specific lines (DOCS within DEAD script):**
- L12: usage example showing `export DATABASE_URL="postgresql://postgres:...@db.swtsqkroigpdeskzcnib.supabase.co:6543/postgres?pgbouncer=true"`

**Risk:** Low. The script has the URL in a JSDoc comment; it would work fine if invoked with a local-container URL. The Supabase mention is purely documentation of "how this was used in 2026."

**Recommendation:** **Update comment to note it is legacy.** Two equally valid options:
- **Option A (lighter):** Add a one-line note at the top of the file pointing to `scripts/bootstrap-support-user.ts` as the post-migration replacement.
- **Option B (cleaner):** Replace the URL in the usage example with the local-container form, plus add the same note.

I recommend **Option A** because the script might still be useful for a one-off Firebase role-claim reset (the actual Firebase logic — `setCustomUserClaims`, etc. — is orthogonal to which DB it then writes to).

---

### 11. `/Volumes/Extra Storage/SiteDeckPM/scripts/list-schemas.ts` — **DEAD / KEEP-BUT-MARK**

**Status:** A 26-line diagnostic script that lists schemas in the database it connects to. The "Schemas in prod Supabase" console.log on L7 is misleading after the migration — the script, run against the local container, would print "Schemas in prod Supabase" and then show the local container's schemas (which are just `public`).

**Specific lines (DEAD):**
- L7: `console.log('Schemas in prod Supabase:');`

**Risk:** Cosmetic. No code behavior changes — only the log message lies.

**Recommendation:** **Update comment to note it is legacy.** Change L7 to `console.log('Schemas in the connected database:');` (1 word changed). This is a 5-second edit and makes the script usable post-migration.

---

### 12. `/Volumes/Extra Storage/SiteDeckPM/.claude/settings.local.json` — **CONFIG / KEEP-WITH-CAVEAT**

**Status:** Claude Code's permission allowlist. The 7 Supabase-related entries are `Bash(...)` allowlists for one-off diagnostic commands used during the pre-migration investigation (June 12-13):

- L22: `"WebFetch(domain:supabase.com)"` — allows fetching Supabase docs (e.g., for migration guidance)
- L56: `"Bash(PGPASSWORD='Windpower2020&' psql -h db.swtsqkroigpdeskzcnib.supabase.co ...)"` — direct psql to Supabase
- L57: `"Bash(DATABASE_URL='postgresql://postgres:Windpower2020&@db.swtsqkroigpdeskzcnib.supabase.co:6543/postgres?pgbouncer=true' node -e ' *)"` — node script against Supabase
- L95-99: Five more `npx ts-node scripts/...` variants all targeting Supabase

**Specific lines (CONFIG):**
- L22, L56, L57, L95, L96, L97, L98, L99

**Risk:** Low. These are permission grants, not executed code. They allow future Claude sessions to probe Supabase if asked, but don't trigger anything on their own.

**Recommendation:** **Keep with caveat.** Two arguments for keeping them:
1. **Rollback testing.** If we ever need to verify that the Supabase schema is still intact (per Lesson 6's "confirm we don't need it" criterion), having the allowlist pre-populated means a future Claude session can do `npx ts-node scripts/seed-data-survey.ts` against Supabase without an extra permission prompt.
2. **Forward-compat for re-migration.** If a future Sprint migrates back to Supabase, or migrates a sibling service, these allowlists save permission-prompt time.

One argument for removing them: zero-trust posture — don't grant permissions for resources that aren't actively used. The user can decide based on their security model. I lean toward **keep** because the rollback use case is real and the cost is negligible (these are local Claude Code permission rules, not network ACLs).

---

## Recommendation rollup

| File | Lines | Category | Recommendation |
|---|---|---|---|
| `.env.example` (Mac + VPS) | L1-3 | CONFIG | **Update comment to note legacy, add self-hosted form** |
| `/.env` (Mac) | L1-2 | CONFIG | **Update comment to flag as one-off-probe legacy** |
| `/frontend/.env` (Mac) | L1-3 | CONFIG (inert) | **Update comment, leave URLs as-is** (or remove the inert DB lines) |
| `/opt/sitedeck-pm/.env.supabase-pre-migration` | L1-2 | BACKUP | **Keep as-is** (rollback target) |
| `/opt/sitedeck-pm/.env` | comment block | DOCS within CONFIG | **Keep as-is** (architecture breadcrumb) |
| `/SETUP.md` | 6 lines | DOCS | **Update or replace** (rewrite for new architecture, or delete and point at MIGRATION plan) |
| `/MIGRATION_PM_TO_VPS.md` | 39 lines | DOCS | **Keep as-is** (canonical migration record) |
| `/SPRINT_3_LOG.md` | 4 lines | DOCS | **Keep as-is** (historical record) |
| `/SPRINT_4_LOG.md` | 2 lines | DOCS | **Keep as-is** (historical record) |
| `/scripts/grant-support-admin.ts` | L12 | DOCS within DEAD | **Update comment** to point at `bootstrap-support-user.ts` |
| `/scripts/list-schemas.ts` | L7 | DEAD (cosmetic) | **Update the log message** from "Schemas in prod Supabase" to "Schemas in the connected database" |
| `/.claude/settings.local.json` | 8 entries | CONFIG | **Keep with caveat** (rollback testing) |

---

## Out-of-scope (per user's instruction)

- **Supabase cloud schema** (`public` and `benchmark`): **untouched, 0 rows in each, 45 + 18 tables intact.** Not dropped per `BUILD_LESSONS.md` Lesson 6. Will remain until a future "drop" sprint with explicit user sign-off.
- **No files were modified by this audit.** Only `SUPABASE_AUDIT.md` was written.

---

## Risk assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Someone runs an old script (`grant-support-admin.ts`) with the stale URL | Low | Low (script targets wrong DB but doesn't break anything) | Update the JSDoc usage example (Option A above) |
| A new developer follows `SETUP.md` and provisions Supabase | Medium | Medium (wasted time) | Update or delete `SETUP.md` |
| A script reads Mac `.env` thinking it's current, hits Supabase | Low | Low (Supabase is empty anyway) | Update the Mac `.env` comment |
| The `.env.supabase-pre-migration` rollback file is deleted prematurely | Low | High (no rollback path) | Keep with a clear naming convention; do not delete until the user explicitly says so |
| The `.claude/settings.local.json` allowlist is cleaned by a future session | Low | Low (just adds a permission prompt) | Acceptable |

---

**End of audit. No files modified except this report.**
