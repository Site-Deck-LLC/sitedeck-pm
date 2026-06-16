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
const resourceService = __importStar(require("../services/resource.service"));
const router = (0, express_1.Router)({ mergeParams: true });
router.get('/equipment', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await resourceService.getEquipmentByProject(req.params.projectId);
    res.json(result);
}));
router.get('/equipment-cost-summary', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.ACCOUNTANT_AP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await resourceService.getEquipmentCostSummary(req.params.projectId);
    res.json(result);
}));
router.get('/labor-cost-summary', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.ACCOUNTANT_AP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await resourceService.getLaborCostSummary(req.params.projectId);
    res.json(result);
}));
router.get('/idle-equipment', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await resourceService.getIdleEquipmentOnCriticalPath(req.params.projectId);
    res.json(result);
}));
router.get('/attendance/today', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.SUPERVISOR, roles_1.ROLES.FIELD_CREW, roles_1.ROLES.ACCOUNTANT_AP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const date = req.query.date ? new Date(String(req.query.date)) : new Date();
    const result = await resourceService.getAttendanceForDate(req.params.projectId, date);
    res.json(result || null);
}));
router.post('/attendance', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.SUPERVISOR), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const body = req.body || {};
    const date = body.date ? new Date(body.date) : new Date();
    if (body.workerCount == null || body.hours == null) {
        res.status(400).json({ error: { message: 'workerCount and hours are required' } });
        return;
    }
    const result = await resourceService.upsertAttendance(req.params.projectId, date, Number(body.workerCount), Number(body.hours), {
        presentCount: body.presentCount != null ? Number(body.presentCount) : undefined,
        absentCount: body.absentCount != null ? Number(body.absentCount) : undefined,
        lateCount: body.lateCount != null ? Number(body.lateCount) : undefined,
        notes: body.notes ? String(body.notes) : undefined,
        affectedActivities: Array.isArray(body.affectedActivities)
            ? body.affectedActivities.map((a) => String(a))
            : undefined,
    });
    res.status(201).json(result);
}));
router.post('/equipment', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const body = req.body || {};
    if (!body.externalId || !body.name) {
        res.status(400).json({ error: { message: 'externalId and name are required' } });
        return;
    }
    const result = await resourceService.upsertEquipment({
        projectId: req.params.projectId,
        externalId: String(body.externalId),
        name: String(body.name),
        type: body.type ? String(body.type) : undefined,
        currentActivityId: body.currentActivityId ? String(body.currentActivityId) : undefined,
    });
    res.status(201).json(result);
}));
router.post('/equipment/status-log', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.SUPERVISOR), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const body = req.body || {};
    if (!body.equipmentId || !body.status) {
        res.status(400).json({ error: { message: 'equipmentId and status are required' } });
        return;
    }
    const result = await resourceService.logEquipmentStatus({
        equipmentId: String(body.equipmentId),
        date: body.date ? new Date(body.date) : new Date(),
        status: String(body.status),
        hours: body.hours != null ? Number(body.hours) : 0,
        notes: body.notes ? String(body.notes) : undefined,
        loggedBy: body.loggedBy ? String(body.loggedBy) : undefined,
    });
    res.status(201).json(result);
}));
router.get('/equipment/status-log', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.SUPERVISOR, roles_1.ROLES.FIELD_CREW, roles_1.ROLES.ACCOUNTANT_AP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();
    const startDate = req.query.startDate
        ? new Date(String(req.query.startDate))
        : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const result = await resourceService.getEquipmentStatusLog(req.params.projectId, startDate, endDate);
    res.json(result);
}));
// ─── Equipment Registry (Sprint 6) ────────────────────────────────────────
router.get('/equipment-registry', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await resourceService.getEquipmentListForProject(req.params.projectId);
    res.json(result);
}));
router.get('/equipment-registry/:equipId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await resourceService.getEquipmentById(req.params.equipId);
    if (!result) {
        res.status(404).json({ error: 'Equipment not found' });
        return;
    }
    res.json(result);
}));
router.post('/equipment-registry', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.body.name || typeof req.body.dailyRate !== 'number') {
        res.status(400).json({ error: 'name and dailyRate are required' });
        return;
    }
    const calDueDate = req.body.calDueDate ? new Date(req.body.calDueDate) : null;
    const result = await resourceService.createEquipment({
        projectId: req.params.projectId,
        name: req.body.name,
        type: req.body.type,
        dailyRate: req.body.dailyRate,
        isOwned: !!req.body.isOwned,
        serialNumber: req.body.serialNumber,
        vendor: req.body.vendor,
        calDueDate,
    });
    res.status(201).json(result);
}));
router.patch('/equipment-registry/:equipId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const data = { ...req.body };
    if (data.calDueDate !== undefined) {
        data.calDueDate = data.calDueDate ? new Date(data.calDueDate) : null;
    }
    const result = await resourceService.updateEquipment(req.params.equipId, data);
    res.json(result);
}));
router.get('/equipment-registry/:equipId/history', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await resourceService.getEquipmentStatusHistory(req.params.equipId);
    res.json(result);
}));
exports.default = router;
//# sourceMappingURL=resource.routes.js.map