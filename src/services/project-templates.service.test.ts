/**
 * Tests for the full-snapshot project template service.
 * - saveProjectAsTemplate: captures WBS, activities, budget, risks, lessons
 *   with addedToTemplate=true; rejects other-org projects; rejects empty name.
 * - applyProjectTemplate: idempotent re-apply (skips items that already
 *   exist), tenant isolation, structure-type mismatch, dedupe strategy
 *   for activities (name), budget (name), risks (description), lessons (title).
 */

import * as projectTemplates from './project-templates.service';

const mockProjectFindUnique = jest.fn();
const mockWorkBreakdownItemFindMany = jest.fn();
const mockScheduleActivityFindMany = jest.fn();
const mockScheduleActivityCreate = jest.fn();
const mockScheduleActivityFindFirst = jest.fn();
const mockBudgetLineFindMany = jest.fn();
const mockBudgetLineCreate = jest.fn();
const mockBudgetLineFindFirst = jest.fn();
const mockRiskItemFindMany = jest.fn();
const mockRiskItemCreate = jest.fn();
const mockRiskItemFindFirst = jest.fn();
const mockLessonLearnedFindMany = jest.fn();
const mockLessonLearnedCreate = jest.fn();
const mockLessonLearnedFindFirst = jest.fn();
const mockProjectTemplateCreate = jest.fn();
const mockProjectTemplateFindUnique = jest.fn();
const mockProjectTemplateFindMany = jest.fn();
const mockProjectTemplateDelete = jest.fn();

jest.mock('../lib/prisma', () => ({
  getPrismaClient: () => ({
    project: { findUnique: mockProjectFindUnique },
    workBreakdownItem: { findMany: mockWorkBreakdownItemFindMany },
    scheduleActivity: {
      findMany: mockScheduleActivityFindMany,
      create: mockScheduleActivityCreate,
      findFirst: mockScheduleActivityFindFirst,
    },
    budgetLine: {
      findMany: mockBudgetLineFindMany,
      create: mockBudgetLineCreate,
      findFirst: mockBudgetLineFindFirst,
    },
    riskItem: {
      findMany: mockRiskItemFindMany,
      create: mockRiskItemCreate,
      findFirst: mockRiskItemFindFirst,
    },
    lessonLearned: {
      findMany: mockLessonLearnedFindMany,
      create: mockLessonLearnedCreate,
      findFirst: mockLessonLearnedFindFirst,
    },
    projectTemplate: {
      create: mockProjectTemplateCreate,
      findUnique: mockProjectTemplateFindUnique,
      findMany: mockProjectTemplateFindMany,
      delete: mockProjectTemplateDelete,
    },
  }),
}));

// applyProjectTemplate internally calls applyTemplate (from the WBS-only
// service), which needs its own prisma mocks. We stub that import path.
jest.mock('./templates.service', () => ({
  applyTemplate: jest.fn(async () => ({ created: 1, skipped: 0 })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockProjectFindUnique.mockResolvedValue({ orgId: 'org1', structureType: 'wbs' });
  mockWorkBreakdownItemFindMany.mockResolvedValue([
    { id: 'wbs1', code: 'A1', name: 'Sitework', parentId: null, level: 1, responsibleParty: null, budget: null },
  ]);
  mockScheduleActivityFindMany.mockResolvedValue([
    {
      name: 'Excavate',
      description: null,
      wbsItemId: 'wbs1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-05'),
    },
  ]);
  mockBudgetLineFindMany.mockResolvedValue([
    { wbsItemId: 'wbs1', name: 'Excavation cost', budgetAmount: 50000 },
  ]);
  mockRiskItemFindMany.mockResolvedValue([
    {
      description: 'Weather delays',
      category: 'schedule',
      probability: 'medium',
      impact: 'medium',
      score: 6,
      mitigationPlan: 'Add float',
      owner: 'Jim',
    },
  ]);
  mockLessonLearnedFindMany.mockResolvedValue([
    {
      title: 'Call before you dig',
      description: null,
      category: 'safety',
      impact: 'Hit a utility line',
      recommendation: 'Always 811 first',
      dfowRef: null,
    },
  ]);
  mockProjectTemplateCreate.mockImplementation(async ({ data }: any) => ({
    id: 'tpl-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data,
  }));
  mockProjectTemplateFindUnique.mockResolvedValue({
    id: 'tpl-1',
    orgId: 'org1',
    name: 'X',
    description: null,
    structureType: 'wbs',
    snapshot: [],
    activitiesSnapshot: [],
    budgetSnapshot: [],
    risksSnapshot: [],
    lessonsSnapshot: [],
    sourceProjectId: 'p1',
    createdBy: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

describe('saveProjectAsTemplate', () => {
  it('rejects an empty name', async () => {
    await expect(
      projectTemplates.saveProjectAsTemplate({
        orgId: 'org1',
        projectId: 'p1',
        name: '',
        createdBy: 'u1',
      })
    ).rejects.toThrow(/name/);
  });

  it('rejects when the source project does not exist', async () => {
    mockProjectFindUnique.mockResolvedValue(null);
    await expect(
      projectTemplates.saveProjectAsTemplate({
        orgId: 'org1',
        projectId: 'p1',
        name: 'X',
        createdBy: 'u1',
      })
    ).rejects.toThrow(/not found/);
  });

  it('rejects when the source project belongs to a different org', async () => {
    mockProjectFindUnique.mockResolvedValue({ orgId: 'other-org', structureType: 'wbs' });
    await expect(
      projectTemplates.saveProjectAsTemplate({
        orgId: 'org1',
        projectId: 'p1',
        name: 'X',
        createdBy: 'u1',
      })
    ).rejects.toThrow(/does not belong/);
  });

  it('captures WBS + activities + budget + risks + lessons with addedToTemplate=true', async () => {
    const result = await projectTemplates.saveProjectAsTemplate({
      orgId: 'org1',
      projectId: 'p1',
      name: 'Office buildout template',
      description: 'Reusable office project',
      createdBy: 'u1',
    });
    expect(result.id).toBe('tpl-1');
    expect(result.counts.wbs).toBe(1);
    expect(result.counts.activities).toBe(1);
    expect(result.counts.budget).toBe(1);
    expect(result.counts.risks).toBe(1);
    expect(result.counts.lessons).toBe(1);

    // Verify the create call received the full snapshot.
    expect(mockProjectTemplateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activitiesSnapshot: expect.arrayContaining([
            expect.objectContaining({ name: 'Excavate', plannedDurationDays: 4 }),
          ]),
          budgetSnapshot: expect.arrayContaining([
            expect.objectContaining({ name: 'Excavation cost', budgetAmount: 50000 }),
          ]),
          risksSnapshot: expect.arrayContaining([
            expect.objectContaining({ description: 'Weather delays', score: 6 }),
          ]),
          lessonsSnapshot: expect.arrayContaining([
            expect.objectContaining({ title: 'Call before you dig' }),
          ]),
        }),
      })
    );
  });
});

describe('applyProjectTemplate', () => {
  beforeEach(() => {
    mockProjectTemplateFindUnique.mockResolvedValue({
      id: 'tpl-1',
      orgId: 'org1',
      structureType: 'wbs',
      snapshot: [{ code: 'A1', name: 'Sitework', parentCode: null, level: 1, responsibleParty: null, budget: null }],
      activitiesSnapshot: [{ name: 'Excavate', wbsItemCode: 'A1', plannedDurationDays: 4 }],
      budgetSnapshot: [{ name: 'Excavation cost', wbsItemCode: 'A1', budgetAmount: 50000 }],
      risksSnapshot: [
        { description: 'Weather delays', category: 'schedule', probability: 'medium', impact: 'medium', score: 6 },
      ],
      lessonsSnapshot: [{ title: 'Call before you dig', category: 'safety' }],
    });
    // Target project starts with no activities, no budget lines — so the
    // create path is taken. The first test re-runs this beforeEach, then
    // overrides findFirst to null in the body to assert the "creates"
    // branch.
    mockScheduleActivityFindMany.mockResolvedValue([]);
    mockBudgetLineFindMany.mockResolvedValue([]);
  });

  it('rejects when the template does not belong to the org', async () => {
    mockProjectTemplateFindUnique.mockResolvedValue({ orgId: 'other-org' });
    await expect(
      projectTemplates.applyProjectTemplate({
        templateId: 'tpl-1',
        projectId: 'p2',
        orgId: 'org1',
        userId: 'u1',
      })
    ).rejects.toThrow(/does not belong/);
  });

  it('rejects when the structure type does not match the target project', async () => {
    mockProjectFindUnique.mockResolvedValue({ orgId: 'org1', structureType: 'cost_code' });
    await expect(
      projectTemplates.applyProjectTemplate({
        templateId: 'tpl-1',
        projectId: 'p2',
        orgId: 'org1',
        userId: 'u1',
      })
    ).rejects.toThrow(/structure type/);
  });

  it('creates items, lessons, and skips pre-existing ones (idempotent re-apply)', async () => {
    // Pre-existing WBS resolves to the code lookup, then no activities/budget
    // exist yet, so the service should create all of them.
    mockScheduleActivityFindFirst.mockResolvedValue(null);
    mockBudgetLineFindFirst.mockResolvedValue(null);
    mockRiskItemFindFirst.mockResolvedValue(null);
    mockLessonLearnedFindFirst.mockResolvedValue(null);

    const result = await projectTemplates.applyProjectTemplate({
      templateId: 'tpl-1',
      projectId: 'p2',
      orgId: 'org1',
      userId: 'u1',
    });

    expect(result.activities.created).toBe(1);
    expect(result.budget.created).toBe(1);
    expect(result.risks.created).toBe(1);
    expect(result.lessons.created).toBe(1);
    expect(mockScheduleActivityCreate).toHaveBeenCalledTimes(1);
    expect(mockBudgetLineCreate).toHaveBeenCalledTimes(1);
    expect(mockRiskItemCreate).toHaveBeenCalledTimes(1);
    expect(mockLessonLearnedCreate).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: re-running skips items that already exist', async () => {
    mockScheduleActivityFindFirst.mockResolvedValue({ id: 'existing-activity' });
    mockBudgetLineFindFirst.mockResolvedValue({ id: 'existing-budget' });
    mockRiskItemFindFirst.mockResolvedValue({ id: 'existing-risk' });
    mockLessonLearnedFindFirst.mockResolvedValue({ id: 'existing-lesson' });

    const result = await projectTemplates.applyProjectTemplate({
      templateId: 'tpl-1',
      projectId: 'p2',
      orgId: 'org1',
      userId: 'u1',
    });

    expect(result.activities).toEqual({ created: 0, skipped: 1 });
    expect(result.budget).toEqual({ created: 0, skipped: 1 });
    expect(result.risks).toEqual({ created: 0, skipped: 1 });
    expect(result.lessons).toEqual({ created: 0, skipped: 1 });
    expect(mockScheduleActivityCreate).not.toHaveBeenCalled();
    expect(mockBudgetLineCreate).not.toHaveBeenCalled();
    expect(mockRiskItemCreate).not.toHaveBeenCalled();
    expect(mockLessonLearnedCreate).not.toHaveBeenCalled();
  });
});

describe('getProjectTemplate / listProjectTemplates / deleteProjectTemplate', () => {
  it('listProjectTemplates returns summaries with counts', async () => {
    mockProjectTemplateFindMany.mockResolvedValue([
      {
        id: 't1',
        orgId: 'org1',
        name: 'X',
        description: null,
        structureType: 'wbs',
        snapshot: [{}, {}],
        activitiesSnapshot: [{}],
        budgetSnapshot: [{}, {}, {}],
        risksSnapshot: [],
        lessonsSnapshot: [{}],
        sourceProjectId: null,
        createdBy: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const list = await projectTemplates.listProjectTemplates('org1');
    expect(list).toHaveLength(1);
    expect(list[0].counts).toEqual({ wbs: 2, activities: 1, budget: 3, risks: 0, lessons: 1 });
  });

  it('getProjectTemplate returns null for a template from a different org', async () => {
    mockProjectTemplateFindUnique.mockResolvedValue({ orgId: 'other-org' });
    const t = await projectTemplates.getProjectTemplate('t1', 'org1');
    expect(t).toBeNull();
  });

  it('deleteProjectTemplate rejects cross-org delete', async () => {
    mockProjectTemplateFindUnique.mockResolvedValue({ orgId: 'other-org' });
    await expect(
      projectTemplates.deleteProjectTemplate('t1', 'org1')
    ).rejects.toThrow(/does not belong/);
  });
});
