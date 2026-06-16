/**
 * Lessons Learned Routes
 * ============================================================================
 * CRUD + agent-flagged pattern detection for project lessons.
 *
 *   GET    /api/v1/projects/:projectId/lessons
 *     Query: ?category=&source=&addedToTemplate=
 *   POST   /api/v1/projects/:projectId/lessons
 *     Body: { title, description?, category, impact?, recommendation?, dfowRef?, addedToTemplate? }
 *   PATCH  /api/v1/projects/:projectId/lessons/:id
 *   DELETE /api/v1/projects/:projectId/lessons/:id
 *   POST   /api/v1/projects/:projectId/lessons/:id/flag-template
 *     Body: { on: boolean }  — toggles addedToTemplate
 *   POST   /api/v1/projects/:projectId/lessons/scan-patterns
 *     Forces a pattern-detection scan (the morning brief does this
 *     automatically; this endpoint is for the "Scan now" button).
 *
 * All endpoints enforce tenant isolation: a lesson's projectId must
 * match the :projectId in the URL.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/permission.middleware';
import { asyncHandler } from '../lib/async-handler';
import { ROLES } from '../constants/roles';
import { requireRole } from '../middleware/permission.middleware';
import * as lessons from '../services/lessons.service';

const router = Router({ mergeParams: true });

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const filters: lessons.LessonFilters = {
      ...(req.query.category ? { category: req.query.category as any } : {}),
      ...(req.query.source ? { source: req.query.source as any } : {}),
      ...(req.query.addedToTemplate === 'true' ? { addedToTemplate: true } : {}),
      ...(req.query.addedToTemplate === 'false' ? { addedToTemplate: false } : {}),
      ...(req.query.search ? { search: String(req.query.search) } : {}),
    };
    res.json(await lessons.getLessons(projectId, filters));
  })
);

router.get(
  '/by-category',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await lessons.getLessonsByCategory(req.params.projectId));
  })
);

router.post(
  '/',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const { title, description, category, impact, recommendation, dfowRef, addedToTemplate } =
      req.body || {};
    if (!title || typeof title !== 'string') {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    if (!lessons.LESSON_CATEGORIES.includes(category)) {
      res
        .status(400)
        .json({ error: `category must be one of: ${lessons.LESSON_CATEGORIES.join(', ')}` });
      return;
    }
    const created = await lessons.createLesson({
      projectId,
      title: title.slice(0, 200),
      description: description ? String(description).slice(0, 4000) : undefined,
      category,
      source: 'pm_entered',
      impact: impact ? String(impact).slice(0, 4000) : undefined,
      recommendation: recommendation ? String(recommendation).slice(0, 4000) : undefined,
      dfowRef: dfowRef ? String(dfowRef).slice(0, 200) : undefined,
      createdBy: req.user?.uid ?? 'unknown',
      addedToTemplate: !!addedToTemplate,
    });
    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const existing = await lessons.getLessonById(req.params.id);
    if (!existing || existing.projectId !== req.params.projectId) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const body = req.body || {};
    if (body.category && !lessons.LESSON_CATEGORIES.includes(body.category)) {
      res.status(400).json({ error: `category must be one of: ${lessons.LESSON_CATEGORIES.join(', ')}` });
      return;
    }
    const updated = await lessons.updateLesson(req.params.id, {
      title: body.title,
      description: body.description,
      category: body.category,
      impact: body.impact,
      recommendation: body.recommendation,
      dfowRef: body.dfowRef,
      addedToTemplate: body.addedToTemplate,
    });
    res.json(updated);
  })
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const existing = await lessons.getLessonById(req.params.id);
    if (!existing || existing.projectId !== req.params.projectId) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    await lessons.deleteLesson(req.params.id);
    res.json({ deleted: true });
  })
);

router.post(
  '/:id/flag-template',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const existing = await lessons.getLessonById(req.params.id);
    if (!existing || existing.projectId !== req.params.projectId) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const on = req.body?.on !== false;
    const updated = await lessons.flagForTemplate(req.params.id, on);
    res.json(updated);
  })
);

router.post(
  '/scan-patterns',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await lessons.scanForPatterns(req.params.projectId);
    res.json(result);
  })
);

export default router;
