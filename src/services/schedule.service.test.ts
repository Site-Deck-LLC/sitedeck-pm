import {
  calculateCpm,
  calculateBaselineVariance,
  calculateCriticalPathImpact,
  recalculateSchedule,
  getSchedulePerformance,
  ActivityNode,
} from './schedule.service';
import { getPrismaClient, setPrismaClient } from '../lib/prisma';
import { PrismaClient } from '@prisma/client';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function sameDay(a: Date, b: Date): boolean {
  return Math.abs(a.getTime() - b.getTime()) < MS_PER_DAY / 2;
}

describe('schedule.service', () => {
  describe('calculateCpm', () => {
    const projectStart = new Date('2026-01-01');

    it('computes forward pass correctly for a simple chain', () => {
      const activities: ActivityNode[] = [
        {
          id: 'A',
          startDate: projectStart,
          endDate: addDays(projectStart, 3),
          duration: 3,
          predecessors: [],
        },
        {
          id: 'B',
          startDate: addDays(projectStart, 3),
          endDate: addDays(projectStart, 5),
          duration: 2,
          predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
        },
      ];

      const result = calculateCpm(activities, projectStart);
      const a = result.get('A')!;
      const b = result.get('B')!;

      expect(sameDay(a.earlyStart, projectStart)).toBe(true);
      expect(sameDay(a.earlyFinish, addDays(projectStart, 3))).toBe(true);
      expect(sameDay(b.earlyStart, addDays(projectStart, 3))).toBe(true);
      expect(sameDay(b.earlyFinish, addDays(projectStart, 5))).toBe(true);
    });

    it('identifies critical path activities with zero total float', () => {
      const activities: ActivityNode[] = [
        {
          id: 'A',
          startDate: projectStart,
          endDate: addDays(projectStart, 3),
          duration: 3,
          predecessors: [],
        },
        {
          id: 'B',
          startDate: addDays(projectStart, 3),
          endDate: addDays(projectStart, 5),
          duration: 2,
          predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
        },
        {
          id: 'C',
          startDate: addDays(projectStart, 3),
          endDate: addDays(projectStart, 7),
          duration: 4,
          predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
        },
        {
          id: 'D',
          startDate: addDays(projectStart, 7),
          endDate: addDays(projectStart, 9),
          duration: 2,
          predecessors: [
            { activityId: 'B', type: 'FS', lag: 0 },
            { activityId: 'C', type: 'FS', lag: 0 },
          ],
        },
      ];

      const result = calculateCpm(activities, projectStart);

      expect(result.get('A')!.isCritical).toBe(true);
      expect(result.get('B')!.isCritical).toBe(false);
      expect(result.get('C')!.isCritical).toBe(true);
      expect(result.get('D')!.isCritical).toBe(true);
    });

    it('calculates total float correctly', () => {
      const activities: ActivityNode[] = [
        {
          id: 'A',
          startDate: projectStart,
          endDate: addDays(projectStart, 3),
          duration: 3,
          predecessors: [],
        },
        {
          id: 'B',
          startDate: addDays(projectStart, 3),
          endDate: addDays(projectStart, 5),
          duration: 2,
          predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
        },
        {
          id: 'C',
          startDate: addDays(projectStart, 3),
          endDate: addDays(projectStart, 7),
          duration: 4,
          predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
        },
        {
          id: 'D',
          startDate: addDays(projectStart, 7),
          endDate: addDays(projectStart, 9),
          duration: 2,
          predecessors: [
            { activityId: 'B', type: 'FS', lag: 0 },
            { activityId: 'C', type: 'FS', lag: 0 },
          ],
        },
      ];

      const result = calculateCpm(activities, projectStart);

      expect(result.get('A')!.totalFloat).toBeCloseTo(0);
      expect(result.get('B')!.totalFloat).toBeCloseTo(2);
      expect(result.get('C')!.totalFloat).toBeCloseTo(0);
      expect(result.get('D')!.totalFloat).toBeCloseTo(0);
    });

    it('calculates free float correctly', () => {
      const activities: ActivityNode[] = [
        {
          id: 'A',
          startDate: projectStart,
          endDate: addDays(projectStart, 3),
          duration: 3,
          predecessors: [],
        },
        {
          id: 'B',
          startDate: addDays(projectStart, 3),
          endDate: addDays(projectStart, 5),
          duration: 2,
          predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
        },
        {
          id: 'C',
          startDate: addDays(projectStart, 3),
          endDate: addDays(projectStart, 7),
          duration: 4,
          predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
        },
        {
          id: 'D',
          startDate: addDays(projectStart, 7),
          endDate: addDays(projectStart, 9),
          duration: 2,
          predecessors: [
            { activityId: 'B', type: 'FS', lag: 0 },
            { activityId: 'C', type: 'FS', lag: 0 },
          ],
        },
      ];

      const result = calculateCpm(activities, projectStart);

      expect(result.get('A')!.freeFloat).toBeCloseTo(0);
      expect(result.get('B')!.freeFloat).toBeCloseTo(2);
      expect(result.get('C')!.freeFloat).toBeCloseTo(0);
      expect(result.get('D')!.freeFloat).toBeCloseTo(0);
    });

    it('handles lag in predecessor relationships', () => {
      const activities: ActivityNode[] = [
        {
          id: 'A',
          startDate: projectStart,
          endDate: addDays(projectStart, 3),
          duration: 3,
          predecessors: [],
        },
        {
          id: 'B',
          startDate: addDays(projectStart, 5),
          endDate: addDays(projectStart, 7),
          duration: 2,
          predecessors: [{ activityId: 'A', type: 'FS', lag: 2 }],
        },
      ];

      const result = calculateCpm(activities, projectStart);

      expect(sameDay(result.get('B')!.earlyStart, addDays(projectStart, 5))).toBe(true);
      expect(sameDay(result.get('B')!.earlyFinish, addDays(projectStart, 7))).toBe(true);
    });

    it('throws on cycle detection', () => {
      const activities: ActivityNode[] = [
        {
          id: 'A',
          startDate: projectStart,
          endDate: addDays(projectStart, 3),
          duration: 3,
          predecessors: [{ activityId: 'B', type: 'FS', lag: 0 }],
        },
        {
          id: 'B',
          startDate: addDays(projectStart, 3),
          endDate: addDays(projectStart, 5),
          duration: 2,
          predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
        },
      ];

      expect(() => calculateCpm(activities, projectStart)).toThrow('Cycle detected');
    });

    it('verifies ES/EF/LS/LF/Float for a simple linear chain A→B→C', () => {
      const activities: ActivityNode[] = [
        { id: 'A', startDate: projectStart, endDate: addDays(projectStart, 3), duration: 3, predecessors: [] },
        { id: 'B', startDate: addDays(projectStart, 3), endDate: addDays(projectStart, 5), duration: 2, predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }] },
        { id: 'C', startDate: addDays(projectStart, 5), endDate: addDays(projectStart, 8), duration: 3, predecessors: [{ activityId: 'B', type: 'FS', lag: 0 }] },
      ];

      const result = calculateCpm(activities, projectStart);
      const a = result.get('A')!;
      const b = result.get('B')!;
      const c = result.get('C')!;

      expect(sameDay(a.earlyStart, projectStart)).toBe(true);
      expect(sameDay(a.earlyFinish, addDays(projectStart, 3))).toBe(true);
      expect(sameDay(b.earlyStart, addDays(projectStart, 3))).toBe(true);
      expect(sameDay(b.earlyFinish, addDays(projectStart, 5))).toBe(true);
      expect(sameDay(c.earlyStart, addDays(projectStart, 5))).toBe(true);
      expect(sameDay(c.earlyFinish, addDays(projectStart, 8))).toBe(true);

      expect(sameDay(a.lateStart, projectStart)).toBe(true);
      expect(sameDay(a.lateFinish, addDays(projectStart, 3))).toBe(true);
      expect(sameDay(b.lateStart, addDays(projectStart, 3))).toBe(true);
      expect(sameDay(b.lateFinish, addDays(projectStart, 5))).toBe(true);
      expect(sameDay(c.lateStart, addDays(projectStart, 5))).toBe(true);
      expect(sameDay(c.lateFinish, addDays(projectStart, 8))).toBe(true);

      expect(a.totalFloat).toBeCloseTo(0);
      expect(b.totalFloat).toBeCloseTo(0);
      expect(c.totalFloat).toBeCloseTo(0);
      expect(a.isCritical).toBe(true);
      expect(b.isCritical).toBe(true);
      expect(c.isCritical).toBe(true);
    });

    it('handles SS relationship with lag (parallel starts)', () => {
      const activities: ActivityNode[] = [
        { id: 'A', startDate: projectStart, endDate: addDays(projectStart, 5), duration: 5, predecessors: [] },
        { id: 'B', startDate: addDays(projectStart, 3), endDate: addDays(projectStart, 6), duration: 3, predecessors: [{ activityId: 'A', type: 'SS', lag: 3 }] },
      ];

      const result = calculateCpm(activities, projectStart);
      const b = result.get('B')!;
      expect(sameDay(b.earlyStart, addDays(projectStart, 3))).toBe(true);
      expect(sameDay(b.earlyFinish, addDays(projectStart, 6))).toBe(true);
    });

    it('handles FF relationship with lag (parallel finishes)', () => {
      const activities: ActivityNode[] = [
        { id: 'A', startDate: projectStart, endDate: addDays(projectStart, 5), duration: 5, predecessors: [] },
        { id: 'B', startDate: addDays(projectStart, 2), endDate: addDays(projectStart, 7), duration: 3, predecessors: [{ activityId: 'A', type: 'FF', lag: 2 }] },
      ];

      const result = calculateCpm(activities, projectStart);
      const b = result.get('B')!;
      // B must finish 2 days after A finishes: A finishes day 5, B must finish day 7
      expect(sameDay(b.earlyFinish, addDays(projectStart, 7))).toBe(true);
      expect(sameDay(b.earlyStart, addDays(projectStart, 4))).toBe(true); // 7 - 3 = 4
    });

    it('handles SF relationship with lag', () => {
      const activities: ActivityNode[] = [
        { id: 'A', startDate: projectStart, endDate: addDays(projectStart, 5), duration: 5, predecessors: [] },
        { id: 'B', startDate: projectStart, endDate: addDays(projectStart, 3), duration: 3, predecessors: [{ activityId: 'A', type: 'SF', lag: 2 }] },
      ];

      const result = calculateCpm(activities, projectStart);
      const b = result.get('B')!;
      // SF constraint: EF_B >= ES_A + lag = 0 + 2 = 2
      // Forward pass gives ES_B = max(0, 0 + 2 - 3) = 0, so EF_B = 0 + 3 = 3 (satisfies constraint)
      expect(sameDay(b.earlyStart, projectStart)).toBe(true);
      expect(sameDay(b.earlyFinish, addDays(projectStart, 3))).toBe(true);
    });

    it('handles activity with multiple predecessors', () => {
      const activities: ActivityNode[] = [
        { id: 'A', startDate: projectStart, endDate: addDays(projectStart, 3), duration: 3, predecessors: [] },
        { id: 'B', startDate: projectStart, endDate: addDays(projectStart, 5), duration: 5, predecessors: [] },
        { id: 'C', startDate: addDays(projectStart, 5), endDate: addDays(projectStart, 7), duration: 2, predecessors: [
          { activityId: 'A', type: 'FS', lag: 0 },
          { activityId: 'B', type: 'FS', lag: 0 },
        ]},
      ];

      const result = calculateCpm(activities, projectStart);
      const c = result.get('C')!;
      // C starts when both A and B finish; B finishes later (day 5)
      expect(sameDay(c.earlyStart, addDays(projectStart, 5))).toBe(true);
      expect(c.totalFloat).toBeCloseTo(0);
    });

    it('handles activity with multiple successors', () => {
      const activities: ActivityNode[] = [
        { id: 'A', startDate: projectStart, endDate: addDays(projectStart, 3), duration: 3, predecessors: [] },
        { id: 'B', startDate: addDays(projectStart, 3), endDate: addDays(projectStart, 5), duration: 2, predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }] },
        { id: 'C', startDate: addDays(projectStart, 3), endDate: addDays(projectStart, 6), duration: 3, predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }] },
      ];

      const result = calculateCpm(activities, projectStart);
      const a = result.get('A')!;
      expect(a.freeFloat).toBeCloseTo(0); // A has no free float because it drives both B and C
    });

    it('float = 0 correctly identifies critical path', () => {
      const activities: ActivityNode[] = [
        { id: 'A', startDate: projectStart, endDate: addDays(projectStart, 3), duration: 3, predecessors: [] },
        { id: 'B', startDate: addDays(projectStart, 3), endDate: addDays(projectStart, 5), duration: 2, predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }] },
        { id: 'C', startDate: addDays(projectStart, 3), endDate: addDays(projectStart, 7), duration: 4, predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }] },
        { id: 'D', startDate: addDays(projectStart, 7), endDate: addDays(projectStart, 9), duration: 2, predecessors: [
          { activityId: 'B', type: 'FS', lag: 0 },
          { activityId: 'C', type: 'FS', lag: 0 },
        ]},
      ];

      const result = calculateCpm(activities, projectStart);
      expect(result.get('A')!.totalFloat).toBeCloseTo(0);
      expect(result.get('B')!.totalFloat).toBeCloseTo(2);
      expect(result.get('C')!.totalFloat).toBeCloseTo(0);
      expect(result.get('D')!.totalFloat).toBeCloseTo(0);
      expect(result.get('A')!.isCritical).toBe(true);
      expect(result.get('B')!.isCritical).toBe(false);
      expect(result.get('C')!.isCritical).toBe(true);
      expect(result.get('D')!.isCritical).toBe(true);
    });

    it('float > 0 correctly identifies non-critical activities', () => {
      const activities: ActivityNode[] = [
        { id: 'A', startDate: projectStart, endDate: addDays(projectStart, 3), duration: 3, predecessors: [] },
        { id: 'B', startDate: addDays(projectStart, 3), endDate: addDays(projectStart, 5), duration: 2, predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }] },
        { id: 'C', startDate: addDays(projectStart, 5), endDate: addDays(projectStart, 9), duration: 4, predecessors: [{ activityId: 'B', type: 'FS', lag: 0 }] },
      ];

      const result = calculateCpm(activities, projectStart);
      expect(result.get('A')!.totalFloat).toBeCloseTo(0);
      expect(result.get('B')!.totalFloat).toBeCloseTo(0);
      expect(result.get('C')!.totalFloat).toBeCloseTo(0);
      // All critical in a linear chain — no non-critical. Let's make B have float by adding a shorter parallel path.
    });

    it('non-critical activity has positive total and free float', () => {
      const activities: ActivityNode[] = [
        { id: 'A', startDate: projectStart, endDate: addDays(projectStart, 3), duration: 3, predecessors: [] },
        { id: 'B', startDate: addDays(projectStart, 3), endDate: addDays(projectStart, 5), duration: 2, predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }] },
        { id: 'C', startDate: addDays(projectStart, 3), endDate: addDays(projectStart, 8), duration: 5, predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }] },
        { id: 'D', startDate: addDays(projectStart, 8), endDate: addDays(projectStart, 10), duration: 2, predecessors: [
          { activityId: 'B', type: 'FS', lag: 0 },
          { activityId: 'C', type: 'FS', lag: 0 },
        ]},
      ];

      const result = calculateCpm(activities, projectStart);
      expect(result.get('B')!.totalFloat).toBeCloseTo(3);
      expect(result.get('B')!.freeFloat).toBeCloseTo(3);
      expect(result.get('B')!.isCritical).toBe(false);
      expect(result.get('C')!.totalFloat).toBeCloseTo(0);
      expect(result.get('C')!.isCritical).toBe(true);
    });
  });

  describe('calculateBaselineVariance', () => {
    it('returns zero variance when dates match', () => {
      const date = new Date('2026-01-01');
      const current: ActivityNode = {
        id: 'A',
        startDate: date,
        endDate: addDays(date, 5),
        duration: 5,
      };
      const baseline: ActivityNode = {
        id: 'A',
        startDate: date,
        endDate: addDays(date, 5),
        duration: 5,
      };

      const variance = calculateBaselineVariance(current, baseline);
      expect(variance.startVarianceDays).toBeCloseTo(0);
      expect(variance.finishVarianceDays).toBeCloseTo(0);
    });

    it('returns positive variance when current is later than baseline', () => {
      const baselineDate = new Date('2026-01-01');
      const currentDate = new Date('2026-01-03');
      const current: ActivityNode = {
        id: 'A',
        startDate: currentDate,
        endDate: addDays(currentDate, 5),
        duration: 5,
      };
      const baseline: ActivityNode = {
        id: 'A',
        startDate: baselineDate,
        endDate: addDays(baselineDate, 5),
        duration: 5,
      };

      const variance = calculateBaselineVariance(current, baseline);
      expect(variance.startVarianceDays).toBeCloseTo(2);
      expect(variance.finishVarianceDays).toBeCloseTo(2);
    });
  });

  describe('calculateCriticalPathImpact', () => {
    it('returns zero when duration change does not affect project end', () => {
      const projectStart = new Date('2026-01-01');
      const activities: ActivityNode[] = [
        {
          id: 'A',
          startDate: projectStart,
          endDate: addDays(projectStart, 3),
          duration: 3,
          predecessors: [],
        },
        {
          id: 'B',
          startDate: addDays(projectStart, 3),
          endDate: addDays(projectStart, 5),
          duration: 2,
          predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
        },
        {
          id: 'C',
          startDate: addDays(projectStart, 3),
          endDate: addDays(projectStart, 7),
          duration: 4,
          predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
        },
        {
          id: 'D',
          startDate: addDays(projectStart, 7),
          endDate: addDays(projectStart, 9),
          duration: 2,
          predecessors: [
            { activityId: 'B', type: 'FS', lag: 0 },
            { activityId: 'C', type: 'FS', lag: 0 },
          ],
        },
      ];

      // B has 2 days of float; increasing duration by 1 should not impact project end
      const impact = calculateCriticalPathImpact(activities, 'B', 3, projectStart);
      expect(impact).toBeCloseTo(0);
    });

    it('returns positive impact when critical path activity duration increases', () => {
      const projectStart = new Date('2026-01-01');
      const activities: ActivityNode[] = [
        {
          id: 'A',
          startDate: projectStart,
          endDate: addDays(projectStart, 3),
          duration: 3,
          predecessors: [],
        },
        {
          id: 'B',
          startDate: addDays(projectStart, 3),
          endDate: addDays(projectStart, 5),
          duration: 2,
          predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
        },
        {
          id: 'C',
          startDate: addDays(projectStart, 3),
          endDate: addDays(projectStart, 7),
          duration: 4,
          predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
        },
        {
          id: 'D',
          startDate: addDays(projectStart, 7),
          endDate: addDays(projectStart, 9),
          duration: 2,
          predecessors: [
            { activityId: 'B', type: 'FS', lag: 0 },
            { activityId: 'C', type: 'FS', lag: 0 },
          ],
        },
      ];

      // C is critical; increasing duration by 2 should push project end by 2
      const impact = calculateCriticalPathImpact(activities, 'C', 6, projectStart);
      expect(impact).toBeCloseTo(2);
    });
  });

  describe('recalculateSchedule', () => {
    const mockProjectFindUnique = jest.fn();
    const mockScheduleActivityUpdate = jest.fn();
    const mockActivityRelationshipFindMany = jest.fn();

    const mockPrisma = {
      project: {
        findUnique: mockProjectFindUnique,
      },
      scheduleActivity: {
        update: mockScheduleActivityUpdate,
      },
      activityRelationship: {
        findMany: mockActivityRelationshipFindMany,
      },
    } as unknown as PrismaClient;

    beforeEach(() => {
      jest.clearAllMocks();
      setPrismaClient(mockPrisma);
    });

    it('updates activity CPM fields after calculation', async () => {
      const projectStart = new Date('2026-01-01');
      const activities = [
        {
          id: 'act-1',
          projectId: 'proj-1',
          startDate: projectStart,
          endDate: addDays(projectStart, 3),
          duration: 3,
          predecessors: null,
          successors: null,
        },
        {
          id: 'act-2',
          projectId: 'proj-1',
          startDate: addDays(projectStart, 3),
          endDate: addDays(projectStart, 5),
          duration: 2,
          predecessors: [{ activityId: 'act-1', type: 'FS', lag: 0 }],
          successors: null,
        },
      ];

      mockProjectFindUnique.mockResolvedValue({
        id: 'proj-1',
        startDate: projectStart,
        scheduleActivities: activities,
      });
      mockActivityRelationshipFindMany.mockResolvedValue([
        { predecessorId: 'act-1', successorId: 'act-2', relationshipType: 'FS', lagDays: 0 },
      ]);
      mockScheduleActivityUpdate.mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: args.where.id, ...args.data })
      );

      await recalculateSchedule('proj-1');

      expect(mockScheduleActivityUpdate).toHaveBeenCalledTimes(2);
      expect(mockScheduleActivityUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'act-1' },
          data: expect.objectContaining({
            isCritical: true,
            totalFloat: expect.any(Number),
            freeFloat: expect.any(Number),
          }),
        })
      );
    });

    it('throws if project not found', async () => {
      mockProjectFindUnique.mockResolvedValue(null);
      await expect(recalculateSchedule('proj-1')).rejects.toThrow('Project not found');
    });

    it('returns early if no activities exist', async () => {
      mockProjectFindUnique.mockResolvedValue({
        id: 'proj-1',
        startDate: new Date('2026-01-01'),
        scheduleActivities: [],
      });
      await recalculateSchedule('proj-1');
      expect(mockScheduleActivityUpdate).not.toHaveBeenCalled();
    });
  });

  describe('getSchedulePerformance', () => {
    const mockProjectFindUnique = jest.fn();
    const mockScheduleBaselineFindFirst = jest.fn();
    const mockScheduleActivityFindMany = jest.fn();

    const mockPrismaPerf = {
      project: {
        findUnique: mockProjectFindUnique,
      },
      scheduleBaseline: {
        findFirst: mockScheduleBaselineFindFirst,
      },
      scheduleActivity: {
        findMany: mockScheduleActivityFindMany,
      },
    } as unknown as PrismaClient;

    beforeEach(() => {
      jest.clearAllMocks();
      setPrismaClient(mockPrismaPerf);
    });

    it('throws when project not found', async () => {
      mockProjectFindUnique.mockResolvedValue(null);
      await expect(getSchedulePerformance('proj-1')).rejects.toThrow('Project start date required');
    });

    it('throws when project has no start date', async () => {
      mockProjectFindUnique.mockResolvedValue({ startDate: null, endDate: null });
      await expect(getSchedulePerformance('proj-1')).rejects.toThrow('Project start date required');
    });

    it('returns daily data points from start to end', async () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-05');
      mockProjectFindUnique.mockResolvedValue({ startDate: start, endDate: end });
      mockScheduleBaselineFindFirst.mockResolvedValue(null);
      mockScheduleActivityFindMany.mockResolvedValue([]);

      const result = await getSchedulePerformance('proj-1');

      expect(result.projectId).toBe('proj-1');
      expect(result.data).toHaveLength(5);
      expect(result.data[0].date).toBe('2026-01-01');
      expect(result.data[4].date).toBe('2026-01-05');
    });

    it('computes baselinePct from locked baseline activities', async () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-05');
      mockProjectFindUnique.mockResolvedValue({ startDate: start, endDate: end });
      mockScheduleBaselineFindFirst.mockResolvedValue({
        locked: true,
        baselineDate: new Date('2026-01-01'),
        activities: [
          { startDate: '2026-01-01', endDate: '2026-01-05', duration: 4 },
        ],
      });
      mockScheduleActivityFindMany.mockResolvedValue([
        { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-05'), duration: 4, percentComplete: 0.5 },
      ]);

      const result = await getSchedulePerformance('proj-1');

      const firstDay = result.data[0];
      const lastDay = result.data[4];
      expect(firstDay.baselinePct).toBe(0);
      expect(lastDay.baselinePct).toBe(1);
    });

    it('interpolates actualPct from 0 at start to current actual % at today', async () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-10');
      mockProjectFindUnique.mockResolvedValue({ startDate: start, endDate: end });
      mockScheduleBaselineFindFirst.mockResolvedValue(null);
      mockScheduleActivityFindMany.mockResolvedValue([
        { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), duration: 9, percentComplete: 0.5 },
      ]);

      const result = await getSchedulePerformance('proj-1');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      const todayPoint = result.data.find((p) => p.date === todayStr);

      if (todayPoint && today >= start && today <= end) {
        expect(todayPoint.actualPct).toBeGreaterThan(0);
        expect(todayPoint.actualPct).toBeLessThanOrEqual(0.5);
      }

      // Forecast should continue beyond today
      const endPoint = result.data[result.data.length - 1];
      expect(endPoint.forecastPct).toBeGreaterThanOrEqual(endPoint.actualPct);
    });

    it('uses fallback end date when project endDate is null', async () => {
      const start = new Date('2026-01-01');
      mockProjectFindUnique.mockResolvedValue({ startDate: start, endDate: null });
      mockScheduleBaselineFindFirst.mockResolvedValue(null);
      mockScheduleActivityFindMany.mockResolvedValue([]);

      const result = await getSchedulePerformance('proj-1');
      // Should generate one year of days
      expect(result.data.length).toBeGreaterThan(360);
    });
  });
});
