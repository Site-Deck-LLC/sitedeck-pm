"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
exports.requireOwnersRep = requireOwnersRep;
const roles_1 = require("../constants/roles");
const auth_service_1 = require("../services/auth.service");
function requireAuth(req, res, next) {
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
    (0, auth_service_1.verifyIdToken)(token)
        .then((decodedToken) => {
        const role = decodedToken.role || null;
        req.user = { decodedToken, role };
        next();
    })
        .catch(() => {
        res.status(401).json({ error: 'Unauthorized' });
    });
}
function requireRole(...allowedRoles) {
    return (req, res, next) => {
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
function requireOwnersRep(req, res, next) {
    return requireRole(roles_1.ROLES.OWNERS_REP)(req, res, next);
}
//# sourceMappingURL=permission.middleware.js.map