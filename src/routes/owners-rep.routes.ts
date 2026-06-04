import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as dashboardService from '../services/dashboard.service';
import * as integrationService from '../services/integration.service';
import * as communicationsService from '../services/communications.service';

const router = Router({ mergeParams: true });

router.get(
  '/dashboard',
  requireAuth,
  requireRole(ROLES.OWNERS_REP, ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const safetyData = { incidents: 0, openObservations: 0 };
    const result = await dashboardService.getMorningDashboard(req.params.projectId, safetyData);
    res.json(result);
  })
);

router.get(
  '/issues',
  requireAuth,
  requireRole(ROLES.OWNERS_REP, ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await integrationService.getIssuesByType(req.params.projectId, 'client_issue');
    res.json(result);
  })
);

router.get(
  '/rfis',
  requireAuth,
  requireRole(ROLES.OWNERS_REP, ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await communicationsService.getRfiByProject(req.params.projectId);
    res.json(result);
  })
);

export default router;
