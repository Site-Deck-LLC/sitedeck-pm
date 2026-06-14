/**
 * Tests for the lessons-learned service.
 * - createLesson: all fields saved correctly
 * - flagForTemplate: addedToTemplate = true
 * - getLessons: filtering by category, source, addedToTemplate
 * - getLessonsByCategory: groups correctly, empty categories included
 * - Pattern detection:
 *     - Recurring schedule delay: 3+ same reason_code → flag
 *     - Overdue RFI: 3+ same party → flag
 *     - Early cost variance: variance > 10% before 50% complete → flag
 *     - Idempotent: running twice doesn't create a duplicate lesson
 */

import * as lessons from './lessons.service';

const mockProject = { findUnique: jest.fn() };

const mockLessonCreate = jest.fn();
const mockLessonFindMany = jest.fn();
const mockLessonFindUnique = jest.fn();
const mockLessonUpdate = jest.fn();
const mockLessonDelete = jest.fn();

const mockScheduleChangeRequestFindMany = jest.fn();
const mockRfiFindMany = jest.fn();
const mockBudgetLineFindMany = jest.fn();
const mockScheduleBaselineFindFirst = jest.fn();
const mockScheduleActivityFindMany = jest.fn();
const mockSubcontractFindMany = jest.fn();

jest.mock('../lib/prisma', () => ({
  getPrismaClient: () => ({
    lessonLearned: {
      create: mockLessonCreate,
      findMany: mockLessonFindMany,
      findUnique: mockLessonFindUnique,
      update: mockLessonUpdate,
      delete: mockLessonDelete,
    },
    scheduleChangeRequest: { findMany: mockScheduleChangeRequestFindMany },
    rfi: { findMany: mockRfiFindMany },
    budgetLine: { findMany: mockBudgetLineFindMany },
    scheduleBaseline: { findFirst: mockScheduleBaselineFindFirst },
    scheduleActivity: { findMany: mockScheduleActivityFindMany },
    subcontract: { findMany: mockSubcontractFindMany },
    project: mockProject,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Make the create call return its data
  mockLessonCreate.mockImplementation(async ({ data }: any) => ({
    id: `lesson-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    addedToTemplate: false,
    ...data,
  }));
  mockLessonUpdate.mockImplementation(async ({ where, data }: any) => ({
    id: where.id,
    ...data,
  }));
  mockLessonFindUnique.mockImplementation(async ({ where }: any) => ({
    id: where.id,
    projectId: 'p1',
    title: 'old',
  }));
  // Default: no data, so detectors that don't have an explicit mock
  // return cleanly (empty arrays). Individual tests override.
  mockRfiFindMany.mockResolvedValue([]);
  mockBudgetLineFindMany.mockResolvedValue([]);
  mockScheduleChangeRequestFindMany.mockResolvedValue([]);
  mockScheduleBaselineFindFirst.mockResolvedValue(null);
  mockScheduleActivityFindMany.mockResolvedValue([]);
  mockSubcontractFindMany.mockResolvedValue([]);
});

describe('createLesson', () => {
  it('saves all fields and defaults addedToTemplate to false', async () => {
    await lessons.createLesson({
      projectId: 'p1',
      title: 'Crane pad settling',
      description: 'subgrade was soft',
      category: 'quality',
      source: 'pm_entered',
      impact: '2 days delay',
      recommendation: 'pre-load 48h',
      dfowRef: 'A1.01',
      createdBy: 'user-1',
    });
    expect(mockLessonCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'p1',
          title: 'Crane pad settling',
          category: 'quality',
          source: 'pm_entered',
          addedToTemplate: false,
        }),
      })
    );
  });

  it('respects addedToTemplate = true when PM opts in', async () => {
    await lessons.createLesson({
      projectId: 'p1',
      title: 't',
      category: 'schedule',
      source: 'pm_entered',
      createdBy: 'u1',
      addedToTemplate: true,
    });
    expect(mockLessonCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ addedToTemplate: true }),
      })
    );
  });
});

describe('flagForTemplate', () => {
  it('sets addedToTemplate to true', async () => {
    await lessons.flagForTemplate('L1', true);
    expect(mockLessonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'L1' },
        data: { addedToTemplate: true },
      })
    );
  });

  it('sets addedToTemplate to false when called with false', async () => {
    await lessons.flagForTemplate('L1', false);
    expect(mockLessonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { addedToTemplate: false },
      })
    );
  });
});

describe('getLessons', () => {
  it('passes the projectId and category filter', async () => {
    mockLessonFindMany.mockResolvedValue([]);
    await lessons.getLessons('p1', { category: 'schedule' });
    expect(mockLessonFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'p1',
          category: 'schedule',
        }),
      })
    );
  });

  it('passes the source filter', async () => {
    mockLessonFindMany.mockResolvedValue([]);
    await lessons.getLessons('p1', { source: 'agent_flagged' });
    expect(mockLessonFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: 'agent_flagged' }),
      })
    );
  });

  it('passes the addedToTemplate filter', async () => {
    mockLessonFindMany.mockResolvedValue([]);
    await lessons.getLessons('p1', { addedToTemplate: true });
    expect(mockLessonFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ addedToTemplate: true }),
      })
    );
  });
});

describe('getLessonsByCategory', () => {
  it('returns all 8 categories with lessons grouped correctly', async () => {
    mockLessonFindMany.mockResolvedValue([
      { id: 'L1', category: 'schedule', title: 'a' },
      { id: 'L2', category: 'cost', title: 'b' },
      { id: 'L3', category: 'schedule', title: 'c' },
    ]);
    const grouped = await lessons.getLessonsByCategory('p1');
    expect(grouped).toHaveLength(8);
    const sched = grouped.find((g) => g.category === 'schedule');
    const cost = grouped.find((g) => g.category === 'cost');
    const safety = grouped.find((g) => g.category === 'safety');
    expect(sched?.lessons).toHaveLength(2);
    expect(cost?.lessons).toHaveLength(1);
    expect(safety?.lessons).toHaveLength(0);
  });
});

describe('pattern detection: recurring schedule delay', () => {
  it('returns the most-frequent reason code with 3+ occurrences', async () => {
    mockScheduleChangeRequestFindMany.mockResolvedValue([
      { reasonCode: 'weather' },
      { reasonCode: 'weather' },
      { reasonCode: 'weather' },
      { reasonCode: 'material' },
    ]);
    const r = await lessons.detectRecurringScheduleDelay('p1');
    expect(r).toEqual({ reasonCode: 'weather', count: 3 });
  });

  it('returns null when no reason code reaches 3', async () => {
    mockScheduleChangeRequestFindMany.mockResolvedValue([
      { reasonCode: 'a' },
      { reasonCode: 'b' },
    ]);
    expect(await lessons.detectRecurringScheduleDelay('p1')).toBeNull();
  });
});

describe('pattern detection: RFI ball-in-court', () => {
  it('returns the party with 3+ overdue RFIs', async () => {
    mockRfiFindMany.mockResolvedValue([
      { ballInCourt: 'EOR', assignedTo: 'EOR' },
      { ballInCourt: 'EOR', assignedTo: null },
      { ballInCourt: 'EOR', assignedTo: null },
      { ballInCourt: 'GC', assignedTo: 'GC' },
    ]);
    const r = await lessons.detectOverdueRfiPattern('p1');
    expect(r).toEqual({ party: 'EOR', count: 3 });
  });
});

describe('pattern detection: cost variance', () => {
  it('flags a line with > 10% variance before 50% complete', async () => {
    mockBudgetLineFindMany.mockResolvedValue([
      { id: 'b1', name: 'Concrete', budgetAmount: 100000, incurredAmount: 50000, percentComplete: 0.4 },
    ]);
    // bcwp = 100000 * 0.4 = 40000, acwp = 50000, variance = (50000 - 40000) / 40000 = 25%
    const r = await lessons.detectEarlyCostVariance('p1');
    expect(r).toEqual({ wbsElement: 'Concrete', variancePct: 25, pctComplete: 0.4 });
  });

  it('does not flag lines past 50% complete', async () => {
    mockBudgetLineFindMany.mockResolvedValue([
      { id: 'b1', name: 'Concrete', budgetAmount: 100000, incurredAmount: 50000, percentComplete: 0.6 },
    ]);
    expect(await lessons.detectEarlyCostVariance('p1')).toBeNull();
  });
});

describe('pattern detection: schedule recovery (Sprint 11)', () => {
  it('flags an activity that finished 2+ days ahead of baseline', async () => {
    const plannedEnd = new Date('2026-06-10T00:00:00Z');
    const actualEnd = new Date('2026-06-07T00:00:00Z');
    mockScheduleBaselineFindFirst.mockResolvedValue({
      id: 'b1',
      activities: [{ name: 'Pour slab', endDate: plannedEnd.toISOString() }],
    });
    mockScheduleActivityFindMany.mockResolvedValue([
      { name: 'Pour slab', endDate: actualEnd },
    ]);
    const r = await lessons.detectScheduleRecoveryPattern('p1');
    expect(r).toEqual({ activityName: 'Pour slab', daysSaved: 3 });
  });

  it('returns null when no baseline exists', async () => {
    mockScheduleBaselineFindFirst.mockResolvedValue(null);
    expect(await lessons.detectScheduleRecoveryPattern('p1')).toBeNull();
  });
});

describe('pattern detection: cost overrun (Sprint 11)', () => {
  it('flags a line that is already over budget before 100% complete', async () => {
    mockBudgetLineFindMany.mockResolvedValue([
      { name: 'Earthwork', budgetAmount: 100000, incurredAmount: 110000, percentComplete: 0.85 },
    ]);
    const r = await lessons.detectCostOverrunPattern('p1');
    expect(r).toEqual({ wbsElement: 'Earthwork', overrunPct: 10 });
  });

  it('does not flag a line that is on budget', async () => {
    mockBudgetLineFindMany.mockResolvedValue([
      { name: 'Earthwork', budgetAmount: 100000, incurredAmount: 90000, percentComplete: 0.9 },
    ]);
    expect(await lessons.detectCostOverrunPattern('p1')).toBeNull();
  });
});

describe('pattern detection: RFI clustering (Sprint 11)', () => {
  it('flags 3+ RFIs created in the same calendar week', async () => {
    // 3 RFIs on Mon, Wed, Fri of the same week.
    const weekMon = new Date('2026-06-08T12:00:00Z'); // Mon
    const weekWed = new Date('2026-06-10T12:00:00Z');
    const weekFri = new Date('2026-06-12T12:00:00Z');
    mockRfiFindMany.mockResolvedValue([
      { createdAt: weekMon },
      { createdAt: weekWed },
      { createdAt: weekFri },
    ]);
    const r = await lessons.detectRfiClusteringPattern('p1');
    expect(r).not.toBeNull();
    expect(r?.count).toBe(3);
  });

  it('returns null when no week has 3+ RFIs', async () => {
    mockRfiFindMany.mockResolvedValue([
      { createdAt: new Date('2026-06-08T00:00:00Z') },
      { createdAt: new Date('2026-06-15T00:00:00Z') },
      { createdAt: new Date('2026-06-22T00:00:00Z') },
    ]);
    expect(await lessons.detectRfiClusteringPattern('p1')).toBeNull();
  });
});

describe('pattern detection: sub performance (Sprint 11)', () => {
  it('flags a sub with 2+ late milestones', async () => {
    const past = new Date('2026-06-01T00:00:00Z'); // already in the past
    mockSubcontractFindMany.mockResolvedValue([
      {
        subcontractorName: 'Acme Mechanical',
        milestones: [
          { status: 'late', plannedDate: past },
          { status: 'late', plannedDate: past },
          { status: 'pending', plannedDate: new Date('2026-07-01T00:00:00Z') },
        ],
      },
    ]);
    const r = await lessons.detectSubPerformancePattern('p1');
    expect(r).toEqual({ subcontractorName: 'Acme Mechanical', lateMilestones: 2 });
  });

  it('does not flag a sub with all milestones on track', async () => {
    mockSubcontractFindMany.mockResolvedValue([
      {
        subcontractorName: 'Acme Mechanical',
        milestones: [
          { status: 'complete', plannedDate: new Date('2026-05-01T00:00:00Z') },
          { status: 'pending', plannedDate: new Date('2026-07-01T00:00:00Z') },
        ],
      },
    ]);
    expect(await lessons.detectSubPerformancePattern('p1')).toBeNull();
  });
});

describe('scanForPatterns', () => {
  it('creates an agent_flagged lesson when a pattern is detected', async () => {
    mockScheduleChangeRequestFindMany.mockResolvedValue([
      { reasonCode: 'weather' },
      { reasonCode: 'weather' },
      { reasonCode: 'weather' },
    ]);
    // No existing lessons, so the scan should create one
    mockLessonFindMany.mockResolvedValue([]);

    const result = await lessons.scanForPatterns('p1');
    expect(result.created).toHaveLength(1);
    expect(result.schedule).toEqual({ reasonCode: 'weather', count: 3 });
    expect(mockLessonCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'agent_flagged',
          category: 'schedule',
        }),
      })
    );
  });

  it('is idempotent: re-running does not create a duplicate lesson', async () => {
    mockScheduleChangeRequestFindMany.mockResolvedValue([
      { reasonCode: 'weather' },
      { reasonCode: 'weather' },
      { reasonCode: 'weather' },
    ]);
    // Existing lessons already include the lesson we would create
    mockLessonFindMany.mockResolvedValue([
      {
        id: 'L1',
        projectId: 'p1',
        title: 'Recurring weather delay detected',
        category: 'schedule',
        source: 'agent_flagged',
        description: '',
        impact: null,
        recommendation: null,
        dfowRef: null,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        addedToTemplate: false,
      },
    ]);

    const result = await lessons.scanForPatterns('p1');
    expect(result.created).toHaveLength(0);
    expect(mockLessonCreate).not.toHaveBeenCalled();
  });
});
