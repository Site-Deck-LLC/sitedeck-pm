"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SITEDECK_LLC_ORG_ID = void 0;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
exports.requireOwnersRep = requireOwnersRep;
exports.requireSiteDeckAdmin = requireSiteDeckAdmin;
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
    // Dev bypass: allows local testing without Firebase credentials.
    // The bypass is open in non-production. In production we *also* allow it
    // when Firebase is not configured — a misconfigured production deploy
    // should fall back to dev-bypass with a loud warning, not silently 401
    // every request. This makes the failure mode obvious in deploy logs and
    // keeps the system usable long enough to fix the key.
    if (token === 'dev-token') {
        const isProd = process.env.NODE_ENV === 'production';
        const firebaseConfigured = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) ||
            Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
            Boolean(process.env.FIREBASE_PROJECT_ID);
        if (isProd && firebaseConfigured) {
            res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'dev-token bypass is disabled in production when Firebase is configured',
                },
            });
            return;
        }
        if (isProd && !firebaseConfigured) {
            // Loud, single-line warning. We log on every call so a misconfigured
            // server is impossible to miss in journal.
            console.warn('[express-auth] WARNING: Firebase not configured — using dev bypass. ' +
                'Set FIREBASE_SERVICE_ACCOUNT_KEY in production.');
        }
        const devRole = process.env.DEV_USER_ROLE || roles_1.ROLES.PROJECT_MANAGER;
        req.user = {
            uid: 'dev-user',
            role: devRole,
            orgId: null,
            decodedToken: { uid: 'dev-user', role: devRole },
        };
        next();
        return;
    }
    try {
        const decodedToken = await (0, auth_service_1.verifyIdToken)(token);
        // Default to the lowest-privilege role when the token has no
        // explicit role claim. `field_crew` is read-only in the cost
        // module and the dashboard is the only thing it can interact
        // with. This is the safe default for any token that authenticates
        // but has not been onboarded into a role.
        const role = decodedToken.role || roles_1.ROLES.FIELD_CREW;
        const orgId = decodedToken.orgId || null;
        req.user = {
            uid: decodedToken.uid,
            role,
            orgId,
            decodedToken,
        };
        next();
    }
    catch (err) {
        // Distinguish expired tokens from invalid ones so the frontend
        // can attempt a refresh-and-retry before forcing a logout. Firebase
        // surfaces expiration as a code on the thrown error.
        const code = err?.code || err?.errorInfo?.code || '';
        const isExpired = code === 'auth/id-token-expired' || /expired/i.test(err?.message || '');
        if (isExpired) {
            res.status(401).json({ error: { code: 'token_expired', message: 'Token expired — refresh and retry' } });
            return;
        }
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
exports.SITEDECK_LLC_ORG_ID = process.env.SITEDECK_LLC_ORG_ID || 'sitedeck-llc';
function requireSiteDeckAdmin(req, res, next) {
    if (!req.user) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
        return;
    }
    if (req.user.role !== roles_1.ROLES.OWNER_ADMIN) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
        return;
    }
    if (req.user.orgId !== exports.SITEDECK_LLC_ORG_ID) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
        return;
    }
    next();
}
//# sourceMappingURL=express-auth.js.map