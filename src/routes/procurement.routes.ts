import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as procurementService from '../services/procurement.service';

const router = Router({ mergeParams: true });

router.get(
  '/purchase-orders',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT),
  asyncHandler(async (req, res) => {
    const result = await procurementService.getPurchaseOrdersByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/purchase-orders',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await procurementService.createPurchaseOrder({
      projectId: req.params.projectId,
      ...req.body,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/purchase-orders/:poId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT),
  asyncHandler(async (req, res) => {
    const result = await procurementService.getPurchaseOrderById(req.params.poId);
    res.json(result);
  })
);

router.post(
  '/purchase-orders/:poId/issue',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await procurementService.issuePurchaseOrder(req.params.poId);
    res.json(result);
  })
);

router.post(
  '/purchase-orders/:poId/close',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await procurementService.closePurchaseOrder(req.params.poId);
    res.json(result);
  })
);

router.get(
  '/invoices',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT_AP),
  asyncHandler(async (req, res) => {
    const result = await procurementService.getInvoicesByProject(req.params.projectId);
    res.json(result);
  })
);

router.get(
  '/subcontracts',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUBCONTRACTOR_PM),
  asyncHandler(async (req, res) => {
    const result = await procurementService.getSubcontractsByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/subcontracts',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await procurementService.createSubcontract({
      projectId: req.params.projectId,
      ...req.body,
    });
    res.status(201).json(result);
  })
);

export default router;
