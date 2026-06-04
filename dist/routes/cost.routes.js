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
const costService = __importStar(require("../services/cost.service"));
const router = (0, express_1.Router)({ mergeParams: true });
router.get('/budget-lines', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.ACCOUNTANT_AP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await costService.getBudgetLinesByProject(req.params.projectId);
    res.json(result);
}));
router.post('/budget-lines', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await costService.createBudgetLine({
        projectId: req.params.projectId,
        ...req.body,
    });
    res.status(201).json(result);
}));
router.get('/budget-lines/:lineId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.ACCOUNTANT_AP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await costService.getBudgetLineById(req.params.lineId);
    res.json(result);
}));
router.patch('/budget-lines/:lineId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await costService.updateBudgetLine(req.params.lineId, req.body);
    res.json(result);
}));
router.get('/evm', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.ACCOUNTANT_AP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await costService.calculateProjectEvm(req.params.projectId);
    res.json(result);
}));
router.get('/transactions', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.ACCOUNTANT_AP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await costService.getCostTransactionsByProject(req.params.projectId);
    res.json(result);
}));
exports.default = router;
//# sourceMappingURL=cost.routes.js.map