// Firebase Client SDK config
// In production, set the following Vite env vars in frontend/.env:
//   VITE_FIREBASE_API_KEY
//   VITE_FIREBASE_AUTH_DOMAIN
//   VITE_FIREBASE_PROJECT_ID
//   VITE_FIREBASE_APP_ID
//
// When these are absent, the app falls back to dev-mode authentication
// (the localStorage role + dev-token) for local development.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

export const isFirebaseConfigured = Boolean(
  apiKey && authDomain && projectId && appId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured) return null;
  if (!app) {
    app = initializeApp({
      apiKey: apiKey!,
      authDomain: authDomain!,
      projectId: projectId!,
      appId: appId!,
    });
  }
  if (!auth) {
    auth = getAuth(app);
  }
  return auth;
}
