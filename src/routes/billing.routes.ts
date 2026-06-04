import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as billingService from '../services/billing.service';
import { mapServiceErrorToApiError } from '../lib/error-handler';

const router = Router();

router.post(
  '/checkout-session',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN),
  asyncHandler(async (req, res) => {
    const { priceId, successUrl, cancelUrl } = req.body;
    if (!priceId || !successUrl || !cancelUrl) {
      throw mapServiceErrorToApiError(
        new Error('priceId, successUrl, and cancelUrl are required')
      );
    }

    const orgId = req.user?.decodedToken?.orgId || req.body.orgId;
    if (!orgId) {
      throw mapServiceErrorToApiError(new Error('orgId is required'));
    }

    const session = await billingService.createCheckoutSession(
      orgId,
      priceId,
      successUrl,
      cancelUrl
    );
    res.json({ url: session.url });
  })
);

router.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user?.decodedToken?.orgId || req.query.orgId as string;
    if (!orgId) {
      throw mapServiceErrorToApiError(new Error('orgId is required'));
    }

    const status = await billingService.getSubscriptionStatus(orgId);
    res.json(status ?? { status: 'none', planTier: 'none' });
  })
);

router.get(
  '/plan',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user?.decodedToken?.orgId || req.query.orgId as string;
    if (!orgId) {
      throw mapServiceErrorToApiError(new Error('orgId is required'));
    }

    const account = await billingService.getBillingAccountByOrgId(orgId);
    const plan = account ? await billingService.getPlanConfig(account.planTier) : null;
    res.json({
      orgId,
      planTier: account?.planTier || 'none',
      status: account?.status || 'none',
      config: plan,
    });
  })
);

export default router;
