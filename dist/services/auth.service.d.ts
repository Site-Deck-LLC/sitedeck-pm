import { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { Role } from '../constants/roles';
export declare function getAuthInstance(): Auth;
export declare function setAuthInstance(instance: Auth): void;
export declare function setUserRole(uid: string, role: Role): Promise<void>;
export declare function getUserRole(uid: string): Promise<Role | null>;
export declare function verifyIdToken(token: string): Promise<DecodedIdToken>;
export declare function removeUserRole(uid: string): Promise<void>;
/**
 * Sprint 11: Look up the Firebase UID for an email. If the user does
 * not exist yet (invited but never signed in), create them so we can
 * attach a UID to the ProjectMember row. Returns null if Firebase
 * admin is not configured.
 */
export declare function getOrCreateFirebaseUid(email: string, displayName?: string): Promise<string | null>;
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
export declare function getUserClaims(uid: string): Promise<ProjectClaims | null>;
export declare function setUserProjectClaims(uid: string, claims: ProjectClaims): Promise<void>;
export declare function addProjectToClaims(uid: string, projectId: string, role: Role, orgId: string): Promise<ProjectClaims>;
export declare function removeProjectFromClaims(uid: string, projectId: string): Promise<ProjectClaims | null>;
export type { Role };
//# sourceMappingURL=auth.service.d.ts.map