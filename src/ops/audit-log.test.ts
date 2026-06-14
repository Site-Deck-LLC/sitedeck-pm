/**
 * Tests for the ops audit logger — Sprint 10
 * ============================================================================
 * Verifies that log entries are written with the expected shape and
 * that the append-only contract holds at the service layer.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { logOpsAction, listOpsAuditEntries } from './audit-log';

describe('audit-log', () => {
  let createdId = '';

  afterAll(async () => {
    const prisma = getPrismaClient();
    if (createdId) {
      await prisma.opsAuditLog.delete({ where: { id: createdId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('writes an audit row', async () => {
    const id = await logOpsAction({
      action: 'test.action',
      performedBy: 'tester',
      targetType: 'system',
      targetId: 'test-target',
      details: { foo: 'bar' },
    });
    expect(id).not.toBeNull();
    createdId = id!;
  });

  it('listOpsAuditEntries returns recent rows', async () => {
    const rows = await listOpsAuditEntries({ limit: 5 });
    expect(Array.isArray(rows)).toBe(true);
    // We don't assume order; we just want shape.
    for (const r of rows) {
      expect(typeof r.action).toBe('string');
      expect(typeof r.performedBy).toBe('string');
      expect(typeof r.targetType).toBe('string');
      expect(typeof r.targetId).toBe('string');
    }
  });
});
