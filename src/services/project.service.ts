import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma';
import { PROJECT_STATUSES, ProjectStatus } from '../constants/status';

export interface CreateProjectInput {
  name: string;
  orgId: string;
  structureType: 'WBS' | 'COST_CODE';
  startDate?: Date;
  endDate?: Date;
  activeMilestones?: unknown[];
  superintendentAssignments?: { userId: string; name: string }[];
}

export interface UpdateProjectInput {
  name?: string;
  status?: ProjectStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  activeMilestones?: unknown[];
  superintendentAssignments?: { userId: string; name: string }[];
}

export interface WbsItemInput {
  code: string;
  name: string;
  parentId?: string;
  level?: number;
}

export async function createProject(data: CreateProjectInput) {
  const prisma = getPrismaClient();
  return prisma.project.create({
    data: {
      name: data.name,
      orgId: data.orgId,
      structureType: data.structureType,
      startDate: data.startDate,
      endDate: data.endDate,
      activeMilestones: data.activeMilestones as Prisma.InputJsonValue | undefined,
      superintendentAssignments: data.superintendentAssignments as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function getProjectById(id: string) {
  const prisma = getPrismaClient();
  return prisma.project.findUnique({
    where: { id },
    include: { workBreakdownItems: true },
  });
}

export async function updateProject(id: string, data: UpdateProjectInput) {
  const prisma = getPrismaClient();
  return prisma.project.update({
    where: { id },
    data: {
      name: data.name,
      status: data.status,
      startDate: data.startDate,
      endDate: data.endDate,
      activeMilestones: data.activeMilestones as Prisma.InputJsonValue | undefined,
      superintendentAssignments: data.superintendentAssignments as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function lockProjectStructure(id: string) {
  const prisma = getPrismaClient();
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    throw new Error('Project not found');
  }
  if (project.structureLocked) {
    return project;
  }
  return prisma.project.update({
    where: { id },
    data: { structureLocked: true },
  });
}

export async function addWorkBreakdownItem(projectId: string, item: WbsItemInput) {
  const prisma = getPrismaClient();
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new Error('Project not found');
  }
  if (!project.structureType) {
    throw new Error('Project structure type must be set before adding work breakdown items');
  }

  const existingItems = await prisma.workBreakdownItem.count({
    where: { projectId },
  });

  const createdItem = await prisma.workBreakdownItem.create({
    data: {
      projectId,
      structureType: project.structureType,
      code: item.code,
      name: item.name,
      parentId: item.parentId,
      level: item.level ?? 1,
    },
  });

  if (existingItems === 0) {
    await prisma.project.update({
      where: { id: projectId },
      data: { structureLocked: true },
    });
  }

  return createdItem;
}

export async function deleteProject(id: string) {
  const prisma = getPrismaClient();
  return prisma.project.update({
    where: { id },
    data: { status: PROJECT_STATUSES.CANCELLED },
  });
}

export async function setProjectOrgBridge(id: string, orgId: string) {
  const prisma = getPrismaClient();
  return prisma.project.update({
    where: { id },
    data: { orgId },
  });
}
