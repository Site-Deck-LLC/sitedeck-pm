import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as billingService from '../services/billing.service';
import { mapServiceErrorToApiError } from '../lib/error-handler';
import { PLAN_LIST } from '../constants/subscription-tiers';
import { getPrismaClient } from '../lib/prisma';

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

router.get(
  '/plans',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(
      PLAN_LIST.map((p) => ({
        id: p.id,
        name: p.displayName,
        monthlyPrice: p.priceUsdMonthly,
        projectLimit: p.projectLimit,
        features: p.features || [],
        stripePriceId:
          p.id === 'starter'
            ? process.env.STRIPE_PRICE_STARTER || ''
            : p.id === 'professional'
            ? process.env.STRIPE_PRICE_PROFESSIONAL || ''
            : process.env.STRIPE_PRICE_ENTERPRISE || '',
      }))
    );
  })
);

router.post(
  '/byok',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN),
  asyncHandler(async (req, res) => {
    const orgId = req.user?.orgId || req.user?.decodedToken?.orgId || req.body?.orgId;
    if (!orgId) {
      throw mapServiceErrorToApiError(new Error('orgId is required'));
    }
    const { anthropicApiKey } = req.body || {};
    if (!anthropicApiKey || typeof anthropicApiKey !== 'string' || !anthropicApiKey.startsWith('sk-ant-')) {
      throw mapServiceErrorToApiError(
        new Error('anthropicApiKey is required and must start with sk-ant-')
      );
    }

    // Enterprise-only. Read account, refuse if not enterprise.
    const account = await billingService.getBillingAccountByOrgId(orgId);
    if (!account || account.planTier !== 'enterprise') {
      throw mapServiceErrorToApiError(
        new Error('BYOK is available on the enterprise plan only')
      );
    }

    // Encrypt the key at rest (AES-256-GCM). The plaintext value
    // never leaves this function.
    const { setOrgAnthropicKey } = await import('../services/byok.service');
    await setOrgAnthropicKey({
      orgId,
      anthropicApiKey,
      userId: req.user?.uid || 'unknown',
    });
    res.json({ saved: true });
  })
);

router.delete(
  '/byok',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN),
  asyncHandler(async (req, res) => {
    const orgId = req.user?.orgId || req.user?.decodedToken?.orgId || req.body?.orgId;
    if (!orgId) {
      throw mapServiceErrorToApiError(new Error('orgId is required'));
    }
    const account = await billingService.getBillingAccountByOrgId(orgId);
    if (!account || account.planTier !== 'enterprise') {
      throw mapServiceErrorToApiError(
        new Error('BYOK is available on the enterprise plan only')
      );
    }
    const { deleteOrgAnthropicKey } = await import('../services/byok.service');
    await deleteOrgAnthropicKey(orgId);
    res.json({ removed: true });
  })
);

router.get(
  '/byok/status',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const orgId = req.user?.orgId || req.user?.decodedToken?.orgId || (req.query.orgId as string);
    if (!orgId) {
      throw mapServiceErrorToApiError(new Error('orgId is required'));
    }
    const { hasOrgAnthropicKey } = await import('../services/byok.service');
    const active = await hasOrgAnthropicKey(orgId);
    // We deliberately return only the boolean — never the key.
    res.json({ active });
  })
);

export default router;
