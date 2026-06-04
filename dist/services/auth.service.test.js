"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_service_1 = require("./auth.service");
const roles_1 = require("../constants/roles");
const mockSetCustomUserClaims = jest.fn();
const mockGetUser = jest.fn();
const mockVerifyIdToken = jest.fn();
const mockAuth = {
    setCustomUserClaims: mockSetCustomUserClaims,
    getUser: mockGetUser,
    verifyIdToken: mockVerifyIdToken,
};
beforeEach(() => {
    jest.clearAllMocks();
    (0, auth_service_1.setAuthInstance)(mockAuth);
});
describe('auth.service', () => {
    describe('setUserRole', () => {
        it('sets the role custom claim on the user', async () => {
            mockSetCustomUserClaims.mockResolvedValue(undefined);
            await (0, auth_service_1.setUserRole)('uid-123', roles_1.ROLES.PROJECT_MANAGER);
            expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-123', {
                role: roles_1.ROLES.PROJECT_MANAGER,
            });
        });
    });
    describe('getUserRole', () => {
        it('returns the role when present in custom claims', async () => {
            mockGetUser.mockResolvedValue({
                customClaims: { role: roles_1.ROLES.SUPERINTENDENT },
            });
            const role = await (0, auth_service_1.getUserRole)('uid-123');
            expect(role).toBe(roles_1.ROLES.SUPERINTENDENT);
        });
        it('returns null when no custom claims exist', async () => {
            mockGetUser.mockResolvedValue({
                customClaims: undefined,
            });
            const role = await (0, auth_service_1.getUserRole)('uid-123');
            expect(role).toBeNull();
        });
        it('returns null when role claim is missing', async () => {
            mockGetUser.mockResolvedValue({
                customClaims: { other: 'value' },
            });
            const role = await (0, auth_service_1.getUserRole)('uid-123');
            expect(role).toBeNull();
        });
    });
    describe('verifyIdToken', () => {
        it('returns decoded token for a valid token', async () => {
            const decoded = { uid: 'uid-123', role: roles_1.ROLES.OWNER_ADMIN };
            mockVerifyIdToken.mockResolvedValue(decoded);
            const result = await (0, auth_service_1.verifyIdToken)('valid-token');
            expect(result).toBe(decoded);
            expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
        });
        it('rejects for an invalid token', async () => {
            mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
            await expect((0, auth_service_1.verifyIdToken)('bad-token')).rejects.toThrow('Invalid token');
        });
    });
    describe('removeUserRole', () => {
        it('clears the role claim while preserving other claims', async () => {
            mockGetUser.mockResolvedValue({
                customClaims: { role: roles_1.ROLES.PROJECT_MANAGER, org: 'org-1' },
            });
            mockSetCustomUserClaims.mockResolvedValue(undefined);
            await (0, auth_service_1.removeUserRole)('uid-123');
            expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-123', {
                org: 'org-1',
            });
        });
        it('handles undefined custom claims gracefully', async () => {
            mockGetUser.mockResolvedValue({
                customClaims: undefined,
            });
            mockSetCustomUserClaims.mockResolvedValue(undefined);
            await (0, auth_service_1.removeUserRole)('uid-123');
            expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-123', {});
        });
    });
});
//# sourceMappingURL=auth.service.test.js.map