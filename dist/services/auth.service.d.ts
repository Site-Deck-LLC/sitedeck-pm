import { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { Role } from '../constants/roles';
export declare function getAuthInstance(): Auth;
export declare function setAuthInstance(instance: Auth): void;
export declare function setUserRole(uid: string, role: Role): Promise<void>;
export declare function getUserRole(uid: string): Promise<Role | null>;
export declare function verifyIdToken(token: string): Promise<DecodedIdToken>;
export declare function removeUserRole(uid: string): Promise<void>;
export type { Role };
//# sourceMappingURL=auth.service.d.ts.map