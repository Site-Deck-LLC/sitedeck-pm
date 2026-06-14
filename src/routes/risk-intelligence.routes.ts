/**
 * Risk Intelligence Routes (Sprint 9 Task 7 + Sprint 11 Task 7)
 * ============================================================================
 *   GET  /api/v1/projects/:id/risk-intelligence
 *   POST /api/v1/projects/:id/risk-intelligence/refresh
 *   GET  /api/v1/projects/:id/risk-intelligence/history
 *   POST /api/v1/projects/:id/risk-intelligence/history/:riskId/resolve
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/express-auth';
import { asyncHandler } from '../lib/async-handler';
import {
  getRiskIntelligenceSnapshot,
  tryRefreshRiskIntelligence,
  listCompoundRiskHistory,
  resolveCompoundRisk,
  RiskRefreshLimitError,
} from '../services/risk-intelligence.service';

const router = Router({ mergeParams: true });

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await getRiskIntelligenceSnapshot(req.params.projectId));
  })
);

router.post(
  '/refresh',
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const snap = await tryRefreshRiskIntelligence(req.params.projectId);
      res.json(snap);
    } catch (err) {
      if (err instanceof RiskRefreshLimitError) {
        res.status(429).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/history',
  requireAuth,
  asyncHandler(async (req, res) => {
    const list = await listCompoundRiskHistory(req.params.projectId);
    res.json(list);
  })
);

router.post(
  '/history/:riskId/resolve',
  requireAuth,
  asyncHandler(async (req, res) => {
    const resolution = String(req.body?.resolution || '').trim();
    if (!resolution) { res.status(400).json({ error: 'resolution required' }); return; }
    const who = (req as any).user?.uid || 'unknown';
    res.json(await resolveCompoundRisk(req.params.riskId, who, resolution));
  })
);

export default router;
