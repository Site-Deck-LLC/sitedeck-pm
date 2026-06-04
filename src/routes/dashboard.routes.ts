import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as dashboardService from '../services/dashboard.service';

const router = Router({ mergeParams: true });

router.get(
  '/morning',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const safetyData = req.query.safetyData
      ? (JSON.parse(req.query.safetyData as string) as dashboardService.SafetyData)
      : { incidents: 0, openObservations: 0 };
    const result = await dashboardService.getMorningDashboard(req.params.projectId, safetyData);
    res.json(result);
  })
);

export default router;
