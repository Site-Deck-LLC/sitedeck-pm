import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as riskService from '../services/risk.service';

const router = Router({ mergeParams: true });

router.get(
  '/risk-items',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await riskService.getRiskItemsByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/risk-items',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT),
  asyncHandler(async (req, res) => {
    const result = await riskService.createRiskItem({
      projectId: req.params.projectId,
      ...req.body,
    });
    res.status(201).json(result);
  })
);

export default router;
