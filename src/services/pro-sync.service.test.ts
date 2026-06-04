import { Firestore } from 'firebase-admin/firestore';
import {
  setFirestoreInstance,
  replicateProjectToFirestore,
  updateFirestoreProject,
  deleteFirestoreProject,
} from './pro-sync.service';

const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockDoc = jest.fn(() => ({
  set: mockSet,
  update: mockUpdate,
  delete: mockDelete,
}));
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
}));

const mockDb = {
  collection: mockCollection,
} as unknown as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
  setFirestoreInstance(mockDb);
});

describe('pro-sync.service', () => {
  describe('replicateProjectToFirestore', () => {
    it('writes project metadata to Firestore', async () => {
      const project = {
        id: 'proj-1',
        name: 'Test Project',
        status: 'active',
        orgId: 'org-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        activeMilestones: [{ name: 'Kickoff', date: '2026-01-15' }],
        superintendentAssignments: [{ userId: 'u1', name: 'Alice' }],
        updatedAt: new Date('2026-06-01'),
        createdAt: new Date('2026-01-01'),
        structureType: 'WBS',
        structureLocked: false,
      };

      mockSet.mockResolvedValue(undefined);

      await replicateProjectToFirestore(project);

      expect(mockCollection).toHaveBeenCalledWith('projects');
      expect(mockDoc).toHaveBeenCalledWith('proj-1');
      expect(mockSet).toHaveBeenCalledWith({
        project_id: 'proj-1',
        project_name: 'Test Project',
        status: 'active',
        schedule_start: new Date('2026-01-01'),
        schedule_end: new Date('2026-12-31'),
        active_milestones: [{ name: 'Kickoff', date: '2026-01-15' }],
        superintendent_assignments: [{ userId: 'u1', name: 'Alice' }],
        org_id: 'org-1',
        updated_at: new Date('2026-06-01'),
      });
    });

    it('handles null optional fields', async () => {
      const project = {
        id: 'proj-2',
        name: 'Minimal Project',
        status: 'planning',
        orgId: 'org-2',
        startDate: null,
        endDate: null,
        activeMilestones: null,
        superintendentAssignments: null,
        updatedAt: new Date('2026-06-01'),
        createdAt: new Date('2026-01-01'),
        structureType: 'COST_CODE',
        structureLocked: false,
      };

      mockSet.mockResolvedValue(undefined);

      await replicateProjectToFirestore(project);

      expect(mockSet).toHaveBeenCalledWith({
        project_id: 'proj-2',
        project_name: 'Minimal Project',
        status: 'planning',
        schedule_start: null,
        schedule_end: null,
        active_milestones: null,
        superintendent_assignments: null,
        org_id: 'org-2',
        updated_at: new Date('2026-06-01'),
      });
    });

    it('logs error and does not throw on Firestore failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const project = {
        id: 'proj-3',
        name: 'Fail Project',
        status: 'active',
        orgId: 'org-3',
        startDate: null,
        endDate: null,
        activeMilestones: null,
        superintendentAssignments: null,
        updatedAt: new Date('2026-06-01'),
        createdAt: new Date('2026-01-01'),
        structureType: 'WBS',
        structureLocked: false,
      };

      mockSet.mockRejectedValue(new Error('Firestore down'));

      await expect(replicateProjectToFirestore(project)).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to replicate project to Firestore:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('updateFirestoreProject', () => {
    it('applies partial update with updated_at', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await updateFirestoreProject('proj-1', { status: 'completed' });

      expect(mockCollection).toHaveBeenCalledWith('projects');
      expect(mockDoc).toHaveBeenCalledWith('proj-1');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          updated_at: expect.any(Date),
        })
      );
    });

    it('respects provided updated_at', async () => {
      mockUpdate.mockResolvedValue(undefined);
      const customDate = new Date('2026-06-15');

      await updateFirestoreProject('proj-1', { status: 'on_hold', updated_at: customDate });

      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'on_hold',
        updated_at: customDate,
      });
    });

    it('logs error and does not throw on Firestore failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockUpdate.mockRejectedValue(new Error('Firestore down'));

      await expect(
        updateFirestoreProject('proj-1', { status: 'active' })
      ).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to update Firestore project:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('deleteFirestoreProject', () => {
    it('deletes the Firestore document', async () => {
      mockDelete.mockResolvedValue(undefined);

      await deleteFirestoreProject('proj-1');

      expect(mockCollection).toHaveBeenCalledWith('projects');
      expect(mockDoc).toHaveBeenCalledWith('proj-1');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('logs error and does not throw on Firestore failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockDelete.mockRejectedValue(new Error('Firestore down'));

      await expect(deleteFirestoreProject('proj-1')).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to delete Firestore project:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
