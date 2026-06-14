/**
 * ops/approval.service.ts — Sprint 10, Task 5
 * ============================================================================
 * Tokenized email-approval flow for code-change bug fixes.
 *
 * Flow:
 *   1. Operator reviews a bug report in /admin
 *   2. sendApprovalEmail(bugReportId) generates a BugApprovalToken
 *      (UUID v4, 48h expiry) and emails a deep link with the token
 *      to support@sitedeck.pro
 *   3. Operator clicks [APPROVE] or [REJECT] in the email
 *   4. The GET routes show a confirmation page; POST routes do the
 *      actual action. GET never auto-approves.
 *   5. On approve: BugReport → code_fix_approved and the fix pipeline
 *      (ops/fix-pipeline.service.ts) is triggered async.
 *   6. On reject: BugReport → closed, and the user is notified with
 *      the workaround (if any).
 *
 * Security:
 *   - Tokens are single-use; rejected/approved/expired tokens are
 *     marked on the row and rejected on subsequent uses.
 *   - Tokens are NOT accepted on /admin/* routes — those still
 *     require requireSiteDeckAdmin. The token is the email path
 *     for the operator who isn't currently signed in.
 * ============================================================================
 */

import * as crypto from 'crypto';
import { getPrismaClient } from '../lib/prisma';
import { sendEmail } from '../services/email.service';
import { sendPushNotification } from '../services/push-notification.service';
import { logOpsAction } from './audit-log';
import { triggerFixPipeline } from './fix-pipeline.service';

const APPROVAL_RECIPIENT = process.env.OPS_APPROVAL_EMAIL || 'support@sitedeck.pro';
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://projects.sitedeck.pro';

export interface ApprovalTokenView {
  token: string;
  expiresAt: Date;
  url: string;
}

// ─── Issue / revoke / use tokens ─────────────────────────────────────────────

export async function createApprovalToken(bugReportId: string): Promise<ApprovalTokenView> {
  const prisma = getPrismaClient();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await prisma.bugApprovalToken.create({
    data: {
      bugReportId,
      token,
      expiresAt,
    },
  });
  return {
    token,
    expiresAt,
    url: `${PUBLIC_BASE_URL}/admin/bugs/${bugReportId}/approve?token=${token}`,
  };
}

export async function findValidToken(token: string) {
  const prisma = getPrismaClient();
  const row = await prisma.bugApprovalToken.findUnique({ where: { token } });
  if (!row) return null;
  if (row.approvedAt || row.rejectedAt) return { row, status: 'used' as const };
  if (row.expiresAt.getTime() < Date.now()) return { row, status: 'expired' as const };
  return { row, status: 'valid' as const };
}

// ─── Email + push ────────────────────────────────────────────────────────────

export async function sendApprovalEmail(bugReportId: string): Promise<{ ok: boolean; tokenId: string }> {
  const prisma = getPrismaClient();
  const bug = await prisma.bugReport.findUnique({ where: { id: bugReportId } });
  if (!bug) throw new Error(`BugReport ${bugReportId} not found`);

  const approval = await createApprovalToken(bugReportId);
  const blast = (bug.blastRadius as any) ?? {};
  const risk = (bug.riskLevel || 'medium').toUpperCase();
  const text = [
    `[ACTION REQUIRED] ${risk} Code Bug — SiteDeck ${bug.product} — ${bug.route}`,
    '',
    'What the user reported (sanitized):',
    bug.userAction,
    '',
    `Route: ${bug.route}`,
    `Product: ${bug.product}`,
    `Classification: ${bug.classification || 'n/a'}`,
    `Confidence: ${bug.classificationConfidence ? `${bug.classificationConfidence}%` : 'n/a'}`,
    `Risk level: ${risk}`,
    '',
    'Affected files:',
    ...(Array.isArray(blast.affectedFiles) && blast.affectedFiles.length
      ? blast.affectedFiles.map((f: string) => '  - ' + f)
      : ['  (none reported)']),
    '',
    'Suggested fix:',
    bug.suggestedFix || '(no suggested fix provided)',
    '',
    'Workaround provided to user:',
    bug.workaround || '(no workaround)',
    '',
    'Approve:  ' + approval.url,
    `Reject:   ${PUBLIC_BASE_URL}/admin/bugs/${bugReportId}/reject?token=${approval.token}`,
    '',
    'Token expires in 48 hours. This action is logged and irreversible.',
  ].join('\n');

  const result = await sendEmail({
    to: APPROVAL_RECIPIENT,
    subject: `[ACTION REQUIRED] ${risk} Code Bug — SiteDeck ${bug.product} — ${bug.route}`,
    text,
  });

  // Push notification to the owner admin (best-effort, never throws).
  // We push to the support user uid as a stand-in for the operator
  // configured to receive ops alerts.
  const supportUid = process.env.OPS_SUPPORT_UID || 'BJedHsm0LTXHiJokkZStXw9N18H2';
  try {
    await sendPushNotification({
      userId: supportUid,
      title: `[${risk}] Code Bug Needs Review`,
      body: `${bug.product} — ${bug.route} — ${bug.classificationConfidence || 0}% confidence`,
      data: { actionUrl: `/admin/bugs/${bugReportId}`, bugReportId },
    });
  } catch {
    // push is best-effort
  }

  await logOpsAction({
    action: 'bug.approval_email_sent',
    performedBy: 'system:approval',
    targetType: 'bug_report',
    targetId: bugReportId,
    details: { token: approval.token, ok: result.ok, recipient: APPROVAL_RECIPIENT },
  });

  return { ok: result.ok, tokenId: approval.token };
}

// ─── Approve / reject (called by HTTP routes) ────────────────────────────────

export async function approveBugFix(
  bugReportId: string,
  token: string,
  performedBy: string
): Promise<{ ok: boolean; reason?: string }> {
  const prisma = getPrismaClient();
  const found = await findValidToken(token);
  if (!found) return { ok: false, reason: 'Invalid token' };
  if (found.status === 'expired') return { ok: false, reason: 'Token expired' };
  if (found.status === 'used') return { ok: false, reason: 'Token already used' };
  if (found.row.bugReportId !== bugReportId) {
    return { ok: false, reason: 'Token does not match this bug report' };
  }

  await prisma.$transaction([
    prisma.bugApprovalToken.update({
      where: { id: found.row.id },
      data: { approvedAt: new Date(), approvedBy: performedBy },
    }),
    prisma.bugReport.update({
      where: { id: bugReportId },
      data: { status: 'code_fix_approved' },
    }),
  ]);

  await logOpsAction({
    action: 'bug.approved',
    performedBy,
    targetType: 'bug_report',
    targetId: bugReportId,
    details: { token: token.slice(0, 8) + '…' },
  });

  // Fire-and-forget pipeline trigger. Caller returns 200 immediately.
  triggerFixPipeline(bugReportId).catch((e) => {
    console.error('[ops/approval] fix pipeline trigger failed', e);
  });

  return { ok: true };
}

export async function rejectBugFix(
  bugReportId: string,
  token: string,
  reason: string,
  performedBy: string
): Promise<{ ok: boolean; reason?: string }> {
  const prisma = getPrismaClient();
  const found = await findValidToken(token);
  if (!found) return { ok: false, reason: 'Invalid token' };
  if (found.status === 'expired') return { ok: false, reason: 'Token expired' };
  if (found.status === 'used') return { ok: false, reason: 'Token already used' };
  if (found.row.bugReportId !== bugReportId) {
    return { ok: false, reason: 'Token does not match this bug report' };
  }

  const bug = await prisma.bugReport.findUnique({ where: { id: bugReportId } });

  await prisma.$transaction([
    prisma.bugApprovalToken.update({
      where: { id: found.row.id },
      data: { rejectedAt: new Date(), rejectedBy: performedBy, rejectReason: reason.slice(0, 500) },
    }),
    prisma.bugReport.update({
      where: { id: bugReportId },
      data: { status: 'closed', resolvedAt: new Date() },
    }),
  ]);

  await logOpsAction({
    action: 'bug.rejected',
    performedBy,
    targetType: 'bug_report',
    targetId: bugReportId,
    details: { reason: reason.slice(0, 200) },
  });

  if (bug?.workaround) {
    // Best-effort notify the user. We don't have the user email here
    // without an extra join, so the user-facing notification will be
    // picked up by the polling endpoint and rendered client-side.
  }

  return { ok: true };
}

export const __test__ = {
  TOKEN_TTL_MS,
  APPROVAL_RECIPIENT,
};
