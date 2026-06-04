"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
exports.requireOwnersRep = requireOwnersRep;
const roles_1 = require("../constants/roles");
const auth_service_1 = require("../services/auth.service");
async function requireAuth(req, res, next) {
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
        const devRole = process.env.DEV_USER_ROLE || roles_1.ROLES.PROJECT_MANAGER;
        req.user = {
            uid: 'dev-user',
            role: devRole,
            decodedToken: { uid: 'dev-user', role: devRole },
        };
        next();
        return;
    }
    try {
        const decodedToken = await (0, auth_service_1.verifyIdToken)(token);
        const role = decodedToken.role || null;
        req.user = { uid: decodedToken.uid, role, decodedToken };
        next();
    }
    catch {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
}
function requireRole(...allowedRoles) {
    return (req, res, next) => {
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
function requireOwnersRep(req, res, next) {
    return requireRole(roles_1.ROLES.OWNERS_REP)(req, res, next);
}
//# sourceMappingURL=express-auth.js.map