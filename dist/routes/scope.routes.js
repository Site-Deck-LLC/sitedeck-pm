"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_auth_1 = require("../middleware/express-auth");
const roles_1 = require("../constants/roles");
const async_handler_1 = require("../lib/async-handler");
const scopeService = __importStar(require("../services/scope.service"));
const router = (0, express_1.Router)({ mergeParams: true });
router.get('/scope-statements', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await scopeService.getScopeStatementsByProject(req.params.projectId);
    res.json(result);
}));
router.post('/scope-statements', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await scopeService.createScopeStatement(req.params.projectId, req.body.content, req.body.createdBy);
    res.status(201).json(result);
}));
router.get('/change-orders', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await scopeService.getChangeOrdersByProject(req.params.projectId);
    res.json(result);
}));
router.post('/change-orders', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await scopeService.createChangeOrder({
        projectId: req.params.projectId,
        ...req.body,
    });
    res.status(201).json(result);
}));
router.get('/change-orders/:coId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await scopeService.getChangeOrderById(req.params.coId);
    if (!result) {
        res.status(404).json({ error: { message: 'Change order not found' } });
        return;
    }
    res.json(result);
}));
router.patch('/change-orders/:coId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const body = req.body || {};
    const action = body.action;
    let result;
    if (action === 'submit') {
        result = await scopeService.submitChangeOrder(req.params.coId);
    }
    else if (action === 'approve') {
        result = await scopeService.approveChangeOrder(req.params.coId, String(body.approver || 'owner'));
    }
    else if (action === 'reject') {
        result = await scopeService.rejectChangeOrder(req.params.coId, String(body.approver || 'owner'));
    }
    else if (action === 'update') {
        result = await scopeService.updateChangeOrder(req.params.coId, {
            description: body.description,
            dollarValue: body.dollarValue != null ? Number(body.dollarValue) : undefined,
            scheduleImpact: body.scheduleImpact != null ? Number(body.scheduleImpact) : undefined,
            affectedActivityIds: Array.isArray(body.affectedActivityIds) ? body.affectedActivityIds : undefined,
        });
    }
    else {
        res.status(400).json({ error: { message: 'Unknown action. Use submit | approve | reject | update' } });
        return;
    }
    res.json(result);
}));
// ── PDF Export ──
const pdf_service_1 = require("../services/pdf/pdf.service");
const prisma_1 = require("../lib/prisma");
router.get('/change-orders/:coId/pdf', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const data = await scopeService.getChangeOrderPdfData(req.params.coId);
    const fullCo = await (0, prisma_1.getPrismaClient)().changeOrder.findUnique({
        where: { id: req.params.coId },
    });
    if (!fullCo) {
        res.status(404).json({ error: { message: 'Change order not found' } });
        return;
    }
    const pdf = await (0, pdf_service_1.buildChangeOrderPdf)({
        coNumber: data.coNumber,
        date: data.date,
        description: data.description,
        status: data.status,
        dollarValue: data.dollarValue,
        scheduleImpact: data.scheduleImpact,
        approver: data.approver,
        approvedAt: fullCo.approvedAt,
        projectName: data.projectName,
        affectedActivityIds: fullCo.affectedActivityIds,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${data.coNumber}.pdf"`);
    res.setHeader('Content-Length', pdf.length.toString());
    res.send(pdf);
}));
exports.default = router;
//# sourceMappingURL=scope.routes.js.map