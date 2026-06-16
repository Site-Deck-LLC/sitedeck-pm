import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as safetyService from '../services/safety.service';

const router = Router({ mergeParams: true });

router.get(
  '/performance',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await safetyService.getSafetyPerformance(req.params.projectId);
    res.json(result);
  })
);

export default router;
