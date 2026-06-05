import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as scheduleService from '../services/schedule.service';
import * as activityService from '../services/activity.service';
import * as baselineService from '../services/baseline.service';
import * as changeRequestService from '../services/change-request.service';

const router = Router({ mergeParams: true });

router.get(
  '/activities',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.SUBCONTRACTOR_PM, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await activityService.getActivitiesWithWbs(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/activities',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await activityService.createActivity({
      projectId: req.params.projectId,
      ...req.body,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/activities/:activityId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.SUBCONTRACTOR_PM, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await activityService.getActivityById(req.params.activityId);
    res.json(result);
  })
);

router.patch(
  '/activities/:activityId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await activityService.updateActivity(req.params.activityId, req.body);
    res.json(result);
  })
);

router.delete(
  '/activities/:activityId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await activityService.deleteActivity(req.params.activityId);
    res.json(result);
  })
);

router.get(
  '/baselines',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await baselineService.getBaselinesByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/baselines',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await baselineService.createBaseline(
      req.params.projectId,
      req.body.name,
      req.body.createdBy
    );
    res.status(201).json(result);
  })
);

router.get(
  '/change-requests',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await changeRequestService.getChangeRequestsByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/change-requests',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT),
  asyncHandler(async (req, res) => {
    const result = await changeRequestService.createChangeRequest({
      projectId: req.params.projectId,
      ...req.body,
    });
    res.status(201).json(result);
  })
);

export default router;
