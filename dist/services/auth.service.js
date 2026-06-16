"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthInstance = getAuthInstance;
exports.setAuthInstance = setAuthInstance;
exports.setUserRole = setUserRole;
exports.getUserRole = getUserRole;
exports.verifyIdToken = verifyIdToken;
exports.removeUserRole = removeUserRole;
exports.getOrCreateFirebaseUid = getOrCreateFirebaseUid;
exports.getUserClaims = getUserClaims;
exports.setUserProjectClaims = setUserProjectClaims;
exports.addProjectToClaims = addProjectToClaims;
exports.removeProjectFromClaims = removeProjectFromClaims;
const auth_1 = require("firebase-admin/auth");
const app_1 = require("firebase-admin/app");
let authInstance = null;
function getAuthInstance() {
    if (!authInstance) {
        if ((0, app_1.getApps)().length === 0) {
            (0, app_1.initializeApp)();
        }
        authInstance = (0, auth_1.getAuth)();
    }
    return authInstance;
}
function setAuthInstance(instance) {
    authInstance = instance;
}
async function setUserRole(uid, role) {
    const auth = getAuthInstance();
    await auth.setCustomUserClaims(uid, { role });
}
async function getUserRole(uid) {
    const auth = getAuthInstance();
    const user = await auth.getUser(uid);
    const role = user.customClaims?.role;
    if (typeof role === 'string') {
        return role;
    }
    return null;
}
async function verifyIdToken(token) {
    const auth = getAuthInstance();
    return auth.verifyIdToken(token);
}
async function removeUserRole(uid) {
    const auth = getAuthInstance();
    const user = await auth.getUser(uid);
    const claims = { ...(user.customClaims || {}) };
    delete claims.role;
    await auth.setCustomUserClaims(uid, claims);
}
/**
 * Sprint 11: Look up the Firebase UID for an email. If the user does
 * not exist yet (invited but never signed in), create them so we can
 * attach a UID to the ProjectMember row. Returns null if Firebase
 * admin is not configured.
 */
async function getOrCreateFirebaseUid(email, displayName) {
    try {
        const auth = getAuthInstance();
        try {
            const u = await auth.getUserByEmail(email);
            return u.uid;
        }
        catch {
            const created = await auth.createUser({
                email,
                displayName: displayName || undefined,
            });
            return created.uid;
        }
    }
    catch {
        return null;
    }
}
async function getUserClaims(uid) {
    try {
        const auth = getAuthInstance();
        const user = await auth.getUser(uid);
        const c = user.customClaims || {};
        if (!c.role || !c.orgId)
            return null;
        return {
            role: c.role,
            orgId: String(c.orgId),
            projectIds: Array.isArray(c.projectIds) ? c.projectIds : [],
        };
    }
    catch {
        return null;
    }
}
async function setUserProjectClaims(uid, claims) {
    const auth = getAuthInstance();
    await auth.setCustomUserClaims(uid, { ...claims });
}
async function addProjectToClaims(uid, projectId, role, orgId) {
    const current = (await getUserClaims(uid)) || { role, orgId, projectIds: [] };
    const projectIds = Array.from(new Set([...current.projectIds, projectId]));
    const next = { role, orgId, projectIds };
    await setUserProjectClaims(uid, next);
    return next;
}
async function removeProjectFromClaims(uid, projectId) {
    const current = await getUserClaims(uid);
    if (!current)
        return null;
    const projectIds = current.projectIds.filter((p) => p !== projectId);
    // If they have no more projects, drop to the minimum access role
    const role = projectIds.length === 0 ? 'field_crew' : current.role;
    const next = { role, orgId: current.orgId, projectIds };
    await setUserProjectClaims(uid, next);
    return next;
}
//# sourceMappingURL=auth.service.js.map