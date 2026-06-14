/**
 * scripts/bootstrap-support-user.ts
 * ============================================================================
 * One-shot bootstrap for support@sitedeck.pro:
 *   1. Insert Organization row using the user's actual claim orgId
 *      (sWGfCibWkRJ0X5T9rJHs) — not org-dev
 *   2. Insert OrganizationMember row linking support → that org
 *   3. Insert a starter "Test EPC Project" tied to that org
 *   4. Insert a ProjectMember row linking support → that project
 *   5. Optionally seed a few schedule activities, RFI seed, submittal seed
 *      so the dashboard isn't just a card with a name
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." \
 *   GOOGLE_APPLICATION_CREDENTIALS=/Volumes/Extra\ Storage/SiteDeckPro/functions/serviceAccountKey1.json \
 *   FIREBASE_PROJECT_ID=site-deck \
 *   npx ts-node scripts/bootstrap-support-user.ts
 * ============================================================================
 */

import * as admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';

const SUPPORT_UID = 'BJedHsm0LTXHiJokkZStXw9N18H2';
const SUPPORT_EMAIL = 'support@sitedeck.pro';
// The Firebase claim says the user's org is sWGfCibWkRJ0X5T9rJHs. We use that
// for all rows so future "list users in my org" queries will see this project.
const ORG_ID = 'sWGfCibWkRJ0X5T9rJHs';
const ORG_NAME = 'SiteDeck (support)';
const PROJECT_ID = 'proj-support-seed';
const PROJECT_NAME = 'Test EPC Project';
const SEED_ACTIVITIES = 5;

async function main() {
  // Init Firebase Admin just to confirm the uid is reachable
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

  const prisma = new PrismaClient();
  const auth = admin.auth();

  // ── Confirm the user exists ────────────────────────────────────────
  const fbUser = await auth.getUser(SUPPORT_UID);
  console.log(`[firebase] confirmed uid=${fbUser.uid} email=${fbUser.email} claims=${JSON.stringify(fbUser.customClaims || {})}`);

  // ── 1. Organization ────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: { name: ORG_NAME },
    create: {
      id: ORG_ID,
      name: ORG_NAME,
      type: 'general_contractor',
      createdBy: SUPPORT_UID,
    },
  });
  console.log(`[db] organization ${org.id} (${org.name})`);

  // ── 2. OrganizationMember ──────────────────────────────────────────
  const orgMember = await prisma.organizationMember.upsert({
    where: { id: `om-${ORG_ID}-${SUPPORT_UID}` },
    update: {
      status: 'active',
      role: 'owner_admin',
      joinedAt: new Date(),
      email: SUPPORT_EMAIL,
      displayName: 'SiteDeck Support',
    },
    create: {
      id: `om-${ORG_ID}-${SUPPORT_UID}`,
      orgId: ORG_ID,
      userId: SUPPORT_UID,
      email: SUPPORT_EMAIL,
      displayName: 'SiteDeck Support',
      role: 'owner_admin',
      invitedBy: SUPPORT_UID,
      invitedAt: new Date(),
      joinedAt: new Date(),
      status: 'active',
    },
  });
  console.log(`[db] organizationMember ${orgMember.id} (role=${orgMember.role})`);

  // ── 3. Project ─────────────────────────────────────────────────────
  const project = await prisma.project.upsert({
    where: { id: PROJECT_ID },
    update: { name: PROJECT_NAME, orgId: ORG_ID },
    create: {
      id: PROJECT_ID,
      name: PROJECT_NAME,
      status: 'active',
      orgId: ORG_ID,
      structureType: 'WBS',
      city: 'Midland',
      state: 'TX',
      contractValue: 12_500_000,
      latitude: 31.9973,
      longitude: -102.0779,
    },
  });
  console.log(`[db] project ${project.id} (${project.name})`);

  // ── 4. ProjectMember ───────────────────────────────────────────────
  const projectMember = await prisma.projectMember.upsert({
    where: { id: `pm-${PROJECT_ID}-${SUPPORT_UID}` },
    update: { status: 'active', role: 'owner_admin' },
    create: {
      id: `pm-${PROJECT_ID}-${SUPPORT_UID}`,
      projectId: PROJECT_ID,
      userId: SUPPORT_UID,
      email: SUPPORT_EMAIL,
      displayName: 'SiteDeck Support',
      role: 'owner_admin',
      addedBy: SUPPORT_UID,
      status: 'active',
    },
  });
  console.log(`[db] projectMember ${projectMember.id} (role=${projectMember.role})`);

  // ── 5. Seed a few schedule activities so the Gantt isn't empty ────
  const activityRows = [
    { id: 'a-1000', name: 'Site mobilization', startOffset: 0,  durationDays: 5  },
    { id: 'a-1001', name: 'Excavation & footings', startOffset: 5,  durationDays: 12 },
    { id: 'a-1002', name: 'Foundation pour', startOffset: 17, durationDays: 4  },
    { id: 'a-1003', name: 'Structural steel', startOffset: 21, durationDays: 20 },
    { id: 'a-1004', name: 'MEP rough-in', startOffset: 41, durationDays: 18 },
  ];
  const projectStart = new Date();
  for (const a of activityRows) {
    const start = new Date(projectStart);
    start.setDate(start.getDate() + a.startOffset);
    const end = new Date(start);
    end.setDate(end.getDate() + a.durationDays);
    await prisma.scheduleActivity.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        projectId: PROJECT_ID,
        name: a.name,
        startDate: start,
        endDate: end,
        duration: a.durationDays,
        percentComplete: 0,
        status: 'planned',
      },
    }).catch((e) => {
      // Some deployments may not have a scheduleActivity table — skip silently
      console.log(`  (skip activity ${a.id}: ${e.message?.slice(0, 80)})`);
    });
  }
  console.log(`[db] seeded ${SEED_ACTIVITIES} schedule activities (best-effort)`);

  // ── Verification report ────────────────────────────────────────────
  console.log('\n=== Verification ===');
  console.log(`Firebase user:     ${fbUser.uid}  claims=${JSON.stringify(fbUser.customClaims || {})}`);
  console.log(`Org members:       ${await prisma.organizationMember.count()}`);
  console.log(`Projects:          ${await prisma.project.count()}`);
  console.log(`Project members:   ${await prisma.projectMember.count()}`);

  console.log('\n✅ Bootstrap done. Sign out of https://projects.sitedeck.pro and sign back in');
  console.log('   to pick up the new project in the dashboard list.');

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('Failed:', e);
  process.exit(1);
});
