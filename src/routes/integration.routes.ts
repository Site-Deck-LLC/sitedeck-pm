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
  '/issues/:issueId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await integrationService.getIssueById(req.params.issueId);
    if (!result) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Issue not found' } });
      return;
    }
    res.json(result);
  })
);

router.patch(
  '/issues/:issueId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const { notesAppend, ...rest } = req.body || {};
    let result;
    if (notesAppend && typeof notesAppend === 'string') {
      // Append a note with author, then apply the rest of the update.
      result = await integrationService.appendIssueNote({
        issueId: req.params.issueId,
        text: notesAppend,
        author: req.user?.uid || 'unknown',
      });
    }
    if (Object.keys(rest).length) {
      result = await integrationService.updateIssue(req.params.issueId, rest);
    }
    res.json(result);
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
