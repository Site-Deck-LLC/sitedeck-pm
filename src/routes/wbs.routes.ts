import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { requireFeature } from '../middleware/subscription.middleware';
import { asyncHandler } from '../lib/async-handler';
import * as wbsService from '../services/wbs.service';

const router = Router({ mergeParams: true });

const gate = [requireAuth, requireFeature('wbs_builder')];

router.get(
  '/',
  ...gate,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await wbsService.getWbsTree(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/',
  ...gate,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    if (!req.body.code || !req.body.name) {
      res.status(400).json({ error: 'code and name are required' });
      return;
    }
    const result = await wbsService.addWbsItem({
      projectId: req.params.projectId,
      code: req.body.code,
      name: req.body.name,
      parentId: req.body.parentId,
      level: req.body.level,
      responsibleParty: req.body.responsibleParty,
      budget: req.body.budget,
    });
    res.status(201).json(result);
  })
);

router.patch(
  '/:wbsId',
  ...gate,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    try {
      const result = await wbsService.updateWbsItem(req.params.wbsId, req.body);
      res.json(result);
    } catch (e: any) {
      if (e.message.startsWith('Cannot change code')) {
        res.status(400).json({ error: e.message });
        return;
      }
      throw e;
    }
  })
);

router.get(
  '/:wbsId/blockers',
  ...gate,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await wbsService.getWbsBlockerInfo(req.params.wbsId);
    res.json(result);
  })
);

router.delete(
  '/:wbsId',
  ...gate,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await wbsService.deleteWbsItem(req.params.wbsId);
    if (!result.deleted) {
      res.status(400).json({
        error: 'Cannot delete — linked records exist',
        blockers: result.blockers,
      });
      return;
    }
    res.json({ deleted: true });
  })
);

// ─── Crosswalk ───

router.get(
  '/crosswalk',
  ...gate,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await wbsService.getCrosswalk(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/crosswalk',
  ...gate,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    if (!req.body.gcItemId || !req.body.subItemId) {
      res.status(400).json({ error: 'gcItemId and subItemId are required' });
      return;
    }
    const result = await wbsService.addCrosswalkEntry(
      req.params.projectId,
      req.body.gcItemId,
      req.body.subItemId
    );
    res.status(201).json(result);
  })
);

router.patch(
  '/crosswalk/:id',
  ...gate,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    if (!req.body.gcItemId || !req.body.subItemId) {
      res.status(400).json({ error: 'gcItemId and subItemId are required' });
      return;
    }
    const result = await wbsService.updateCrosswalkEntry(
      req.params.id,
      req.body.gcItemId,
      req.body.subItemId
    );
    res.json(result);
  })
);

router.delete(
  '/crosswalk/:id',
  ...gate,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    await wbsService.deleteCrosswalkEntry(req.params.id);
    res.json({ deleted: true });
  })
);

export default router;
