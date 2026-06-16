/**
 * portfolio.routes.ts — /api/v1/portfolio
 * ============================================================================
 * Sprint 8. Single endpoint today: GET /summary. Returns the aggregated
 * portfolio rollup for the caller, scoped to their org. See
 * portfolio.service.ts for the data model.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/express-auth';
import { asyncHandler } from '../lib/async-handler';
import { getPortfolioSummary } from '../services/portfolio.service';

const router = Router();

router.get(
  '/summary',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Tenant isolation: the auth middleware has already verified the
    // token. orgId comes from the Firebase custom claim (Sprint 8
    // Task 3), or null in dev-bypass mode. When null the service
    // returns every project, which matches the dev experience.
    const orgId = req.user?.orgId ?? null;
    const summary = await getPortfolioSummary(orgId);
    res.json(summary);
  })
);

export default router;
