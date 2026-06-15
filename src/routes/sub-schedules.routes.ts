/**
 * Sub-Schedule Routes
 * ============================================================================
 * Sprint 12 Task 6.
 *   GET    /api/v1/projects/:id/sub-schedules
 *   POST   /api/v1/projects/:id/sub-schedules
 *   GET    /api/v1/projects/:id/sub-schedules/rollup
 *   GET    /api/v1/projects/:id/sub-schedules/:subId
 *   POST   /api/v1/projects/:id/sub-schedules/:subId/activities
 *   PATCH  /api/v1/projects/:id/sub-schedules/:subId/activities/:actId
 *   POST   /api/v1/projects/:id/sub-schedules/:subId/activities/:actId/link/:masterActId
 *
 * Tenant isolation: every sub-schedule must belong to the project
 * in the URL. The service enforces this; the route relies on it.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as subSchedules from '../services/sub-schedule.service';

const router = Router({ mergeParams: true });

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await subSchedules.getSubSchedules(req.params.projectId));
  })
);

router.get(
  '/rollup',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await subSchedules.getRollup(req.params.projectId));
  })
);

router.post(
  '/',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const { subcontractId, name, description, baselineStartDate, baselineEndDate } = req.body || {};
    if (!subcontractId || !name) {
      res.status(400).json({ error: 'subcontractId and name are required' });
      return;
    }
    try {
      const ss = await subSchedules.createSubSchedule({
        projectId: req.params.projectId,
        subcontractId,
        name,
        description,
        baselineStartDate,
        baselineEndDate,
        createdBy: req.user?.uid || 'unknown',
      });
      res.status(201).json(ss);
    } catch (err: any) {
      if (/not found/i.test(err?.message || '')) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/:subId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ss = await subSchedules.getSubSchedule(req.params.projectId, req.params.subId);
    if (!ss) {
      res.status(404).json({ error: 'sub-schedule not found' });
      return;
    }
    // Include this sub's SPI for the panel header.
    const spi = await subSchedules.calculateSubSPI(ss.subcontractId);
    res.json({ ...ss, spi });
  })
);

router.post(
  '/:subId/activities',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUBCONTRACTOR_PM),
  asyncHandler(async (req, res) => {
    // Tenant check: the sub-schedule must belong to the project.
    const ss = await subSchedules.getSubSchedule(req.params.projectId, req.params.subId);
    if (!ss) {
      res.status(404).json({ error: 'sub-schedule not found' });
      return;
    }
    const { name, description, plannedStart, plannedEnd, percentComplete, status } = req.body || {};
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const a = await subSchedules.addActivity({
      subScheduleId: req.params.subId,
      name,
      description,
      plannedStart,
      plannedEnd,
      percentComplete,
      status,
    });
    res.status(201).json(a);
  })
);

router.patch(
  '/:subId/activities/:actId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUBCONTRACTOR_PM),
  asyncHandler(async (req, res) => {
    const ss = await subSchedules.getSubSchedule(req.params.projectId, req.params.subId);
    if (!ss) {
      res.status(404).json({ error: 'sub-schedule not found' });
      return;
    }
    const a = await subSchedules.updateActivity(req.params.actId, req.body || {});
    res.json(a);
  })
);

router.post(
  '/:subId/activities/:actId/link/:masterActId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const ss = await subSchedules.getSubSchedule(req.params.projectId, req.params.subId);
    if (!ss) {
      res.status(404).json({ error: 'sub-schedule not found' });
      return;
    }
    const masterActId = req.params.masterActId === 'null' ? null : req.params.masterActId;
    const a = await subSchedules.linkToMaster(req.params.actId, masterActId);
    res.json(a);
  })
);

export default router;
