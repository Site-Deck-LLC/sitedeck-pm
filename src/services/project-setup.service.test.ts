import { runProjectSetup, SetupWizardInput } from './project-setup.service';
import * as projectService from './project.service';
import * as proSyncService from './pro-sync.service';

jest.mock('./project.service');
jest.mock('./pro-sync.service');

const mockedCreateProject = jest.mocked(projectService.createProject);
const mockedAddWorkBreakdownItem = jest.mocked(projectService.addWorkBreakdownItem);
const mockedGetProjectById = jest.mocked(projectService.getProjectById);
const mockedReplicateProjectToFirestore = jest.mocked(
  proSyncService.replicateProjectToFirestore
);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('project-setup.service', () => {
  describe('runProjectSetup', () => {
    it('creates project, adds WBS items, replicates to Firestore, and returns full project', async () => {
      const input: SetupWizardInput = {
        name: 'New Project',
        orgId: 'org-1',
        structureType: 'WBS',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        milestones: [{ name: 'Kickoff' }],
        superintendentAssignments: [{ userId: 'u1', name: 'Alice' }],
        initialWbsItems: [{ code: '1.1', name: 'Foundation' }],
      };

      const createdProject = {
        id: 'proj-1',
        name: 'New Project',
        orgId: 'org-1',
        structureType: 'WBS',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        activeMilestones: [{ name: 'Kickoff' }],
        superintendentAssignments: [{ userId: 'u1', name: 'Alice' }],
        status: 'active',
        structureLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fullProject = {
        ...createdProject,
        workBreakdownItems: [
          { id: 'wbs-1', projectId: 'proj-1', code: '1.1', name: 'Foundation' },
        ],
      };

      mockedCreateProject.mockResolvedValue(createdProject as unknown as ReturnType<typeof projectService.createProject> extends Promise<infer T> ? T : never);
      mockedAddWorkBreakdownItem.mockResolvedValue({
        id: 'wbs-1',
        projectId: 'proj-1',
        code: '1.1',
        name: 'Foundation',
      } as unknown as ReturnType<typeof projectService.addWorkBreakdownItem> extends Promise<infer T> ? T : never);
      mockedReplicateProjectToFirestore.mockResolvedValue(undefined);
      mockedGetProjectById.mockResolvedValue(fullProject as unknown as ReturnType<typeof projectService.getProjectById> extends Promise<infer T> ? T : never);

      const result = await runProjectSetup(input);

      expect(mockedCreateProject).toHaveBeenCalledWith({
        name: 'New Project',
        orgId: 'org-1',
        structureType: 'WBS',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        activeMilestones: [{ name: 'Kickoff' }],
        superintendentAssignments: [{ userId: 'u1', name: 'Alice' }],
      });
      expect(mockedAddWorkBreakdownItem).toHaveBeenCalledWith('proj-1', {
        code: '1.1',
        name: 'Foundation',
      });
      expect(mockedReplicateProjectToFirestore).toHaveBeenCalledWith(createdProject);
      expect(mockedGetProjectById).toHaveBeenCalledWith('proj-1');
      expect(result).toEqual(fullProject);
    });

    it('creates project without WBS items when none provided', async () => {
      const input: SetupWizardInput = {
        name: 'Simple Project',
        orgId: 'org-1',
        structureType: 'COST_CODE',
      };

      const createdProject = {
        id: 'proj-2',
        name: 'Simple Project',
        orgId: 'org-1',
        structureType: 'COST_CODE',
        status: 'active',
        structureLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fullProject = {
        ...createdProject,
        workBreakdownItems: [],
      };

      mockedCreateProject.mockResolvedValue(createdProject as unknown as ReturnType<typeof projectService.createProject> extends Promise<infer T> ? T : never);
      mockedReplicateProjectToFirestore.mockResolvedValue(undefined);
      mockedGetProjectById.mockResolvedValue(fullProject as unknown as ReturnType<typeof projectService.getProjectById> extends Promise<infer T> ? T : never);

      const result = await runProjectSetup(input);

      expect(mockedAddWorkBreakdownItem).not.toHaveBeenCalled();
      expect(mockedReplicateProjectToFirestore).toHaveBeenCalledWith(createdProject);
      expect(result).toEqual(fullProject);
    });

    it('throws when name is missing', async () => {
      const input: SetupWizardInput = {
        name: '',
        orgId: 'org-1',
        structureType: 'WBS',
      };

      await expect(runProjectSetup(input)).rejects.toThrow('Project name is required');
      expect(mockedCreateProject).not.toHaveBeenCalled();
    });

    it('throws when orgId is missing', async () => {
      const input: SetupWizardInput = {
        name: 'Test',
        orgId: '',
        structureType: 'WBS',
      };

      await expect(runProjectSetup(input)).rejects.toThrow('Org ID is required');
      expect(mockedCreateProject).not.toHaveBeenCalled();
    });

    it('throws when structureType is invalid', async () => {
      const input = {
        name: 'Test',
        orgId: 'org-1',
        structureType: 'INVALID',
      } as unknown as SetupWizardInput;

      await expect(runProjectSetup(input)).rejects.toThrow(
        'Structure type must be WBS or COST_CODE'
      );
      expect(mockedCreateProject).not.toHaveBeenCalled();
    });

    it('throws when endDate is before startDate', async () => {
      const input: SetupWizardInput = {
        name: 'Test',
        orgId: 'org-1',
        structureType: 'WBS',
        startDate: new Date('2026-12-31'),
        endDate: new Date('2026-01-01'),
      };

      await expect(runProjectSetup(input)).rejects.toThrow(
        'End date must be on or after start date'
      );
      expect(mockedCreateProject).not.toHaveBeenCalled();
    });
  });
});
