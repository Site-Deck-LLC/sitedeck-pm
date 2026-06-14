import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/permission.middleware';
import { asyncHandler } from '../lib/async-handler';
import { ROLES } from '../constants/roles';
import { runCopilot } from '../agents/copilot.agent';
import { runCoach } from '../agents/coach.agent';
import { runReporter } from '../agents/reporter.agent';
import { runStandards } from '../agents/standards.agent';
import { runIntelligence } from '../agents/intelligence.agent';
import { runMorningBrief } from '../agents/morning-brief.agent';
import { runRfiFollowUp } from '../agents/rfi-followup.agent';
import { runOwnerReport } from '../agents/owner-report.agent';
import {
  checkDailyRateLimit,
  saveReport,
  listReports,
  getReport,
  editSection,
  markAsSent,
} from '../services/owner-report.service';
import { getTodayUsageFor } from '../services/agent-usage.service';
import { getPrismaClient } from '../lib/prisma';

const router = Router({ mergeParams: true });

/**
 * GET /api/v1/projects/:projectId/agents/copilot
 * Returns proactive alerts and what-if scenarios for the project.
 */
router.get(
  '/copilot',
  requireAuth,
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const result = await runCopilot({ projectId, triggerEvent: 'scheduled' });
    res.json(result);
  })
);

/**
 * GET /api/v1/projects/:projectId/agents/coach
 * Returns contextual onboarding tips and training nudges.
 */
router.get(
  '/coach',
  requireAuth,
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const result = await runCoach({
      projectId,
      userId: req.user?.uid ?? 'anonymous',
      currentView: 'dashboard',
    });
    res.json(result);
  })
);

/**
 * GET /api/v1/projects/:projectId/agents/reporter
 * Returns a draft owner-ready status report.
 */
router.get(
  '/reporter',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const result = await runReporter({
      projectId,
      audience: 'owner',
      periodStart: weekAgo.toISOString(),
      periodEnd: now.toISOString(),
      format: 'narrative',
    });
    res.json(result);
  })
);

/**
 * GET /api/v1/projects/:projectId/agents/standards
 * Returns regulatory compliance checks and notice alerts.
 */
router.get(
  '/standards',
  requireAuth,
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const result = await runStandards({ projectId });
    res.json(result);
  })
);

/**
 * GET /api/v1/projects/:projectId/agents/intelligence
 * Returns historical-pattern-based estimate validations and risks.
 */
router.get(
  '/intelligence',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const result = await runIntelligence({ projectId, orgId: 'default', analysisType: 'full' });
    res.json(result);
  })
);

/**
 * GET /api/v1/projects/:projectId/agents/brief
 * Combined "morning brief" — pulls from all 5 agents and returns a single
 * compact payload for the dashboard. Saves 5 round-trips on page load.
 */
router.get(
  '/brief',
  requireAuth,
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const userId = req.user?.uid ?? 'anonymous';

    const [copilot, coach, standards] = await Promise.all([
      runCopilot({ projectId, triggerEvent: 'scheduled' }),
      runCoach({ projectId, userId, currentView: 'dashboard' }),
      runStandards({ projectId }),
    ]);

    res.json({
      generatedAt: new Date().toISOString(),
      copilot: {
        alertCount: copilot.alerts.length,
        scenarioCount: copilot.scenarios.length,
        compoundFlagCount: copilot.compoundFlags.length,
        topAlerts: copilot.alerts.slice(0, 3),
      },
      coach: {
        tipCount: coach.tips.length,
        nudgeCount: coach.nudges.length,
        topTips: coach.tips.slice(0, 3),
        nextStep: coach.onboarding.nextStep,
      },
      standards: {
        overallStatus: standards.overallStatus,
        checkCount: standards.checks.length,
        noticeCount: standards.notices.length,
        upcomingNotices: standards.notices
          .filter((n) => n.daysRemaining <= 7)
          .slice(0, 3),
      },
    });
  })
);

/**
 * GET /api/v1/projects/:projectId/agents/morning-brief
 * AI Co-Pilot V1 — generates a short, scannable morning brief for the
 * project. Returns either an AI-generated brief (when ANTHROPIC_API_KEY
 * is configured) or a deterministic fallback brief.
 *
 * The endpoint always returns 200 with a brief (never fails the dashboard).
 * The `source` field tells the caller whether the brief was AI or fallback.
 * The `meta` field includes cost and token counts when AI, or the failure
 * code when fallback.
 */
router.get(
  '/morning-brief',
  requireAuth,
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const userId = req.user?.uid ?? 'anonymous';
    // Allow ?mode=fallback to force the deterministic path (useful for
    // the dashboard toggle and for testing).
    const mode = req.query.mode === 'fallback' ? 'fallback' : 'auto';
    const result = await runMorningBrief({ projectId, userId, mode });
    res.json(result);
  })
);

/**
 * GET /api/v1/projects/:projectId/agents/morning-brief/usage
 * Returns today's call count + spend for the current user. The dashboard
 * uses this to display the AI badge and the spend meter.
 */
router.get(
  '/morning-brief/usage',
  requireAuth,
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const userId = req.user?.uid ?? 'anonymous';
    const usage = await getTodayUsageFor(projectId, userId, 'brief');
    res.json(usage);
  })
);

/**
 * POST /api/v1/projects/:projectId/agents/rfi-followup
 * Body: { rfiId: string, tone?: 'firm_professional' | 'collaborative' | 'urgent' }
 * Returns a draft follow-up message for an RFI that is past its required
 * date. The PM reviews and sends it themselves; this endpoint never sends
 * anything on its own.
 */
router.post(
  '/rfi-followup',
  requireAuth,
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const rfiId = req.body?.rfiId;
    if (!rfiId || typeof rfiId !== 'string') {
      res.status(400).json({ error: 'rfiId is required' });
      return;
    }
    const result = await runRfiFollowUp({
      projectId,
      rfiId,
      userId: req.user?.uid ?? 'anonymous',
      mode: req.body?.mode,
      tone: req.body?.tone,
    });
    res.json(result);
  })
);

/**
 * POST /api/v1/projects/:projectId/agents/owner-report
 * Body (optional): { weekEnding?: 'YYYY-MM-DD', mode?: 'auto'|'fallback' }
 *
 * Generates a weekly owner status report, persists it, and returns the
 * full payload. Same security stack as morning-brief / rfi-followup:
 *   - requireAuth + role gate (PM/owner only — owners_rep read-only)
 *   - hard-coded max_tokens (1200, via 'reporter' agent endpoint)
 *   - sanitized metrics via sanitizeForPrompt
 *   - call logged to api_usage_log
 *   - per-project rate limit: 3/day (returns 429)
 *
 * Idempotent: re-running for the same (project, weekEnding) updates the
 * existing row rather than inserting a duplicate.
 */
router.post(
  '/owner-report',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const userId = req.user?.uid ?? 'anonymous';

    // Per-project 3/day rate limit. We do this BEFORE running the agent
    // so a 429 doesn't waste tokens.
    try {
      await checkDailyRateLimit(projectId);
    } catch (e: any) {
      if (e.status === 429) {
        res.status(429).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }

    const weekEndingRaw = req.body?.weekEnding;
    const weekEnding = weekEndingRaw ? new Date(weekEndingRaw) : undefined;
    if (weekEnding && isNaN(weekEnding.getTime())) {
      res.status(400).json({ error: 'weekEnding must be a valid ISO date' });
      return;
    }

    const mode =
      req.body?.mode === 'fallback' ? 'fallback' : req.body?.mode === 'force' ? 'force' : 'auto';

    const report = await runOwnerReport({ projectId, userId, weekEnding: weekEndingRaw, mode });

    // Persist (upsert on (projectId, weekEnding))
    const saved = await saveReport({
      projectId,
      userId,
      weekEnding: new Date(report.week_ending),
      report: {
        report_title: report.report_title,
        week_ending: report.week_ending,
        sections: report.sections,
        full_report_text: report.full_report_text,
        source: report.source,
        metrics: report.metrics,
        meta: report.meta,
      },
    });

    res.status(201).json({
      id: saved.id,
      weekEnding: saved.weekEnding,
      generatedAt: saved.generatedAt,
      sentAt: saved.sentAt,
      report,
    });
  })
);

/**
 * GET /api/v1/projects/:projectId/agents/owner-report
 * List all owner reports for the project (most-recent week first).
 */
router.get(
  '/owner-report',
  requireAuth,
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const rows = await listReports(projectId);
    res.json(rows);
  })
);

/**
 * GET /api/v1/projects/:projectId/agents/owner-report/:id
 * Returns the full report (with the sections) for editing / sending.
 */
router.get(
  '/owner-report/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const report = await getReport(req.params.id);
    if (!report) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    // Tenant isolation — report must belong to the requested project
    if (report.projectId !== req.params.projectId) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(report);
  })
);

/**
 * PATCH /api/v1/projects/:projectId/agents/owner-report/:id
 * Body: { section: 'schedule'|'cost'|'rfis'|'change_orders'|'risks'|'lookahead', body: string }
 * Edits a single section and re-renders full_report_text. This is the
 * "PM adjusts tone" path — the AI is never called again.
 */
router.patch(
  '/owner-report/:id',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const { section, body } = req.body || {};
    const valid = ['schedule', 'cost', 'rfis', 'change_orders', 'risks', 'lookahead'];
    if (!valid.includes(section)) {
      res.status(400).json({ error: `section must be one of: ${valid.join(', ')}` });
      return;
    }
    if (typeof body !== 'string') {
      res.status(400).json({ error: 'body must be a string' });
      return;
    }
    const updated = await editSection(req.params.id, section as any, body.slice(0, 4000));
    // Tenant isolation
    if (updated.projectId !== req.params.projectId) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(updated);
  })
);

/**
 * POST /api/v1/projects/:projectId/agents/owner-report/:id/send
 * Body (optional): { sentToEmail?: string }
 * Records the sentAt timestamp. This is a record-keeping endpoint; it
 * does not actually email anything (that's a future task).
 */
router.post(
  '/owner-report/:id/send',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const updated = await markAsSent(req.params.id, req.body?.sentToEmail);
    if (updated.projectId !== req.params.projectId) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(updated);
  })
);

/**
 * GET /api/v1/projects/:projectId/agents/owner-report/:id/pdf
 * Renders the saved report as a SiteDeck-branded PDF. Cover page with
 * week ending and project name, then the six sections (Schedule, Cost,
 * RFIs, Change Orders, Risks, Two-Week Lookahead). Returns
 * application/pdf bytes — the browser opens it inline.
 */
router.get(
  '/owner-report/:id/pdf',
  requireAuth,
  asyncHandler(async (req, res) => {
    const report = await getReport(req.params.id);
    if (!report || report.projectId !== req.params.projectId) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const json = (report.reportJson as any) || {};
    const project = await getPrismaClient().project.findUnique({
      where: { id: req.params.projectId },
      select: { name: true },
    });
    const projectName = project?.name || 'Project';
    const sections = json.sections || {};
    const { buildOwnerReportPdf } = await import('../services/pdf/pdf.service');
    const buffer = await buildOwnerReportPdf({
      reportTitle: json.report_title || 'Weekly Owner Report',
      weekEnding: json.week_ending || new Date(report.weekEnding).toISOString().slice(0, 10),
      projectName,
      generatedAt: (report.generatedAt instanceof Date
        ? report.generatedAt
        : new Date(report.generatedAt)
      ).toISOString(),
      sections: {
        schedule: sections.schedule || '',
        cost: sections.cost || '',
        rfis: sections.rfis || '',
        change_orders: sections.change_orders || '',
        risks: sections.risks || '',
        lookahead: sections.lookahead || '',
      },
      metrics: (json.metrics as any) || null,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="owner-report-${json.week_ending || 'report'}.pdf"`
    );
    res.send(buffer);
  })
);

export default router;
