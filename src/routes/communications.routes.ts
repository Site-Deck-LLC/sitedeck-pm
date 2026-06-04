import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as communicationsService from '../services/communications.service';

const router = Router({ mergeParams: true });

router.get(
  '/rfis',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP, ROLES.SUBCONTRACTOR_PM),
  asyncHandler(async (req, res) => {
    const result = await communicationsService.getRfiByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/rfis',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT),
  asyncHandler(async (req, res) => {
    const result = await communicationsService.createRfi({
      projectId: req.params.projectId,
      ...req.body,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/submittals',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP, ROLES.SUBCONTRACTOR_PM),
  asyncHandler(async (req, res) => {
    const result = await communicationsService.getSubmittalsByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/submittals',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUBCONTRACTOR_PM),
  asyncHandler(async (req, res) => {
    const result = await communicationsService.createSubmittal({
      projectId: req.params.projectId,
      ...req.body,
    });
    res.status(201).json(result);
  })
);

export default router;
