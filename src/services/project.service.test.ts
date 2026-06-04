import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import {
  createProject,
  getProjectById,
  updateProject,
  lockProjectStructure,
  addWorkBreakdownItem,
  deleteProject,
  setProjectOrgBridge,
} from './project.service';
import { PROJECT_STATUSES } from '../constants/status';

const mockProjectCreate = jest.fn();
const mockProjectFindUnique = jest.fn();
const mockProjectUpdate = jest.fn();
const mockWorkBreakdownItemCreate = jest.fn();
const mockWorkBreakdownItemCount = jest.fn();

const mockPrisma = {
  project: {
    create: mockProjectCreate,
    findUnique: mockProjectFindUnique,
    update: mockProjectUpdate,
  },
  workBreakdownItem: {
    create: mockWorkBreakdownItemCreate,
    count: mockWorkBreakdownItemCount,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.clearAllMocks();
  setPrismaClient(mockPrisma);
});

describe('project.service', () => {
  describe('createProject', () => {
    it('creates a project with the given data', async () => {
      const data = {
        name: 'Test Project',
        orgId: 'org-1',
        structureType: 'WBS' as const,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      };
      const created = { id: 'proj-1', ...data };
      mockProjectCreate.mockResolvedValue(created);

      const result = await createProject(data);
      expect(mockProjectCreate).toHaveBeenCalledWith({
        data: {
          name: 'Test Project',
          orgId: 'org-1',
          structureType: 'WBS',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          activeMilestones: undefined,
          superintendentAssignments: undefined,
        },
      });
      expect(result).toEqual(created);
    });
  });

  describe('getProjectById', () => {
    it('returns project with workBreakdownItems', async () => {
      const project = { id: 'proj-1', name: 'Test' };
      mockProjectFindUnique.mockResolvedValue(project);

      const result = await getProjectById('proj-1');
      expect(mockProjectFindUnique).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        include: { workBreakdownItems: true },
      });
      expect(result).toEqual(project);
    });
  });

  describe('updateProject', () => {
    it('updates allowed fields', async () => {
      const updated = { id: 'proj-1', name: 'Updated' };
      mockProjectUpdate.mockResolvedValue(updated);

      const result = await updateProject('proj-1', { name: 'Updated' });
      expect(mockProjectUpdate).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        data: { name: 'Updated' },
      });
      expect(result).toEqual(updated);
    });
  });

  describe('lockProjectStructure', () => {
    it('sets structureLocked to true', async () => {
      const project = { id: 'proj-1', structureLocked: false };
      const locked = { id: 'proj-1', structureLocked: true };
      mockProjectFindUnique.mockResolvedValue(project);
      mockProjectUpdate.mockResolvedValue(locked);

      const result = await lockProjectStructure('proj-1');
      expect(mockProjectUpdate).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        data: { structureLocked: true },
      });
      expect(result).toEqual(locked);
    });

    it('returns project if already locked (idempotent)', async () => {
      const project = { id: 'proj-1', structureLocked: true };
      mockProjectFindUnique.mockResolvedValue(project);

      const result = await lockProjectStructure('proj-1');
      expect(mockProjectUpdate).not.toHaveBeenCalled();
      expect(result).toEqual(project);
    });

    it('throws if project not found', async () => {
      mockProjectFindUnique.mockResolvedValue(null);
      await expect(lockProjectStructure('proj-1')).rejects.toThrow('Project not found');
    });
  });

  describe('addWorkBreakdownItem', () => {
    it('adds item and locks structure on first item', async () => {
      const project = { id: 'proj-1', structureType: 'WBS' };
      const item = { id: 'wbs-1', projectId: 'proj-1', code: '1.1', name: 'Foundation' };
      mockProjectFindUnique.mockResolvedValue(project);
      mockWorkBreakdownItemCount.mockResolvedValue(0);
      mockWorkBreakdownItemCreate.mockResolvedValue(item);
      mockProjectUpdate.mockResolvedValue({ ...project, structureLocked: true });

      const result = await addWorkBreakdownItem('proj-1', {
        code: '1.1',
        name: 'Foundation',
      });
      expect(mockWorkBreakdownItemCreate).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          structureType: 'WBS',
          code: '1.1',
          name: 'Foundation',
          parentId: undefined,
          level: 1,
        },
      });
      expect(mockProjectUpdate).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        data: { structureLocked: true },
      });
      expect(result).toEqual(item);
    });

    it('does not lock structure on subsequent items', async () => {
      const project = { id: 'proj-1', structureType: 'WBS' };
      const item = { id: 'wbs-2', projectId: 'proj-1', code: '1.2', name: 'Walls' };
      mockProjectFindUnique.mockResolvedValue(project);
      mockWorkBreakdownItemCount.mockResolvedValue(3);
      mockWorkBreakdownItemCreate.mockResolvedValue(item);

      const result = await addWorkBreakdownItem('proj-1', { code: '1.2', name: 'Walls' });
      expect(mockProjectUpdate).not.toHaveBeenCalled();
      expect(result).toEqual(item);
    });

    it('throws if project not found', async () => {
      mockProjectFindUnique.mockResolvedValue(null);
      await expect(
        addWorkBreakdownItem('proj-1', { code: '1.1', name: 'X' })
      ).rejects.toThrow('Project not found');
    });

    it('throws if structureType not set', async () => {
      mockProjectFindUnique.mockResolvedValue({ id: 'proj-1', structureType: null });
      await expect(
        addWorkBreakdownItem('proj-1', { code: '1.1', name: 'X' })
      ).rejects.toThrow('Project structure type must be set before adding work breakdown items');
    });
  });

  describe('deleteProject', () => {
    it('soft deletes by setting status to cancelled', async () => {
      const updated = { id: 'proj-1', status: PROJECT_STATUSES.CANCELLED };
      mockProjectUpdate.mockResolvedValue(updated);

      const result = await deleteProject('proj-1');
      expect(mockProjectUpdate).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        data: { status: PROJECT_STATUSES.CANCELLED },
      });
      expect(result).toEqual(updated);
    });
  });

  describe('setProjectOrgBridge', () => {
    it('sets orgId on project', async () => {
      const updated = { id: 'proj-1', orgId: 'org-2' };
      mockProjectUpdate.mockResolvedValue(updated);

      const result = await setProjectOrgBridge('proj-1', 'org-2');
      expect(mockProjectUpdate).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        data: { orgId: 'org-2' },
      });
      expect(result).toEqual(updated);
    });
  });
});
