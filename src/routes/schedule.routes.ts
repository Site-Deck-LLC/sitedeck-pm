import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as scheduleService from '../services/schedule.service';
import * as activityService from '../services/activity.service';
import * as baselineService from '../services/baseline.service';
import * as changeRequestService from '../services/change-request.service';
import { importXerSchedule } from '../services/schedule-import.service';
import { importMsProjectSchedule } from '../services/schedule-import-msproject.service';
import { importExcelSchedule } from '../services/schedule-import-excel.service';
import { runWhatIf } from '../services/schedule-whatif.service';
import { linkActivityToBenchmark } from '../services/activity-benchmark.service';

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

router.post(
  '/activities/:activityId/send-to-benchmark',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const { dfowId } = req.body;
    if (!dfowId || typeof dfowId !== 'string') {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'dfowId is required' } });
      return;
    }
    const result = await linkActivityToBenchmark(req.params.activityId, dfowId);
    res.json(result);
  })
);

router.post(
  '/activities/:activityId/assign-to-field',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { activityId } = req.params;
    const { taskDescription } = req.body || {};
    const { assignToField } = await import('../services/pro-outbound.service');
    const result = await assignToField({
      projectId,
      activityId,
      activityName: req.body?.activityName || '',
      taskDescription: taskDescription || '',
    });
    res.json({ success: result.sent, taskId: result.taskId });
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

router.get(
  '/performance',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await scheduleService.getSchedulePerformance(req.params.projectId);
    res.json(result);
  })
);

// ─── Activity Relationships ───

router.post(
  '/activities/:activityId/relationships',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await activityService.createRelationship({
      projectId: req.params.projectId,
      predecessorId: req.body.predecessorId,
      successorId: req.params.activityId,
      relationshipType: req.body.relationshipType,
      lagDays: req.body.lagDays,
      constraintType: req.body.constraintType,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/activities/:activityId/relationships',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.SUBCONTRACTOR_PM, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await activityService.getRelationshipsForActivity(req.params.activityId);
    res.json(result);
  })
);

router.delete(
  '/relationships/:relId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await activityService.deleteRelationship(req.params.relId);
    res.json(result);
  })
);

router.get(
  '/relationships',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.SUBCONTRACTOR_PM, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const prisma = (await import('../lib/prisma')).getPrismaClient();
    const result = await prisma.activityRelationship.findMany({
      where: { projectId: req.params.projectId },
      include: {
        predecessor: { select: { id: true, name: true } },
        successor: { select: { id: true, name: true } },
      },
    });
    res.json(result);
  })
);

// ─── What-If Analysis ───

router.get(
  '/whatif',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const { activityId, delayDays, delayType } = req.query;
    if (!activityId || typeof activityId !== 'string') {
      res.status(400).json({ error: 'activityId is required' });
      return;
    }
    const days = Number(delayDays);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      res.status(400).json({ error: 'delayDays must be 1-365' });
      return;
    }
    if (delayType !== 'start_delay' && delayType !== 'duration_extension') {
      res.status(400).json({ error: 'delayType must be start_delay or duration_extension' });
      return;
    }
    const result = await runWhatIf(req.params.projectId, {
      activityId,
      delayDays: days,
      delayType,
    });
    res.json(result);
  })
);

// ─── Import ───

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/import/xer',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const content = req.file.buffer.toString('utf-8');
    const result = await importXerSchedule(req.params.projectId, content);
    res.status(200).json(result);
  })
);

router.post(
  '/import/msproject',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const content = req.file.buffer.toString('utf-8');
    const result = await importMsProjectSchedule(req.params.projectId, content);
    res.status(200).json(result);
  })
);

router.post(
  '/import/excel',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const result = await importExcelSchedule(req.params.projectId, req.file.buffer, req.file.originalname);
    res.status(200).json(result);
  })
);

export default router;
