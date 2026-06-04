import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as projectService from '../services/project.service';
import * as billingService from '../services/billing.service';
import { mapServiceErrorToApiError } from '../lib/error-handler';

const router = Router();

router.post(
  '/',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const orgId = req.body.orgId;
    if (!orgId) {
      throw mapServiceErrorToApiError(new Error('orgId is required'));
    }

    let account = await billingService.getBillingAccountByOrgId(orgId);
    if (!account) {
      const email = (req.user?.decodedToken as any)?.email || 'dev@example.com';
      account = await billingService.createBillingAccount(orgId, email);
    }

    const allowed = await billingService.canCreateProject(orgId);
    if (!allowed) {
      throw mapServiceErrorToApiError(
        new Error('Project limit reached for current plan. Upgrade to create more projects.')
      );
    }

    const result = await projectService.createProject(req.body);
    res.status(201).json(result);
  })
);

router.get(
  '/',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (_req, res) => {
    const projects = await projectService.listProjects();
    res.json(projects);
  })
);

router.get(
  '/:id',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await projectService.getProjectById(req.params.id);
    res.json(result);
  })
);

router.patch(
  '/:id',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await projectService.updateProject(req.params.id, req.body);
    res.json(result);
  })
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await projectService.deleteProject(req.params.id);
    res.json(result);
  })
);

router.post(
  '/:id/wbs-items',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await projectService.addWorkBreakdownItem(req.params.id, req.body);
    res.status(201).json(result);
  })
);

router.post(
  '/:id/lock-structure',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await projectService.lockProjectStructure(req.params.id);
    res.json(result);
  })
);

export default router;
