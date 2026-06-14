/**
 * bug-approval.routes.ts — Sprint 10
 * ============================================================================
 * Token-gated approval/rejection endpoints hit by the email links.
 *
 * The token IS the authorization. The operator may or may not be
 * signed in when they click the link. The token is single-use and
 * time-bounded.
 *
 * On GET: show a confirmation page (or rejection form). The page is
 * rendered as JSON (a minimal HTML stub) — the React frontend fetches
 * this endpoint and renders the actual UI; this is just a sanity
 * endpoint for direct browser hits and curl smoke tests.
 *
 * SECURITY: never auto-approve on GET. POST is the only path that
 * mutates state.
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { findValidToken, approveBugFix, rejectBugFix } from '../ops/approval.service';
import { getPrismaClient } from '../lib/prisma';

const router = Router();

async function tokenStatusResponse(token: string, bugReportId: string) {
  const found = await findValidToken(token);
  if (!found) return { status: 'invalid' as const };
  if (found.row.bugReportId !== bugReportId) return { status: 'mismatch' as const };
  if (found.status === 'used') return { status: 'used' as const };
  if (found.status === 'expired') return { status: 'expired' as const };
  return { status: 'valid' as const };
}

router.get(
  '/bugs/:id/approve',
  asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.query.token || '');
    if (!token) {
      res.status(400).json({ error: 'token is required' });
      return;
    }
    const status = await tokenStatusResponse(token, req.params.id);
    if (status.status !== 'valid') {
      res.status(401).json({ error: status.status });
      return;
    }
    const prisma = getPrismaClient();
    const bug = await prisma.bugReport.findUnique({ where: { id: req.params.id } });
    if (!bug) {
      res.status(404).json({ error: 'bug not found' });
      return;
    }
    res.json({
      confirmation: true,
      bug: {
        id: bug.id,
        product: bug.product,
        route: bug.route,
        userAction: bug.userAction,
        suggestedFix: bug.suggestedFix,
        workaround: bug.workaround,
        riskLevel: bug.riskLevel,
        blastRadius: bug.blastRadius,
      },
      message: 'POST to /api/v1/bug-approval/bugs/:id/approve with { token } to confirm.',
    });
  })
);

router.post(
  '/bugs/:id/approve',
  asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.body?.token || '');
    if (!token) {
      res.status(400).json({ error: 'token is required' });
      return;
    }
    const performedBy = req.user?.uid || 'token-link';
    const result = await approveBugFix(req.params.id, token, performedBy);
    if (!result.ok) {
      res.status(401).json({ error: result.reason || 'approval failed' });
      return;
    }
    res.json({ ok: true, message: 'Fix approved. Running now.' });
  })
);

router.get(
  '/bugs/:id/reject',
  asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.query.token || '');
    if (!token) {
      res.status(400).json({ error: 'token is required' });
      return;
    }
    const status = await tokenStatusResponse(token, req.params.id);
    if (status.status !== 'valid') {
      res.status(401).json({ error: status.status });
      return;
    }
    res.json({
      form: 'rejection',
      message: 'POST to /api/v1/bug-approval/bugs/:id/reject with { token, reason } to confirm.',
    });
  })
);

router.post(
  '/bugs/:id/reject',
  asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.body?.token || '');
    const reason = String(req.body?.reason || 'No reason provided');
    if (!token) {
      res.status(400).json({ error: 'token is required' });
      return;
    }
    const performedBy = req.user?.uid || 'token-link';
    const result = await rejectBugFix(req.params.id, token, reason, performedBy);
    if (!result.ok) {
      res.status(401).json({ error: result.reason || 'rejection failed' });
      return;
    }
    res.json({ ok: true });
  })
);

export default router;
