/**
 * QuickBooks Integration Routes
 * ============================================================================
 * Sprint 12 Task 5. PM → QuickBooks export only (no sync, no accounting).
 *
 *   GET  /api/v1/integrations/quickbooks/auth        → redirect to QBO OAuth
 *   GET  /api/v1/integrations/quickbooks/callback    → exchange code, store
 *   GET  /api/v1/integrations/quickbooks/status      → configured + connected
 *   POST /api/v1/integrations/quickbooks/disconnect  → remove token row
 *
 *   GET  /api/v1/projects/:id/integrations/quickbooks/status
 *   POST /api/v1/projects/:id/integrations/quickbooks/export-co/:coId
 *   POST /api/v1/projects/:id/integrations/quickbooks/export-summary
 *
 * Tenant isolation: every project-scoped route keys on :id. The CO
 * is fetched with projectId match — a CO in another project returns
 * a useful 400, not a leak.
 *
 * Out of scope this sprint: QBO → PM webhooks (payment received, etc).
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  exportInvoice,
  exportChangeOrderSummary,
  getConnectionStatus,
  getSyncStatus,
  QboNotConfiguredError,
  QboNotConnectedError,
  isQboConfigured,
} from '../services/quickbooks.service';
import { getPrismaClient } from '../lib/prisma';
import crypto from 'crypto';

const router = Router();

// ─── Top-level (not project-scoped) routes ────────────────────────────────

router.get(
  '/status',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await getConnectionStatus());
  })
);

router.get(
  '/auth',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.ACCOUNTANT_AP, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    if (!isQboConfigured()) {
      // Standalone degradation — the user reaches this when env vars
      // are missing. Return a useful 503, not a 500.
      res.status(503).json({
        error: 'QuickBooks is not configured. Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET on the backend.',
      });
      return;
    }
    // CSRF: a one-shot state we round-trip via the cookie. QBO
    // redirects with ?state= and we verify it before exchanging.
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie('qbo_oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000 });
    const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/integrations/quickbooks/callback`;
    res.redirect(buildAuthUrl(state, redirectUri));
  })
);

router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code, state, realmId } = req.query as Record<string, string | undefined>;
    const expectedState = (req as any).cookies?.qbo_oauth_state;
    if (!code || !state || !realmId) {
      res.status(400).send('Missing code/state/realmId from QuickBooks callback');
      return;
    }
    if (expectedState && expectedState !== state) {
      res.status(400).send('OAuth state mismatch — possible CSRF');
      return;
    }
    const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/integrations/quickbooks/callback`;
    try {
      await exchangeCodeForTokens(code, realmId, redirectUri);
    } catch (err: any) {
      res.status(502).send(`QuickBooks OAuth failed: ${err?.message || 'unknown'}`);
      return;
    }
    // Redirect the user back to the integrations settings page. The
    // frontend will refresh its status badge.
    res.clearCookie('qbo_oauth_state');
    res.redirect('/settings?integration=quickbooks&status=connected');
  })
);

router.post(
  '/disconnect',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.ACCOUNTANT_AP, ROLES.PROJECT_MANAGER),
  asyncHandler(async (_req, res) => {
    const prisma = getPrismaClient();
    await prisma.quickBooksToken.deleteMany({});
    res.json({ ok: true });
  })
);

// ─── Project-scoped routes ────────────────────────────────────────────────

const projectRouter = Router({ mergeParams: true });

projectRouter.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const status = await getConnectionStatus();
      const sync = await getSyncStatus(req.params.projectId);
      res.json({ ...status, sync });
    } catch (err: any) {
      if (err instanceof QboNotConfiguredError || err instanceof QboNotConnectedError) {
        res.status(503).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

projectRouter.post(
  '/export-co/:coId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT_AP),
  asyncHandler(async (req, res) => {
    try {
      const r = await exportInvoice(
        req.params.projectId,
        req.params.coId,
        req.user?.uid || 'unknown'
      );
      res.json({
        ok: true,
        alreadyExported: r.alreadyExported,
        invoiceId: r.invoiceId,
        invoiceNumber: r.invoiceNumber,
      });
    } catch (err: any) {
      if (err instanceof QboNotConfiguredError) {
        res.status(503).json({ error: err.message });
        return;
      }
      if (err instanceof QboNotConnectedError) {
        res.status(409).json({ error: err.message });
        return;
      }
      // Validation errors from the service (tenant isolation, CO not
      // approved, missing QBO customer) come back as 400.
      if (/not found|must be approved|customer|item/i.test(err?.message || '')) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

projectRouter.post(
  '/export-summary',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT_AP),
  asyncHandler(async (req, res) => {
    try {
      const r = await exportChangeOrderSummary(
        req.params.projectId,
        req.user?.uid || 'unknown'
      );
      res.json(r);
    } catch (err: any) {
      if (err instanceof QboNotConfiguredError) {
        res.status(503).json({ error: err.message });
        return;
      }
      if (err instanceof QboNotConnectedError) {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

export { router as quickbooksRouter, projectRouter as quickbooksProjectRouter };
