import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as projectService from '../services/project.service';

const router = Router();

router.post(
  '/',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
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
