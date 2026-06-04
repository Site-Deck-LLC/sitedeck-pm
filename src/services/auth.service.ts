import { getAuth, Auth, DecodedIdToken } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase-admin/app';
import { Role } from '../constants/roles';

let authInstance: Auth | null = null;

export function getAuthInstance(): Auth {
  if (!authInstance) {
    if (getApps().length === 0) {
      initializeApp();
    }
    authInstance = getAuth();
  }
  return authInstance;
}

export function setAuthInstance(instance: Auth): void {
  authInstance = instance;
}

export async function setUserRole(uid: string, role: Role): Promise<void> {
  const auth = getAuthInstance();
  await auth.setCustomUserClaims(uid, { role });
}

export async function getUserRole(uid: string): Promise<Role | null> {
  const auth = getAuthInstance();
  const user = await auth.getUser(uid);
  const role = user.customClaims?.role;
  if (typeof role === 'string') {
    return role as Role;
  }
  return null;
}

export async function verifyIdToken(token: string): Promise<DecodedIdToken> {
  const auth = getAuthInstance();
  return auth.verifyIdToken(token);
}

export async function removeUserRole(uid: string): Promise<void> {
  const auth = getAuthInstance();
  const user = await auth.getUser(uid);
  const claims = { ...(user.customClaims || {}) };
  delete claims.role;
  await auth.setCustomUserClaims(uid, claims);
}

export type { Role };
