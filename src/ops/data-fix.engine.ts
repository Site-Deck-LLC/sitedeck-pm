/**
 * ops/data-fix.engine.ts — Sprint 10, Task 3
 * ============================================================================
 * Executes Category 3 (DATA_FIX) bug fixes — corrupt data corrections
 * that do not require a code change. The execution is bounded by a
 * strict safety policy:
 *
 *   REJECT conditions (escalate to code_change):
 *     1. fixPlan.affectedRowCount > 10
 *     2. targetTable in [users, firebase_tokens, billing_accounts,
 *        api_keys, ops_audit_log, bug_approval_tokens, bug_reports]
 *     3. fixType = 'delete_record' AND affectedRowCount > 1
 *     4. fixType is anything that would ALTER TABLE / drop columns /
 *        change schema
 *
 *   EXECUTE: in a Prisma transaction, with the action logged to
 *   ops_audit_log BEFORE and AFTER. On failure, the transaction rolls
 *   back, the failure is logged, and the bug is escalated.
 *
 *   The fix plan is parsed from a free-text `suggestedFix` string. The
 *   triage agent emits this string in a structured form. We support a
 *   small DSL (see parseFixPlan) to keep the contract testable.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { logOpsAction } from './audit-log';

export type FixType =
  | 'update_record'
  | 'delete_record'
  | 'fix_json_field'
  | 'remove_duplicate'
  | 'fix_orphan';

export interface FixPlan {
  fixType: FixType;
  targetTable: string;
  targetId: string;
  field?: string;
  newValue?: unknown;
  affectedRowCount: number;
}

export interface FixExecutionResult {
  success: boolean;
  rowsAffected: number;
  rejectedReason?: string;
  escalated: boolean;
  plainEnglish: string;
}

const PROTECTED_TABLES = new Set([
  'users',
  'firebase_tokens',
  'billing_accounts',
  'api_keys',
  'ops_audit_log',
  'bug_approval_tokens',
  'bug_reports',
  'feature_requests',
  'org_api_keys',
  'org_api_key',
  'firebase_service_account',
]);

// ─── Fix-plan DSL parser ─────────────────────────────────────────────────────
// The triage agent emits a JSON blob embedded in the suggestedFix text
// (delimited by ===FIX_PLAN_START=== ... ===FIX_PLAN_END===). When the
// model doesn't include it, we fall back to a conservative escalate.

const PLAN_START = '===FIX_PLAN_START===';
const PLAN_END = '===FIX_PLAN_END===';

export function parseFixPlan(suggestedFix: string | null | undefined): FixPlan | null {
  if (!suggestedFix) return null;
  const startIdx = suggestedFix.indexOf(PLAN_START);
  const endIdx = suggestedFix.indexOf(PLAN_END);
  if (startIdx < 0 || endIdx <= startIdx) return null;
  const raw = suggestedFix.slice(startIdx + PLAN_START.length, endIdx).trim();
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const fixType = o.fixType as FixType;
  const targetTable = typeof o.targetTable === 'string' ? o.targetTable : '';
  const targetId = typeof o.targetId === 'string' ? o.targetId : '';
  const field = typeof o.field === 'string' ? o.field : undefined;
  const newValue = o.newValue;
  const affectedRowCount = Number(o.affectedRowCount);
  if (!fixType || !targetTable || !targetId || !Number.isFinite(affectedRowCount)) {
    return null;
  }
  return { fixType, targetTable, targetId, field, newValue, affectedRowCount };
}

// ─── Safety guards ───────────────────────────────────────────────────────────

export function rejectIfUnsafe(plan: FixPlan): string | null {
  if (plan.affectedRowCount > 10) {
    return `Refusing: affectedRowCount=${plan.affectedRowCount} > 10`;
  }
  if (PROTECTED_TABLES.has(plan.targetTable)) {
    return `Refusing: target table "${plan.targetTable}" is protected`;
  }
  if (plan.fixType === 'delete_record' && plan.affectedRowCount > 1) {
    return 'Refusing: delete_record with affectedRowCount > 1';
  }
  // ALTER TABLE / schema changes are not representable in this DSL — they
  // would have been rejected at parse time if attempted.
  return null;
}

// ─── Execution ───────────────────────────────────────────────────────────────
// Each supported fix type is a small switch arm. Unknown fix types fail
// closed (rejected).

export async function executeDataFix(
  bugReportId: string,
  suggestedFix: string,
  performedBy: string
): Promise<FixExecutionResult> {
  const prisma = getPrismaClient();

  const plan = parseFixPlan(suggestedFix);
  if (!plan) {
    await logOpsAction({
      action: 'data_fix.rejected',
      performedBy,
      targetType: 'bug_report',
      targetId: bugReportId,
      details: { reason: 'no fix plan' },
    });
    return {
      success: false,
      rowsAffected: 0,
      rejectedReason: 'No fix plan in suggestedFix',
      escalated: true,
      plainEnglish: 'No structured fix plan was found. Manual review required.',
    };
  }

  const rejection = rejectIfUnsafe(plan);
  if (rejection) {
    await logOpsAction({
      action: 'data_fix.rejected',
      performedBy,
      targetType: 'bug_report',
      targetId: bugReportId,
      details: { plan, reason: rejection },
    });
    return {
      success: false,
      rowsAffected: 0,
      rejectedReason: rejection,
      escalated: true,
      plainEnglish: 'The fix was rejected by the safety policy. Manual review required.',
    };
  }

  await logOpsAction({
    action: 'data_fix_attempted',
    performedBy,
    targetType: 'bug_report',
    targetId: bugReportId,
    details: { plan },
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      switch (plan.fixType) {
        case 'update_record': {
          if (!plan.field) throw new Error('update_record requires field');
          // Use a parameterized raw query to support any allowed table.
          // Field names are validated against a strict allowlist below.
          const allowedField = isAllowedField(plan.targetTable, plan.field);
          if (!allowedField) {
            throw new Error(`Field ${plan.field} not allowed on ${plan.targetTable}`);
          }
          const affected = await tx.$executeRawUnsafe(
            `UPDATE ${q(plan.targetTable)} SET ${q(plan.field)} = $1 WHERE id = $2`,
            plan.newValue ?? null,
            plan.targetId
          );
          return { rowsAffected: affected };
        }
        case 'fix_json_field': {
          if (!plan.field) throw new Error('fix_json_field requires field');
          if (!isAllowedField(plan.targetTable, plan.field)) {
            throw new Error(`Field ${plan.field} not allowed on ${plan.targetTable}`);
          }
          const affected = await tx.$executeRawUnsafe(
            `UPDATE ${q(plan.targetTable)} SET ${q(plan.field)} = $1::jsonb WHERE id = $2`,
            JSON.stringify(plan.newValue ?? null),
            plan.targetId
          );
          return { rowsAffected: affected };
        }
        case 'delete_record': {
          const affected = await tx.$executeRawUnsafe(
            `DELETE FROM ${q(plan.targetTable)} WHERE id = $1`,
            plan.targetId
          );
          return { rowsAffected: affected };
        }
        case 'remove_duplicate':
        case 'fix_orphan': {
          // Generic "remove a duplicate" or "fix an orphan": these need
          // a more specific fixType. We treat them as rejected for V1
          // and rely on the operator to write a more specific plan.
          throw new Error(`fixType ${plan.fixType} is not yet implemented`);
        }
        default: {
          throw new Error(`Unknown fixType ${(plan as FixPlan).fixType}`);
        }
      }
    });

    await logOpsAction({
      action: 'data_fix_completed',
      performedBy,
      targetType: 'bug_report',
      targetId: bugReportId,
      details: { rowsAffected: result.rowsAffected, plan },
    });

    return {
      success: true,
      rowsAffected: result.rowsAffected,
      escalated: false,
      plainEnglish: `Updated ${result.rowsAffected} row(s) in ${plan.targetTable}.`,
    };
  } catch (err) {
    await logOpsAction({
      action: 'data_fix.failed',
      performedBy,
      targetType: 'bug_report',
      targetId: bugReportId,
      details: { plan, error: (err as Error)?.message?.slice(0, 500) },
    });
    return {
      success: false,
      rowsAffected: 0,
      rejectedReason: (err as Error)?.message ?? 'unknown error',
      escalated: true,
      plainEnglish: 'The data fix failed. Manual review required.',
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Whitelist of editable fields. Hard-coded so a misbehaving model can't
// write to a sensitive column. The map is intentionally narrow — it
// covers the data shapes the triage agent has been instructed to handle.
const ALLOWED_FIELDS: Record<string, Set<string>> = {
  projects: new Set(['name', 'status', 'city', 'state', 'end_date', 'start_date', 'contract_value']),
  rfis: new Set(['status', 'ball_in_court', 'required_date', 'answered_at']),
  submittals: new Set(['status', 'ball_in_court', 'required_date']),
  change_orders: new Set(['status', 'approved_at', 'approved_by']),
  schedule_activities: new Set(['status', 'percent_complete', 'end_date', 'start_date']),
  budget_lines: new Set(['planned_amount', 'actual_amount']),
  issues: new Set(['status', 'priority', 'assigned_to', 'closed_at']),
  meetings: new Set(['scheduled_at', 'location']),
  notifications: new Set(['read', 'read_at']),
};

function isAllowedField(table: string, field: string): boolean {
  const allowed = ALLOWED_FIELDS[table];
  return Boolean(allowed?.has(field));
}

function q(name: string): string {
  // Identifier quoting. We do not use parameter substitution for
  // identifiers (Prisma can't) — instead we whitelist the values.
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${name}"`;
}

export const __test__ = {
  parseFixPlan,
  rejectIfUnsafe,
  isAllowedField,
  ALLOWED_FIELDS,
  PROTECTED_TABLES,
};
