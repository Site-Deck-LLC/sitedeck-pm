/**
 * scripts/check-prod-auth.ts
 * ============================================================================
 * Pre-deploy verification for production auth. Run before promoting a build:
 *
 *   npx ts-node scripts/check-prod-auth.ts
 *
 * Exits non-zero if anything required is missing. Warns (but exits 0) for
 * recommended-but-not-required items. Designed to be safe to run in dev too —
 * it'll just show "NOT SET" for everything.
 *
 * Checks performed:
 *   - NODE_ENV is 'production'
 *   - GOOGLE_APPLICATION_CREDENTIALS points to a readable JSON file
 *   - The credential file has the required service-account fields
 *   - FIREBASE_PROJECT_ID is set
 *   - Frontend VITE_FIREBASE_* env vars are set (if .env.production exists)
 *   - An admin SDK can be initialized with the configured creds
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

interface Check {
  name: string;
  status: 'OK' | 'WARN' | 'FAIL';
  detail: string;
}

const checks: Check[] = [];
const fail = (name: string, detail: string) => checks.push({ name, status: 'FAIL', detail });
const warn = (name: string, detail: string) => checks.push({ name, status: 'WARN', detail });
const ok = (name: string, detail: string) => checks.push({ name, status: 'OK', detail });

// 1. NODE_ENV
if (process.env.NODE_ENV === 'production') {
  ok('NODE_ENV', 'production');
} else {
  warn('NODE_ENV', `not 'production' (current: ${process.env.NODE_ENV || 'unset'}) — running this check in dev mode is fine for setup, but the deployed service must be 'production'`);
}

// 2. GOOGLE_APPLICATION_CREDENTIALS
const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credsPath) {
  fail('GOOGLE_APPLICATION_CREDENTIALS', 'unset — server cannot verify Firebase ID tokens');
} else if (!fs.existsSync(credsPath)) {
  fail('GOOGLE_APPLICATION_CREDENTIALS', `set to ${credsPath} but file does not exist`);
} else {
  try {
    const content = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
    const required = ['type', 'project_id', 'private_key', 'client_email'];
    const missing = required.filter((f) => !content[f]);
    if (missing.length > 0) {
      fail('Service account key', `missing fields: ${missing.join(', ')}`);
    } else {
      ok('Service account key', `${credsPath} (project: ${content.project_id}, client: ${content.client_email})`);
    }
  } catch (e: any) {
    fail('Service account key', `not parseable JSON: ${e.message}`);
  }
}

// 3. FIREBASE_PROJECT_ID
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  fail('FIREBASE_PROJECT_ID', 'unset');
} else {
  ok('FIREBASE_PROJECT_ID', projectId);
}

// 4. Frontend env
const frontendEnvPath = path.resolve(__dirname, '../frontend/.env.production');
if (fs.existsSync(frontendEnvPath)) {
  const env = fs.readFileSync(frontendEnvPath, 'utf-8');
  const need = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];
  const missing = need.filter((k) => !new RegExp(`^${k}=`, 'm').test(env));
  if (missing.length > 0) {
    fail('Frontend .env.production', `missing keys: ${missing.join(', ')}`);
  } else {
    ok('Frontend .env.production', 'all VITE_FIREBASE_* keys present');
  }
} else {
  warn('Frontend .env.production', `${frontendEnvPath} not found — if you're serving a frontend build, the login page will show "no Firebase config"`);
}

// 5. Try to initialize admin SDK (best effort, may not work without network)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admin = require('firebase-admin');
  if (admin.apps.length === 0 && credsPath) {
    try {
      admin.initializeApp({ credential: admin.credential.cert(credsPath) });
      ok('firebase-admin init', 'succeeded');
    } catch (e: any) {
      fail('firebase-admin init', e.message);
    }
  } else if (admin.apps.length > 0) {
    ok('firebase-admin init', 'already initialized');
  } else {
    warn('firebase-admin init', 'skipped (no creds path)');
  }
} catch (e: any) {
  warn('firebase-admin init', `skipped — firebase-admin not installed: ${e.message}`);
}

// Report
console.log('\n=== Production Auth Check ===\n');
const width = Math.max(...checks.map((c) => c.name.length));
for (const c of checks) {
  const color = c.status === 'OK' ? '\x1b[32m' : c.status === 'WARN' ? '\x1b[33m' : '\x1b[31m';
  console.log(`  ${color}${c.status.padEnd(4)}\x1b[0m  ${c.name.padEnd(width)}  ${c.detail}`);
}

const failed = checks.filter((c) => c.status === 'FAIL').length;
const warned = checks.filter((c) => c.status === 'WARN').length;
console.log(`\n${failed === 0 ? '\x1b[32m' : '\x1b[31m'}${failed} failed, ${warned} warned\x1b[0m\n`);

process.exit(failed === 0 ? 0 : 1);
