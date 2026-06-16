import {
  createProject,
  addWorkBreakdownItem,
  getProjectById,
  WbsItemInput,
} from './project.service';
import { replicateProjectToFirestore } from './pro-sync.service';
import { Project, WorkBreakdownItem } from '@prisma/client';

export interface SetupWizardInput {
  name: string;
  orgId: string;
  structureType: 'WBS' | 'COST_CODE';
  startDate?: Date;
  endDate?: Date;
  milestones?: unknown[];
  superintendentAssignments?: { userId: string; name: string }[];
  initialWbsItems?: WbsItemInput[];
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
}

export async function runProjectSetup(
  input: SetupWizardInput
): Promise<Project & { workBreakdownItems: WorkBreakdownItem[] }> {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('Project name is required');
  }
  if (!input.orgId || input.orgId.trim().length === 0) {
    throw new Error('Org ID is required');
  }
  if (input.structureType !== 'WBS' && input.structureType !== 'COST_CODE') {
    throw new Error('Structure type must be WBS or COST_CODE');
  }
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw new Error('End date must be on or after start date');
  }

  const project = await createProject({
    name: input.name,
    orgId: input.orgId,
    structureType: input.structureType,
    startDate: input.startDate,
    endDate: input.endDate,
    activeMilestones: input.milestones,
    superintendentAssignments: input.superintendentAssignments,
    latitude: input.latitude,
    longitude: input.longitude,
    city: input.city,
    state: input.state,
  });

  if (input.initialWbsItems && input.initialWbsItems.length > 0) {
    for (const item of input.initialWbsItems) {
      await addWorkBreakdownItem(project.id, item);
    }
  }

  await replicateProjectToFirestore(project);

  const fullProject = await getProjectById(project.id);
  if (!fullProject) {
    throw new Error('Project not found after creation');
  }

  return fullProject;
}
