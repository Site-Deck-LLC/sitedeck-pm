import { Request, Response } from 'express';
import { requireAuth, requireRole } from './express-auth';
import { setAuthInstance } from '../services/auth.service';
import { ROLES } from '../constants/roles';

const mockVerifyIdToken = jest.fn();

const mockAuth = {
  verifyIdToken: mockVerifyIdToken,
} as unknown as import('firebase-admin/auth').Auth;

beforeEach(() => {
  jest.clearAllMocks();
  setAuthInstance(mockAuth);
});

describe('requireAuth', () => {
  it('attaches user when token is valid', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-1',
      role: ROLES.PROJECT_MANAGER,
    });

    const req = { headers: { authorization: 'Bearer valid-token' } } as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(
      expect.objectContaining({
        uid: 'user-1',
        role: ROLES.PROJECT_MANAGER,
      })
    );
  });

  it('returns 401 when header is missing', async () => {
    const req = { headers: {} } as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

    const req = { headers: { authorization: 'Bearer bad-token' } } as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  it('allows access when role is in allowed list', () => {
    const req = { user: { uid: 'user-1', role: ROLES.PROJECT_MANAGER } } as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    requireRole(ROLES.PROJECT_MANAGER, ROLES.OWNER_ADMIN)(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when role is not allowed', () => {
    const req = { user: { uid: 'user-1', role: ROLES.SUPERINTENDENT } } as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    requireRole(ROLES.PROJECT_MANAGER)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user is not authenticated', () => {
    const req = {} as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    requireRole(ROLES.PROJECT_MANAGER)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
