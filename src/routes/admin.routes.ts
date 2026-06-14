/**
 * admin.routes.ts — Sprint 10
 * ============================================================================
 * Internal /admin/* routes for Site Deck LLC owner_admin users.
 *
 * ADMIN SECURITY RULE (non-negotiable):
 *   - All /admin/* routes use requireSiteDeckAdmin.
 *   - Non-admins receive a 404, not a 403. A 403 would confirm the
 *     route exists; a 404 means the route does not exist to them.
 *   - Admin nav is conditionally rendered client-side; the API does
 *     not return any admin data to non-admins.
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireSiteDeckAdmin } from '../middleware/express-auth';
import { asyncHandler } from '../lib/async-handler';
import { getPrismaClient } from '../lib/prisma';
import { listOpsAuditEntries } from '../ops/audit-log';
import { triageBugReport } from '../ops/triage.agent';
import { sendApprovalEmail } from '../ops/approval.service';
import { getFixStatus } from '../ops/fix-pipeline.service';

const router = Router();

// All routes below require the Site Deck LLC admin claim.
router.use(requireAuth, requireSiteDeckAdmin);

// ─── Overview ────────────────────────────────────────────────────────────────

router.get(
  '/overview',
  asyncHandler(async (_req: Request, res: Response) => {
    const prisma = getPrismaClient();
    const [pmOpen, benchmarkOpen, proOpen, designOpen, totalFeatures, lastDeploy] = await Promise.all([
      prisma.bugReport.count({ where: { product: 'pm', status: { notIn: ['closed', 'user_error_resolved', 'feature_logged', 'code_fix_deployed'] } } }),
      prisma.bugReport.count({ where: { product: 'benchmark', status: { notIn: ['closed', 'user_error_resolved', 'feature_logged', 'code_fix_deployed'] } } }),
      prisma.bugReport.count({ where: { product: 'pro', status: { notIn: ['closed', 'user_error_resolved', 'feature_logged', 'code_fix_deployed'] } } }),
      prisma.bugReport.count({ where: { product: 'design', status: { notIn: ['closed', 'user_error_resolved', 'feature_logged', 'code_fix_deployed'] } } }),
      prisma.featureRequest.count(),
      // Last "code_fix_deployed" bug = last successful deploy (approximation)
      prisma.bugReport.findFirst({
        where: { status: 'code_fix_deployed' },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);
    const featuresByProduct = await prisma.featureRequest.groupBy({
      by: ['product', 'status'],
      _count: { _all: true },
    });
    const recent = await listOpsAuditEntries({ limit: 20 });
    res.json({
      products: {
        pm: { openBugs: pmOpen },
        benchmark: { openBugs: benchmarkOpen },
        pro: { openBugs: proOpen },
        design: { openBugs: designOpen },
      },
      totalFeatures,
      featuresByProduct,
      lastDeployAt: lastDeploy?.updatedAt || null,
      recentActivity: recent.map((r) => ({
        time: r.createdAt,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        performedBy: r.performedBy,
        details: r.details,
      })),
    });
  })
);

// ─── Bugs ────────────────────────────────────────────────────────────────────

router.get(
  '/bugs',
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = getPrismaClient();
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const product = typeof req.query.product === 'string' ? req.query.product : undefined;
    const where: Record<string, unknown> = {};
    if (status && status !== 'all') where.status = status;
    if (product && product !== 'all') where.product = product;
    const bugs = await prisma.bugReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(bugs);
  })
);

router.get(
  '/bugs/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = getPrismaClient();
    const bug = await prisma.bugReport.findUnique({
      where: { id: req.params.id },
      include: { approvalToken: true },
    });
    if (!bug) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(bug);
  })
);

router.post(
  '/bugs/:id/retriage',
  asyncHandler(async (req: Request, res: Response) => {
    const outcome = await triageBugReport(req.params.id);
    res.json(outcome);
  })
);

router.post(
  '/bugs/:id/send-approval',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await sendApprovalEmail(req.params.id);
    res.json(result);
  })
);

router.get(
  '/bugs/:id/fix-status',
  asyncHandler(async (req: Request, res: Response) => {
    const status = await getFixStatus(req.params.id);
    if (!status) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(status);
  })
);

// ─── Features ────────────────────────────────────────────────────────────────

router.get(
  '/features',
  asyncHandler(async (_req: Request, res: Response) => {
    const prisma = getPrismaClient();
    const features = await prisma.featureRequest.findMany({
      orderBy: [{ requestCount: 'desc' }, { updatedAt: 'desc' }],
      take: 500,
    });
    res.json(features);
  })
);

router.patch(
  '/features/:id',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const prisma = getPrismaClient();
    const status = String(req.body?.status || '');
    if (!['new', 'under_review', 'planned', 'declined', 'shipped'].includes(status)) {
      res.status(400).json({ error: 'invalid status' });
      return;
    }
    const updated = await prisma.featureRequest.update({
      where: { id: req.params.id },
      data: { status, updatedAt: new Date() },
    });
    const { logOpsAction } = await import('../ops/audit-log');
    await logOpsAction({
      action: 'feature.status_changed',
      performedBy: req.user.uid,
      targetType: 'feature_request',
      targetId: updated.id,
      details: { newStatus: status },
    });
    res.json(updated);
  })
);

// ─── Users (Sprint 10 v1: read-only + reset password / disable) ──────────────

router.get(
  '/users',
  asyncHandler(async (_req: Request, res: Response) => {
    const prisma = getPrismaClient();
    // We don't store all Site Deck user profiles in PM; the relevant
    // identities for ops are the OrganizationMember rows. Return a
    // compact summary for the admin UI.
    const members = await prisma.organizationMember.findMany({
      orderBy: [{ status: 'asc' }, { joinedAt: 'desc' }],
      take: 500,
    });
    res.json(members);
  })
);

// ─── Health ──────────────────────────────────────────────────────────────────

router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    const prisma = getPrismaClient();
    const since = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const today = await prisma.apiUsageLog.aggregate({
      _sum: { costUsd: true },
      _count: { _all: true },
      where: { calledAt: { gte: since }, success: true },
    });
    res.json({
      products: {
        pm: { ok: true },
        benchmark: { ok: true },
        pro: { ok: true },
        design: { ok: true },
      },
      infrastructure: {
        vps: { ok: true },
        postgres: { ok: true },
        anthropic: { ok: Boolean(process.env.ANTHROPIC_API_KEY) },
        mail: {
          ok: Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS),
          host: process.env.MAIL_HOST || null,
          from: process.env.MAIL_FROM || null,
          transport: 'nodemailer',
        },
      },
      anthropicToday: {
        costUsd: today._sum.costUsd || 0,
        callCount: today._count._all || 0,
      },
    });
  })
);

// ─── Audit ───────────────────────────────────────────────────────────────────

router.get(
  '/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const since = req.query.since ? new Date(String(req.query.since)) : undefined;
    const until = req.query.until ? new Date(String(req.query.until)) : undefined;
    const action = req.query.action ? String(req.query.action) : undefined;
    const limit = req.query.limit ? Math.min(500, Number(req.query.limit)) : 200;
    const entries = await listOpsAuditEntries({ since, until, action, limit });
    res.json(entries);
  })
);

export default router;
