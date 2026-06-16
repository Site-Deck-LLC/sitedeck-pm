// Quick diagnostic: what users are in prod Postgres via Firebase Auth?
// Also dump the project list so we know if the dev seed is missing.

import * as admin from 'firebase-admin';

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
  const targetEmails = [
    'support@sitedeck.pro',
    'dev-admin@sitedeck.pro',
    'dev-pm@sitedeck.pro',
    'dev-super@sitedeck.pro',
  ];
  console.log('=== Firebase Auth user lookup ===');
  for (const email of targetEmails) {
    try {
      const u = await auth.getUserByEmail(email);
      console.log(`\n${email}`);
      console.log(`  uid: ${u.uid}`);
      console.log(`  displayName: ${u.displayName || '(none)'}`);
      console.log(`  customClaims: ${JSON.stringify(u.customClaims || {})}`);
      console.log(`  disabled: ${u.disabled}`);
      console.log(`  lastSignIn: ${u.metadata.lastSignInTime}`);
    } catch (e: any) {
      console.log(`\n${email}: NOT FOUND (${e.message})`);
    }
  }
  process.exit(0);
}

main();
