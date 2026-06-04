import { Request, Response, NextFunction } from 'express';
import { Role, ROLES } from '../constants/roles';
import { verifyIdToken } from '../services/auth.service';
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

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
    return;
  }

  // Dev bypass: allows local testing without Firebase credentials
  if (token === 'dev-token') {
    const devRole = (process.env.DEV_USER_ROLE as Role) || ROLES.PROJECT_MANAGER;
    req.user = {
      uid: 'dev-user',
      role: devRole,
      decodedToken: { uid: 'dev-user', role: devRole } as unknown as DecodedIdToken,
    };
    next();
    return;
  }

  try {
    const decodedToken = await verifyIdToken(token);
    const role = (decodedToken.role as Role) || null;
    req.user = { uid: decodedToken.uid, role, decodedToken };
    next();
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  }
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const userRole = req.user.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
      return;
    }

    next();
  };
}

export function requireOwnersRep(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  return requireRole(ROLES.OWNERS_REP)(req, res, next);
}
