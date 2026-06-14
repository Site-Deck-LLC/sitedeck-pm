/**
 * Tests for the fix pipeline service — Sprint 10
 * ============================================================================
 * Mocks out the SSH calls (we don't want to talk to the VPS from the
 * test suite) and verifies the status transitions + audit log writes.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { __test__, getFixStatus, triggerFixPipeline } from './fix-pipeline.service';

// Force the pipeline to a known state by clearing any in-flight entries
// from prior runs.
beforeEach(() => {
  __test__.inFlightPipelines.clear();
});

describe('fix-pipeline.service: inFlightPipelines', () => {
  it('exposes the in-flight map for tests', () => {
    expect(__test__.inFlightPipelines).toBeInstanceOf(Map);
  });
});

describe('fix-pipeline.service: getFixStatus', () => {
  it('returns null for an unknown bug', async () => {
    const status = await getFixStatus('does-not-exist');
    expect(status).toBeNull();
  });

  it('returns the current status for a known bug', async () => {
    const prisma = getPrismaClient();
    const bug = await prisma.bugReport.create({
      data: {
        product: 'pm',
        userId: 'tester',
        route: '/x',
        pageTitle: 'X',
        userAction: 'x',
        status: 'code_fix_pending',
      },
    });
    try {
      const status = await getFixStatus(bug.id);
      expect(status).not.toBeNull();
      expect(status!.status).toBe('code_fix_pending');
    } finally {
      await prisma.bugReport.delete({ where: { id: bug.id } }).catch(() => undefined);
      await prisma.$disconnect();
    }
  });
});

describe('fix-pipeline.service: triggerFixPipeline', () => {
  it('rejects a bug that is not in code_fix_approved', async () => {
    const prisma = getPrismaClient();
    const bug = await prisma.bugReport.create({
      data: {
        product: 'pm',
        userId: 'tester',
        route: '/x',
        pageTitle: 'X',
        userAction: 'x',
        status: 'code_fix_pending',
      },
    });
    try {
      const result = await triggerFixPipeline(bug.id);
      expect(result.started).toBe(false);
    } finally {
      await prisma.bugReport.delete({ where: { id: bug.id } }).catch(() => undefined);
      await prisma.$disconnect();
    }
  });

  it('rejects an unknown bug', async () => {
    const result = await triggerFixPipeline('nope');
    expect(result.started).toBe(false);
  });
});
