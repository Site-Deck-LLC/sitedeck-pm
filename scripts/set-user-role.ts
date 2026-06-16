/**
 * scripts/set-user-role.ts
 * ============================================================================
 * Sets a custom claim on a Firebase user. Per FIREBASE_SETUP.md, every user
 * must have a `role` custom claim that matches the canonical name in
 * CLAUDE.md (owner_admin, project_manager, etc.). Run from the deploy
 * workstation or VPS:
 *
 *   npx ts-node scripts/set-user-role.ts <uid> <role>
 *
 * Reads creds from GOOGLE_APPLICATION_CREDENTIALS (or FIREBASE_PROJECT_ID +
 * the JSON pointed to). Refuses to set unknown roles.
 * ============================================================================
 */

import * as admin from 'firebase-admin';

const VALID_ROLES = new Set([
  'owner_admin',
  'project_manager',
  'superintendent',
  'supervisor',
  'field_crew',
  'subcontractor_pm',
  'subcontractor_super',
  'owners_rep',
  'accountant_ap',
]);

const [uid, role] = process.argv.slice(2);
if (!uid || !role) {
  console.error('Usage: ts-node scripts/set-user-role.ts <uid> <role>');
  process.exit(1);
}

if (!VALID_ROLES.has(role)) {
  console.error(`Unknown role "${role}". Must be one of:\n  ${Array.from(VALID_ROLES).join('\n  ')}`);
  process.exit(1);
}

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

try {
  await admin.auth().setCustomUserClaims(uid, { role });
  console.log(`Set role=${role} for uid=${uid}`);
  console.log('Note: user must sign out and back in (or refresh their ID token) for the claim to take effect.');
} catch (e: any) {
  console.error(`Failed: ${e.message}`);
  process.exit(1);
}
