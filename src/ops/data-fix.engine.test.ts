/**
 * Tests for the data-fix engine safety guards — Sprint 10
 * ============================================================================
 * The engine is intentionally bounded: most attempted fixes should be
 * rejected. These tests pin that policy.
 * ============================================================================
 */

import { __test__, rejectIfUnsafe, parseFixPlan } from './data-fix.engine';

describe('data-fix.engine: parseFixPlan', () => {
  it('parses a structured fix plan', () => {
    const text = 'Description: rename.\n===FIX_PLAN_START===\n{"fixType":"update_record","targetTable":"projects","targetId":"p1","field":"name","newValue":"New Name","affectedRowCount":1}\n===FIX_PLAN_END===\nDone.';
    const plan = parseFixPlan(text);
    expect(plan).not.toBeNull();
    expect(plan!.fixType).toBe('update_record');
    expect(plan!.targetTable).toBe('projects');
  });

  it('returns null when no plan block', () => {
    expect(parseFixPlan('free text only')).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    expect(parseFixPlan('===FIX_PLAN_START==={not json}===FIX_PLAN_END===')).toBeNull();
  });
});

describe('data-fix.engine: rejectIfUnsafe', () => {
  it('rejects affectedRowCount > 10', () => {
    const r = rejectIfUnsafe({ fixType: 'update_record', targetTable: 'projects', targetId: 'p1', affectedRowCount: 11 });
    expect(r).toMatch(/Refusing/);
  });

  it('rejects protected tables', () => {
    for (const t of ['users', 'firebase_tokens', 'billing_accounts', 'api_keys', 'ops_audit_log', 'bug_approval_tokens', 'bug_reports']) {
      const r = rejectIfUnsafe({ fixType: 'update_record', targetTable: t, targetId: 'x', affectedRowCount: 1 });
      expect(r).toMatch(/Refusing/);
    }
  });

  it('rejects delete_record with affectedRowCount > 1', () => {
    const r = rejectIfUnsafe({ fixType: 'delete_record', targetTable: 'projects', targetId: 'x', affectedRowCount: 2 });
    expect(r).toMatch(/Refusing/);
  });

  it('accepts a safe update', () => {
    const r = rejectIfUnsafe({ fixType: 'update_record', targetTable: 'projects', targetId: 'p1', field: 'name', newValue: 'X', affectedRowCount: 1 });
    expect(r).toBeNull();
  });
});

describe('data-fix.engine: ALLOWED_FIELDS', () => {
  it('only allows whitelisted fields on whitelisted tables', () => {
    expect(__test__.isAllowedField('projects', 'name')).toBe(true);
    expect(__test__.isAllowedField('projects', 'secret_field')).toBe(false);
    expect(__test__.isAllowedField('unknown_table', 'name')).toBe(false);
  });
});
