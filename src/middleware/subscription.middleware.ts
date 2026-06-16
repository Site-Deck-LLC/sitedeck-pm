/**
 * Subscription Tier Middleware
 * ============================================================================
 * Express middlewares that gate routes on subscription tier.
 *
 *   - `requireModuleAccess(moduleId)` — 402 if org's plan doesn't allow module.
 *   - `requireFeature(featureId)` — 402 if org's plan doesn't allow feature.
 *   - `requireActiveSubscription()` — 402 if status is past_due/canceled/unpaid.
 *
 * These all look up the orgId from the authenticated user (req.user.orgId).
 * In tenant-isolated routes, the org context may also be on req.params.projectId;
 * we resolve orgId via Project lookup in that case.
 *
 * 402 Payment Required is the right status when the user can pay to unlock —
 * it tells the frontend to show the upgrade page, not just an error.
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { getPrismaClient } from '../lib/prisma';
import {
  isModuleInPlan,
  isFeatureInPlan,
  getPlan,
} from '../constants/subscription-tiers';
import { getBillingAccountByOrgId } from '../services/billing.service';

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

type AuthedRequest = Request;

async function resolveOrgId(req: AuthedRequest): Promise<string | null> {
  // `req.user` is typed as ExpressUser (which has uid/role/decodedToken). Org
  // is attached as a custom field by route-level auth middleware that
  // resolves it from the user record. Treat as `any` to keep this gate
  // middleware loosely coupled to the auth pipeline.
  const user = (req as any).user;
  if (user && user.orgId) return user.orgId;
  // Fallback: project-scoped route — read :projectId and look up the org.
  const projectId = req.params.projectId;
  if (projectId) {
    const project = await getPrismaClient().project.findUnique({
      where: { id: projectId },
      select: { orgId: true },
    });
    return project?.orgId || null;
  }
  return null;
}

/**
 * Returns 402 with the org's current plan + the missing module id, so the
 * frontend can show an upgrade prompt with the right copy.
 */
export function requireModuleAccess(moduleId: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = await resolveOrgId(req);
      if (!orgId) {
        res.status(401).json({ error: 'unauthenticated' });
        return;
      }
      const account = await getBillingAccountByOrgId(orgId);
      if (!account) {
        res.status(402).json({
          error: 'no_subscription',
          module: moduleId,
          upgradeRequired: true,
        });
        return;
      }
      if (!ACTIVE_STATUSES.has(account.status)) {
        res.status(402).json({
          error: 'subscription_inactive',
          status: account.status,
          upgradeRequired: true,
        });
        return;
      }
      if (!isModuleInPlan(account.planTier, moduleId)) {
        res.status(402).json({
          error: 'module_not_in_plan',
          module: moduleId,
          currentPlan: account.planTier,
          upgradeRequired: true,
        });
        return;
      }
      next();
    } catch (err: any) {
      next(err);
    }
  };
}

export function requireFeature(featureId: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = await resolveOrgId(req);
      if (!orgId) {
        res.status(401).json({ error: 'unauthenticated' });
        return;
      }
      const account = await getBillingAccountByOrgId(orgId);
      if (!account || !ACTIVE_STATUSES.has(account.status)) {
        res.status(402).json({
          error: 'subscription_inactive',
          feature: featureId,
          upgradeRequired: true,
        });
        return;
      }
      if (!isFeatureInPlan(account.planTier, featureId)) {
        res.status(402).json({
          error: 'feature_not_in_plan',
          feature: featureId,
          currentPlan: account.planTier,
          upgradeRequired: true,
        });
        return;
      }
      next();
    } catch (err: any) {
      next(err);
    }
  };
}

export function requireActiveSubscription() {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = await resolveOrgId(req);
      if (!orgId) {
        res.status(401).json({ error: 'unauthenticated' });
        return;
      }
      const account = await getBillingAccountByOrgId(orgId);
      if (!account || !ACTIVE_STATUSES.has(account.status)) {
        res.status(402).json({
          error: 'subscription_inactive',
          status: account?.status || 'none',
          upgradeRequired: true,
        });
        return;
      }
      // Attach plan info for downstream handlers
      const plan = getPlan(account.planTier);
      (req as any).subscription = {
        orgId,
        planTier: account.planTier,
        projectLimit: plan?.projectLimit ?? 3,
        status: account.status,
      };
      next();
    } catch (err: any) {
      next(err);
    }
  };
}
