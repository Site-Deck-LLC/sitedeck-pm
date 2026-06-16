import { jest } from '@jest/globals';
import {
  listMilestonesForProject,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  SubcontractMilestoneNotFoundError,
  SubcontractMilestoneValidationError,
  syncFromActivity,
} from './subcontract-milestones.service';

jest.mock('../lib/prisma', () => {
  const subcontractMilestone = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  };
  const subcontract = {
    findUnique: jest.fn(),
  };
  const unifiedChangeLog = {
    create: jest.fn(),
  };
  return {
    getPrismaClient: () => ({
      subcontractMilestone,
      subcontract,
      unifiedChangeLog,
    }),
  };
});

const prismaMock = require('../lib/prisma').getPrismaClient() as any;

describe('subcontract-milestones.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listMilestonesForProject', () => {
    it('returns milestones for all subcontracts in a project', async () => {
      prismaMock.subcontractMilestone.findMany.mockResolvedValueOnce([
        { id: 'm1', subcontractId: 's1', name: 'Foundation complete', plannedDate: new Date('2026-07-01') },
      ]);
      const out = await listMilestonesForProject('p1');
      expect(out).toHaveLength(1);
      expect(prismaMock.subcontractMilestone.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { subcontract: { projectId: 'p1' } },
          orderBy: { plannedDate: 'asc' },
        })
      );
    });
  });

  describe('createMilestone', () => {
    it('creates a milestone and writes a unified change log entry', async () => {
      prismaMock.subcontract.findUnique.mockResolvedValueOnce({ id: 's1', projectId: 'p1' });
      prismaMock.subcontractMilestone.create.mockResolvedValueOnce({
        id: 'm1',
        subcontractId: 's1',
        name: 'Foundation complete',
        plannedDate: new Date('2026-07-01'),
      });
      const out = await createMilestone(
        { subcontractId: 's1', name: 'Foundation complete', plannedDate: '2026-07-01', billingTrigger: true },
        'u-pm'
      );
      expect(out.id).toBe('m1');
      expect(prismaMock.unifiedChangeLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'p1',
            module: 'subcontracts',
            changeType: 'milestone_created',
            affectedRecordId: 'm1',
            affectedRecordType: 'subcontract_milestone',
            changedBy: 'u-pm',
          }),
        })
      );
    });

    it('throws when subcontract is not found', async () => {
      prismaMock.subcontract.findUnique.mockResolvedValueOnce(null);
      await expect(
        createMilestone({ subcontractId: 'sX', name: 'X', plannedDate: '2026-07-01' }, 'u-pm')
      ).rejects.toThrow(SubcontractMilestoneValidationError);
    });

    it('throws when name is empty', async () => {
      await expect(
        createMilestone({ subcontractId: 's1', name: '  ', plannedDate: '2026-07-01' }, 'u-pm')
      ).rejects.toThrow(SubcontractMilestoneValidationError);
    });

    it('throws when plannedDate is invalid', async () => {
      await expect(
        createMilestone({ subcontractId: 's1', name: 'X', plannedDate: 'not-a-date' }, 'u-pm')
      ).rejects.toThrow(SubcontractMilestoneValidationError);
    });
  });

  describe('updateMilestone', () => {
    const existing = {
      id: 'm1',
      subcontractId: 's1',
      name: 'Old name',
      status: 'pending',
      actualDate: null,
      subcontract: { projectId: 'p1' },
    };

    it('updates fields and logs to the change log', async () => {
      prismaMock.subcontractMilestone.findUnique.mockResolvedValueOnce(existing);
      prismaMock.subcontractMilestone.update.mockResolvedValueOnce({ ...existing, name: 'New name' });
      const out = await updateMilestone('m1', { name: 'New name' }, 'u-pm');
      expect(out.name).toBe('New name');
      expect(prismaMock.unifiedChangeLog.create).toHaveBeenCalled();
    });

    it('auto-sets actualDate when status moves to completed', async () => {
      prismaMock.subcontractMilestone.findUnique.mockResolvedValueOnce(existing);
      prismaMock.subcontractMilestone.update.mockResolvedValueOnce({ ...existing, status: 'completed' });
      await updateMilestone('m1', { status: 'completed' }, 'u-pm');
      const call = prismaMock.subcontractMilestone.update.mock.calls[0][0];
      expect(call.data.status).toBe('completed');
      expect(call.data.actualDate).toBeInstanceOf(Date);
    });

    it('rejects invalid status values', async () => {
      prismaMock.subcontractMilestone.findUnique.mockResolvedValueOnce(existing);
      await expect(
        updateMilestone('m1', { status: 'not-a-status' as any }, 'u-pm')
      ).rejects.toThrow(SubcontractMilestoneValidationError);
    });

    it('throws NotFound when the row is missing', async () => {
      prismaMock.subcontractMilestone.findUnique.mockResolvedValueOnce(null);
      await expect(updateMilestone('m1', { name: 'X' }, 'u-pm')).rejects.toThrow(
        SubcontractMilestoneNotFoundError
      );
    });
  });

  describe('deleteMilestone', () => {
    it('soft-deletes via Prisma delete and logs the change', async () => {
      prismaMock.subcontractMilestone.findUnique.mockResolvedValueOnce({
        id: 'm1',
        name: 'X',
        subcontract: { projectId: 'p1' },
      });
      prismaMock.subcontractMilestone.delete.mockResolvedValueOnce({ id: 'm1' });
      const out = await deleteMilestone('m1', 'u-pm');
      expect(out).toEqual({ id: 'm1' });
      expect(prismaMock.unifiedChangeLog.create).toHaveBeenCalled();
    });

    it('throws NotFound when row missing', async () => {
      prismaMock.subcontractMilestone.findUnique.mockResolvedValueOnce(null);
      await expect(deleteMilestone('m1', 'u-pm')).rejects.toThrow(SubcontractMilestoneNotFoundError);
    });
  });

  describe('syncFromActivity', () => {
    it('updates all incomplete milestones linked to an activity', async () => {
      prismaMock.subcontractMilestone.findMany.mockResolvedValueOnce([
        { id: 'm1' },
        { id: 'm2' },
      ]);
      prismaMock.subcontractMilestone.updateMany.mockResolvedValueOnce({ count: 2 });
      const n = await syncFromActivity('a1', new Date('2026-08-01'));
      expect(n).toBe(2);
    });

    it('skips completed milestones (those with actualDate set)', async () => {
      // The findMany query is expected to filter out milestones with actualDate != null
      prismaMock.subcontractMilestone.findMany.mockResolvedValueOnce([{ id: 'm1' }]);
      prismaMock.subcontractMilestone.updateMany.mockResolvedValueOnce({ count: 1 });
      const n = await syncFromActivity('a1', new Date('2026-08-01'));
      expect(n).toBe(1);
    });

    it('returns 0 when no milestones are linked', async () => {
      prismaMock.subcontractMilestone.findMany.mockResolvedValueOnce([]);
      const n = await syncFromActivity('a1', new Date('2026-08-01'));
      expect(n).toBe(0);
      expect(prismaMock.subcontractMilestone.updateMany).not.toHaveBeenCalled();
    });
  });
});
