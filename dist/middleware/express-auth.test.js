"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_auth_1 = require("./express-auth");
const auth_service_1 = require("../services/auth.service");
const roles_1 = require("../constants/roles");
const mockVerifyIdToken = jest.fn();
const mockAuth = {
    verifyIdToken: mockVerifyIdToken,
};
beforeEach(() => {
    jest.clearAllMocks();
    (0, auth_service_1.setAuthInstance)(mockAuth);
});
describe('requireAuth', () => {
    it('attaches user when token is valid', async () => {
        mockVerifyIdToken.mockResolvedValue({
            uid: 'user-1',
            role: roles_1.ROLES.PROJECT_MANAGER,
        });
        const req = { headers: { authorization: 'Bearer valid-token' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();
        await (0, express_auth_1.requireAuth)(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.user).toEqual(expect.objectContaining({
            uid: 'user-1',
            role: roles_1.ROLES.PROJECT_MANAGER,
        }));
    });
    it('returns 401 when header is missing', async () => {
        const req = { headers: {} };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();
        await (0, express_auth_1.requireAuth)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
    it('returns 401 when token is invalid', async () => {
        mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
        const req = { headers: { authorization: 'Bearer bad-token' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();
        await (0, express_auth_1.requireAuth)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
    it('returns 401 with token_expired code on expired Firebase token', async () => {
        const err = new Error('Token expired');
        err.code = 'auth/id-token-expired';
        mockVerifyIdToken.mockRejectedValue(err);
        const req = { headers: { authorization: 'Bearer expired-token' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        const next = jest.fn();
        await (0, express_auth_1.requireAuth)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 'token_expired' }) }));
        expect(next).not.toHaveBeenCalled();
    });
    it('defaults role to field_crew when token has no role claim', async () => {
        mockVerifyIdToken.mockResolvedValue({ uid: 'user-1' });
        const req = { headers: { authorization: 'Bearer valid-token' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();
        await (0, express_auth_1.requireAuth)(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.user.role).toBe(roles_1.ROLES.FIELD_CREW);
    });
    it('reads orgId from the token claim', async () => {
        mockVerifyIdToken.mockResolvedValue({
            uid: 'user-1',
            role: roles_1.ROLES.PROJECT_MANAGER,
            orgId: 'org-acme',
        });
        const req = { headers: { authorization: 'Bearer valid-token' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();
        await (0, express_auth_1.requireAuth)(req, res, next);
        expect(req.user.orgId).toBe('org-acme');
    });
    describe('dev-token bypass', () => {
        const originalRole = process.env.DEV_USER_ROLE;
        const originalNodeEnv = process.env.NODE_ENV;
        const originalFsa = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        const originalGac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        const originalFpid = process.env.FIREBASE_PROJECT_ID;
        beforeEach(() => {
            // Each test starts with no Firebase configured; specific tests opt-in.
            delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
            delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
            delete process.env.FIREBASE_PROJECT_ID;
        });
        afterEach(() => {
            process.env.DEV_USER_ROLE = originalRole;
            process.env.NODE_ENV = originalNodeEnv;
            process.env.FIREBASE_SERVICE_ACCOUNT_KEY = originalFsa;
            process.env.GOOGLE_APPLICATION_CREDENTIALS = originalGac;
            process.env.FIREBASE_PROJECT_ID = originalFpid;
        });
        it('accepts dev-token in non-production', async () => {
            process.env.NODE_ENV = 'development';
            process.env.DEV_USER_ROLE = roles_1.ROLES.SUPERINTENDENT;
            const req = { headers: { authorization: 'Bearer dev-token' } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();
            await (0, express_auth_1.requireAuth)(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(req.user.role).toBe(roles_1.ROLES.SUPERINTENDENT);
        });
        it('development: always allows dev-token even when Firebase is set', async () => {
            process.env.NODE_ENV = 'development';
            process.env.FIREBASE_SERVICE_ACCOUNT_KEY = '/some/path.json';
            const req = { headers: { authorization: 'Bearer dev-token' } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();
            await (0, express_auth_1.requireAuth)(req, res, next);
            expect(next).toHaveBeenCalled();
        });
        it('production + Firebase configured: rejects dev-token with 401', async () => {
            process.env.NODE_ENV = 'production';
            process.env.FIREBASE_SERVICE_ACCOUNT_KEY = '/some/path.json';
            const req = { headers: { authorization: 'Bearer dev-token' } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();
            await (0, express_auth_1.requireAuth)(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });
        it('production + Firebase missing: allows dev-token with warning', async () => {
            process.env.NODE_ENV = 'production';
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => { });
            const req = { headers: { authorization: 'Bearer dev-token' } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();
            await (0, express_auth_1.requireAuth)(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(req.user.uid).toBe('dev-user');
            expect(warn).toHaveBeenCalled();
            const msg = warn.mock.calls.map((c) => String(c[0])).join('\n');
            expect(msg).toMatch(/Firebase not configured/);
            expect(msg).toMatch(/FIREBASE_SERVICE_ACCOUNT_KEY/);
            warn.mockRestore();
        });
        it('production + only GOOGLE_APPLICATION_CREDENTIALS set: rejects dev-token', async () => {
            process.env.NODE_ENV = 'production';
            process.env.GOOGLE_APPLICATION_CREDENTIALS = '/some/path.json';
            const req = { headers: { authorization: 'Bearer dev-token' } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();
            await (0, express_auth_1.requireAuth)(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });
        it('production + only FIREBASE_PROJECT_ID set: rejects dev-token', async () => {
            process.env.NODE_ENV = 'production';
            process.env.FIREBASE_PROJECT_ID = 'site-deck';
            const req = { headers: { authorization: 'Bearer dev-token' } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();
            await (0, express_auth_1.requireAuth)(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });
        it('uses DEV_USER_ROLE env var when set', async () => {
            process.env.NODE_ENV = 'development';
            process.env.DEV_USER_ROLE = roles_1.ROLES.OWNER_ADMIN;
            const req = { headers: { authorization: 'Bearer dev-token' } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();
            await (0, express_auth_1.requireAuth)(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(req.user.role).toBe(roles_1.ROLES.OWNER_ADMIN);
        });
    });
});
describe('requireRole', () => {
    it('allows access when role is in allowed list', () => {
        const req = { user: { uid: 'user-1', role: roles_1.ROLES.PROJECT_MANAGER } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();
        (0, express_auth_1.requireRole)(roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.OWNER_ADMIN)(req, res, next);
        expect(next).toHaveBeenCalled();
    });
    it('returns 403 when role is not allowed', () => {
        const req = { user: { uid: 'user-1', role: roles_1.ROLES.SUPERINTENDENT } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();
        (0, express_auth_1.requireRole)(roles_1.ROLES.PROJECT_MANAGER)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
    it('returns 401 when user is not authenticated', () => {
        const req = {};
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();
        (0, express_auth_1.requireRole)(roles_1.ROLES.PROJECT_MANAGER)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=express-auth.test.js.map