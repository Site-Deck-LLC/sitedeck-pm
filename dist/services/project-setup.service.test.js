"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const project_setup_service_1 = require("./project-setup.service");
const projectService = __importStar(require("./project.service"));
const proSyncService = __importStar(require("./pro-sync.service"));
jest.mock('./project.service');
jest.mock('./pro-sync.service');
const mockedCreateProject = jest.mocked(projectService.createProject);
const mockedAddWorkBreakdownItem = jest.mocked(projectService.addWorkBreakdownItem);
const mockedGetProjectById = jest.mocked(projectService.getProjectById);
const mockedReplicateProjectToFirestore = jest.mocked(proSyncService.replicateProjectToFirestore);
beforeEach(() => {
    jest.clearAllMocks();
});
describe('project-setup.service', () => {
    describe('runProjectSetup', () => {
        it('creates project, adds WBS items, replicates to Firestore, and returns full project', async () => {
            const input = {
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
            mockedCreateProject.mockResolvedValue(createdProject);
            mockedAddWorkBreakdownItem.mockResolvedValue({
                id: 'wbs-1',
                projectId: 'proj-1',
                code: '1.1',
                name: 'Foundation',
            });
            mockedReplicateProjectToFirestore.mockResolvedValue(undefined);
            mockedGetProjectById.mockResolvedValue(fullProject);
            const result = await (0, project_setup_service_1.runProjectSetup)(input);
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
            const input = {
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
            mockedCreateProject.mockResolvedValue(createdProject);
            mockedReplicateProjectToFirestore.mockResolvedValue(undefined);
            mockedGetProjectById.mockResolvedValue(fullProject);
            const result = await (0, project_setup_service_1.runProjectSetup)(input);
            expect(mockedAddWorkBreakdownItem).not.toHaveBeenCalled();
            expect(mockedReplicateProjectToFirestore).toHaveBeenCalledWith(createdProject);
            expect(result).toEqual(fullProject);
        });
        it('throws when name is missing', async () => {
            const input = {
                name: '',
                orgId: 'org-1',
                structureType: 'WBS',
            };
            await expect((0, project_setup_service_1.runProjectSetup)(input)).rejects.toThrow('Project name is required');
            expect(mockedCreateProject).not.toHaveBeenCalled();
        });
        it('throws when orgId is missing', async () => {
            const input = {
                name: 'Test',
                orgId: '',
                structureType: 'WBS',
            };
            await expect((0, project_setup_service_1.runProjectSetup)(input)).rejects.toThrow('Org ID is required');
            expect(mockedCreateProject).not.toHaveBeenCalled();
        });
        it('throws when structureType is invalid', async () => {
            const input = {
                name: 'Test',
                orgId: 'org-1',
                structureType: 'INVALID',
            };
            await expect((0, project_setup_service_1.runProjectSetup)(input)).rejects.toThrow('Structure type must be WBS or COST_CODE');
            expect(mockedCreateProject).not.toHaveBeenCalled();
        });
        it('throws when endDate is before startDate', async () => {
            const input = {
                name: 'Test',
                orgId: 'org-1',
                structureType: 'WBS',
                startDate: new Date('2026-12-31'),
                endDate: new Date('2026-01-01'),
            };
            await expect((0, project_setup_service_1.runProjectSetup)(input)).rejects.toThrow('End date must be on or after start date');
            expect(mockedCreateProject).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=project-setup.service.test.js.map