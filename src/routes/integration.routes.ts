import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as integrationService from '../services/integration.service';

const router = Router({ mergeParams: true });

router.get(
  '/issues',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await integrationService.getIssuesByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/issues',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT),
  asyncHandler(async (req, res) => {
    const result = await integrationService.createIssue({
      projectId: req.params.projectId,
      ...req.body,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/change-log',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await integrationService.getChangeLogByProject(req.params.projectId);
    res.json(result);
  })
);

router.get(
  '/closeout',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await integrationService.getCloseoutChecklist(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/closeout',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await integrationService.initializeCloseoutChecklist(req.params.projectId);
    res.status(201).json(result);
  })
);

export default router;
