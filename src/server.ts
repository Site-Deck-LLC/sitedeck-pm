import app from './index';

const PORT = process.env.PORT || 3000;

// Firebase Admin configuration check.
// The Firebase Admin SDK is initialized lazily on first verifyIdToken call.
// In production (NODE_ENV=production), the dev-token bypass is disabled — the
// app requires real Firebase ID tokens. This means if Firebase Admin is not
// configured (no GOOGLE_APPLICATION_CREDENTIALS, no FIREBASE_PROJECT_ID), no
// request will succeed.
//
// We warn loudly at startup so this is visible in deploy logs.
const isProd = process.env.NODE_ENV === 'production';
const hasGoogleCreds = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const hasFirebaseProject = Boolean(process.env.FIREBASE_PROJECT_ID);
if (!hasGoogleCreds && !hasFirebaseProject) {
  if (isProd) {
    console.error(
      '[WARN] Production mode but no Firebase Admin credentials configured. ' +
        'Server will start, but verifyIdToken() will fail for all real tokens. ' +
        'Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID before going live. ' +
        'Until then, the dev-token bypass is the only auth path — DO NOT use this in customer-facing deployments.'
    );
  } else {
    console.warn(
      '[WARN] Firebase Admin SDK has no credentials configured. ' +
        'Server will run in DEV mode (dev-token bypass). ' +
        'Set GOOGLE_APPLICATION_CREDENTIALS for production.'
    );
  }
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
