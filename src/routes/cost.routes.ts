import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as costService from '../services/cost.service';

const router = Router({ mergeParams: true });

router.get(
  '/budget-lines',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT_AP),
  asyncHandler(async (req, res) => {
    const result = await costService.getBudgetLinesByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/budget-lines',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await costService.createBudgetLine({
      projectId: req.params.projectId,
      ...req.body,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/budget-lines/:lineId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT_AP),
  asyncHandler(async (req, res) => {
    const result = await costService.getBudgetLineById(req.params.lineId);
    res.json(result);
  })
);

router.patch(
  '/budget-lines/:lineId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await costService.updateBudgetLine(req.params.lineId, req.body);
    res.json(result);
  })
);

router.get(
  '/evm',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT_AP),
  asyncHandler(async (req, res) => {
    const result = await costService.calculateProjectEvm(req.params.projectId);
    res.json(result);
  })
);

router.get(
  '/transactions',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT_AP),
  asyncHandler(async (req, res) => {
    const result = await costService.getCostTransactionsByProject(req.params.projectId);
    res.json(result);
  })
);

export default router;
