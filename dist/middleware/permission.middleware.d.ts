import { DecodedIdToken } from 'firebase-admin/auth';
import { Role } from '../constants/roles';
export interface AuthenticatedRequest {
    headers: {
        authorization?: string;
    };
    user?: {
        decodedToken: DecodedIdToken;
        role: Role | null;
    };
}
export interface MiddlewareResponse {
    status(code: number): MiddlewareResponse;
    json(body: unknown): void;
    send(body?: unknown): void;
}
export type NextFunction = (err?: unknown) => void;
export declare function requireAuth(req: AuthenticatedRequest, res: MiddlewareResponse, next: NextFunction): void;
export declare function requireRole(...allowedRoles: Role[]): (req: AuthenticatedRequest, res: MiddlewareResponse, next: NextFunction) => void;
export declare function requireOwnersRep(req: AuthenticatedRequest, res: MiddlewareResponse, next: NextFunction): void;
//# sourceMappingURL=permission.middleware.d.ts.map