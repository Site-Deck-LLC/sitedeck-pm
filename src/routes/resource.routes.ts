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

router.get(
  '/attendance/today',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.SUPERVISOR, ROLES.FIELD_CREW, ROLES.ACCOUNTANT_AP),
  asyncHandler(async (req, res) => {
    const date = req.query.date ? new Date(String(req.query.date)) : new Date();
    const result = await resourceService.getAttendanceForDate(req.params.projectId, date);
    res.json(result || null);
  })
);

router.post(
  '/attendance',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const date = body.date ? new Date(body.date) : new Date();
    if (body.workerCount == null || body.hours == null) {
      res.status(400).json({ error: { message: 'workerCount and hours are required' } });
      return;
    }
    const result = await resourceService.upsertAttendance(
      req.params.projectId,
      date,
      Number(body.workerCount),
      Number(body.hours),
      {
        presentCount: body.presentCount != null ? Number(body.presentCount) : undefined,
        absentCount: body.absentCount != null ? Number(body.absentCount) : undefined,
        lateCount: body.lateCount != null ? Number(body.lateCount) : undefined,
        notes: body.notes ? String(body.notes) : undefined,
        affectedActivities: Array.isArray(body.affectedActivities)
          ? body.affectedActivities.map((a: unknown) => String(a))
          : undefined,
      }
    );
    res.status(201).json(result);
  })
);

router.post(
  '/equipment',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.externalId || !body.name) {
      res.status(400).json({ error: { message: 'externalId and name are required' } });
      return;
    }
    const result = await resourceService.upsertEquipment({
      projectId: req.params.projectId,
      externalId: String(body.externalId),
      name: String(body.name),
      type: body.type ? String(body.type) : undefined,
      currentActivityId: body.currentActivityId ? String(body.currentActivityId) : undefined,
    });
    res.status(201).json(result);
  })
);

router.post(
  '/equipment/status-log',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.equipmentId || !body.status) {
      res.status(400).json({ error: { message: 'equipmentId and status are required' } });
      return;
    }
    const result = await resourceService.logEquipmentStatus({
      equipmentId: String(body.equipmentId),
      date: body.date ? new Date(body.date) : new Date(),
      status: String(body.status),
      hours: body.hours != null ? Number(body.hours) : 0,
      notes: body.notes ? String(body.notes) : undefined,
      loggedBy: body.loggedBy ? String(body.loggedBy) : undefined,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/equipment/status-log',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.SUPERVISOR, ROLES.FIELD_CREW, ROLES.ACCOUNTANT_AP),
  asyncHandler(async (req, res) => {
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();
    const startDate = req.query.startDate
      ? new Date(String(req.query.startDate))
      : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const result = await resourceService.getEquipmentStatusLog(req.params.projectId, startDate, endDate);
    res.json(result);
  })
);

// ─── Equipment Registry (Sprint 6) ────────────────────────────────────────

router.get(
  '/equipment-registry',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await resourceService.getEquipmentListForProject(req.params.projectId);
    res.json(result);
  })
);

router.get(
  '/equipment-registry/:equipId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await resourceService.getEquipmentById(req.params.equipId);
    if (!result) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }
    res.json(result);
  })
);

router.post(
  '/equipment-registry',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    if (!req.body.name || typeof req.body.dailyRate !== 'number') {
      res.status(400).json({ error: 'name and dailyRate are required' });
      return;
    }
    const calDueDate = req.body.calDueDate ? new Date(req.body.calDueDate) : null;
    const result = await resourceService.createEquipment({
      projectId: req.params.projectId,
      name: req.body.name,
      type: req.body.type,
      dailyRate: req.body.dailyRate,
      isOwned: !!req.body.isOwned,
      serialNumber: req.body.serialNumber,
      vendor: req.body.vendor,
      calDueDate,
    });
    res.status(201).json(result);
  })
);

router.patch(
  '/equipment-registry/:equipId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const data: any = { ...req.body };
    if (data.calDueDate !== undefined) {
      data.calDueDate = data.calDueDate ? new Date(data.calDueDate) : null;
    }
    const result = await resourceService.updateEquipment(req.params.equipId, data);
    res.json(result);
  })
);

router.get(
  '/equipment-registry/:equipId/history',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await resourceService.getEquipmentStatusHistory(req.params.equipId);
    res.json(result);
  })
);

export default router;
