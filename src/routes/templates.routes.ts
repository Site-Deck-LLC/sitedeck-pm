/**
 * Project Templates Routes
 * ============================================================================
 * Org-scoped CRUD for project templates + apply-to-project endpoint.
 *
 *   GET    /api/v1/templates                    — list this org's templates
 *   POST   /api/v1/templates                    — save a snapshot from a project
 *   GET    /api/v1/templates/:id                — get one template (with items)
 *   DELETE /api/v1/templates/:id                — delete (org must own)
 *   POST   /api/v1/templates/:id/apply          — apply to a project
 *
 * The org id is resolved from the authenticated user (req.user.orgId) with a
 * fallback to the project's orgId (for the apply route). The same fallback
 * logic the subscription middleware uses.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { requireFeature } from '../middleware/subscription.middleware';
import { asyncHandler } from '../lib/async-handler';
import { getPrismaClient } from '../lib/prisma';
import * as templates from '../services/templates.service';

const router = Router();

async function resolveOrgId(req: any): Promise<string | null> {
  if (req.user?.orgId) return req.user.orgId;
  // For the apply route, the target projectId tells us the org.
  const projectId = req.body?.projectId;
  if (projectId) {
    const p = await getPrismaClient().project.findUnique({
      where: { id: projectId }, select: { orgId: true },
    });
    return p?.orgId || null;
  }
  return null;
}

router.get(
  '/',
  requireAuth,
  requireFeature('wbs_builder'),
  asyncHandler(async (req, res) => {
    const orgId = await resolveOrgId(req);
    if (!orgId) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    res.json(await templates.listTemplates(orgId));
  })
);

router.post(
  '/',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  requireFeature('wbs_builder'),
  asyncHandler(async (req, res) => {
    const orgId = await resolveOrgId(req);
    if (!orgId) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    if (!req.body?.name || !req.body?.projectId) {
      res.status(400).json({ error: 'name and projectId are required' });
      return;
    }
    const result = await templates.saveTemplate({
      orgId,
      name: req.body.name,
      description: req.body.description,
      projectId: req.body.projectId,
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
    const orgId = await resolveOrgId(req);
    if (!orgId) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    const tpl = await templates.getTemplate(req.params.id);
    if (!tpl) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    if (tpl.orgId !== orgId) {
      res.status(404).json({ error: 'not found' }); // hide existence from other orgs
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
    const orgId = await resolveOrgId(req);
    if (!orgId) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    const result = await templates.deleteTemplate(req.params.id, orgId);
    res.json(result);
  })
);

router.post(
  '/:id/apply',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  requireFeature('wbs_builder'),
  asyncHandler(async (req, res) => {
    const orgId = await resolveOrgId(req);
    if (!orgId) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    if (!req.body?.projectId) {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }
    const result = await templates.applyTemplate({
      templateId: req.params.id,
      projectId: req.body.projectId,
      orgId,
    });
    res.json(result);
  })
);

export default router;
