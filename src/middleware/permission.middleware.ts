import { DecodedIdToken } from 'firebase-admin/auth';
import { Role, ROLES } from '../constants/roles';
import { verifyIdToken } from '../services/auth.service';

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

export function requireAuth(
  req: AuthenticatedRequest,
  res: MiddlewareResponse,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  verifyIdToken(token)
    .then((decodedToken) => {
      const role = (decodedToken.role as Role) || null;
      req.user = { decodedToken, role };
      next();
    })
    .catch(() => {
      res.status(401).json({ error: 'Unauthorized' });
    });
}

export function requireRole(...allowedRoles: Role[]) {
  return (
    req: AuthenticatedRequest,
    res: MiddlewareResponse,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userRole = req.user.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
}

export function requireOwnersRep(
  req: AuthenticatedRequest,
  res: MiddlewareResponse,
  next: NextFunction
): void {
  return requireRole(ROLES.OWNERS_REP)(req, res, next);
}
