import {
  requireAuth,
  requireRole,
  requireOwnersRep,
  AuthenticatedRequest,
  MiddlewareResponse,
  NextFunction,
} from './permission.middleware';
import { ROLES, Role } from '../constants/roles';
import * as authService from '../services/auth.service';
import { DecodedIdToken } from 'firebase-admin/auth';

jest.mock('../services/auth.service');

const mockedVerifyIdToken = jest.mocked(authService.verifyIdToken);

describe('permission.middleware', () => {
  let req: AuthenticatedRequest;
  let res: MiddlewareResponse;
  let next: NextFunction;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let sendMock: jest.Mock;

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
      requireAuth(req, res, next);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when authorization header does not start with Bearer', () => {
      req.headers.authorization = 'Basic abc123';
      requireAuth(req, res, next);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when token verification fails', async () => {
      req.headers.authorization = 'Bearer bad-token';
      mockedVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
      requireAuth(req, res, next);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('attaches user and role to req when token is valid', async () => {
      req.headers.authorization = 'Bearer valid-token';
      const decoded = { uid: 'uid-1', role: ROLES.PROJECT_MANAGER } as unknown as DecodedIdToken;
      mockedVerifyIdToken.mockResolvedValue(decoded);
      requireAuth(req, res, next);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(req.user).toEqual({
        decodedToken: decoded,
        role: ROLES.PROJECT_MANAGER,
      });
      expect(next).toHaveBeenCalled();
    });

    it('sets role to null when claim is missing', async () => {
      req.headers.authorization = 'Bearer valid-token';
      const decoded = { uid: 'uid-1' } as unknown as DecodedIdToken;
      mockedVerifyIdToken.mockResolvedValue(decoded);
      requireAuth(req, res, next);
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
      const middleware = requireRole(ROLES.PROJECT_MANAGER);
      middleware(req, res, next);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when user role is null', () => {
      req.user = { decodedToken: { uid: 'uid-1' } as unknown as DecodedIdToken, role: null };
      const middleware = requireRole(ROLES.PROJECT_MANAGER);
      middleware(req, res, next);
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Forbidden' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when user role is not in allowed list', () => {
      req.user = {
        decodedToken: { uid: 'uid-1' } as unknown as DecodedIdToken,
        role: ROLES.FIELD_CREW,
      };
      const middleware = requireRole(ROLES.PROJECT_MANAGER, ROLES.OWNER_ADMIN);
      middleware(req, res, next);
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Forbidden' });
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next when user role is in allowed list', () => {
      req.user = {
        decodedToken: { uid: 'uid-1' } as unknown as DecodedIdToken,
        role: ROLES.PROJECT_MANAGER,
      };
      const middleware = requireRole(ROLES.PROJECT_MANAGER, ROLES.OWNER_ADMIN);
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('calls next when user role matches exactly', () => {
      req.user = {
        decodedToken: { uid: 'uid-1' } as unknown as DecodedIdToken,
        role: ROLES.OWNERS_REP,
      };
      const middleware = requireRole(ROLES.OWNERS_REP);
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireOwnersRep', () => {
    it('returns 401 when req.user is not set', () => {
      requireOwnersRep(req, res, next);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when user role is not owners_rep', () => {
      req.user = {
        decodedToken: { uid: 'uid-1' } as unknown as DecodedIdToken,
        role: ROLES.PROJECT_MANAGER,
      };
      requireOwnersRep(req, res, next);
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Forbidden' });
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next when user role is owners_rep', () => {
      req.user = {
        decodedToken: { uid: 'uid-1' } as unknown as DecodedIdToken,
        role: ROLES.OWNERS_REP,
      };
      requireOwnersRep(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });
});
