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

  it('returns 401 with token_expired code on expired Firebase token', async () => {
    const err: any = new Error('Token expired');
    err.code = 'auth/id-token-expired';
    mockVerifyIdToken.mockRejectedValue(err);

    const req = { headers: { authorization: 'Bearer expired-token' } } as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'token_expired' }) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('defaults role to field_crew when token has no role claim', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-1' });

    const req = { headers: { authorization: 'Bearer valid-token' } } as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).user.role).toBe(ROLES.FIELD_CREW);
  });

  it('reads orgId from the token claim', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-1',
      role: ROLES.PROJECT_MANAGER,
      orgId: 'org-acme',
    });

    const req = { headers: { authorization: 'Bearer valid-token' } } as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect((req as any).user.orgId).toBe('org-acme');
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
      process.env.DEV_USER_ROLE = ROLES.SUPERINTENDENT;
      const req = { headers: { authorization: 'Bearer dev-token' } } as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
      const next = jest.fn();

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect((req as any).user.role).toBe(ROLES.SUPERINTENDENT);
    });

    it('development: always allows dev-token even when Firebase is set', async () => {
      process.env.NODE_ENV = 'development';
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY = '/some/path.json';
      const req = { headers: { authorization: 'Bearer dev-token' } } as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
      const next = jest.fn();

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('production + Firebase configured: rejects dev-token with 401', async () => {
      process.env.NODE_ENV = 'production';
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY = '/some/path.json';
      const req = { headers: { authorization: 'Bearer dev-token' } } as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
      const next = jest.fn();

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('production + Firebase missing: allows dev-token with warning', async () => {
      process.env.NODE_ENV = 'production';
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const req = { headers: { authorization: 'Bearer dev-token' } } as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
      const next = jest.fn();

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect((req as any).user.uid).toBe('dev-user');
      expect(warn).toHaveBeenCalled();
      const msg = warn.mock.calls.map((c) => String(c[0])).join('\n');
      expect(msg).toMatch(/Firebase not configured/);
      expect(msg).toMatch(/FIREBASE_SERVICE_ACCOUNT_KEY/);
      warn.mockRestore();
    });

    it('production + only GOOGLE_APPLICATION_CREDENTIALS set: rejects dev-token', async () => {
      process.env.NODE_ENV = 'production';
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/some/path.json';
      const req = { headers: { authorization: 'Bearer dev-token' } } as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
      const next = jest.fn();

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('production + only FIREBASE_PROJECT_ID set: rejects dev-token', async () => {
      process.env.NODE_ENV = 'production';
      process.env.FIREBASE_PROJECT_ID = 'site-deck';
      const req = { headers: { authorization: 'Bearer dev-token' } } as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
      const next = jest.fn();

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('uses DEV_USER_ROLE env var when set', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DEV_USER_ROLE = ROLES.OWNER_ADMIN;
      const req = { headers: { authorization: 'Bearer dev-token' } } as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
      const next = jest.fn();

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect((req as any).user.role).toBe(ROLES.OWNER_ADMIN);
    });
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
