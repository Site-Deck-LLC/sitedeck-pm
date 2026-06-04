import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as resourceService from '../services/resource.service';

const router = Router({ mergeParams: true });

router.get(
  '/equipment',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT),
  asyncHandler(async (req, res) => {
    const result = await resourceService.getEquipmentByProject(req.params.projectId);
    res.json(result);
  })
);

router.get(
  '/equipment-cost-summary',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT_AP),
  asyncHandler(async (req, res) => {
    const result = await resourceService.getEquipmentCostSummary(req.params.projectId);
    res.json(result);
  })
);

router.get(
  '/labor-cost-summary',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT_AP),
  asyncHandler(async (req, res) => {
    const result = await resourceService.getLaborCostSummary(req.params.projectId);
    res.json(result);
  })
);

router.get(
  '/idle-equipment',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT),
  asyncHandler(async (req, res) => {
    const result = await resourceService.getIdleEquipmentOnCriticalPath(req.params.projectId);
    res.json(result);
  })
);

export default router;
