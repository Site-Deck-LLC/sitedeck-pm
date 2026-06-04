"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthInstance = getAuthInstance;
exports.setAuthInstance = setAuthInstance;
exports.setUserRole = setUserRole;
exports.getUserRole = getUserRole;
exports.verifyIdToken = verifyIdToken;
exports.removeUserRole = removeUserRole;
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
//# sourceMappingURL=auth.service.js.map