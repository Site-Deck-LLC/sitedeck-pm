import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma';
import { PROJECT_STATUSES, ProjectStatus } from '../constants/status';
import { getMorningDashboard } from './dashboard.service';

export interface CreateProjectInput {
  name: string;
  orgId: string;
  structureType: 'WBS' | 'COST_CODE';
  startDate?: Date;
  endDate?: Date;
  activeMilestones?: unknown[];
  superintendentAssignments?: { userId: string; name: string }[];
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
}

export interface UpdateProjectInput {
  name?: string;
  status?: ProjectStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  activeMilestones?: unknown[];
  superintendentAssignments?: { userId: string; name: string }[];
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
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
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city,
      state: data.state,
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

export async function listProjects() {
  const prisma = getPrismaClient();
  return prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
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
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city,
      state: data.state,
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

export interface ProjectMapItem {
  id: string;
  name: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  health: 'green' | 'amber' | 'red';
  cpi: number;
  spi: number;
  openItems: number;
  computedStatus: 'green' | 'amber' | 'red';
}

function computeCpiSpiStatus(cpi: number, spi: number): 'green' | 'amber' | 'red' {
  if (cpi < 0.95 || spi < 0.85) return 'red';
  if (cpi < 1.0 || spi < 0.9) return 'amber';
  return 'green';
}

export async function getProjectMapData(): Promise<ProjectMapItem[]> {
  const prisma = getPrismaClient();
  const projects = await prisma.project.findMany({
    where: { status: { not: PROJECT_STATUSES.CANCELLED } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      latitude: true,
      longitude: true,
      city: true,
      state: true,
    },
  });

  const results: ProjectMapItem[] = [];
  for (const p of projects) {
    let health: 'green' | 'amber' | 'red' = 'green';
    let cpi = 1;
    let spi = 1;
    let openItems = 0;
    try {
      const dashboard = await getMorningDashboard(p.id, { incidents: 0, openObservations: 0 });
      const tileStatuses = Object.values(dashboard.tiles).map((t) => t.status);
      if (tileStatuses.includes('red')) {
        health = 'red';
      } else if (tileStatuses.includes('amber')) {
        health = 'amber';
      }
      cpi = dashboard.performance.cpi ?? 1;
      spi = dashboard.performance.spi ?? 1;
      openItems =
        (dashboard.tiles.clientIssues.count ?? 0) +
        (dashboard.tiles.fieldIssues.count ?? 0);
    } catch {
      // Fallback: if dashboard computation fails, default values
    }
    results.push({
      id: p.id,
      name: p.name,
      status: p.status,
      latitude: p.latitude,
      longitude: p.longitude,
      city: p.city,
      state: p.state,
      health,
      cpi: Math.round(cpi * 100) / 100,
      spi: Math.round(spi * 100) / 100,
      openItems,
      computedStatus: computeCpiSpiStatus(cpi, spi),
    });
  }

  return results;
}
