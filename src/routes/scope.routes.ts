import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as scopeService from '../services/scope.service';

const router = Router({ mergeParams: true });

router.get(
  '/scope-statements',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await scopeService.getScopeStatementsByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/scope-statements',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await scopeService.createScopeStatement(
      req.params.projectId,
      req.body.content,
      req.body.createdBy
    );
    res.status(201).json(result);
  })
);

router.get(
  '/change-orders',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await scopeService.getChangeOrdersByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/change-orders',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await scopeService.createChangeOrder({
      projectId: req.params.projectId,
      ...req.body,
    });
    res.status(201).json(result);
  })
);

export default router;
