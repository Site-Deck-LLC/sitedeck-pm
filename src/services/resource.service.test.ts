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
  getCrewStatus,
} from './resource.service';

const mockEquipmentCreate = jest.fn();
const mockEquipmentFindUnique = jest.fn();
const mockEquipmentFindMany = jest.fn();
const mockEquipmentUpdate = jest.fn();

const mockCostTransactionFindMany = jest.fn();
const mockScheduleActivityFindMany = jest.fn();
const mockAttendanceFindUnique = jest.fn();
const mockAttendanceCreate = jest.fn();
const mockAttendanceUpdate = jest.fn();
const mockEquipmentStatusLogCreate = jest.fn();
const mockEquipmentStatusLogFindMany = jest.fn();

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
  attendance: {
    findUnique: mockAttendanceFindUnique,
    create: mockAttendanceCreate,
    update: mockAttendanceUpdate,
  },
  equipmentStatusLog: {
    create: mockEquipmentStatusLogCreate,
    findMany: mockEquipmentStatusLogFindMany,
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

  describe('getCrewStatus', () => {
    it('returns green gap status with full crew attendance', async () => {
      mockScheduleActivityFindMany.mockResolvedValue([
        { id: 'act-1', isCritical: true },
        { id: 'act-2', isCritical: false },
      ]);
      mockAttendanceFindUnique.mockResolvedValue({ workerCount: 2, hours: 16 });
      mockEquipmentFindMany.mockResolvedValue([
        { id: 'eq-1', status: 'active', dailyRate: 500, totalHours: 10 },
        { id: 'eq-2', status: 'idle', dailyRate: 300, totalHours: 5 },
      ]);

      const result = await getCrewStatus('proj-1');

      expect(result.plannedCrewToday).toBe(2);
      expect(result.confirmedPresent).toBe(2);
      expect(result.crewGapPct).toBe(0);
      expect(result.gapStatus).toBe('green');
      expect(result.criticalPathImpacted).toBe(false);
      expect(result.equipmentOnSite).toBe(2);
      expect(result.equipmentIdle).toBe(1);
      expect(result.equipmentDailyBurn).toBe(500);
      expect(result.equipmentBudgetRate).toBe(800);
    });

    it('returns red gap status when gap exceeds 20 percent', async () => {
      mockScheduleActivityFindMany.mockResolvedValue([
        { id: 'act-1', isCritical: false },
        { id: 'act-2', isCritical: false },
        { id: 'act-3', isCritical: false },
        { id: 'act-4', isCritical: false },
        { id: 'act-5', isCritical: false },
      ]);
      mockAttendanceFindUnique.mockResolvedValue({ workerCount: 2, hours: 16 });
      mockEquipmentFindMany.mockResolvedValue([]);

      const result = await getCrewStatus('proj-1');

      expect(result.plannedCrewToday).toBe(5);
      expect(result.confirmedPresent).toBe(2);
      expect(result.crewGapPct).toBe(60);
      expect(result.gapStatus).toBe('red');
    });

    it('returns amber gap status when gap is 10-20 percent', async () => {
      mockScheduleActivityFindMany.mockResolvedValue([
        { id: 'act-1', isCritical: false },
        { id: 'act-2', isCritical: false },
        { id: 'act-3', isCritical: false },
        { id: 'act-4', isCritical: false },
        { id: 'act-5', isCritical: false },
      ]);
      mockAttendanceFindUnique.mockResolvedValue({ workerCount: 4, hours: 32 });
      mockEquipmentFindMany.mockResolvedValue([]);

      const result = await getCrewStatus('proj-1');

      // 5 planned, 4 present, gap 20% => on red threshold (> 20) but boundary itself is amber
      expect(result.crewGapPct).toBe(20);
      expect(result.gapStatus).toBe('amber');
    });

    it('flags critical path impact when critical activities planned but no attendance', async () => {
      mockScheduleActivityFindMany.mockResolvedValue([
        { id: 'act-1', isCritical: true },
        { id: 'act-2', isCritical: false },
      ]);
      mockAttendanceFindUnique.mockResolvedValue({ workerCount: 0, hours: 0 });
      mockEquipmentFindMany.mockResolvedValue([]);

      const result = await getCrewStatus('proj-1');

      expect(result.criticalPathImpacted).toBe(true);
      // 100% gap, critical path impacted, gap > 20% => red
      expect(result.crewGapPct).toBe(100);
      expect(result.gapStatus).toBe('red');
    });

    it('handles missing attendance record gracefully (treats as 0 present)', async () => {
      mockScheduleActivityFindMany.mockResolvedValue([
        { id: 'act-1', isCritical: false },
      ]);
      mockAttendanceFindUnique.mockResolvedValue(null);
      mockEquipmentFindMany.mockResolvedValue([]);

      const result = await getCrewStatus('proj-1');

      expect(result.plannedCrewToday).toBe(1);
      expect(result.confirmedPresent).toBe(0);
      expect(result.crewGapPct).toBe(100);
      expect(result.gapStatus).toBe('red');
      expect(result.absentCount).toBe(1);
    });

    it('returns zero gap when no activities planned today', async () => {
      mockScheduleActivityFindMany.mockResolvedValue([]);
      mockAttendanceFindUnique.mockResolvedValue(null);
      mockEquipmentFindMany.mockResolvedValue([]);

      const result = await getCrewStatus('proj-1');

      expect(result.plannedCrewToday).toBe(0);
      expect(result.confirmedPresent).toBe(0);
      expect(result.crewGapPct).toBe(0);
      expect(result.gapStatus).toBe('green');
    });

    it('uses stored absent/late counts when present in the attendance record', async () => {
      mockScheduleActivityFindMany.mockResolvedValue([{ id: 'a-1', isCritical: false }]);
      mockAttendanceFindUnique.mockResolvedValue({
        workerCount: 5,
        hours: 40,
        presentCount: 5,
        absentCount: 7,
        lateCount: 2,
      });
      mockEquipmentFindMany.mockResolvedValue([]);

      const result = await getCrewStatus('proj-1');

      expect(result.absentCount).toBe(7);
      expect(result.lateCount).toBe(2);
    });
  });

  describe('upsertAttendance (with detail)', () => {
    it('creates a new attendance row when none exists for the date', async () => {
      mockAttendanceFindUnique.mockResolvedValue(null);
      mockAttendanceCreate.mockResolvedValue({ id: 'att-new', workerCount: 10, hours: 80 });
      const { upsertAttendance } = await import('./resource.service');
      const result = await upsertAttendance('proj-1', new Date('2026-06-07'), 10, 80, {
        presentCount: 10,
        absentCount: 0,
        lateCount: 0,
        notes: 'Full crew',
        affectedActivities: ['a-1'],
      });
      expect(result.id).toBe('att-new');
      expect(mockAttendanceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workerCount: 10,
            hours: 80,
            presentCount: 10,
            notes: 'Full crew',
            affectedActivities: ['a-1'],
          }),
        })
      );
    });

    it('updates an existing attendance row for the same date', async () => {
      mockAttendanceFindUnique.mockResolvedValue({ id: 'att-1', workerCount: 5, hours: 40 });
      mockAttendanceUpdate.mockResolvedValue({ id: 'att-1', workerCount: 8, hours: 64 });
      const { upsertAttendance } = await import('./resource.service');
      const result = await upsertAttendance('proj-1', new Date('2026-06-07'), 8, 64, {
        presentCount: 8,
        absentCount: 1,
        lateCount: 0,
      });
      expect(result.id).toBe('att-1');
      expect(mockAttendanceUpdate).toHaveBeenCalled();
    });
  });

  describe('getAttendanceForDate', () => {
    it('returns the attendance record for a specific date', async () => {
      mockAttendanceFindUnique.mockResolvedValue({ id: 'att-1', workerCount: 5, hours: 40 });
      const { getAttendanceForDate } = await import('./resource.service');
      const result = await getAttendanceForDate('proj-1', new Date('2026-06-07'));
      expect(result).toEqual({ id: 'att-1', workerCount: 5, hours: 40 });
    });

    it('returns null when no record exists', async () => {
      mockAttendanceFindUnique.mockResolvedValue(null);
      const { getAttendanceForDate } = await import('./resource.service');
      const result = await getAttendanceForDate('proj-1', new Date('2026-06-07'));
      expect(result).toBeNull();
    });
  });

  describe('logEquipmentStatus', () => {
    it('updates the equipment row and creates a status log entry', async () => {
      mockEquipmentUpdate.mockResolvedValue({ id: 'eq-1', totalHours: 8 });
      mockEquipmentStatusLogCreate.mockResolvedValue({
        id: 'log-1',
        equipmentId: 'eq-1',
        status: 'active',
        hours: 8,
      });
      const { logEquipmentStatus } = await import('./resource.service');
      const result = await logEquipmentStatus({
        equipmentId: 'eq-1',
        date: new Date('2026-06-07'),
        status: 'active',
        hours: 8,
        notes: 'Worked all day',
      });
      expect(result.id).toBe('log-1');
      expect(mockEquipmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'eq-1' },
          data: expect.objectContaining({
            status: 'active',
            totalHours: { increment: 8 },
          }),
        })
      );
      expect(mockEquipmentStatusLogCreate).toHaveBeenCalled();
    });

    it('does not set lastUsageDate when hours are zero', async () => {
      mockEquipmentUpdate.mockResolvedValue({ id: 'eq-1' });
      mockEquipmentStatusLogCreate.mockResolvedValue({ id: 'log-2' });
      const { logEquipmentStatus } = await import('./resource.service');
      await logEquipmentStatus({
        equipmentId: 'eq-1',
        date: new Date('2026-06-07'),
        status: 'idle',
        hours: 0,
      });
      expect(mockEquipmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ lastUsageDate: expect.anything() }),
        })
      );
    });
  });

  describe('getEquipmentStatusLog', () => {
    it('returns status logs with equipment relations', async () => {
      mockEquipmentStatusLogFindMany.mockResolvedValue([
        {
          id: 'log-1',
          equipmentId: 'eq-1',
          date: new Date('2026-06-07'),
          status: 'active',
          hours: 8,
          equipment: { id: 'eq-1', externalId: 'EQ-101', name: 'CAT 320' },
        },
      ]);
      const { getEquipmentStatusLog } = await import('./resource.service');
      const result = await getEquipmentStatusLog(
        'proj-1',
        new Date('2026-06-01'),
        new Date('2026-06-07')
      );
      expect(result).toHaveLength(1);
      expect(result[0].equipment?.name).toBe('CAT 320');
      expect(mockEquipmentStatusLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            equipment: { projectId: 'proj-1' },
          }),
          orderBy: { date: 'desc' },
        })
      );
    });
  });

  describe('createEquipment', () => {
    it('creates equipment with all fields and generates externalId', async () => {
      mockEquipmentCreate.mockResolvedValue({ id: 'eq-1' });
      const { createEquipment } = await import('./resource.service');
      const result = await createEquipment({
        projectId: 'proj-1',
        name: 'CAT 320 Excavator',
        type: 'Excavator',
        dailyRate: 850,
        isOwned: false,
        serialNumber: 'CAT320-12345',
        vendor: 'United Rentals',
        calDueDate: null,
      });
      expect(result.id).toBe('eq-1');
      expect(mockEquipmentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'proj-1',
            name: 'CAT 320 Excavator',
            type: 'Excavator',
            isOwned: false,
            serialNumber: 'CAT320-12345',
            vendor: 'United Rentals',
          }),
        })
      );
    });
  });

  describe('updateEquipment', () => {
    it('updates only the fields provided', async () => {
      mockEquipmentUpdate.mockResolvedValue({ id: 'eq-1' });
      const { updateEquipment } = await import('./resource.service');
      await updateEquipment('eq-1', { name: 'New Name', status: 'idle' });
      expect(mockEquipmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'eq-1' },
          data: expect.objectContaining({
            name: 'New Name',
            status: 'idle',
          }),
        })
      );
    });
  });

  describe('getEquipmentStatusHistory', () => {
    it('returns history for an equipment id, sorted by date desc', async () => {
      mockEquipmentStatusLogFindMany.mockResolvedValue([
        { id: 'log-1', date: new Date('2026-06-05'), status: 'active' },
        { id: 'log-2', date: new Date('2026-06-04'), status: 'idle' },
      ]);
      const { getEquipmentStatusHistory } = await import('./resource.service');
      const result = await getEquipmentStatusHistory('eq-1');
      expect(result).toHaveLength(2);
      expect(mockEquipmentStatusLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { equipmentId: 'eq-1' },
          orderBy: { date: 'desc' },
        })
      );
    });
  });

  describe('getEquipmentListForProject', () => {
    it('returns enriched equipment list with derived columns', async () => {
      const now = new Date();
      const old = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      // Use a real Prisma.Decimal so the service's instanceof check works
      const { Prisma } = require('@prisma/client');
      const decimal = new Prisma.Decimal('850');
      mockEquipmentFindMany.mockResolvedValue([
        {
          id: 'eq-1',
          externalId: 'EQ-0001',
          name: 'CAT 320',
          type: 'Excavator',
          status: 'active',
          dailyRate: decimal,
          isOwned: false,
          totalHours: 100,
          createdAt: old,
          updatedAt: now,
          calDueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
          lastUsageDate: now,
        },
      ]);
      const { getEquipmentListForProject } = await import('./resource.service');
      const result = await getEquipmentListForProject('proj-1');
      expect(result).toHaveLength(1);
      const item = result[0];
      expect(item.dailyRate).toBe(850);
      expect(item.totalCostToDate).toBe(850 * 100);
      expect(item.daysOnProject).toBeGreaterThanOrEqual(30);
      expect(item.calDueSoon).toBe(true);
    });

    it('calDueSoon is false when calDueDate is more than 30 days out', async () => {
      const now = new Date();
      mockEquipmentFindMany.mockResolvedValue([
        {
          id: 'eq-1',
          externalId: 'EQ-0001',
          name: 'Welder',
          type: 'Welder',
          status: 'active',
          dailyRate: null,
          isOwned: true,
          totalHours: 0,
          createdAt: now,
          updatedAt: now,
          calDueDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
          lastUsageDate: null,
        },
      ]);
      const { getEquipmentListForProject } = await import('./resource.service');
      const result = await getEquipmentListForProject('proj-1');
      expect(result[0].calDueSoon).toBe(false);
      expect(result[0].totalCostToDate).toBe(0);
    });
  });
});
