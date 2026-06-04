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