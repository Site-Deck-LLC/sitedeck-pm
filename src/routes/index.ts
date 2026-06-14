import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import authRouter from './auth.routes';
import healthRouter from './health.routes';
import projectRouter from './project.routes';
import scheduleRouter from './schedule.routes';
import costRouter from './cost.routes';
import dashboardRouter from './dashboard.routes';
import procurementRouter from './procurement.routes';
import scopeRouter from './scope.routes';
import communicationsRouter from './communications.routes';
import riskRouter from './risk.routes';
import integrationRouter from './integration.routes';
import ownersRepRouter from './owners-rep.routes';
import resourceRouter from './resource.routes';
import webhookRouter from './webhook.routes';
import billingRouter from './billing.routes';
import stripeWebhookRouter from './webhook-stripe.routes';
import safetyRouter from './safety.routes';
import crewRouter from './crew.routes';
import agentsRouter from './agents.routes';
import wbsRouter from './wbs.routes';
import templatesRouter from './templates.routes';
import lessonsRouter from './lessons.routes';
import projectTemplatesRouter from './project-templates.routes';
import documentsRouter from './documents.routes';
import portfolioRouter from './portfolio.routes';
import notificationsRouter from './notifications.routes';
import redlinesRouter from './redlines.routes';
import teamRouter from './team.routes';
import pushRouter from './push.routes';
import riskIntelligenceRouter from './risk-intelligence.routes';
import subcontractMilestonesRouter from './subcontract-milestones.routes';
import adminRouter from './admin.routes';
import supportRouter from './support.routes';
import bugApprovalRouter from './bug-approval.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/health', healthRouter);
router.use('/projects', projectRouter);
router.use('/projects/:projectId/schedule', scheduleRouter);
router.use('/projects/:projectId/cost', costRouter);
router.use('/projects/:projectId/dashboard', dashboardRouter);
router.use('/projects/:projectId/procurement', procurementRouter);
router.use('/projects/:projectId/scope', scopeRouter);
router.use('/projects/:projectId/communications', communicationsRouter);
router.use('/projects/:projectId/risk', riskRouter);
router.use('/projects/:projectId/integration', integrationRouter);
router.use('/projects/:projectId/owners-rep', ownersRepRouter);
router.use('/projects/:projectId/resource', resourceRouter);
router.use('/projects/:projectId/safety', safetyRouter);
router.use('/projects/:projectId/crew', crewRouter);
router.use('/projects/:projectId/agents', agentsRouter);
router.use('/projects/:projectId/wbs', wbsRouter);
router.use('/projects/:projectId/lessons', lessonsRouter);
router.use('/projects/:projectId/templates', projectTemplatesRouter);
router.use('/projects/:projectId/documents', documentsRouter);
router.use('/billing', billingRouter);
router.use('/webhooks/stripe', stripeWebhookRouter);
router.use('/webhooks', webhookRouter);
router.use('/templates', templatesRouter);
router.use('/portfolio', portfolioRouter);
router.use('/notifications', notificationsRouter);
router.use('/users', pushRouter);
router.use('/projects/:projectId/redlines', redlinesRouter);
router.use('/projects/:projectId/team', teamRouter);
router.use('/projects/:projectId/risk-intelligence', riskIntelligenceRouter);
router.use('/projects/:projectId/subcontract-milestones', subcontractMilestonesRouter);
router.use('/admin', adminRouter);
router.use('/support', supportRouter);
router.use('/bug-approval', bugApprovalRouter);

// Organization routes (top-level — Sprint 9 Task 6)
router.get('/organizations/:orgId', requireAuth, asyncHandler(async (req, res) => {
  const { getOrganization } = require('../services/team.service');
  const org = await getOrganization(req.params.orgId);
  if (!org) { res.status(404).json({ error: 'organization not found' }); return; }
  res.json(org);
}));

router.post('/organizations', requireAuth, requireRole(ROLES.OWNER_ADMIN), asyncHandler(async (req, res) => {
  const { createOrganization } = require('../services/team.service');
  try {
    const org = await createOrganization(req.body || {}, req.user?.uid || 'unknown');
    res.status(201).json(org);
  } catch (err: any) {
    if (/required|must be/i.test(err?.message || '')) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
}));

export default router;
