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
const dashboardService = __importStar(require("../services/dashboard.service"));
const integrationService = __importStar(require("../services/integration.service"));
const communicationsService = __importStar(require("../services/communications.service"));
const router = (0, express_1.Router)({ mergeParams: true });
router.get('/dashboard', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNERS_REP, roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const safetyData = { incidents: 0, openObservations: 0 };
    const result = await dashboardService.getMorningDashboard(req.params.projectId, safetyData);
    res.json(result);
}));
router.get('/issues', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNERS_REP, roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await integrationService.getIssuesByType(req.params.projectId, 'client_issue');
    res.json(result);
}));
router.get('/rfis', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNERS_REP, roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await communicationsService.getRfiByProject(req.params.projectId);
    res.json(result);
}));
exports.default = router;
//# sourceMappingURL=owners-rep.routes.js.map