/**
 * Subcontract Milestone Routes (Sprint 9 Task 9)
 * ============================================================================
 *   GET    /api/v1/projects/:projectId/subcontract-milestones
 *   POST   /api/v1/projects/:projectId/subcontract-milestones
 *   PATCH  /api/v1/projects/:projectId/subcontract-milestones/:id
 *   DELETE /api/v1/projects/:projectId/subcontract-milestones/:id
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import {
  listMilestonesForProject,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  SubcontractMilestoneNotFoundError,
  SubcontractMilestoneValidationError,
} from '../services/subcontract-milestones.service';

const router = Router({ mergeParams: true });

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await listMilestonesForProject(req.params.projectId);
    res.json({ items });
  })
);

router.post(
  '/',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT),
  asyncHandler(async (req, res) => {
    try {
      const row = await createMilestone(req.body || {}, req.user?.uid || 'unknown');
      res.status(201).json(row);
    } catch (err) {
      if (err instanceof SubcontractMilestoneValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

router.patch(
  '/:id',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT),
  asyncHandler(async (req, res) => {
    try {
      const row = await updateMilestone(req.params.id, req.body || {}, req.user?.uid || 'unknown');
      res.json(row);
    } catch (err) {
      if (err instanceof SubcontractMilestoneNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      if (err instanceof SubcontractMilestoneValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT),
  asyncHandler(async (req, res) => {
    try {
      await deleteMilestone(req.params.id, req.user?.uid || 'unknown');
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof SubcontractMilestoneNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

export default router;
