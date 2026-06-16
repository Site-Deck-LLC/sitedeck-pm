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
  '/bugs/:id/reject',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) { res.status(404).json({ error: 'not found' }); return; }
    const prisma = getPrismaClient();
    const reason = String(req.body?.reason || '').trim();
    if (!reason) { res.status(400).json({ error: 'reason required' }); return; }
    const bug = await prisma.bugReport.update({
      where: { id: req.params.id },
      data: { status: 'closed' },
    });
    const { logOpsAction } = await import('../ops/audit-log');
    await logOpsAction({
      action: 'fix_rejected',
      performedBy: req.user.uid,
      targetType: 'bug',
      targetId: bug.id,
      details: { reason },
    });
    res.json({ ok: true, status: 'closed', reason });
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

// ─── User management: change role, reset password, disable/enable ────────────
// All routes 404 on every failure path (admin security rule).

router.patch(
  '/users/:id/role',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) { res.status(404).json({ error: 'not found' }); return; }
    const prisma = getPrismaClient();
    const member = await prisma.organizationMember.findUnique({ where: { id: req.params.id } });
    if (!member || !member.userId) { res.status(404).json({ error: 'not found' }); return; }
    const newRole = String(req.body?.role || '');
    const VALID = ['owner_admin', 'project_manager', 'superintendent', 'supervisor', 'field_crew', 'subcontractor_pm', 'subcontractor_super', 'owners_rep', 'accountant_ap'];
    if (!VALID.includes(newRole)) { res.status(400).json({ error: 'invalid role' }); return; }

    try {
      const { getUserClaims, setUserProjectClaims } = await import('../services/auth.service');
      const current = await getUserClaims(member.userId);
      if (!current) {
        // First-time claim set — seed with this member's orgId and empty project list
        await setUserProjectClaims(member.userId, { role: newRole as any, orgId: member.orgId, projectIds: [] });
      } else {
        await setUserProjectClaims(member.userId, { ...current, role: newRole as any });
      }

      const { logOpsAction } = await import('../ops/audit-log');
      await logOpsAction({
        action: 'role_changed',
        performedBy: req.user.uid,
        targetType: 'user',
        targetId: member.id,
        details: { email: member.email, newRole, previousRole: current?.role || null },
      });

      res.json({ ok: true, newRole, takesEffect: 'next_login' });
    } catch (err: any) {
      // Firebase not configured or user not found → 404 (not 500) for the admin route
      res.status(404).json({ error: 'not found', detail: err?.message });
    }
  })
);

router.post(
  '/users/:id/reset-password',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) { res.status(404).json({ error: 'not found' }); return; }
    const prisma = getPrismaClient();
    const member = await prisma.organizationMember.findUnique({ where: { id: req.params.id } });
    if (!member) { res.status(404).json({ error: 'not found' }); return; }

    try {
      const { getAuthInstance } = await import('../services/auth.service');
      const auth = getAuthInstance();
      const link = await auth.generatePasswordResetLink(member.email);

      // Send via the local mail transport. Best-effort: never throw.
      try {
        const { sendEmail } = await import('../services/email.service');
        await sendEmail({
          to: member.email,
          subject: 'Reset your SiteDeck password',
          text: `Hi ${member.displayName || ''},\n\nClick the link below to set a new password:\n\n${link}\n\n— SiteDeck`,
        });
      } catch (mailErr: any) {
        // mail failure is non-fatal — still return the link
        console.warn('[admin] reset email send failed:', mailErr?.message);
      }

      const { logOpsAction } = await import('../ops/audit-log');
      await logOpsAction({
        action: 'password_reset_sent',
        performedBy: req.user.uid,
        targetType: 'user',
        targetId: member.id,
        details: { email: member.email },
      });

      res.json({ ok: true, sentTo: member.email });
    } catch (err: any) {
      res.status(404).json({ error: 'not found', detail: err?.message });
    }
  })
);

router.post(
  '/users/:id/disable',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) { res.status(404).json({ error: 'not found' }); return; }
    const prisma = getPrismaClient();
    const member = await prisma.organizationMember.findUnique({ where: { id: req.params.id } });
    if (!member) { res.status(404).json({ error: 'not found' }); return; }

    try {
      const { getAuthInstance } = await import('../services/auth.service');
      const auth = getAuthInstance();
      if (member.userId) {
        await auth.updateUser(member.userId, { disabled: true });
      }
      await prisma.organizationMember.update({ where: { id: member.id }, data: { status: 'disabled' } });
      const { logOpsAction } = await import('../ops/audit-log');
      await logOpsAction({
        action: 'account_disabled',
        performedBy: req.user.uid,
        targetType: 'user',
        targetId: member.id,
        details: { email: member.email },
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(404).json({ error: 'not found', detail: err?.message });
    }
  })
);

router.post(
  '/users/:id/enable',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) { res.status(404).json({ error: 'not found' }); return; }
    const prisma = getPrismaClient();
    const member = await prisma.organizationMember.findUnique({ where: { id: req.params.id } });
    if (!member) { res.status(404).json({ error: 'not found' }); return; }

    try {
      const { getAuthInstance } = await import('../services/auth.service');
      const auth = getAuthInstance();
      if (member.userId) {
        await auth.updateUser(member.userId, { disabled: false });
      }
      await prisma.organizationMember.update({ where: { id: member.id }, data: { status: 'active' } });
      const { logOpsAction } = await import('../ops/audit-log');
      await logOpsAction({
        action: 'account_enabled',
        performedBy: req.user.uid,
        targetType: 'user',
        targetId: member.id,
        details: { email: member.email },
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(404).json({ error: 'not found', detail: err?.message });
    }
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
