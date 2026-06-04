"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const permission_middleware_1 = require("./permission.middleware");
const roles_1 = require("../constants/roles");
const authService = __importStar(require("../services/auth.service"));
jest.mock('../services/auth.service');
const mockedVerifyIdToken = jest.mocked(authService.verifyIdToken);
describe('permission.middleware', () => {
    let req;
    let res;
    let next;
    let statusMock;
    let jsonMock;
    let sendMock;
    beforeEach(() => {
        req = { headers: {} };
        statusMock = jest.fn().mockReturnThis();
        jsonMock = jest.fn();
        sendMock = jest.fn();
        res = {
            status: statusMock,
            json: jsonMock,
            send: sendMock,
        };
        next = jest.fn();
        jest.clearAllMocks();
    });
    describe('requireAuth', () => {
        it('returns 401 when authorization header is missing', () => {
            (0, permission_middleware_1.requireAuth)(req, res, next);
            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });
        it('returns 401 when authorization header does not start with Bearer', () => {
            req.headers.authorization = 'Basic abc123';
            (0, permission_middleware_1.requireAuth)(req, res, next);
            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });
        it('returns 401 when token verification fails', async () => {
            req.headers.authorization = 'Bearer bad-token';
            mockedVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
            (0, permission_middleware_1.requireAuth)(req, res, next);
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });
        it('attaches user and role to req when token is valid', async () => {
            req.headers.authorization = 'Bearer valid-token';
            const decoded = { uid: 'uid-1', role: roles_1.ROLES.PROJECT_MANAGER };
            mockedVerifyIdToken.mockResolvedValue(decoded);
            (0, permission_middleware_1.requireAuth)(req, res, next);
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(req.user).toEqual({
                decodedToken: decoded,
                role: roles_1.ROLES.PROJECT_MANAGER,
            });
            expect(next).toHaveBeenCalled();
        });
        it('sets role to null when claim is missing', async () => {
            req.headers.authorization = 'Bearer valid-token';
            const decoded = { uid: 'uid-1' };
            mockedVerifyIdToken.mockResolvedValue(decoded);
            (0, permission_middleware_1.requireAuth)(req, res, next);
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(req.user).toEqual({
                decodedToken: decoded,
                role: null,
            });
            expect(next).toHaveBeenCalled();
        });
    });
    describe('requireRole', () => {
        it('returns 401 when req.user is not set', () => {
            const middleware = (0, permission_middleware_1.requireRole)(roles_1.ROLES.PROJECT_MANAGER);
            middleware(req, res, next);
            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });
        it('returns 403 when user role is null', () => {
            req.user = { decodedToken: { uid: 'uid-1' }, role: null };
            const middleware = (0, permission_middleware_1.requireRole)(roles_1.ROLES.PROJECT_MANAGER);
            middleware(req, res, next);
            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith({ error: 'Forbidden' });
            expect(next).not.toHaveBeenCalled();
        });
        it('returns 403 when user role is not in allowed list', () => {
            req.user = {
                decodedToken: { uid: 'uid-1' },
                role: roles_1.ROLES.FIELD_CREW,
            };
            const middleware = (0, permission_middleware_1.requireRole)(roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.OWNER_ADMIN);
            middleware(req, res, next);
            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith({ error: 'Forbidden' });
            expect(next).not.toHaveBeenCalled();
        });
        it('calls next when user role is in allowed list', () => {
            req.user = {
                decodedToken: { uid: 'uid-1' },
                role: roles_1.ROLES.PROJECT_MANAGER,
            };
            const middleware = (0, permission_middleware_1.requireRole)(roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.OWNER_ADMIN);
            middleware(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalled();
        });
        it('calls next when user role matches exactly', () => {
            req.user = {
                decodedToken: { uid: 'uid-1' },
                role: roles_1.ROLES.OWNERS_REP,
            };
            const middleware = (0, permission_middleware_1.requireRole)(roles_1.ROLES.OWNERS_REP);
            middleware(req, res, next);
            expect(next).toHaveBeenCalled();
        });
    });
    describe('requireOwnersRep', () => {
        it('returns 401 when req.user is not set', () => {
            (0, permission_middleware_1.requireOwnersRep)(req, res, next);
            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });
        it('returns 403 when user role is not owners_rep', () => {
            req.user = {
                decodedToken: { uid: 'uid-1' },
                role: roles_1.ROLES.PROJECT_MANAGER,
            };
            (0, permission_middleware_1.requireOwnersRep)(req, res, next);
            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith({ error: 'Forbidden' });
            expect(next).not.toHaveBeenCalled();
        });
        it('calls next when user role is owners_rep', () => {
            req.user = {
                decodedToken: { uid: 'uid-1' },
                role: roles_1.ROLES.OWNERS_REP,
            };
            (0, permission_middleware_1.requireOwnersRep)(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=permission.middleware.test.js.map