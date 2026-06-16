/**
 * Tests for schedule what-if analysis. These tests:
 *   1. Build a 3-activity network in memory (no DB persistence)
 *   2. Run a what-if
 *   3. Verify the in-memory CPM produces expected results
 *   4. Verify NO database writes happen (we mock prisma and assert no
 *      update/create calls are made)
 */

import { runWhatIf } from './schedule-whatif.service';
import { getPrismaClient } from '../lib/prisma';

jest.mock('../lib/prisma', () => {
  const mockProject = {
    findUnique: jest.fn(),
  };
  const mockScheduleActivity = {
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  return {
    getPrismaClient: () => ({
      project: mockProject,
      scheduleActivity: mockScheduleActivity,
    }),
  };
});

const prisma = getPrismaClient() as any;

const projectStart = new Date('2026-01-05T00:00:00.000Z'); // a Monday

function makeNode(overrides: any) {
  return {
    id: 'a1',
    name: 'Activity 1',
    startDate: projectStart,
    endDate: new Date(projectStart.getTime() + 5 * 86400000),
    duration: 5,
    predecessors: [],
    successors: [],
    ...overrides,
  };
}

describe('runWhatIf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('input validation', () => {
    it('rejects delayDays out of range', async () => {
      await expect(
        runWhatIf('p1', { activityId: 'a1', delayDays: 0, delayType: 'start_delay' })
      ).rejects.toThrow(/between 1 and 365/);
      await expect(
        runWhatIf('p1', { activityId: 'a1', delayDays: 400, delayType: 'start_delay' })
      ).rejects.toThrow(/between 1 and 365/);
    });

    it('rejects invalid delayType', async () => {
      await expect(
        runWhatIf('p1', { activityId: 'a1', delayDays: 5, delayType: 'oops' as any })
      ).rejects.toThrow(/start_delay or duration_extension/);
    });
  });

  describe('CPM impact', () => {
    it('1-day delay on the only critical activity shifts completion by 1 day', async () => {
      // Linear chain: A (5d) -> B (5d) -> C (5d), total 15 working days
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', startDate: projectStart, name: 'Test' });
      prisma.scheduleActivity.findMany.mockResolvedValue([
        { id: 'a', name: 'A', startDate: projectStart, endDate: new Date(projectStart.getTime() + 5 * 86400000), duration: 5, predecessors: [], successors: [{ activityId: 'b', type: 'FS', lag: 0 }] },
        { id: 'b', name: 'B', startDate: new Date(projectStart.getTime() + 5 * 86400000), endDate: new Date(projectStart.getTime() + 10 * 86400000), duration: 5, predecessors: [{ activityId: 'a', type: 'FS', lag: 0 }], successors: [{ activityId: 'c', type: 'FS', lag: 0 }] },
        { id: 'c', name: 'C', startDate: new Date(projectStart.getTime() + 10 * 86400000), endDate: new Date(projectStart.getTime() + 15 * 86400000), duration: 5, predecessors: [{ activityId: 'b', type: 'FS', lag: 0 }], successors: [] },
      ]);

      const result = await runWhatIf('p1', { activityId: 'b', delayDays: 1, delayType: 'start_delay' });

      // Total duration goes from 15 to 16; expect 1-day impact
      expect(result.days_impact).toBe(1);
      expect(result.ld_exposure_days).toBe(1);
      // Completion moved forward
      expect(new Date(result.new_completion).getTime()).toBeGreaterThan(
        new Date(result.original_completion).getTime()
      );
    });

    it('1-day delay on a non-critical activity with float has no completion impact', async () => {
      // Two parallel chains: main (A->B, 5+5=10) and float (X->Y, 3+3=6 with float of 4)
      // Adding 1 day to X (float=4) should NOT shift completion
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', startDate: projectStart, name: 'Test' });
      prisma.scheduleActivity.findMany.mockResolvedValue([
        { id: 'a', name: 'A', startDate: projectStart, endDate: new Date(projectStart.getTime() + 5 * 86400000), duration: 5, predecessors: [], successors: [{ activityId: 'b', type: 'FS', lag: 0 }] },
        { id: 'b', name: 'B', startDate: new Date(projectStart.getTime() + 5 * 86400000), endDate: new Date(projectStart.getTime() + 10 * 86400000), duration: 5, predecessors: [{ activityId: 'a', type: 'FS', lag: 0 }], successors: [] },
        { id: 'x', name: 'X', startDate: projectStart, endDate: new Date(projectStart.getTime() + 3 * 86400000), duration: 3, predecessors: [], successors: [{ activityId: 'y', type: 'FS', lag: 0 }] },
        { id: 'y', name: 'Y', startDate: new Date(projectStart.getTime() + 3 * 86400000), endDate: new Date(projectStart.getTime() + 6 * 86400000), duration: 3, predecessors: [{ activityId: 'x', type: 'FS', lag: 0 }], successors: [] },
      ]);

      const result = await runWhatIf('p1', { activityId: 'x', delayDays: 1, delayType: 'start_delay' });

      // X has float of 4 (chain is 6 days, main is 10), so 1 day delay is absorbed
      expect(result.days_impact).toBe(0);
      expect(result.ld_exposure_days).toBe(0);
      expect(result.summary).toMatch(/no impact/i);
    });

    it('delay that exceeds float creates a new critical path', async () => {
      // Same parallel setup, but now add 5 days to X — exceeds its 4-day float
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', startDate: projectStart, name: 'Test' });
      prisma.scheduleActivity.findMany.mockResolvedValue([
        { id: 'a', name: 'A', startDate: projectStart, endDate: new Date(projectStart.getTime() + 5 * 86400000), duration: 5, predecessors: [], successors: [{ activityId: 'b', type: 'FS', lag: 0 }] },
        { id: 'b', name: 'B', startDate: new Date(projectStart.getTime() + 5 * 86400000), endDate: new Date(projectStart.getTime() + 10 * 86400000), duration: 5, predecessors: [{ activityId: 'a', type: 'FS', lag: 0 }], successors: [] },
        { id: 'x', name: 'X', startDate: projectStart, endDate: new Date(projectStart.getTime() + 3 * 86400000), duration: 3, predecessors: [], successors: [{ activityId: 'y', type: 'FS', lag: 0 }] },
        { id: 'y', name: 'Y', startDate: new Date(projectStart.getTime() + 3 * 86400000), endDate: new Date(projectStart.getTime() + 6 * 86400000), duration: 3, predecessors: [{ activityId: 'x', type: 'FS', lag: 0 }], successors: [] },
      ]);

      const result = await runWhatIf('p1', { activityId: 'x', delayDays: 5, delayType: 'start_delay' });

      // X chain goes from 6 to 11 days, exceeding the main chain (10), so
      // X and Y are now on the critical path
      expect(result.days_impact).toBe(1); // 11 - 10 = 1
      expect(result.critical_path_changed).toBe(true);
      const newCritNames = result.newly_critical_activities.map((a) => a.name);
      expect(newCritNames).toContain('X');
      expect(newCritNames).toContain('Y');
    });

    it('NEVER writes to the database (no update, no create, no delete)', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', startDate: projectStart, name: 'Test' });
      prisma.scheduleActivity.findMany.mockResolvedValue([
        { id: 'a', name: 'A', startDate: projectStart, endDate: new Date(projectStart.getTime() + 5 * 86400000), duration: 5, predecessors: [], successors: [] },
      ]);

      await runWhatIf('p1', { activityId: 'a', delayDays: 1, delayType: 'start_delay' });

      expect(prisma.scheduleActivity.update).not.toHaveBeenCalled();
      expect(prisma.scheduleActivity.create).not.toHaveBeenCalled();
      expect(prisma.scheduleActivity.delete).not.toHaveBeenCalled();
    });

    it('summary field is plain English derived from the numbers', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', startDate: projectStart, name: 'Test' });
      prisma.scheduleActivity.findMany.mockResolvedValue([
        { id: 'a', name: 'Battery Rack Installation', startDate: projectStart, endDate: new Date(projectStart.getTime() + 5 * 86400000), duration: 5, predecessors: [], successors: [] },
      ]);

      const result = await runWhatIf('p1', { activityId: 'a', delayDays: 14, delayType: 'duration_extension' });

      expect(result.summary).toContain('Battery Rack Installation');
      expect(result.summary).toContain('14');
      // Should reference a date change or LD exposure
      expect(result.summary).toMatch(/completion|LD exposure|shifts/i);
    });

    it('start_delay and duration_extension produce the same shift in a pure-FS network', async () => {
      // Linear A -> B (FS, no lag). The activity is critical.
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', startDate: projectStart, name: 'Test' });
      prisma.scheduleActivity.findMany.mockResolvedValue([
        { id: 'a', name: 'A', startDate: projectStart, endDate: new Date(projectStart.getTime() + 5 * 86400000), duration: 5, predecessors: [], successors: [{ activityId: 'b', type: 'FS', lag: 0 }] },
        { id: 'b', name: 'B', startDate: new Date(projectStart.getTime() + 5 * 86400000), endDate: new Date(projectStart.getTime() + 10 * 86400000), duration: 5, predecessors: [{ activityId: 'a', type: 'FS', lag: 0 }], successors: [] },
      ]);

      const startDelay = await runWhatIf('p1', { activityId: 'a', delayDays: 3, delayType: 'start_delay' });
      const durationExt = await runWhatIf('p1', { activityId: 'a', delayDays: 3, delayType: 'duration_extension' });

      // Both produce 3-day project impact
      expect(startDelay.days_impact).toBe(3);
      expect(durationExt.days_impact).toBe(3);
    });
  });

  describe('error handling', () => {
    it('throws when project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(
        runWhatIf('p1', { activityId: 'a', delayDays: 1, delayType: 'start_delay' })
      ).rejects.toThrow(/Project not found/);
    });

    it('throws when project has no start date', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', startDate: null, name: 'Test' });
      await expect(
        runWhatIf('p1', { activityId: 'a', delayDays: 1, delayType: 'start_delay' })
      ).rejects.toThrow(/start date/);
    });

    it('throws when activity not found in project', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', startDate: projectStart, name: 'Test' });
      prisma.scheduleActivity.findMany.mockResolvedValue([
        { id: 'a', name: 'A', startDate: projectStart, endDate: new Date(), duration: 5, predecessors: [], successors: [] },
      ]);
      await expect(
        runWhatIf('p1', { activityId: 'zzz', delayDays: 1, delayType: 'start_delay' })
      ).rejects.toThrow(/Activity not found/);
    });

    it('throws when project has no activities', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', startDate: projectStart, name: 'Test' });
      prisma.scheduleActivity.findMany.mockResolvedValue([]);
      await expect(
        runWhatIf('p1', { activityId: 'a', delayDays: 1, delayType: 'start_delay' })
      ).rejects.toThrow(/no activities/);
    });
  });
});
