import { Request, Response, NextFunction } from 'express';
import { Role } from '../constants/roles';
import { DecodedIdToken } from 'firebase-admin/auth';
export interface ExpressUser {
    uid: string;
    role: Role | null;
    orgId: string | null;
    decodedToken: DecodedIdToken;
}
declare global {
    namespace Express {
        interface Request {
            user?: ExpressUser;
        }
    }
}
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function requireRole(...allowedRoles: Role[]): (req: Request, res: Response, next: NextFunction) => void;
export declare function requireOwnersRep(req: Request, res: Response, next: NextFunction): void;
/**
 * Site Deck LLC admin gate for the /admin/* section.
 *
 * ADMIN SECURITY RULE (Sprint 10): the /admin section must be invisible
 * to customers. Non-admins see a 404 — never a 403. A 403 would confirm
 * the route exists; a 404 means the route does not exist to them.
 *
 * "Admin" means: the user has role=owner_admin AND orgId matches the
 * Site Deck LLC org id. The org id is read from
 * SITEDECK_LLC_ORG_ID (configurable) and defaults to a stable value
 * that matches the support@sitedeck.pro bootstrap org.
 *
 * Implemented as: 404 on every failure path (not authed, wrong role,
 * wrong org). This is intentional — see the rule above.
 */
export declare const SITEDECK_LLC_ORG_ID: string;
export declare function requireSiteDeckAdmin(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=express-auth.d.ts.map