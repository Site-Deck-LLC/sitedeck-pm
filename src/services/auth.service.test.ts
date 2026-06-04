import { Auth, DecodedIdToken, UserRecord } from 'firebase-admin/auth';
import {
  setAuthInstance,
  setUserRole,
  getUserRole,
  verifyIdToken,
  removeUserRole,
} from './auth.service';
import { ROLES, Role } from '../constants/roles';

const mockSetCustomUserClaims = jest.fn();
const mockGetUser = jest.fn();
const mockVerifyIdToken = jest.fn();

const mockAuth = {
  setCustomUserClaims: mockSetCustomUserClaims,
  getUser: mockGetUser,
  verifyIdToken: mockVerifyIdToken,
} as unknown as Auth;

beforeEach(() => {
  jest.clearAllMocks();
  setAuthInstance(mockAuth);
});

describe('auth.service', () => {
  describe('setUserRole', () => {
    it('sets the role custom claim on the user', async () => {
      mockSetCustomUserClaims.mockResolvedValue(undefined);
      await setUserRole('uid-123', ROLES.PROJECT_MANAGER);
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-123', {
        role: ROLES.PROJECT_MANAGER,
      });
    });
  });

  describe('getUserRole', () => {
    it('returns the role when present in custom claims', async () => {
      mockGetUser.mockResolvedValue({
        customClaims: { role: ROLES.SUPERINTENDENT },
      } as unknown as UserRecord);
      const role = await getUserRole('uid-123');
      expect(role).toBe(ROLES.SUPERINTENDENT);
    });

    it('returns null when no custom claims exist', async () => {
      mockGetUser.mockResolvedValue({
        customClaims: undefined,
      } as unknown as UserRecord);
      const role = await getUserRole('uid-123');
      expect(role).toBeNull();
    });

    it('returns null when role claim is missing', async () => {
      mockGetUser.mockResolvedValue({
        customClaims: { other: 'value' },
      } as unknown as UserRecord);
      const role = await getUserRole('uid-123');
      expect(role).toBeNull();
    });
  });

  describe('verifyIdToken', () => {
    it('returns decoded token for a valid token', async () => {
      const decoded = { uid: 'uid-123', role: ROLES.OWNER_ADMIN } as unknown as DecodedIdToken;
      mockVerifyIdToken.mockResolvedValue(decoded);
      const result = await verifyIdToken('valid-token');
      expect(result).toBe(decoded);
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
    });

    it('rejects for an invalid token', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
      await expect(verifyIdToken('bad-token')).rejects.toThrow('Invalid token');
    });
  });

  describe('removeUserRole', () => {
    it('clears the role claim while preserving other claims', async () => {
      mockGetUser.mockResolvedValue({
        customClaims: { role: ROLES.PROJECT_MANAGER, org: 'org-1' },
      } as unknown as UserRecord);
      mockSetCustomUserClaims.mockResolvedValue(undefined);
      await removeUserRole('uid-123');
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-123', {
        org: 'org-1',
      });
    });

    it('handles undefined custom claims gracefully', async () => {
      mockGetUser.mockResolvedValue({
        customClaims: undefined,
      } as unknown as UserRecord);
      mockSetCustomUserClaims.mockResolvedValue(undefined);
      await removeUserRole('uid-123');
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-123', {});
    });
  });
});
