// LEGACY — pre-migration script (2026-06-14)
// Use scripts/bootstrap-support-user.ts instead
// This script still works but the JSDoc usage
// example below shows the old Supabase URL

/**
 * scripts/grant-support-admin.ts
 * ============================================================================
 * One-shot: promote support@sitedeck.pro to owner_admin on the dev seed,
 * add an OrganizationMember + ProjectMember link, and seed a "Test EPC
 * Project" if it's missing. Idempotent — safe to re-run.
 *
 * Usage (run from your workstation, NOT from the agent sandbox):
 *
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-service-account.json
 *   export FIREBASE_PROJECT_ID=sitedeck-pm
 *   export DATABASE_URL="postgresql://postgres:...@db.swtsqkroigpdeskzcnib.supabase.co:6543/postgres?pgbouncer=true"
 *   npx ts-node scripts/grant-support-admin.ts
 *
 * What it does:
 *   1. Look up support@sitedeck.pro in Firebase Auth → get UID
 *   2. setCustomUserClaims(uid, { role: 'owner_admin', orgId: 'org-dev' })
 *   3. Upsert Organization row 'org-dev' if missing
 *   4. Upsert OrganizationMember row linking uid → 'org-dev'
 *   5. Upsert Project 'seed-test-epc' if missing
 *   6. Upsert ProjectMember row linking uid → 'seed-test-epc'
 *   7. Print a verification report
 *
 * Notes:
 *   - listProjects() in project.service.ts does NOT filter by membership —
 *     it returns everything. So the only thing strictly required to see the
 *     dashboard populate is the role claim + the project existing in the DB.
 *   - OrganizationMember/ProjectMember rows matter for permission checks on
 *     per-project actions, even if the project list itself is unfiltered.
 * ============================================================================
 */

import * as admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';

const SUPPORT_EMAIL = 'support@sitedeck.pro';
const ORG_ID = 'org-dev';
const SEED_PROJECT_ID = 'seed-test-epc';
const SEED_PROJECT_NAME = 'Test EPC Project';
const SEED_PROJECT_CITY = 'Midland';
const SEED_PROJECT_STATE = 'TX';

async function main() {
  // 1. Firebase Admin init
  if (admin.apps.length === 0) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    } else {
      console.error('No Firebase credentials. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID.');
      process.exit(1);
    }
  }

  // 2. Prisma init
  const prisma = new PrismaClient();

  const auth = admin.auth();

  // ── Step 1: Look up the Firebase user ────────────────────────────────
  let uid: string;
  try {
    const u = await auth.getUserByEmail(SUPPORT_EMAIL);
    uid = u.uid;
    console.log(`[firebase] ${SUPPORT_EMAIL} already exists → uid=${uid}`);
  } catch {
    console.error(`[firebase] ${SUPPORT_EMAIL} does NOT exist in Firebase Auth.`);
    console.error('  Create the user in the Firebase console first, then re-run.');
    console.error('  https://console.firebase.google.com → Authentication → Add user');
    process.exit(1);
  }

  // ── Step 2: Set custom claims (role + orgId) ─────────────────────────
  await auth.setCustomUserClaims(uid, { role: 'owner_admin', orgId: ORG_ID });
  console.log(`[firebase] set claims: role=owner_admin, orgId=${ORG_ID}`);

  // ── Step 3: Upsert Organization row ─────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: { name: 'SiteDeck Dev' },
    create: { id: ORG_ID, name: 'SiteDeck Dev', type: 'general_contractor', createdBy: uid },
  });
  console.log(`[db] organization: ${org.id} (${org.name})`);

  // ── Step 4: Upsert OrganizationMember row ──────────────────────────
  const orgMemberId = `om-${ORG_ID}-${uid}`;
  const orgMember = await prisma.organizationMember.upsert({
    where: { id: orgMemberId },
    update: {
      status: 'active',
      role: 'owner_admin',
      joinedAt: new Date(),
      email: SUPPORT_EMAIL,
      displayName: 'SiteDeck Support',
    },
    create: {
      id: orgMemberId,
      orgId: ORG_ID,
      userId: uid,
      email: SUPPORT_EMAIL,
      displayName: 'SiteDeck Support',
      role: 'owner_admin',
      invitedBy: uid,
      invitedAt: new Date(),
      joinedAt: new Date(),
      status: 'active',
    },
  });
  console.log(`[db] organizationMember: ${orgMember.id} (role=${orgMember.role}, status=${orgMember.status})`);

  // ── Step 5: Upsert the seed project ─────────────────────────────────
  const project = await prisma.project.upsert({
    where: { id: SEED_PROJECT_ID },
    update: { name: SEED_PROJECT_NAME },
    create: {
      id: SEED_PROJECT_ID,
      name: SEED_PROJECT_NAME,
      status: 'active',
      city: SEED_PROJECT_CITY,
      state: SEED_PROJECT_STATE,
      contractAmount: 12_500_000,
      latitude: 31.9973,
      longitude: -102.0779,
      createdBy: uid,
    },
  });
  console.log(`[db] project: ${project.id} (${project.name})`);

  // ── Step 6: Upsert ProjectMember row ───────────────────────────────
  const projectMemberId = `pm-${SEED_PROJECT_ID}-${uid}`;
  const projectMember = await prisma.projectMember.upsert({
    where: { id: projectMemberId },
    update: { status: 'active', role: 'owner_admin' },
    create: {
      id: projectMemberId,
      projectId: SEED_PROJECT_ID,
      userId: uid,
      email: SUPPORT_EMAIL,
      displayName: 'SiteDeck Support',
      role: 'owner_admin',
      addedBy: uid,
      status: 'active',
    },
  });
  console.log(`[db] projectMember: ${projectMember.id} (role=${projectMember.role}, status=${projectMember.status})`);

  // ── Step 7: Print verification report ───────────────────────────────
  console.log('\n=== Verification ===');
  const u = await auth.getUser(uid);
  console.log(`Firebase uid:        ${u.uid}`);
  console.log(`Custom claims:       ${JSON.stringify(u.customClaims || {})}`);
  console.log(`Org member role:     ${(await prisma.organizationMember.findUnique({ where: { id: orgMemberId } }))?.role}`);
  console.log(`Project member role: ${(await prisma.projectMember.findUnique({ where: { id: projectMemberId } }))?.role}`);
  console.log(`Total projects:      ${await prisma.project.count()}`);
  console.log(`Total org members:   ${await prisma.organizationMember.count()}`);

  console.log('\n✅ Done.');
  console.log('  1. Set a password for support@sitedeck.pro in the Firebase console');
  console.log('     (Authentication → Users → ⋮ → Reset password).');
  console.log('  2. Sign out of https://projects.sitedeck.pro.');
  console.log('  3. Sign back in — a fresh ID token picks up the new claims.');
  console.log('  4. The dashboard should now list "Test EPC Project".');

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('Failed:', e);
  process.exit(1);
});
