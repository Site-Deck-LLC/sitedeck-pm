/**
 * Tests for the WBS tree service. Verifies tree building, rollup math,
 * blockers, and crosswalk functionality.
 */

import * as wbsService from './wbs.service';
import { getPrismaClient } from '../lib/prisma';

jest.mock('../lib/prisma', () => {
  const mockProject = {
    findUnique: jest.fn(),
  };
  const mockWorkBreakdownItem = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };
  const mockScheduleActivity = {
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const mockBudgetLine = {
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const mockPurchaseOrder = {
    count: jest.fn(),
  };
  const mockWbsCostCodeCrosswalk = {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  return {
    getPrismaClient: () => ({
      project: mockProject,
      workBreakdownItem: mockWorkBreakdownItem,
      scheduleActivity: mockScheduleActivity,
      budgetLine: mockBudgetLine,
      purchaseOrder: mockPurchaseOrder,
      wbsCostCodeCrosswalk: mockWbsCostCodeCrosswalk,
    }),
  };
});

const prisma = getPrismaClient() as any;

describe('wbs.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWbsTree', () => {
    it('returns empty array when project has no WBS items', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', structureType: 'wbs' });
      prisma.workBreakdownItem.findMany.mockResolvedValue([]);
      const tree = await wbsService.getWbsTree('p1');
      expect(tree).toEqual([]);
    });

    it('builds a tree from flat list with parent/child relationships', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', structureType: 'wbs' });
      prisma.workBreakdownItem.findMany.mockResolvedValue([
        { id: 'a', code: '01', name: 'Engineering', parentId: null, level: 1, structureType: 'wbs' },
        { id: 'b', code: '01.01', name: 'Detailed Design', parentId: 'a', level: 2, structureType: 'wbs' },
        { id: 'c', code: '02', name: 'Procurement', parentId: null, level: 1, structureType: 'wbs' },
      ]);
      prisma.scheduleActivity.findMany.mockResolvedValue([]);
      prisma.budgetLine.findMany.mockResolvedValue([]);

      const tree = await wbsService.getWbsTree('p1');
      expect(tree).toHaveLength(2);
      const engineering = tree.find((n) => n.code === '01');
      expect(engineering).toBeDefined();
      expect(engineering!.children).toHaveLength(1);
      expect(engineering!.children[0].code).toBe('01.01');
    });

    it('rolls up budget and cost from children to parent', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', structureType: 'wbs' });
      prisma.workBreakdownItem.findMany.mockResolvedValue([
        { id: 'a', code: '01', name: 'Parent', parentId: null, level: 1, structureType: 'wbs' },
        { id: 'b', code: '01.01', name: 'Child 1', parentId: 'a', level: 2, structureType: 'wbs' },
        { id: 'c', code: '01.02', name: 'Child 2', parentId: 'a', level: 2, structureType: 'wbs' },
      ]);
      prisma.scheduleActivity.findMany.mockResolvedValue([]);
      prisma.budgetLine.findMany.mockResolvedValue([
        { costCode: '01.01', budgetAmount: 1000, incurredAmount: 1100 },
        { costCode: '01.02', budgetAmount: 2000, incurredAmount: 1800 },
      ]);

      const tree = await wbsService.getWbsTree('p1');
      const parent = tree[0];
      expect(parent.budget).toBe(3000 * 100); // 3000 dollars → 300000 cents
      expect(parent.actualCost).toBe(2900 * 100);
      // 2900/3000 = 96.7% < 100% → green
      expect(parent.colorStatus).toBe('green');
    });

    it('marks red when actual exceeds 110% of budget', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', structureType: 'wbs' });
      prisma.workBreakdownItem.findMany.mockResolvedValue([
        { id: 'a', code: '01', name: 'Over Budget', parentId: null, level: 1, structureType: 'wbs' },
      ]);
      prisma.scheduleActivity.findMany.mockResolvedValue([]);
      prisma.budgetLine.findMany.mockResolvedValue([
        { costCode: '01', budgetAmount: 1000, incurredAmount: 1500 },
      ]);
      const tree = await wbsService.getWbsTree('p1');
      expect(tree[0].colorStatus).toBe('red');
    });

    it('marks amber when actual exceeds budget by 0-10%', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', structureType: 'wbs' });
      prisma.workBreakdownItem.findMany.mockResolvedValue([
        { id: 'a', code: '01', name: 'Slightly Over', parentId: null, level: 1, structureType: 'wbs' },
      ]);
      prisma.scheduleActivity.findMany.mockResolvedValue([]);
      prisma.budgetLine.findMany.mockResolvedValue([
        { costCode: '01', budgetAmount: 1000, incurredAmount: 1050 },
      ]);
      const tree = await wbsService.getWbsTree('p1');
      expect(tree[0].colorStatus).toBe('amber');
    });

    it('computes weighted percent complete from activities', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', structureType: 'wbs' });
      prisma.workBreakdownItem.findMany.mockResolvedValue([
        { id: 'a', code: '01', name: 'Parent', parentId: null, level: 1, structureType: 'wbs' },
        { id: 'b', code: '01.01', name: 'Child', parentId: 'a', level: 2, structureType: 'wbs' },
      ]);
      prisma.scheduleActivity.findMany.mockResolvedValue([
        { wbsItemId: 'b', percentComplete: 50 },
      ]);
      prisma.budgetLine.findMany.mockResolvedValue([
        { costCode: '01.01', budgetAmount: 1000, actualAmount: 0 },
      ]);
      const tree = await wbsService.getWbsTree('p1');
      expect(tree[0].children[0].percentComplete).toBe(0.5);
    });
  });

  describe('addWbsItem', () => {
    it('creates a WBS element with the right level from parent', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', structureType: 'wbs' });
      prisma.workBreakdownItem.findUnique.mockResolvedValue({ id: 'parent', level: 2 });
      prisma.workBreakdownItem.create.mockResolvedValue({ id: 'new', level: 3 });

      const result = await wbsService.addWbsItem({
        projectId: 'p1',
        code: '01.01.01',
        name: 'Sub-sub',
        parentId: 'parent',
      });
      expect(result.level).toBe(3);
    });

    it('rejects when tree would exceed 4 levels', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', structureType: 'wbs' });
      prisma.workBreakdownItem.findUnique.mockResolvedValue({ id: 'parent', level: 4 });

      await expect(
        wbsService.addWbsItem({
          projectId: 'p1',
          code: '01.01.01.01.01',
          name: 'Too Deep',
          parentId: 'parent',
        })
      ).rejects.toThrow(/4 levels/);
    });
  });

  describe('updateWbsItem', () => {
    it('updates name only', async () => {
      prisma.workBreakdownItem.findUnique.mockResolvedValue({ id: 'w1', code: '01' });
      prisma.scheduleActivity.count.mockResolvedValue(0);
      prisma.workBreakdownItem.update.mockResolvedValue({ id: 'w1', name: 'New' });

      const result = await wbsService.updateWbsItem('w1', { name: 'New' });
      expect(result.name).toBe('New');
    });

    it('rejects code change when activities are linked', async () => {
      prisma.workBreakdownItem.findUnique.mockResolvedValue({ id: 'w1', code: '01' });
      prisma.scheduleActivity.count.mockResolvedValue(3);

      await expect(
        wbsService.updateWbsItem('w1', { code: '99' })
      ).rejects.toThrow(/3 activities/);
    });
  });

  describe('deleteWbsItem', () => {
    it('deletes when no blockers', async () => {
      prisma.workBreakdownItem.findUnique.mockResolvedValue({ id: 'w1', projectId: 'p1', code: '01' });
      prisma.scheduleActivity.count.mockResolvedValue(0);
      prisma.budgetLine.count.mockResolvedValue(0);
      prisma.purchaseOrder.count.mockResolvedValue(0);
      prisma.workBreakdownItem.count.mockResolvedValue(0);
      prisma.workBreakdownItem.delete.mockResolvedValue({ id: 'w1' });

      const result = await wbsService.deleteWbsItem('w1');
      expect(result.deleted).toBe(true);
    });

    it('blocks delete with summary of linked items', async () => {
      prisma.workBreakdownItem.findUnique.mockResolvedValue({ id: 'w1', projectId: 'p1', code: '01' });
      prisma.scheduleActivity.count.mockResolvedValue(3);
      prisma.budgetLine.count.mockResolvedValue(2);
      prisma.purchaseOrder.count.mockResolvedValue(0);

      const result = await wbsService.deleteWbsItem('w1');
      expect(result.deleted).toBe(false);
      expect(result.blockers.activityCount).toBe(3);
      expect(result.blockers.costLineCount).toBe(2);
    });
  });

  describe('crosswalk', () => {
    it('returns crosswalk entries with joined item details', async () => {
      prisma.wbsCostCodeCrosswalk.findMany.mockResolvedValue([
        { id: 'c1', projectId: 'p1', gcItemId: 'g1', subItemId: 's1' },
      ]);
      prisma.workBreakdownItem.findMany.mockResolvedValue([
        { id: 'g1', code: '01', name: 'GC Eng' },
        { id: 's1', code: 'SUB-01', name: 'Sub Eng' },
      ]);

      const result = await wbsService.getCrosswalk('p1');
      expect(result).toHaveLength(1);
      expect(result[0].gcItemCode).toBe('01');
      expect(result[0].subItemCode).toBe('SUB-01');
    });

    it('adds a crosswalk entry', async () => {
      prisma.wbsCostCodeCrosswalk.create.mockResolvedValue({ id: 'c1' });
      const result = await wbsService.addCrosswalkEntry('p1', 'g1', 's1');
      expect(result.id).toBe('c1');
    });

    it('deletes a crosswalk entry', async () => {
      prisma.wbsCostCodeCrosswalk.delete.mockResolvedValue({ id: 'c1' });
      await wbsService.deleteCrosswalkEntry('c1');
      expect(prisma.wbsCostCodeCrosswalk.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });
  });
});
