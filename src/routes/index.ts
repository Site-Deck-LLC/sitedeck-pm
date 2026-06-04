import { Router } from 'express';
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

const router = Router();

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
router.use('/webhooks', webhookRouter);

export default router;
