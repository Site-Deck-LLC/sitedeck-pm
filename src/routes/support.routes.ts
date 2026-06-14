/**
 * support.routes.ts — Sprint 10
 * ============================================================================
 * Public support endpoint for the Get Help button (PM, Benchmark, Pro,
 * Design). Authenticated users POST a bug report; the server triages
 * it async and returns 200 immediately. The frontend polls for the
 * result.
 *
 * Rate limit: 5 reports per user per hour (in-process counter; bounded
 * map per uid).
 *
 * CORS: covered by the global corsForSiteDeck middleware. The X-Product
 * header is honored when present (Benchmark, Pro, Design), defaulting to
 * 'pm' when the request comes from the PM frontend.
 * ============================================================================
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getPrismaClient } from '../lib/prisma';
import { requireAuth } from '../middleware/express-auth';
import { asyncHandler } from '../lib/async-handler';
import { triageBugReport } from '../ops/triage.agent';
import { sanitizeTriageInput } from '../ops/sanitize';

const router = Router();

// In-process rate limit: 5 reports per user per hour
const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;
const userReports = new Map<string, number[]>();

function checkSupportRateLimit(uid: string): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const list = (userReports.get(uid) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= RATE_LIMIT) {
    const oldest = list[0]!;
    return { ok: false, retryAfterMs: WINDOW_MS - (now - oldest) };
  }
  list.push(now);
  userReports.set(uid, list);
  return { ok: true };
}

function detectProduct(req: Request): 'pm' | 'benchmark' | 'pro' | 'design' {
  const header = String(req.headers['x-product'] || '').toLowerCase();
  if (header === 'benchmark' || header === 'pro' || header === 'design') return header;
  return 'pm';
}

const SUPPORT_PRODUCTS = new Set(['pm', 'benchmark', 'pro', 'design']);

// POST /api/v1/support/report
router.post(
  '/report',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const limit = checkSupportRateLimit(req.user.uid);
    if (!limit.ok) {
      res.status(429).json({
        error: 'rate_limited',
        message: 'You have submitted several reports recently. Please wait before submitting more.',
        retryAfterMs: limit.retryAfterMs,
      });
      return;
    }
    const body = req.body || {};
    const userAction = sanitizeTriageInput(String(body.userAction || '').slice(0, 4000), { maxLen: 4000 });
    if (!userAction) {
      res.status(400).json({ error: 'userAction is required' });
      return;
    }
    const product = detectProduct(req);
    if (!SUPPORT_PRODUCTS.has(product)) {
      res.status(400).json({ error: 'invalid product' });
      return;
    }
    const projectId = typeof body.projectId === 'string' ? body.projectId : null;
    const route = sanitizeTriageInput(String(body.route || '').slice(0, 500), { maxLen: 500 }) || '(unknown)';
    const pageTitle = sanitizeTriageInput(String(body.pageTitle || '').slice(0, 500), { maxLen: 500 }) || '(unknown)';
    const consoleErrors = Array.isArray(body.consoleErrors) ? body.consoleErrors.slice(0, 10) : [];
    const lastApiCall = body.lastApiCall && typeof body.lastApiCall === 'object' ? body.lastApiCall : null;
    const browserInfo = body.browserInfo && typeof body.browserInfo === 'object' ? body.browserInfo : null;

    const prisma = getPrismaClient();
    const bug = await prisma.bugReport.create({
      data: {
        product,
        userId: req.user.uid,
        projectId,
        route,
        pageTitle,
        userAction,
        consoleErrors: consoleErrors as any,
        lastApiCall: lastApiCall as any,
        browserInfo: browserInfo as any,
        status: 'new',
      },
    });

    // Fire-and-forget triage. Don't await — the GET endpoint will be
    // polled by the frontend for the result.
    triageBugReport(bug.id).catch((e) => {
      console.error('[support.routes] triage failed', e);
    });

    res.status(200).json({
      reportId: bug.id,
      message: 'Looking into it',
    });
  })
);

// GET /api/v1/support/report/:reportId — poll for status
router.get(
  '/report/:reportId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const prisma = getPrismaClient();
    const bug = await prisma.bugReport.findUnique({
      where: { id: req.params.reportId },
    });
    if (!bug || bug.userId !== req.user.uid) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    // Hide the internal columns from the response.
    res.json({
      reportId: bug.id,
      status: bug.status,
      classification: bug.classification,
      userFacingMessage: deriveUserMessage(bug),
      workaround: bug.workaround,
    });
  })
);

function deriveUserMessage(bug: {
  classification: string | null;
  status: string;
  workaround: string | null;
}): string {
  if (bug.classification === 'user_error') {
    return "We've found a fix. Please review the steps above.";
  }
  if (bug.classification === 'feature_request') {
    return 'That is a cool idea for a new feature. Let me see if this is possible for a future build.';
  }
  if (bug.status === 'data_fixed') {
    return 'We found the issue and fixed it. Refresh the page to see the fix.';
  }
  if (bug.classification === 'code_change' || bug.status === 'code_fix_pending' || bug.status === 'code_fix_approved') {
    if (bug.workaround) return `We're looking into this. In the meantime: ${bug.workaround}`;
    return "We're looking into this. You'll hear back from us when it's resolved.";
  }
  if (bug.status === 'closed') {
    return "This report has been closed. Thank you for the feedback.";
  }
  // Default: still triaging
  return 'Our AI is looking at this…';
}

export default router;
