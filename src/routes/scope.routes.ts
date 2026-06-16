import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as scopeService from '../services/scope.service';

const router = Router({ mergeParams: true });

router.get(
  '/scope-statements',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await scopeService.getScopeStatementsByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/scope-statements',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await scopeService.createScopeStatement(
      req.params.projectId,
      req.body.content,
      req.body.createdBy
    );
    res.status(201).json(result);
  })
);

router.get(
  '/change-orders',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await scopeService.getChangeOrdersByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/change-orders',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await scopeService.createChangeOrder({
      projectId: req.params.projectId,
      ...req.body,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/change-orders/:coId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await scopeService.getChangeOrderById(req.params.coId);
    if (!result) {
      res.status(404).json({ error: { message: 'Change order not found' } });
      return;
    }
    res.json(result);
  })
);

router.patch(
  '/change-orders/:coId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const action = body.action;
    let result;
    if (action === 'submit') {
      result = await scopeService.submitChangeOrder(req.params.coId);
    } else if (action === 'approve') {
      result = await scopeService.approveChangeOrder(req.params.coId, String(body.approver || 'owner'));
    } else if (action === 'reject') {
      result = await scopeService.rejectChangeOrder(req.params.coId, String(body.approver || 'owner'));
    } else if (action === 'update') {
      result = await scopeService.updateChangeOrder(req.params.coId, {
        description: body.description,
        dollarValue: body.dollarValue != null ? Number(body.dollarValue) : undefined,
        scheduleImpact: body.scheduleImpact != null ? Number(body.scheduleImpact) : undefined,
        affectedActivityIds: Array.isArray(body.affectedActivityIds) ? body.affectedActivityIds : undefined,
      });
    } else {
      res.status(400).json({ error: { message: 'Unknown action. Use submit | approve | reject | update' } });
      return;
    }
    res.json(result);
  })
);

// ── PDF Export ──

import { buildChangeOrderPdf } from '../services/pdf/pdf.service';
import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma';

router.get(
  '/change-orders/:coId/pdf',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const data = await scopeService.getChangeOrderPdfData(req.params.coId);
    const fullCo = await getPrismaClient().changeOrder.findUnique({
      where: { id: req.params.coId },
    });
    if (!fullCo) {
      res.status(404).json({ error: { message: 'Change order not found' } });
      return;
    }
    const pdf = await buildChangeOrderPdf({
      coNumber: data.coNumber,
      date: data.date,
      description: data.description,
      status: data.status,
      dollarValue: data.dollarValue,
      scheduleImpact: data.scheduleImpact,
      approver: data.approver,
      approvedAt: fullCo.approvedAt,
      projectName: data.projectName,
      affectedActivityIds: fullCo.affectedActivityIds as any,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${data.coNumber}.pdf"`);
    res.setHeader('Content-Length', pdf.length.toString());
    res.send(pdf);
  })
);

export default router;
