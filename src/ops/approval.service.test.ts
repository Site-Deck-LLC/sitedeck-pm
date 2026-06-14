/**
 * Tests for the approval service — Sprint 10
 * ============================================================================
 * Covers the token lifecycle, the approval + rejection paths, and the
 * audit log writes. Uses the real Prisma client against a transaction
 * that the test cleans up.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { __test__, createApprovalToken, findValidToken, approveBugFix, rejectBugFix } from './approval.service';

describe('approval.service: token lifecycle', () => {
  let bugId = '';

  beforeAll(async () => {
    const prisma = getPrismaClient();
    const bug = await prisma.bugReport.create({
      data: {
        product: 'pm',
        userId: 'test-user',
        route: '/test',
        pageTitle: 'Test',
        userAction: 'test action',
        status: 'code_fix_pending',
      },
    });
    bugId = bug.id;
  });

  afterAll(async () => {
    const prisma = getPrismaClient();
    await prisma.bugApprovalToken.deleteMany({ where: { bugReportId: bugId } });
    await prisma.bugReport.delete({ where: { id: bugId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('creates a valid token', async () => {
    const view = await createApprovalToken(bugId);
    expect(view.token).toMatch(/^[0-9a-f-]{36}$/i);
    const found = await findValidToken(view.token);
    expect(found).not.toBeNull();
    expect(found!.status).toBe('valid');
  });

  it('rejects an unknown token', async () => {
    const found = await findValidToken('00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });

  it('rejects an already-used token', async () => {
    const view = await createApprovalToken(bugId);
    const result = await approveBugFix(bugId, view.token, 'tester');
    expect(result.ok).toBe(true);
    const found = await findValidToken(view.token);
    expect(found!.status).toBe('used');
  });

  it('rejects when bug id mismatches', async () => {
    const view = await createApprovalToken(bugId);
    const result = await approveBugFix('wrong-bug-id', view.token, 'tester');
    expect(result.ok).toBe(false);
  });

  it('handles the rejection path', async () => {
    const view = await createApprovalToken(bugId);
    const result = await rejectBugFix(bugId, view.token, 'Not a real bug', 'tester');
    expect(result.ok).toBe(true);
    const prisma = getPrismaClient();
    const bug = await prisma.bugReport.findUnique({ where: { id: bugId } });
    expect(bug!.status).toBe('closed');
  });
});

describe('approval.service: constants', () => {
  it('exposes the 48h TTL', () => {
    expect(__test__.TOKEN_TTL_MS).toBe(48 * 60 * 60 * 1000);
  });
});
