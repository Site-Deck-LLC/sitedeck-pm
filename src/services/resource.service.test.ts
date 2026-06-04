import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import {
  upsertEquipment,
  recordEquipmentUsage,
  getEquipmentByProject,
  getEquipmentByExternalId,
  assignEquipmentToActivity,
  unassignEquipmentFromActivity,
  getEquipmentCostSummary,
  getLaborCostSummary,
  getIdleEquipmentOnCriticalPath,
} from './resource.service';

const mockEquipmentCreate = jest.fn();
const mockEquipmentFindUnique = jest.fn();
const mockEquipmentFindMany = jest.fn();
const mockEquipmentUpdate = jest.fn();

const mockCostTransactionFindMany = jest.fn();
const mockScheduleActivityFindMany = jest.fn();

const mockPrisma = {
  equipment: {
    create: mockEquipmentCreate,
    findUnique: mockEquipmentFindUnique,
    findMany: mockEquipmentFindMany,
    update: mockEquipmentUpdate,
  },
  costTransaction: {
    findMany: mockCostTransactionFindMany,
  },
  scheduleActivity: {
    findMany: mockScheduleActivityFindMany,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.clearAllMocks();
  setPrismaClient(mockPrisma);
});

describe('resource.service', () => {
  describe('upsertEquipment', () => {
    it('creates equipment when it does not exist', async () => {
      mockEquipmentFindUnique.mockResolvedValue(null);
      mockEquipmentCreate.mockResolvedValue({
        id: 'eq-1',
        projectId: 'proj-1',
        externalId: 'pro-eq-1',
        name: 'Excavator 1',
        type: 'excavator',
        status: 'active',
        currentActivityId: null,
      });

      const result = await upsertEquipment({
        projectId: 'proj-1',
        externalId: 'pro-eq-1',
        name: 'Excavator 1',
        type: 'excavator',
      });

      expect(mockEquipmentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'proj-1',
            externalId: 'pro-eq-1',
            name: 'Excavator 1',
            type: 'excavator',
          }),
        })
      );
      expect(result.name).toBe('Excavator 1');
    });

    it('updates equipment when it already exists', async () => {
      mockEquipmentFindUnique.mockResolvedValue({
        id: 'eq-1',
        projectId: 'proj-1',
        externalId: 'pro-eq-1',
        name: 'Old Name',
        type: 'excavator',
      });
      mockEquipmentUpdate.mockResolvedValue({
        id: 'eq-1',
        name: 'Excavator 1',
        type: 'excavator',
        currentActivityId: 'act-1',
      });

      const result = await upsertEquipment({
        projectId: 'proj-1',
        externalId: 'pro-eq-1',
        name: 'Excavator 1',
        type: 'excavator',
        currentActivityId: 'act-1',
      });

      expect(mockEquipmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'eq-1' },
          data: expect.objectContaining({
            name: 'Excavator 1',
            currentActivityId: 'act-1',
          }),
        })
      );
      expect(result.currentActivityId).toBe('act-1');
    });
  });

  describe('recordEquipmentUsage', () => {
    it('updates totalHours and lastUsageDate', async () => {
      mockEquipmentFindUnique.mockResolvedValue({
        id: 'eq-1',
        projectId: 'proj-1',
        externalId: 'pro-eq-1',
        totalHours: 10,
        lastUsageDate: new Date('2026-05-01'),
      });
      mockEquipmentUpdate.mockResolvedValue({
        id: 'eq-1',
        totalHours: 14,
        lastUsageDate: new Date('2026-06-01'),
      });

      const result = await recordEquipmentUsage({
        projectId: 'proj-1',
        externalId: 'pro-eq-1',
        hours: 4,
        date: new Date('2026-06-01'),
      });

      expect(mockEquipmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'eq-1' },
          data: expect.objectContaining({
            totalHours: 14,
            lastUsageDate: new Date('2026-06-01'),
          }),
        })
      );
      expect(result.totalHours).toBe(14);
    });

    it('throws when equipment not found', async () => {
      mockEquipmentFindUnique.mockResolvedValue(null);

      await expect(
        recordEquipmentUsage({
          projectId: 'proj-1',
          externalId: 'pro-eq-1',
          hours: 4,
          date: new Date(),
        })
      ).rejects.toThrow('Equipment not found');
    });
  });

  describe('getEquipmentByProject', () => {
    it('returns equipment ordered by name', async () => {
      mockEquipmentFindMany.mockResolvedValue([{ id: 'eq-1' }, { id: 'eq-2' }]);

      const result = await getEquipmentByProject('proj-1');
      expect(mockEquipmentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'proj-1' },
          orderBy: { name: 'asc' },
        })
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('getEquipmentByExternalId', () => {
    it('returns equipment by project and externalId', async () => {
      mockEquipmentFindUnique.mockResolvedValue({ id: 'eq-1', externalId: 'pro-eq-1' });

      const result = await getEquipmentByExternalId('proj-1', 'pro-eq-1');
      expect(mockEquipmentFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId_externalId: {
              projectId: 'proj-1',
              externalId: 'pro-eq-1',
            },
          },
        })
      );
      expect(result?.externalId).toBe('pro-eq-1');
    });
  });

  describe('assignEquipmentToActivity', () => {
    it('sets currentActivityId', async () => {
      mockEquipmentFindUnique.mockResolvedValue({ id: 'eq-1' });
      mockEquipmentUpdate.mockResolvedValue({ id: 'eq-1', currentActivityId: 'act-1' });

      const result = await assignEquipmentToActivity('proj-1', 'pro-eq-1', 'act-1');
      expect(mockEquipmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'eq-1' },
          data: { currentActivityId: 'act-1' },
        })
      );
      expect(result.currentActivityId).toBe('act-1');
    });

    it('throws when equipment not found', async () => {
      mockEquipmentFindUnique.mockResolvedValue(null);
      await expect(assignEquipmentToActivity('proj-1', 'pro-eq-1', 'act-1')).rejects.toThrow(
        'Equipment not found'
      );
    });
  });

  describe('unassignEquipmentFromActivity', () => {
    it('clears currentActivityId', async () => {
      mockEquipmentFindUnique.mockResolvedValue({ id: 'eq-1', currentActivityId: 'act-1' });
      mockEquipmentUpdate.mockResolvedValue({ id: 'eq-1', currentActivityId: null });

      const result = await unassignEquipmentFromActivity('proj-1', 'pro-eq-1');
      expect(mockEquipmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'eq-1' },
          data: { currentActivityId: null },
        })
      );
      expect(result.currentActivityId).toBeNull();
    });

    it('throws when equipment not found', async () => {
      mockEquipmentFindUnique.mockResolvedValue(null);
      await expect(unassignEquipmentFromActivity('proj-1', 'pro-eq-1')).rejects.toThrow(
        'Equipment not found'
      );
    });
  });

  describe('getEquipmentCostSummary', () => {
    it('aggregates equipment cost transactions by budget line', async () => {
      mockCostTransactionFindMany.mockResolvedValue([
        { budgetLineId: 'bl-1', amount: 100, source: 'equipment_webhook' },
        { budgetLineId: 'bl-1', amount: 200, source: 'equipment_webhook' },
        { budgetLineId: 'bl-2', amount: 50, source: 'equipment_webhook' },
      ]);

      const result = await getEquipmentCostSummary('proj-1');
      expect(mockCostTransactionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'proj-1', source: 'equipment_webhook' },
          orderBy: { transactionDate: 'desc' },
        })
      );
      expect(result).toHaveLength(2);
      const bl1 = result.find((r) => r.budgetLineId === 'bl-1');
      expect(bl1?.totalAmount).toBe(300);
      expect(bl1?.transactionCount).toBe(2);
    });
  });

  describe('getLaborCostSummary', () => {
    it('aggregates labor cost transactions by budget line', async () => {
      mockCostTransactionFindMany.mockResolvedValue([
        { budgetLineId: 'bl-3', amount: 8, source: 'labor_webhook' },
        { budgetLineId: 'bl-3', amount: 8, source: 'labor_webhook' },
        { budgetLineId: 'bl-4', amount: 4, source: 'labor_webhook' },
      ]);

      const result = await getLaborCostSummary('proj-1');
      expect(mockCostTransactionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'proj-1', source: 'labor_webhook' },
          orderBy: { transactionDate: 'desc' },
        })
      );
      const bl3 = result.find((r) => r.budgetLineId === 'bl-3');
      expect(bl3?.totalAmount).toBe(16);
      expect(bl3?.transactionCount).toBe(2);
    });
  });

  describe('getIdleEquipmentOnCriticalPath', () => {
    it('returns idle equipment assigned to critical non-complete activities', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      mockEquipmentFindMany.mockResolvedValue([
        {
          id: 'eq-1',
          externalId: 'pro-eq-1',
          name: 'Excavator 1',
          currentActivityId: 'act-1',
          lastUsageDate: twoDaysAgo,
        },
        {
          id: 'eq-2',
          externalId: 'pro-eq-2',
          name: 'Crane 1',
          currentActivityId: 'act-2',
          lastUsageDate: now,
        },
        {
          id: 'eq-3',
          externalId: 'pro-eq-3',
          name: 'Dozer',
          currentActivityId: 'act-3',
          lastUsageDate: null,
        },
      ]);

      mockScheduleActivityFindMany.mockResolvedValue([
        { id: 'act-1', name: 'Foundation', isCritical: true, status: 'in_progress' },
        { id: 'act-2', name: 'Steel Erection', isCritical: true, status: 'in_progress' },
        { id: 'act-3', name: 'Grading', isCritical: true, status: 'not_started' },
      ]);

      const result = await getIdleEquipmentOnCriticalPath('proj-1');
      expect(result).toHaveLength(2);
      expect(result.some((r) => r.name === 'Excavator 1')).toBe(true);
      expect(result.some((r) => r.name === 'Dozer')).toBe(true);
      expect(result.some((r) => r.name === 'Crane 1')).toBe(false);
    });

    it('excludes equipment on non-critical activities', async () => {
      mockEquipmentFindMany.mockResolvedValue([
        {
          id: 'eq-1',
          externalId: 'pro-eq-1',
          name: 'Truck',
          currentActivityId: 'act-1',
          lastUsageDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
      ]);

      // Prisma filters by isCritical: true, so mock returns empty for non-critical
      mockScheduleActivityFindMany.mockResolvedValue([]);

      const result = await getIdleEquipmentOnCriticalPath('proj-1');
      expect(result).toHaveLength(0);
    });

    it('excludes equipment on complete activities', async () => {
      mockEquipmentFindMany.mockResolvedValue([
        {
          id: 'eq-1',
          externalId: 'pro-eq-1',
          name: 'Mixer',
          currentActivityId: 'act-1',
          lastUsageDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
      ]);

      // Prisma filters by status: { not: 'complete' }, so mock returns empty for complete
      mockScheduleActivityFindMany.mockResolvedValue([]);

      const result = await getIdleEquipmentOnCriticalPath('proj-1');
      expect(result).toHaveLength(0);
    });

    it('returns empty array when no equipment has currentActivityId', async () => {
      mockEquipmentFindMany.mockResolvedValue([]);

      const result = await getIdleEquipmentOnCriticalPath('proj-1');
      expect(result).toHaveLength(0);
      expect(mockScheduleActivityFindMany).not.toHaveBeenCalled();
    });
  });
});
