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

/**
 * Sprint 11: Look up the Firebase UID for an email. If the user does
 * not exist yet (invited but never signed in), create them so we can
 * attach a UID to the ProjectMember row. Returns null if Firebase
 * admin is not configured.
 */
export async function getOrCreateFirebaseUid(email: string, displayName?: string): Promise<string | null> {
  try {
    const auth = getAuthInstance();
    try {
      const u = await auth.getUserByEmail(email);
      return u.uid;
    } catch {
      const created = await auth.createUser({
        email,
        displayName: displayName || undefined,
      });
      return created.uid;
    }
  } catch {
    return null;
  }
}

/**
 * Sprint 11: extended claims management. ProjectId list is the
 * union of all projects the user is a member of. Role and orgId
 * are updated together.
 */
export interface ProjectClaims {
  role: Role;
  orgId: string;
  projectIds: string[];
}

export async function getUserClaims(uid: string): Promise<ProjectClaims | null> {
  try {
    const auth = getAuthInstance();
    const user = await auth.getUser(uid);
    const c = user.customClaims || {};
    if (!c.role || !c.orgId) return null;
    return {
      role: c.role as Role,
      orgId: String(c.orgId),
      projectIds: Array.isArray(c.projectIds) ? (c.projectIds as string[]) : [],
    };
  } catch {
    return null;
  }
}

export async function setUserProjectClaims(uid: string, claims: ProjectClaims): Promise<void> {
  const auth = getAuthInstance();
  await auth.setCustomUserClaims(uid, { ...claims });
}

export async function addProjectToClaims(uid: string, projectId: string, role: Role, orgId: string): Promise<ProjectClaims> {
  const current = (await getUserClaims(uid)) || { role, orgId, projectIds: [] };
  const projectIds = Array.from(new Set([...current.projectIds, projectId]));
  const next: ProjectClaims = { role, orgId, projectIds };
  await setUserProjectClaims(uid, next);
  return next;
}

export async function removeProjectFromClaims(uid: string, projectId: string): Promise<ProjectClaims | null> {
  const current = await getUserClaims(uid);
  if (!current) return null;
  const projectIds = current.projectIds.filter((p) => p !== projectId);
  // If they have no more projects, drop to the minimum access role
  const role = projectIds.length === 0 ? 'field_crew' : current.role;
  const next: ProjectClaims = { role, orgId: current.orgId, projectIds };
  await setUserProjectClaims(uid, next);
  return next;
}

export type { Role };
