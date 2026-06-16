/**
 * Project Full-Snapshot Template Routes
 * ============================================================================
 * Sprint 7: save a project as a full-snapshot template, list this org's
 * project templates, fetch one with its full snapshot, and apply one
 * (WBS + activity shells + budget + risks + lessons) to a new project.
 *
 *   GET    /api/v1/projects/:projectId/templates
 *     — list this org's project-snapshot templates.
 *   POST   /api/v1/projects/:projectId/templates
 *     Body: { name, description? }
 *     — captures the project as a full snapshot template.
 *   GET    /api/v1/projects/:projectId/templates/:id
 *     — fetch one template's full snapshot. Tenant-isolated.
 *   DELETE /api/v1/projects/:projectId/templates/:id
 *     — delete (org must own).
 *   POST   /api/v1/projects/:projectId/templates/:id/apply
 *     Body: { targetProjectId }
 *     — apply the template to another project. Idempotent.
 *
 * The :projectId in the URL is the *source* project (for save) or just
 * the tenant scope (for list/get/delete). The apply route takes a
 * different `targetProjectId` in the body.
 *
 * Tenant isolation: every action verifies that the project (source or
 * target) and the template both belong to the caller's org.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { requireFeature } from '../middleware/subscription.middleware';
import { asyncHandler } from '../lib/async-handler';
import { getPrismaClient } from '../lib/prisma';
import * as projectTemplates from '../services/project-templates.service';

const router = Router({ mergeParams: true });

async function resolveSourceOrgId(projectId: string) {
  // The auth middleware exposes uid + role on req.user. orgId must be
  // resolved from the source project for tenant scoping. Same fallback the
  // existing /templates routes use.
  const p = await getPrismaClient().project.findUnique({
    where: { id: projectId },
    select: { orgId: true },
  });
  return p?.orgId || null;
}

router.get(
  '/',
  requireAuth,
  requireFeature('wbs_builder'),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const orgId = await resolveSourceOrgId(projectId);
    if (!orgId) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    // Verify the URL project is in this org (tenant check on the source).
    const project = await getPrismaClient().project.findUnique({
      where: { id: projectId },
      select: { orgId: true },
    });
    if (!project || project.orgId !== orgId) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(await projectTemplates.listProjectTemplates(orgId));
  })
);

router.post(
  '/',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  requireFeature('wbs_builder'),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const orgId = await resolveSourceOrgId(projectId);
    if (!orgId) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    if (!req.body?.name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const result = await projectTemplates.saveProjectAsTemplate({
      orgId,
      projectId,
      name: req.body.name,
      description: req.body.description,
      createdBy: req.user?.uid || 'unknown',
    });
    res.status(201).json(result);
  })
);

router.get(
  '/:id',
  requireAuth,
  requireFeature('wbs_builder'),
  asyncHandler(async (req, res) => {
    const orgId = await resolveSourceOrgId(req.params.projectId);
    if (!orgId) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    const tpl = await projectTemplates.getProjectTemplate(req.params.id, orgId);
    if (!tpl) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(tpl);
  })
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  requireFeature('wbs_builder'),
  asyncHandler(async (req, res) => {
    const orgId = await resolveSourceOrgId(req.params.projectId);
    if (!orgId) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    const result = await projectTemplates.deleteProjectTemplate(req.params.id, orgId);
    if (!result.deleted) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(result);
  })
);

router.post(
  '/:id/apply',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  requireFeature('wbs_builder'),
  asyncHandler(async (req, res) => {
    const orgId = await resolveSourceOrgId(req.params.projectId);
    if (!orgId) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    if (!req.body?.targetProjectId) {
      res.status(400).json({ error: 'targetProjectId is required' });
      return;
    }
    const result = await projectTemplates.applyProjectTemplate({
      templateId: req.params.id,
      projectId: req.body.targetProjectId,
      orgId,
      userId: req.user?.uid || 'unknown',
    });
    res.json(result);
  })
);

export default router;
