import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import {
  createChangeRequest,
  getChangeRequestById,
  getChangeRequestsByProject,
  calculateImpact,
  decideChangeRequest,
} from './change-request.service';
import { recalculateSchedule, calculateCriticalPathImpact } from './schedule.service';

jest.mock('./schedule.service', () => ({
  ...jest.requireActual('./schedule.service'),
  recalculateSchedule: jest.fn().mockResolvedValue(undefined),
  calculateCriticalPathImpact: jest.fn().mockReturnValue(3),
}));

const mockScheduleChangeRequestCreate = jest.fn();
const mockScheduleChangeRequestFindUnique = jest.fn();
const mockScheduleChangeRequestFindMany = jest.fn();
const mockScheduleChangeRequestUpdate = jest.fn();
const mockScheduleActivityFindUnique = jest.fn();
const mockScheduleActivityFindMany = jest.fn();
const mockScheduleActivityUpdate = jest.fn();
const mockProjectFindUnique = jest.fn();

const mockPrisma = {
  scheduleChangeRequest: {
    create: mockScheduleChangeRequestCreate,
    findUnique: mockScheduleChangeRequestFindUnique,
    findMany: mockScheduleChangeRequestFindMany,
    update: mockScheduleChangeRequestUpdate,
  },
  scheduleActivity: {
    findUnique: mockScheduleActivityFindUnique,
    findMany: mockScheduleActivityFindMany,
    update: mockScheduleActivityUpdate,
  },
  project: {
    findUnique: mockProjectFindUnique,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.clearAllMocks();
  setPrismaClient(mockPrisma);
});

describe('change-request.service', () => {
  describe('createChangeRequest', () => {
    it('creates a pending change request', async () => {
      const data = {
        projectId: 'proj-1',
        activityId: 'act-1',
        requestedBy: 'user-1',
        reasonCode: 'weather_delay',
        proposedStart: new Date('2026-02-01'),
        proposedEnd: new Date('2026-02-10'),
        impactDescription: 'Rain delay',
      };
      const created = { id: 'cr-1', ...data, status: 'pending' };
      mockScheduleChangeRequestCreate.mockResolvedValue(created);

      const result = await createChangeRequest(data);
      expect(mockScheduleChangeRequestCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          activityId: 'act-1',
          requestedBy: 'user-1',
          reasonCode: 'weather_delay',
          status: 'pending',
        }),
      });
      expect(result).toEqual(created);
    });
  });

  describe('getChangeRequestById', () => {
    it('returns change request with project', async () => {
      const request = { id: 'cr-1' };
      mockScheduleChangeRequestFindUnique.mockResolvedValue(request);

      const result = await getChangeRequestById('cr-1');
      expect(mockScheduleChangeRequestFindUnique).toHaveBeenCalledWith({
        where: { id: 'cr-1' },
        include: { project: true },
      });
      expect(result).toEqual(request);
    });
  });

  describe('getChangeRequestsByProject', () => {
    it('returns change requests ordered by createdAt desc', async () => {
      const requests = [{ id: 'cr-1' }, { id: 'cr-2' }];
      mockScheduleChangeRequestFindMany.mockResolvedValue(requests);

      const result = await getChangeRequestsByProject('proj-1');
      expect(mockScheduleChangeRequestFindMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(requests);
    });
  });

  describe('calculateImpact', () => {
    it('computes critical path impact and updates the request', async () => {
      const request = {
        id: 'cr-1',
        projectId: 'proj-1',
        activityId: 'act-1',
        proposedStart: new Date('2026-02-01'),
        proposedEnd: new Date('2026-02-15'),
      };
      const activity = {
        id: 'act-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-10'),
        duration: 10,
      };
      const allActivities = [activity];
      const project = { id: 'proj-1', startDate: new Date('2026-01-01') };

      mockScheduleChangeRequestFindUnique.mockResolvedValue(request);
      mockScheduleActivityFindUnique.mockResolvedValue(activity);
      mockScheduleActivityFindMany.mockResolvedValue(allActivities);
      mockProjectFindUnique.mockResolvedValue(project);
      mockScheduleChangeRequestUpdate.mockResolvedValue({
        ...request,
        criticalPathImpact: 3,
      });

      const result = await calculateImpact('cr-1');
      expect(calculateCriticalPathImpact).toHaveBeenCalled();
      expect(mockScheduleChangeRequestUpdate).toHaveBeenCalledWith({
        where: { id: 'cr-1' },
        data: { criticalPathImpact: 3 },
      });
      expect(result.criticalPathImpact).toBe(3);
    });

    it('throws if request not found', async () => {
      mockScheduleChangeRequestFindUnique.mockResolvedValue(null);
      await expect(calculateImpact('cr-1')).rejects.toThrow('Change request not found');
    });

    it('throws if no proposed dates available', async () => {
      const request = {
        id: 'cr-1',
        projectId: 'proj-1',
        activityId: 'act-1',
        proposedStart: null,
        proposedEnd: null,
      };
      const activity = {
        id: 'act-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-10'),
        duration: 10,
      };
      mockScheduleChangeRequestFindUnique.mockResolvedValue(request);
      mockScheduleActivityFindUnique.mockResolvedValue(activity);
      await expect(calculateImpact('cr-1')).rejects.toThrow(
        'No proposed dates available to calculate impact'
      );
    });
  });

  describe('decideChangeRequest', () => {
    it('approves request and applies proposed dates to activity', async () => {
      const request = {
        id: 'cr-1',
        projectId: 'proj-1',
        activityId: 'act-1',
        proposedStart: new Date('2026-02-01'),
        proposedEnd: new Date('2026-02-15'),
      };
      const activity = {
        id: 'act-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-10'),
        duration: 10,
      };

      mockScheduleChangeRequestFindUnique.mockResolvedValue(request);
      mockScheduleChangeRequestUpdate.mockResolvedValue({
        ...request,
        status: 'approved',
        decidedBy: 'pm-1',
        decidedAt: new Date(),
      });
      mockScheduleActivityFindUnique.mockResolvedValue(activity);
      mockScheduleActivityUpdate.mockResolvedValue({ ...activity });

      const result = await decideChangeRequest('cr-1', 'approved', 'pm-1', 'Approved');
      expect(mockScheduleChangeRequestUpdate).toHaveBeenCalledWith({
        where: { id: 'cr-1' },
        data: expect.objectContaining({
          status: 'approved',
          decidedBy: 'pm-1',
          decisionNotes: 'Approved',
        }),
      });
      expect(mockScheduleActivityUpdate).toHaveBeenCalledWith({
        where: { id: 'act-1' },
        data: expect.objectContaining({
          startDate: request.proposedStart,
          endDate: request.proposedEnd,
        }),
      });
      expect(recalculateSchedule).toHaveBeenCalledWith('proj-1');
      expect(result.status).toBe('approved');
    });

    it('modifies request with custom dates and applies them', async () => {
      const request = {
        id: 'cr-1',
        projectId: 'proj-1',
        activityId: 'act-1',
        proposedStart: new Date('2026-02-01'),
        proposedEnd: new Date('2026-02-15'),
      };
      const activity = {
        id: 'act-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-10'),
        duration: 10,
      };
      const modifiedDates = {
        startDate: new Date('2026-02-05'),
        endDate: new Date('2026-02-20'),
      };

      mockScheduleChangeRequestFindUnique.mockResolvedValue(request);
      mockScheduleChangeRequestUpdate.mockResolvedValue({
        ...request,
        status: 'modified',
        decidedBy: 'pm-1',
        decidedAt: new Date(),
      });
      mockScheduleActivityFindUnique.mockResolvedValue(activity);
      mockScheduleActivityUpdate.mockResolvedValue({ ...activity });

      const result = await decideChangeRequest(
        'cr-1',
        'modified',
        'pm-1',
        'Modified dates',
        modifiedDates
      );
      expect(mockScheduleActivityUpdate).toHaveBeenCalledWith({
        where: { id: 'act-1' },
        data: expect.objectContaining({
          startDate: modifiedDates.startDate,
          endDate: modifiedDates.endDate,
        }),
      });
      expect(recalculateSchedule).toHaveBeenCalledWith('proj-1');
      expect(result.status).toBe('modified');
    });

    it('rejects request without updating activity dates', async () => {
      const request = {
        id: 'cr-1',
        projectId: 'proj-1',
        activityId: 'act-1',
        proposedStart: new Date('2026-02-01'),
        proposedEnd: new Date('2026-02-15'),
      };

      mockScheduleChangeRequestFindUnique.mockResolvedValue(request);
      mockScheduleChangeRequestUpdate.mockResolvedValue({
        ...request,
        status: 'rejected',
        decidedBy: 'pm-1',
        decidedAt: new Date(),
      });

      const result = await decideChangeRequest('cr-1', 'rejected', 'pm-1', 'Not feasible');
      expect(mockScheduleActivityUpdate).not.toHaveBeenCalled();
      expect(recalculateSchedule).not.toHaveBeenCalled();
      expect(result.status).toBe('rejected');
    });

    it('throws if request not found', async () => {
      mockScheduleChangeRequestFindUnique.mockResolvedValue(null);
      await expect(
        decideChangeRequest('cr-1', 'approved', 'pm-1')
      ).rejects.toThrow('Change request not found');
    });
  });
});
