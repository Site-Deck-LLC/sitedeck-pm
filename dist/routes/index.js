"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_auth_1 = require("../middleware/express-auth");
const roles_1 = require("../constants/roles");
const async_handler_1 = require("../lib/async-handler");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const health_routes_1 = __importDefault(require("./health.routes"));
const project_routes_1 = __importDefault(require("./project.routes"));
const schedule_routes_1 = __importDefault(require("./schedule.routes"));
const cost_routes_1 = __importDefault(require("./cost.routes"));
const dashboard_routes_1 = __importDefault(require("./dashboard.routes"));
const procurement_routes_1 = __importDefault(require("./procurement.routes"));
const scope_routes_1 = __importDefault(require("./scope.routes"));
const communications_routes_1 = __importDefault(require("./communications.routes"));
const risk_routes_1 = __importDefault(require("./risk.routes"));
const integration_routes_1 = __importDefault(require("./integration.routes"));
const owners_rep_routes_1 = __importDefault(require("./owners-rep.routes"));
const resource_routes_1 = __importDefault(require("./resource.routes"));
const webhook_routes_1 = __importDefault(require("./webhook.routes"));
const billing_routes_1 = __importDefault(require("./billing.routes"));
const webhook_stripe_routes_1 = __importDefault(require("./webhook-stripe.routes"));
const safety_routes_1 = __importDefault(require("./safety.routes"));
const crew_routes_1 = __importDefault(require("./crew.routes"));
const agents_routes_1 = __importDefault(require("./agents.routes"));
const wbs_routes_1 = __importDefault(require("./wbs.routes"));
const templates_routes_1 = __importDefault(require("./templates.routes"));
const lessons_routes_1 = __importDefault(require("./lessons.routes"));
const project_templates_routes_1 = __importDefault(require("./project-templates.routes"));
const documents_routes_1 = __importDefault(require("./documents.routes"));
const portfolio_routes_1 = __importDefault(require("./portfolio.routes"));
const notifications_routes_1 = __importDefault(require("./notifications.routes"));
const notification_preferences_routes_1 = __importDefault(require("./notification-preferences.routes"));
const redlines_routes_1 = __importDefault(require("./redlines.routes"));
const team_routes_1 = __importDefault(require("./team.routes"));
const push_routes_1 = __importDefault(require("./push.routes"));
const risk_intelligence_routes_1 = __importDefault(require("./risk-intelligence.routes"));
const subcontract_milestones_routes_1 = __importDefault(require("./subcontract-milestones.routes"));
const admin_routes_1 = __importDefault(require("./admin.routes"));
const support_routes_1 = __importDefault(require("./support.routes"));
const bug_approval_routes_1 = __importDefault(require("./bug-approval.routes"));
const quickbooks_routes_1 = require("./quickbooks.routes");
const sub_schedules_routes_1 = __importDefault(require("./sub-schedules.routes"));
const benchmark_webhook_routes_1 = __importDefault(require("./benchmark-webhook.routes"));
const rework_task_routes_1 = __importDefault(require("./rework-task.routes"));
const router = (0, express_1.Router)();
router.use('/auth', auth_routes_1.default);
router.use('/health', health_routes_1.default);
router.use('/projects', project_routes_1.default);
router.use('/projects/:projectId/schedule', schedule_routes_1.default);
router.use('/projects/:projectId/cost', cost_routes_1.default);
router.use('/projects/:projectId/dashboard', dashboard_routes_1.default);
router.use('/projects/:projectId/procurement', procurement_routes_1.default);
router.use('/projects/:projectId/scope', scope_routes_1.default);
router.use('/projects/:projectId/communications', communications_routes_1.default);
router.use('/projects/:projectId/risk', risk_routes_1.default);
router.use('/projects/:projectId/integration', integration_routes_1.default);
router.use('/projects/:projectId/owners-rep', owners_rep_routes_1.default);
router.use('/projects/:projectId/resource', resource_routes_1.default);
router.use('/projects/:projectId/safety', safety_routes_1.default);
router.use('/projects/:projectId/crew', crew_routes_1.default);
router.use('/projects/:projectId/agents', agents_routes_1.default);
router.use('/projects/:projectId/wbs', wbs_routes_1.default);
router.use('/projects/:projectId/lessons', lessons_routes_1.default);
router.use('/projects/:projectId/templates', project_templates_routes_1.default);
router.use('/projects/:projectId/documents', documents_routes_1.default);
router.use('/billing', billing_routes_1.default);
router.use('/webhooks/stripe', webhook_stripe_routes_1.default);
router.use('/webhooks/benchmark', benchmark_webhook_routes_1.default);
router.use('/webhooks', webhook_routes_1.default);
router.use('/templates', templates_routes_1.default);
router.use('/portfolio', portfolio_routes_1.default);
router.use('/notifications', notifications_routes_1.default);
router.use('/notifications/preferences', notification_preferences_routes_1.default);
router.use('/users', push_routes_1.default);
router.use('/projects/:projectId/redlines', redlines_routes_1.default);
router.use('/projects/:projectId/team', team_routes_1.default);
router.use('/projects/:projectId/risk-intelligence', risk_intelligence_routes_1.default);
router.use('/projects/:projectId/subcontract-milestones', subcontract_milestones_routes_1.default);
router.use('/projects/:projectId/rework-tasks', rework_task_routes_1.default);
router.use('/admin', admin_routes_1.default);
router.use('/support', support_routes_1.default);
router.use('/bug-approval', bug_approval_routes_1.default);
router.use('/integrations/quickbooks', quickbooks_routes_1.quickbooksRouter);
router.use('/projects/:projectId/integrations/quickbooks', quickbooks_routes_1.quickbooksProjectRouter);
router.use('/projects/:projectId/sub-schedules', sub_schedules_routes_1.default);
// Organization routes (top-level — Sprint 9 Task 6)
router.get('/organizations/:orgId', express_auth_1.requireAuth, (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { getOrganization } = require('../services/team.service');
    const org = await getOrganization(req.params.orgId);
    if (!org) {
        res.status(404).json({ error: 'organization not found' });
        return;
    }
    res.json(org);
}));
router.post('/organizations', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { createOrganization } = require('../services/team.service');
    try {
        const org = await createOrganization(req.body || {}, req.user?.uid || 'unknown');
        res.status(201).json(org);
    }
    catch (err) {
        if (/required|must be/i.test(err?.message || '')) {
            res.status(400).json({ error: err.message });
            return;
        }
        throw err;
    }
}));
exports.default = router;
//# sourceMappingURL=index.js.map