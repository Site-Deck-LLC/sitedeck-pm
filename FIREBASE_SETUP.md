# Firebase Auth Production Setup

## Current Status (Sprint 4, Task 8)

The Firebase Auth integration is **infrastructure-ready** but **requires manual
configuration** before going to production. The application will run in dev mode
without configuration.

## What was built in Task 8

1. **Frontend Firebase client SDK** (`frontend/src/firebase.ts`):
   - Auto-detects VITE_FIREBASE_* env vars
   - Returns `null` if not configured (dev mode fallback)
2. **Login page** (`frontend/src/components/Login.tsx`):
   - Production mode: `signInWithEmailAndPassword` → ID token → continue
   - Dev mode: any email/password → `dev-token` from `/api/v1/auth/login-dev`
   - Dev role picker for testing different role contexts
3. **Server startup check** (`src/server.ts`):
   - Production: refuses to start without Firebase credentials
   - Dev: warns loudly that dev-token bypass is active
4. **Auth middleware hardening** (`src/middleware/express-auth.ts`):
   - `dev-token` returns 401 in production

## Production Deployment Steps

### 1. Create a Firebase project

1. Go to https://console.firebase.google.com/
2. Create a new project (or use the existing SiteDeck one)
3. Enable Email/Password sign-in under **Authentication → Sign-in method**

### 2. Get a service account key (server side)

1. In the Firebase console: **Project settings → Service accounts**
2. Click "Generate new private key"
3. Save the JSON file somewhere safe on the VPS (e.g. `/opt/sitedeck-pm/firebase-key.json`)
4. On the VPS, set:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=/opt/sitedeck-pm/firebase-key.json
   ```

### 3. Get the web app config (client side)

1. In the Firebase console: **Project settings → General → Your apps**
2. Click the **Web app** (create one if you don't have it)
3. Copy the config object
4. On the VPS or in the frontend `.env`:
   ```
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_APP_ID=1:1234567890:web:abc...
   ```

### 4. Create test users

In the Firebase console: **Authentication → Users → Add user**

Then set their custom claim (the role) using a one-off Node script:

```ts
// scripts/set-user-role.ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

initializeApp({ credential: cert(require('/opt/sitedeck-pm/firebase-key.json')) });

const [uid, role] = process.argv.slice(2);
if (!uid || !role) {
  console.error('Usage: ts-node scripts/set-user-role.ts <uid> <role>');
  process.exit(1);
}

await getAuth().setCustomUserClaims(uid, { role });
console.log(`Set role=${role} for uid=${uid}`);
```

### 5. Verify

- Restart the backend on the VPS
- Open the frontend in a browser
- The login page should show "Production auth — Firebase sign-in" instead of the dev role picker
- Sign in with one of the test users
- The header should show the role from the custom claim

## Canonical role names

Per CLAUDE.md, the canonical role names are:

- `owner_admin`
- `project_manager`
- `superintendent`
- `supervisor`
- `field_crew`
- `subcontractor_pm`
- `subcontractor_super`
- `owners_rep`
- `accountant_ap`

The custom claim must be exactly one of these strings.

## What still needs to happen in a future sprint

- ID token refresh handling (currently the client gets a new ID token on every page load via `getIdToken()`)
- Password reset flow
- Account lockout / brute force protection (Firebase handles this automatically, but audit logs should be reviewed)
- Multi-factor auth (optional, V2)
- Webhook from Firebase → SiteDeck PM when a user is created/deleted in Firebase, to mirror the user record into our Postgres
