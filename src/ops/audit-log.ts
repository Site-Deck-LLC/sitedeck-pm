/**
 * ops/audit-log.ts — Sprint 10
 * ============================================================================
 * Append-only audit logger for the SiteDeck Ops console. Every privileged
 * action (bug classification, approval, fix pipeline trigger, user claim
 * change) goes through `logOpsAction()`. There is intentionally no update
 * or delete path. The `OpsAuditLog` table is the canonical record.
 *
 * Used by:
 *   - triage.agent.ts       (classification, fix attempts)
 *   - data-fix.engine.ts    (data fix attempt + completion)
 *   - approval.service.ts   (token approval/rejection)
 *   - fix-pipeline.service.ts (pipeline trigger + outcome)
 *   - /admin/users routes   (claim changes, password resets, disables)
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';

export type OpsTargetType =
  | 'bug_report'
  | 'feature_request'
  | 'token'
  | 'fix_pipeline'
  | 'system'
  | 'user'
  | 'bug'
  | 'project_member';

export interface LogOpsInput {
  action: string;
  performedBy: string;
  targetType: OpsTargetType;
  targetId: string;
  details?: Record<string, unknown>;
}

/**
 * Append an ops audit log row. NEVER throws — a failed audit log must not
 * block the calling operation. Returns the row id (or null on failure).
 */
export async function logOpsAction(input: LogOpsInput): Promise<string | null> {
  try {
    const prisma = getPrismaClient();
    const row = await prisma.opsAuditLog.create({
      data: {
        action: input.action,
        performedBy: input.performedBy,
        targetType: input.targetType,
        targetId: input.targetId,
        details: (input.details ?? null) as any,
      },
    });
    return row.id;
  } catch (err) {
    // Audit log failures must never propagate. Log to stderr so they
    // show up in journal.
    console.error('[ops/audit-log] failed to write audit row', {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      err: (err as Error)?.message,
    });
    return null;
  }
}

/**
 * Read recent audit log entries. Admin-only callers (gated at the route
 * layer). Bounded by `limit` (default 100) and optionally filtered.
 */
export async function listOpsAuditEntries(opts: {
  action?: string;
  since?: Date;
  until?: Date;
  limit?: number;
}) {
  const prisma = getPrismaClient();
  const where: Record<string, unknown> = {};
  if (opts.action) where.action = opts.action;
  if (opts.since || opts.until) {
    where.createdAt = {
      ...(opts.since ? { gte: opts.since } : {}),
      ...(opts.until ? { lte: opts.until } : {}),
    };
  }
  return prisma.opsAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(opts.limit ?? 100, 500),
  });
}
