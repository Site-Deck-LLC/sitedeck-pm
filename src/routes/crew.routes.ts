import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as resourceService from '../services/resource.service';

const router = Router({ mergeParams: true });

router.get(
  '/status',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await resourceService.getCrewStatus(req.params.projectId);
    res.json(result);
  })
);

export default router;
