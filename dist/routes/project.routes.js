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
const projectService = __importStar(require("../services/project.service"));
const billingService = __importStar(require("../services/billing.service"));
const error_handler_1 = require("../lib/error-handler");
const benchmark_webhook_service_1 = require("../services/benchmark-webhook.service");
const benchmark_activity_service_1 = require("../services/benchmark-activity.service");
const router = (0, express_1.Router)();
router.post('/', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const orgId = req.body.orgId;
    if (!orgId) {
        throw (0, error_handler_1.mapServiceErrorToApiError)(new Error('orgId is required'));
    }
    let account = await billingService.getBillingAccountByOrgId(orgId);
    if (!account) {
        const email = req.user?.decodedToken?.email || 'dev@example.com';
        account = await billingService.createBillingAccount(orgId, email);
    }
    const allowed = await billingService.canCreateProject(orgId);
    if (!allowed) {
        throw (0, error_handler_1.mapServiceErrorToApiError)(new Error('Project limit reached for current plan. Upgrade to create more projects.'));
    }
    const result = await projectService.createProject(req.body);
    // Fire the Benchmark webhook (fire-and-forget; never blocks the
    // response). If PM_BENCHMARK_WEBHOOK_URL is unset, this is a no-op.
    (0, benchmark_webhook_service_1.emitProjectCreated)((0, benchmark_webhook_service_1.buildProjectCreatedEvent)(orgId, {
        id: result.id,
        name: result.name,
        structureType: result.structureType,
        startDate: result.startDate,
        endDate: result.endDate,
        city: result.city,
        state: result.state,
        createdAt: result.createdAt,
    }));
    res.status(201).json(result);
}));
router.get('/', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (_req, res) => {
    const projects = await projectService.listProjects();
    res.json(projects);
}));
router.get('/map', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (_req, res) => {
    const projects = await projectService.getProjectMapData();
    res.json(projects);
}));
router.get('/:id', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await projectService.getProjectById(req.params.id);
    res.json(result);
}));
router.patch('/:id', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await projectService.updateProject(req.params.id, req.body);
    res.json(result);
}));
router.delete('/:id', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await projectService.deleteProject(req.params.id);
    res.json(result);
}));
router.post('/:id/wbs-items', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await projectService.addWorkBreakdownItem(req.params.id, req.body);
    res.status(201).json(result);
}));
router.get('/:id/benchmark-activity', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const events = await (0, benchmark_activity_service_1.getBenchmarkActivityForProject)(req.params.id);
    res.json({ events });
}));
router.post('/:id/lock-structure', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await projectService.lockProjectStructure(req.params.id);
    res.json(result);
}));
exports.default = router;
//# sourceMappingURL=project.routes.js.map