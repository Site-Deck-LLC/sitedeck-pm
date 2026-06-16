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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const express_auth_1 = require("../middleware/express-auth");
const roles_1 = require("../constants/roles");
const async_handler_1 = require("../lib/async-handler");
const scheduleService = __importStar(require("../services/schedule.service"));
const activityService = __importStar(require("../services/activity.service"));
const baselineService = __importStar(require("../services/baseline.service"));
const changeRequestService = __importStar(require("../services/change-request.service"));
const schedule_import_service_1 = require("../services/schedule-import.service");
const schedule_import_msproject_service_1 = require("../services/schedule-import-msproject.service");
const schedule_import_excel_service_1 = require("../services/schedule-import-excel.service");
const schedule_whatif_service_1 = require("../services/schedule-whatif.service");
const activity_benchmark_service_1 = require("../services/activity-benchmark.service");
const router = (0, express_1.Router)({ mergeParams: true });
router.get('/activities', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.SUBCONTRACTOR_PM, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await activityService.getActivitiesWithWbs(req.params.projectId);
    res.json(result);
}));
router.post('/activities', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await activityService.createActivity({
        projectId: req.params.projectId,
        ...req.body,
    });
    res.status(201).json(result);
}));
router.get('/activities/:activityId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.SUBCONTRACTOR_PM, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await activityService.getActivityById(req.params.activityId);
    res.json(result);
}));
router.patch('/activities/:activityId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await activityService.updateActivity(req.params.activityId, req.body);
    res.json(result);
}));
router.delete('/activities/:activityId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await activityService.deleteActivity(req.params.activityId);
    res.json(result);
}));
router.post('/activities/:activityId/send-to-benchmark', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { dfowId } = req.body;
    if (!dfowId || typeof dfowId !== 'string') {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'dfowId is required' } });
        return;
    }
    const result = await (0, activity_benchmark_service_1.linkActivityToBenchmark)(req.params.activityId, dfowId);
    res.json(result);
}));
router.get('/baselines', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await baselineService.getBaselinesByProject(req.params.projectId);
    res.json(result);
}));
router.post('/baselines', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await baselineService.createBaseline(req.params.projectId, req.body.name, req.body.createdBy);
    res.status(201).json(result);
}));
router.get('/change-requests', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await changeRequestService.getChangeRequestsByProject(req.params.projectId);
    res.json(result);
}));
router.post('/change-requests', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await changeRequestService.createChangeRequest({
        projectId: req.params.projectId,
        ...req.body,
    });
    res.status(201).json(result);
}));
router.get('/performance', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await scheduleService.getSchedulePerformance(req.params.projectId);
    res.json(result);
}));
// ─── Activity Relationships ───
router.post('/activities/:activityId/relationships', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await activityService.createRelationship({
        projectId: req.params.projectId,
        predecessorId: req.body.predecessorId,
        successorId: req.params.activityId,
        relationshipType: req.body.relationshipType,
        lagDays: req.body.lagDays,
        constraintType: req.body.constraintType,
    });
    res.status(201).json(result);
}));
router.get('/activities/:activityId/relationships', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.SUBCONTRACTOR_PM, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await activityService.getRelationshipsForActivity(req.params.activityId);
    res.json(result);
}));
router.delete('/relationships/:relId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await activityService.deleteRelationship(req.params.relId);
    res.json(result);
}));
router.get('/relationships', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.SUBCONTRACTOR_PM, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const prisma = (await Promise.resolve().then(() => __importStar(require('../lib/prisma')))).getPrismaClient();
    const result = await prisma.activityRelationship.findMany({
        where: { projectId: req.params.projectId },
        include: {
            predecessor: { select: { id: true, name: true } },
            successor: { select: { id: true, name: true } },
        },
    });
    res.json(result);
}));
// ─── What-If Analysis ───
router.get('/whatif', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { activityId, delayDays, delayType } = req.query;
    if (!activityId || typeof activityId !== 'string') {
        res.status(400).json({ error: 'activityId is required' });
        return;
    }
    const days = Number(delayDays);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
        res.status(400).json({ error: 'delayDays must be 1-365' });
        return;
    }
    if (delayType !== 'start_delay' && delayType !== 'duration_extension') {
        res.status(400).json({ error: 'delayType must be start_delay or duration_extension' });
        return;
    }
    const result = await (0, schedule_whatif_service_1.runWhatIf)(req.params.projectId, {
        activityId,
        delayDays: days,
        delayType,
    });
    res.json(result);
}));
// ─── Import ───
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.post('/import/xer', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), upload.single('file'), (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }
    const content = req.file.buffer.toString('utf-8');
    const result = await (0, schedule_import_service_1.importXerSchedule)(req.params.projectId, content);
    res.status(200).json(result);
}));
router.post('/import/msproject', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), upload.single('file'), (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }
    const content = req.file.buffer.toString('utf-8');
    const result = await (0, schedule_import_msproject_service_1.importMsProjectSchedule)(req.params.projectId, content);
    res.status(200).json(result);
}));
router.post('/import/excel', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), upload.single('file'), (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }
    const result = await (0, schedule_import_excel_service_1.importExcelSchedule)(req.params.projectId, req.file.buffer, req.file.originalname);
    res.status(200).json(result);
}));
exports.default = router;
//# sourceMappingURL=schedule.routes.js.map