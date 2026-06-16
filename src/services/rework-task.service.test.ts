import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import {
  createReworkTask,
  listReworkTasks,
  getReworkTask,
  updateReworkTaskStatus,
  assignReworkTask,
} from './rework-task.service';

const mockReworkTaskCreate = jest.fn();
const mockReworkTaskFindFirst = jest.fn();
const mockReworkTaskFindUnique = jest.fn();
const mockReworkTaskFindMany = jest.fn();
const mockReworkTaskUpdate = jest.fn();

const mockPrisma = {
  reworkTask: {
    create: mockReworkTaskCreate,
    findFirst: mockReworkTaskFindFirst,
    findUnique: mockReworkTaskFindUnique,
    findMany: mockReworkTaskFindMany,
    update: mockReworkTaskUpdate,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.resetAllMocks();
  setPrismaClient(mockPrisma);
});

describe('rework-task.service', () => {
  describe('createReworkTask', () => {
    it('creates a manual rework task', async () => {
      mockReworkTaskFindFirst.mockResolvedValue(null);
      mockReworkTaskCreate.mockResolvedValue({
        id: 'task-1',
        projectId: 'proj-1',
        source: 'manual',
        title: 'Fix concrete finish',
        status: 'open',
        priority: 'medium',
      });

      const task = await createReworkTask({
        projectId: 'proj-1',
        source: 'manual',
        title: 'Fix concrete finish',
        createdBy: 'user-1',
      });

      expect(task.id).toBe('task-1');
      expect(mockReworkTaskCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'proj-1',
            source: 'manual',
            title: 'Fix concrete finish',
            createdBy: 'user-1',
            status: 'open',
            priority: 'medium',
          }),
        })
      );
    });

    it('is idempotent by sourceEventId', async () => {
      mockReworkTaskFindFirst.mockResolvedValue({ id: 'task-existing' });

      const task = await createReworkTask({
        projectId: 'proj-1',
        source: 'ncr',
        title: 'NCR rework',
        sourceEventId: 'evt-1',
      });

      expect(task.id).toBe('task-existing');
      expect(mockReworkTaskCreate).not.toHaveBeenCalled();
    });

    it('is idempotent by ncrId', async () => {
      mockReworkTaskFindFirst.mockResolvedValueOnce({ id: 'task-ncr' });

      const task = await createReworkTask({
        projectId: 'proj-1',
        source: 'ncr',
        title: 'NCR rework',
        ncrId: 'ncr-1',
      });

      expect(task.id).toBe('task-ncr');
      expect(mockReworkTaskCreate).not.toHaveBeenCalled();
    });

    it('parses severity into priority for ncr events', async () => {
      mockReworkTaskFindFirst.mockResolvedValue(null);
      mockReworkTaskCreate.mockResolvedValue({ id: 'task-1' });

      await createReworkTask({
        projectId: 'proj-1',
        source: 'ncr',
        title: 'Critical NCR',
        priority: 'critical',
      });

      expect(mockReworkTaskCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priority: 'critical' }),
        })
      );
    });

    it('throws for missing projectId', async () => {
      await expect(
        createReworkTask({ projectId: '', source: 'manual', title: 'Bad task' })
      ).rejects.toThrow('projectId is required');
    });

    it('throws for missing title', async () => {
      await expect(
        createReworkTask({ projectId: 'proj-1', source: 'manual', title: '' })
      ).rejects.toThrow('title is required');
    });

    it('throws for invalid source', async () => {
      await expect(
        createReworkTask({ projectId: 'proj-1', source: 'invalid' as any, title: 'Bad source' })
      ).rejects.toThrow('Invalid source');
    });
  });

  describe('listReworkTasks', () => {
    it('lists tasks for a project', async () => {
      mockReworkTaskFindMany.mockResolvedValue([{ id: 'task-1' }, { id: 'task-2' }]);

      const tasks = await listReworkTasks('proj-1');

      expect(tasks).toHaveLength(2);
      expect(mockReworkTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'proj-1' },
          orderBy: [{ createdAt: 'desc' }],
        })
      );
    });

    it('applies status and source filters', async () => {
      mockReworkTaskFindMany.mockResolvedValue([{ id: 'task-1' }]);

      await listReworkTasks('proj-1', { status: ['open', 'in_progress'], source: 'ncr' });

      expect(mockReworkTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId: 'proj-1',
            status: { in: ['open', 'in_progress'] },
            source: { in: ['ncr'] },
          },
        })
      );
    });
  });

  describe('getReworkTask', () => {
    it('returns a task by id', async () => {
      mockReworkTaskFindUnique.mockResolvedValue({ id: 'task-1', title: 'Fix paint' });

      const task = await getReworkTask('task-1');

      expect(task?.title).toBe('Fix paint');
    });
  });

  describe('updateReworkTaskStatus', () => {
    it('updates status and sets resolvedAt for resolved', async () => {
      mockReworkTaskFindUnique.mockResolvedValue({ id: 'task-1', status: 'open' });
      mockReworkTaskUpdate.mockResolvedValue({ id: 'task-1', status: 'resolved', resolvedAt: new Date() });

      const task = await updateReworkTaskStatus('task-1', 'resolved', 'user-1');

      expect(task.status).toBe('resolved');
      expect(mockReworkTaskUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ status: 'resolved', resolvedAt: expect.any(Date) }),
        })
      );
    });

    it('clears resolvedAt when moving back to open', async () => {
      mockReworkTaskFindUnique.mockResolvedValue({ id: 'task-1', status: 'resolved' });
      mockReworkTaskUpdate.mockResolvedValue({ id: 'task-1', status: 'open', resolvedAt: null });

      const task = await updateReworkTaskStatus('task-1', 'open', 'user-1');

      expect(task.status).toBe('open');
      expect(mockReworkTaskUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'open', resolvedAt: null }),
        })
      );
    });

    it('throws for invalid status', async () => {
      await expect(updateReworkTaskStatus('task-1', 'invalid' as any, 'user-1')).rejects.toThrow(
        'Invalid status'
      );
    });

    it('throws when task not found', async () => {
      mockReworkTaskFindUnique.mockResolvedValue(null);

      await expect(updateReworkTaskStatus('missing', 'resolved', 'user-1')).rejects.toThrow(
        'ReworkTask not found'
      );
    });
  });

  describe('assignReworkTask', () => {
    it('assigns a task to a user', async () => {
      mockReworkTaskFindUnique.mockResolvedValue({ id: 'task-1' });
      mockReworkTaskUpdate.mockResolvedValue({ id: 'task-1', assignedTo: 'user-2' });

      const task = await assignReworkTask('task-1', 'user-2', 'user-1');

      expect(task.assignedTo).toBe('user-2');
      expect(mockReworkTaskUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: { assignedTo: 'user-2' },
        })
      );
    });

    it('throws for missing assignedTo', async () => {
      await expect(assignReworkTask('task-1', '', 'user-1')).rejects.toThrow('assignedTo is required');
    });
  });
});
