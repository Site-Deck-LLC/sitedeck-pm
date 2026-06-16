/**
 * Team Routes — Project-level team management
 * ============================================================================
 * Sprint 9 Task 6.
 *   GET    /api/v1/projects/:id/team
 *   POST   /api/v1/projects/:id/team
 *   PATCH  /api/v1/projects/:id/team/:userId
 *   DELETE /api/v1/projects/:id/team/:userId
 *   GET    /api/v1/organizations/:orgId
 *   POST   /api/v1/organizations
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as team from '../services/team.service';
import { TeamValidationError, DuplicateMemberError } from '../services/team.service';

const router = Router({ mergeParams: true });

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await team.getProjectTeam(req.params.projectId));
  })
);

router.post(
  '/',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const { email, displayName, role } = req.body || {};
    if (!email || !displayName || !role) {
      res.status(400).json({ error: 'email, displayName, and role are required' });
      return;
    }
    try {
      const row = await team.addProjectMember(
        req.params.projectId,
        { email, displayName, role },
        req.user?.uid || 'unknown'
      );
      res.status(201).json(row);
    } catch (err) {
      if (err instanceof DuplicateMemberError) {
        res.status(409).json({ error: err.message });
        return;
      }
      if (err instanceof TeamValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

router.patch(
  '/:userId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const { role } = req.body || {};
    if (!role) {
      res.status(400).json({ error: 'role is required' });
      return;
    }
    try {
      const row = await team.updateMemberRole(req.params.projectId, req.params.userId, role);
      res.json(row);
    } catch (err) {
      if (err instanceof TeamValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

router.delete(
  '/:userId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await team.removeProjectMember(
      req.params.projectId,
      req.params.userId,
      req.user?.uid || 'unknown'
    );
    res.json(result);
  })
);

export default router;
