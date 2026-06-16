/**
 * Tests for the subscription tier middleware. Verifies that:
 *   - requireModuleAccess blocks modules not in the plan with 402
 *   - requireFeature blocks features not in the plan with 402
 *   - requireActiveSubscription blocks past_due/canceled statuses
 *   - Resolution from req.user.orgId and from :projectId both work
 *
 * The middleware intentionally returns 402 Payment Required so the frontend
 * can show an upgrade prompt. 401 is reserved for missing auth.
 */

import { Request, Response, NextFunction } from 'express';
import {
  requireModuleAccess,
  requireFeature,
  requireActiveSubscription,
} from './subscription.middleware';
import { ExpressUser } from './express-auth';

jest.mock('../lib/prisma', () => {
  const project = { findUnique: jest.fn() };
  return {
    getPrismaClient: () => ({ project, billingAccount: { findUnique: jest.fn() } }),
    __mockPrisma: { project },
  };
});

jest.mock('../services/billing.service', () => ({
  getBillingAccountByOrgId: jest.fn(),
}));

import { getPrismaClient } from '../lib/prisma';
import { getBillingAccountByOrgId } from '../services/billing.service';

const mockPrisma = getPrismaClient() as any;
const mockGetAccount = getBillingAccountByOrgId as jest.Mock;

function makeReq(opts: {
  orgId?: string;
  projectIdParam?: string;
}): Request {
  const req: any = { params: {}, user: undefined };
  if (opts.orgId) {
    const u: any = { orgId: opts.orgId };
    req.user = u as ExpressUser;
  }
  if (opts.projectIdParam) req.params.projectId = opts.projectIdParam;
  return req as Request;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function account(overrides: Partial<{ planTier: string; status: string; orgId: string }> = {}) {
  return {
    orgId: 'org1',
    planTier: 'starter',
    status: 'active',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.project.findUnique.mockResolvedValue(null);
  mockGetAccount.mockResolvedValue(null);
});

describe('subscription.middleware', () => {
  describe('requireModuleAccess', () => {
    it('rejects with 401 when there is no user and no project param', async () => {
      const mw = requireModuleAccess('schedule');
      const res = makeRes();
      const next = jest.fn();
      await mw(makeReq({}), res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects with 402 when the plan does not include the module', async () => {
      mockGetAccount.mockResolvedValue(account({ planTier: 'starter' }));
      const mw = requireModuleAccess('procurement');
      const res = makeRes();
      const next = jest.fn();
      await mw(makeReq({ orgId: 'org1' }), res, next);
      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'module_not_in_plan',
        module: 'procurement',
        currentPlan: 'starter',
        upgradeRequired: true,
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next() when the plan includes the module', async () => {
      mockGetAccount.mockResolvedValue(account({ planTier: 'starter' }));
      const mw = requireModuleAccess('schedule');
      const res = makeRes();
      const next = jest.fn();
      await mw(makeReq({ orgId: 'org1' }), res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows wildcard (professional) plan through for any module', async () => {
      mockGetAccount.mockResolvedValue(account({ planTier: 'professional' }));
      const mw = requireModuleAccess('procurement');
      const res = makeRes();
      const next = jest.fn();
      await mw(makeReq({ orgId: 'org1' }), res, next);
      expect(next).toHaveBeenCalled();
    });

    it('falls back to 402 when account is missing', async () => {
      mockGetAccount.mockResolvedValue(null);
      const mw = requireModuleAccess('schedule');
      const res = makeRes();
      const next = jest.fn();
      await mw(makeReq({ orgId: 'org1' }), res, next);
      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'no_subscription' }));
    });

    it('rejects with 402 when status is past_due', async () => {
      mockGetAccount.mockResolvedValue(account({ status: 'past_due' }));
      const mw = requireModuleAccess('schedule');
      const res = makeRes();
      const next = jest.fn();
      await mw(makeReq({ orgId: 'org1' }), res, next);
      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'subscription_inactive' }));
    });

    it('resolves orgId from project param when user.orgId missing', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ orgId: 'org-from-project' });
      mockGetAccount.mockResolvedValue(account({ planTier: 'starter' }));
      const mw = requireModuleAccess('schedule');
      const res = makeRes();
      const next = jest.fn();
      await mw(makeReq({ projectIdParam: 'p1' }), res, next);
      expect(mockGetAccount).toHaveBeenCalledWith('org-from-project');
      expect(next).toHaveBeenCalled();
    });

    it('treats trialing as active', async () => {
      mockGetAccount.mockResolvedValue(account({ status: 'trialing' }));
      const mw = requireModuleAccess('schedule');
      const res = makeRes();
      const next = jest.fn();
      await mw(makeReq({ orgId: 'org1' }), res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireFeature', () => {
    it('rejects when feature not in plan', async () => {
      mockGetAccount.mockResolvedValue(account({ planTier: 'starter' }));
      const mw = requireFeature('ai_morning_brief');
      const res = makeRes();
      const next = jest.fn();
      await mw(makeReq({ orgId: 'org1' }), res, next);
      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ feature: 'ai_morning_brief' }));
    });

    it('passes when feature is in plan', async () => {
      mockGetAccount.mockResolvedValue(account({ planTier: 'professional' }));
      const mw = requireFeature('ai_morning_brief');
      const res = makeRes();
      const next = jest.fn();
      await mw(makeReq({ orgId: 'org1' }), res, next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects with 402 when subscription is canceled', async () => {
      mockGetAccount.mockResolvedValue(account({ status: 'canceled' }));
      const mw = requireFeature('ai_morning_brief');
      const res = makeRes();
      const next = jest.fn();
      await mw(makeReq({ orgId: 'org1' }), res, next);
      expect(res.status).toHaveBeenCalledWith(402);
    });
  });

  describe('requireActiveSubscription', () => {
    it('attaches plan info and calls next for active subscription', async () => {
      mockGetAccount.mockResolvedValue(account({ planTier: 'starter', status: 'active' }));
      const mw = requireActiveSubscription();
      const req = makeReq({ orgId: 'org1' });
      const res = makeRes();
      const next = jest.fn();
      await mw(req, res, next);
      expect(next).toHaveBeenCalled();
      expect((req as any).subscription).toEqual(
        expect.objectContaining({ orgId: 'org1', planTier: 'starter', projectLimit: 3 })
      );
    });

    it('returns 402 with status for past_due', async () => {
      mockGetAccount.mockResolvedValue(account({ status: 'past_due' }));
      const mw = requireActiveSubscription();
      const res = makeRes();
      const next = jest.fn();
      await mw(makeReq({ orgId: 'org1' }), res, next);
      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'past_due' }));
    });
  });
});
