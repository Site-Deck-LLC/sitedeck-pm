import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import {
  createActivity,
  getActivityById,
  getActivitiesByProject,
  updateActivity,
  deleteActivity,
  markActivityReady,
  markActivityComplete,
} from './activity.service';
import { recalculateSchedule } from './schedule.service';

jest.mock('./schedule.service', () => ({
  ...jest.requireActual('./schedule.service'),
  recalculateSchedule: jest.fn().mockResolvedValue(undefined),
}));

const mockScheduleActivityCreate = jest.fn();
const mockScheduleActivityFindUnique = jest.fn();
const mockScheduleActivityFindMany = jest.fn();
const mockScheduleActivityUpdate = jest.fn();
const mockScheduleActivityDelete = jest.fn();

const mockPrisma = {
  scheduleActivity: {
    create: mockScheduleActivityCreate,
    findUnique: mockScheduleActivityFindUnique,
    findMany: mockScheduleActivityFindMany,
    update: mockScheduleActivityUpdate,
    delete: mockScheduleActivityDelete,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.clearAllMocks();
  setPrismaClient(mockPrisma);
});

describe('activity.service', () => {
  describe('createActivity', () => {
    it('creates an activity and recalculates schedule', async () => {
      const data = {
        projectId: 'proj-1',
        name: 'Foundation',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-10'),
        duration: 10,
      };
      const created = { id: 'act-1', ...data };
      mockScheduleActivityCreate.mockResolvedValue(created);

      const result = await createActivity(data);
      expect(mockScheduleActivityCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          name: 'Foundation',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-10'),
          duration: 10,
          status: 'not_started',
        }),
      });
      expect(recalculateSchedule).toHaveBeenCalledWith('proj-1');
      expect(result).toEqual(created);
    });
  });

  describe('getActivityById', () => {
    it('returns activity by id', async () => {
      const activity = { id: 'act-1', name: 'Foundation' };
      mockScheduleActivityFindUnique.mockResolvedValue(activity);

      const result = await getActivityById('act-1');
      expect(mockScheduleActivityFindUnique).toHaveBeenCalledWith({
        where: { id: 'act-1' },
      });
      expect(result).toEqual(activity);
    });
  });

  describe('getActivitiesByProject', () => {
    it('returns activities ordered by startDate', async () => {
      const activities = [{ id: 'act-1' }, { id: 'act-2' }];
      mockScheduleActivityFindMany.mockResolvedValue(activities);

      const result = await getActivitiesByProject('proj-1');
      expect(mockScheduleActivityFindMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { startDate: 'asc' },
      });
      expect(result).toEqual(activities);
    });
  });

  describe('updateActivity', () => {
    it('updates activity and recalculates schedule', async () => {
      const existing = { id: 'act-1', projectId: 'proj-1', name: 'Foundation' };
      const updated = { id: 'act-1', projectId: 'proj-1', name: 'Updated' };
      mockScheduleActivityFindUnique.mockResolvedValue(existing);
      mockScheduleActivityUpdate.mockResolvedValue(updated);

      const result = await updateActivity('act-1', { name: 'Updated' });
      expect(mockScheduleActivityUpdate).toHaveBeenCalledWith({
        where: { id: 'act-1' },
        data: { name: 'Updated' },
      });
      expect(recalculateSchedule).toHaveBeenCalledWith('proj-1');
      expect(result).toEqual(updated);
    });

    it('throws if activity not found', async () => {
      mockScheduleActivityFindUnique.mockResolvedValue(null);
      await expect(updateActivity('act-1', { name: 'X' })).rejects.toThrow(
        'Activity not found'
      );
    });
  });

  describe('deleteActivity', () => {
    it('deletes activity and recalculates schedule', async () => {
      const existing = { id: 'act-1', projectId: 'proj-1' };
      mockScheduleActivityFindUnique.mockResolvedValue(existing);
      mockScheduleActivityDelete.mockResolvedValue(existing);

      const result = await deleteActivity('act-1');
      expect(mockScheduleActivityDelete).toHaveBeenCalledWith({
        where: { id: 'act-1' },
      });
      expect(recalculateSchedule).toHaveBeenCalledWith('proj-1');
      expect(result).toEqual(existing);
    });

    it('throws if activity not found', async () => {
      mockScheduleActivityFindUnique.mockResolvedValue(null);
      await expect(deleteActivity('act-1')).rejects.toThrow('Activity not found');
    });
  });

  describe('markActivityReady', () => {
    it('sets status to not_started', async () => {
      const existing = { id: 'act-1', status: 'delayed' };
      const updated = { id: 'act-1', status: 'not_started' };
      mockScheduleActivityFindUnique.mockResolvedValue(existing);
      mockScheduleActivityUpdate.mockResolvedValue(updated);

      const result = await markActivityReady('act-1');
      expect(mockScheduleActivityUpdate).toHaveBeenCalledWith({
        where: { id: 'act-1' },
        data: { status: 'not_started' },
      });
      expect(result).toEqual(updated);
    });

    it('throws if activity not found', async () => {
      mockScheduleActivityFindUnique.mockResolvedValue(null);
      await expect(markActivityReady('act-1')).rejects.toThrow('Activity not found');
    });
  });

  describe('markActivityComplete', () => {
    it('sets percentComplete to 100, status to complete, and recalculates schedule', async () => {
      const existing = { id: 'act-1', projectId: 'proj-1' };
      const completedAt = new Date('2026-01-15');
      const updated = {
        id: 'act-1',
        percentComplete: 100,
        status: 'complete',
        endDate: completedAt,
      };
      mockScheduleActivityFindUnique.mockResolvedValue(existing);
      mockScheduleActivityUpdate.mockResolvedValue(updated);

      const result = await markActivityComplete('act-1', 'user-1', completedAt);
      expect(mockScheduleActivityUpdate).toHaveBeenCalledWith({
        where: { id: 'act-1' },
        data: {
          percentComplete: 100,
          status: 'complete',
          endDate: completedAt,
        },
      });
      expect(recalculateSchedule).toHaveBeenCalledWith('proj-1');
      expect(result).toEqual(updated);
    });

    it('throws if activity not found', async () => {
      mockScheduleActivityFindUnique.mockResolvedValue(null);
      await expect(
        markActivityComplete('act-1', 'user-1', new Date())
      ).rejects.toThrow('Activity not found');
    });
  });
});
