import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import {
  createBaseline,
  lockBaseline,
  getBaselineById,
  getBaselinesByProject,
  compareToBaseline,
  canRebaseline,
} from './baseline.service';
import { ROLES } from '../constants/roles';

const mockScheduleActivityFindMany = jest.fn();
const mockScheduleBaselineCreate = jest.fn();
const mockScheduleBaselineFindUnique = jest.fn();
const mockScheduleBaselineFindMany = jest.fn();
const mockScheduleBaselineUpdate = jest.fn();

const mockPrisma = {
  scheduleActivity: {
    findMany: mockScheduleActivityFindMany,
  },
  scheduleBaseline: {
    create: mockScheduleBaselineCreate,
    findUnique: mockScheduleBaselineFindUnique,
    findMany: mockScheduleBaselineFindMany,
    update: mockScheduleBaselineUpdate,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.clearAllMocks();
  setPrismaClient(mockPrisma);
});

describe('baseline.service', () => {
  describe('createBaseline', () => {
    it('snapshots current activities into a baseline record', async () => {
      const activities = [
        {
          id: 'act-1',
          name: 'Foundation',
          description: null,
          wbsItemId: null,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-10'),
          duration: 10,
          percentComplete: 0,
          status: 'not_started',
          isMilestone: false,
          isCritical: false,
          predecessors: null,
          successors: null,
        },
      ];
      mockScheduleActivityFindMany.mockResolvedValue(activities);
      mockScheduleBaselineCreate.mockResolvedValue({ id: 'base-1' });

      const result = await createBaseline('proj-1', 'Kickoff Baseline', 'user-1');
      expect(mockScheduleActivityFindMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
      });
      expect(mockScheduleBaselineCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'proj-1',
            name: 'Kickoff Baseline',
            locked: false,
            createdBy: 'user-1',
            activities: expect.any(Array),
          }),
        })
      );
      expect(result).toEqual({ id: 'base-1' });
    });
  });

  describe('lockBaseline', () => {
    it('sets locked to true', async () => {
      const baseline = { id: 'base-1', locked: false };
      const locked = { id: 'base-1', locked: true };
      mockScheduleBaselineFindUnique.mockResolvedValue(baseline);
      mockScheduleBaselineUpdate.mockResolvedValue(locked);

      const result = await lockBaseline('base-1');
      expect(mockScheduleBaselineUpdate).toHaveBeenCalledWith({
        where: { id: 'base-1' },
        data: { locked: true },
      });
      expect(result).toEqual(locked);
    });

    it('returns baseline if already locked (idempotent)', async () => {
      const baseline = { id: 'base-1', locked: true };
      mockScheduleBaselineFindUnique.mockResolvedValue(baseline);

      const result = await lockBaseline('base-1');
      expect(mockScheduleBaselineUpdate).not.toHaveBeenCalled();
      expect(result).toEqual(baseline);
    });

    it('throws if baseline not found', async () => {
      mockScheduleBaselineFindUnique.mockResolvedValue(null);
      await expect(lockBaseline('base-1')).rejects.toThrow('Baseline not found');
    });
  });

  describe('getBaselineById', () => {
    it('returns baseline', async () => {
      const baseline = { id: 'base-1' };
      mockScheduleBaselineFindUnique.mockResolvedValue(baseline);

      const result = await getBaselineById('base-1');
      expect(mockScheduleBaselineFindUnique).toHaveBeenCalledWith({
        where: { id: 'base-1' },
      });
      expect(result).toEqual(baseline);
    });
  });

  describe('getBaselinesByProject', () => {
    it('returns baselines ordered by createdAt desc', async () => {
      const baselines = [{ id: 'base-1' }, { id: 'base-2' }];
      mockScheduleBaselineFindMany.mockResolvedValue(baselines);

      const result = await getBaselinesByProject('proj-1');
      expect(mockScheduleBaselineFindMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(baselines);
    });
  });

  describe('compareToBaseline', () => {
    it('returns variance for matching activities', async () => {
      const baseline = {
        id: 'base-1',
        projectId: 'proj-1',
        activities: [
          {
            id: 'act-1',
            name: 'Foundation',
            startDate: '2026-01-01T00:00:00.000Z',
            endDate: '2026-01-10T00:00:00.000Z',
            duration: 10,
          },
        ],
      };
      const currentActivities = [
        {
          id: 'act-1',
          name: 'Foundation',
          startDate: new Date('2026-01-03'),
          endDate: new Date('2026-01-12'),
          duration: 10,
        },
      ];
      mockScheduleBaselineFindUnique.mockResolvedValue(baseline);
      mockScheduleActivityFindMany.mockResolvedValue(currentActivities);

      const result = await compareToBaseline('proj-1', 'base-1');
      expect(result).toHaveLength(1);
      expect(result[0].activityId).toBe('act-1');
      expect(result[0].startVarianceDays).toBeCloseTo(2);
      expect(result[0].finishVarianceDays).toBeCloseTo(2);
    });

    it('throws if baseline not found', async () => {
      mockScheduleBaselineFindUnique.mockResolvedValue(null);
      await expect(compareToBaseline('proj-1', 'base-1')).rejects.toThrow(
        'Baseline not found'
      );
    });

    it('throws if baseline belongs to different project', async () => {
      mockScheduleBaselineFindUnique.mockResolvedValue({
        id: 'base-1',
        projectId: 'proj-2',
      });
      await expect(compareToBaseline('proj-1', 'base-1')).rejects.toThrow(
        'Baseline does not belong to project'
      );
    });
  });

  describe('canRebaseline', () => {
    it('returns true for owner_admin', () => {
      expect(canRebaseline('proj-1', ROLES.OWNER_ADMIN)).toBe(true);
    });

    it('returns true for project_manager', () => {
      expect(canRebaseline('proj-1', ROLES.PROJECT_MANAGER)).toBe(true);
    });

    it('returns false for superintendent', () => {
      expect(canRebaseline('proj-1', ROLES.SUPERINTENDENT)).toBe(false);
    });

    it('returns false for field_crew', () => {
      expect(canRebaseline('proj-1', ROLES.FIELD_CREW)).toBe(false);
    });

    it('returns false for subcontractor roles', () => {
      expect(canRebaseline('proj-1', ROLES.SUBCONTRACTOR_PM)).toBe(false);
      expect(canRebaseline('proj-1', ROLES.SUBCONTRACTOR_SUPER)).toBe(false);
    });
  });
});
