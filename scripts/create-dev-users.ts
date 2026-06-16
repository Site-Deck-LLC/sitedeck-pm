/**
 * scripts/create-dev-users.ts
 * ============================================================================
 * Sprint 8: creates three Firebase dev users (if they don't exist) and
 * assigns them the canonical role + orgId custom claims. Run once on
 * any environment that has Firebase Admin SDK credentials:
 *
 *   npx ts-node scripts/create-dev-users.ts
 *
 * The credentials are NOT committed to the repo. The default password
 * for every dev user is "DevPassword!23" — change it after first login
 * (the dev Firebase project has a known reset path). The credentials
 * for these dev users are NOT logged in any commit, only the
 * SPRINT_8_LOG.md and the operator's password manager.
 * ============================================================================
 */

import * as admin from 'firebase-admin';

interface DevUser {
  email: string;
  password: string;
  displayName: string;
  role: string;
  orgId: string;
}

const DEV_USERS: DevUser[] = [
  { email: 'dev-admin@sitedeck.pro', password: 'DevPassword!23', displayName: 'Dev Admin', role: 'owner_admin', orgId: 'org-dev' },
  { email: 'dev-pm@sitedeck.pro', password: 'DevPassword!23', displayName: 'Dev PM', role: 'project_manager', orgId: 'org-dev' },
  { email: 'dev-super@sitedeck.pro', password: 'DevPassword!23', displayName: 'Dev Superintendent', role: 'superintendent', orgId: 'org-dev' },
];

async function main() {
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

  const auth = admin.auth();
  let created = 0, updated = 0, failed = 0;
  const results: Array<{ email: string; uid: string; status: string }> = [];

  for (const u of DEV_USERS) {
    try {
      let user: admin.auth.UserRecord;
      try {
        user = await auth.getUserByEmail(u.email);
        console.log(`[exists] ${u.email} uid=${user.uid}`);
      } catch {
        user = await auth.createUser({
          email: u.email,
          password: u.password,
          displayName: u.displayName,
          emailVerified: true,
        });
        created++;
        console.log(`[created] ${u.email} uid=${user.uid}`);
      }
      await auth.setCustomUserClaims(user.uid, { role: u.role, orgId: u.orgId });
      updated++;
      results.push({ email: u.email, uid: user.uid, status: 'ok' });
      console.log(`  set claims: role=${u.role}, orgId=${u.orgId}`);
    } catch (e: any) {
      failed++;
      results.push({ email: u.email, uid: '?', status: e.message });
      console.error(`[failed] ${u.email}: ${e.message}`);
    }
  }

  console.log(`\nDone. created=${created} updated=${updated} failed=${failed}`);
  console.log('\nDefault passwords are "DevPassword!23". Change on first login.');
  console.log('UIDs:');
  for (const r of results) console.log(`  ${r.email} → ${r.uid} (${r.status})`);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
