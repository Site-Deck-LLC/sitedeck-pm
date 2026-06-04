import { Request, Response, NextFunction } from 'express';
import { Role } from '../constants/roles';
import { DecodedIdToken } from 'firebase-admin/auth';
export interface ExpressUser {
    uid: string;
    role: Role | null;
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
//# sourceMappingURL=express-auth.d.ts.map