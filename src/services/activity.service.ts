import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { recalculateSchedule } from './schedule.service';
import { ACTIVITY_STATUSES } from '../constants/reason-codes';

export interface CreateActivityInput {
  projectId: string;
  name: string;
  description?: string;
  wbsItemId?: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  percentComplete?: number;
  status?: string;
  isMilestone?: boolean;
  predecessors?: Prisma.InputJsonValue;
  successors?: Prisma.InputJsonValue;
}

export interface UpdateActivityInput {
  name?: string;
  description?: string;
  wbsItemId?: string | null;
  startDate?: Date;
  endDate?: Date;
  duration?: number;
  percentComplete?: number;
  status?: string;
  isMilestone?: boolean;
  predecessors?: Prisma.InputJsonValue;
  successors?: Prisma.InputJsonValue;
}

export async function createActivity(data: CreateActivityInput) {
  const prisma = getPrismaClient();
  const activity = await prisma.scheduleActivity.create({
    data: {
      projectId: data.projectId,
      name: data.name,
      description: data.description,
      wbsItemId: data.wbsItemId,
      startDate: data.startDate,
      endDate: data.endDate,
      duration: data.duration,
      percentComplete: data.percentComplete,
      status: data.status || ACTIVITY_STATUSES.NOT_STARTED,
      isMilestone: data.isMilestone,
      predecessors: data.predecessors,
      successors: data.successors,
    },
  });
  await recalculateSchedule(data.projectId);
  return activity;
}

export async function getActivityById(id: string) {
  const prisma = getPrismaClient();
  return prisma.scheduleActivity.findUnique({
    where: { id },
  });
}

export async function getActivitiesByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.scheduleActivity.findMany({
    where: { projectId },
    orderBy: { startDate: 'asc' },
  });
}

export interface EnrichedActivity {
  id: string;
  name: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  duration: number;
  percentComplete: number;
  status: string;
  isMilestone: boolean;
  isCritical: boolean;
  wbsItemId: string | null;
  wbsCode: string | null;
  wbsName: string | null;
  wbsCategory: string | null;
  totalFloat: number | null;
  freeFloat: number | null;
}

export async function getActivitiesWithWbs(projectId: string): Promise<EnrichedActivity[]> {
  const prisma = getPrismaClient();
  const activities = await prisma.scheduleActivity.findMany({
    where: { projectId },
    orderBy: { startDate: 'asc' },
  });

  const wbsItemIds = [...new Set(activities.map(a => a.wbsItemId).filter(Boolean))];
  const wbsItems = wbsItemIds.length
    ? await prisma.workBreakdownItem.findMany({
        where: { id: { in: wbsItemIds as string[] } },
      })
    : [];

  const wbsMap = new Map(wbsItems.map(w => [w.id, w]));

  // Fetch level-1 parents for category names
  const parentIds = [...new Set(wbsItems.map(w => w.parentId).filter(Boolean))];
  const parents = parentIds.length
    ? await prisma.workBreakdownItem.findMany({
        where: { id: { in: parentIds as string[] } },
      })
    : [];
  const parentMap = new Map(parents.map(p => [p.id, p]));

  return activities.map(a => {
    const wbs = a.wbsItemId ? wbsMap.get(a.wbsItemId) : null;
    const parent = wbs?.parentId ? parentMap.get(wbs.parentId) : null;
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      startDate: a.startDate,
      endDate: a.endDate,
      duration: a.duration,
      percentComplete: a.percentComplete,
      status: a.status,
      isMilestone: a.isMilestone,
      isCritical: a.isCritical,
      wbsItemId: a.wbsItemId,
      wbsCode: wbs?.code || null,
      wbsName: wbs?.name || null,
      wbsCategory: parent?.name || wbs?.name || 'Uncategorized',
      totalFloat: a.totalFloat,
      freeFloat: a.freeFloat,
    };
  });
}

export async function updateActivity(id: string, data: UpdateActivityInput) {
  const prisma = getPrismaClient();
  const existing = await prisma.scheduleActivity.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new Error('Activity not found');
  }
  const activity = await prisma.scheduleActivity.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      wbsItemId: data.wbsItemId,
      startDate: data.startDate,
      endDate: data.endDate,
      duration: data.duration,
      percentComplete: data.percentComplete,
      status: data.status,
      isMilestone: data.isMilestone,
      predecessors: data.predecessors,
      successors: data.successors,
    },
  });
  await recalculateSchedule(existing.projectId);
  return activity;
}

export async function deleteActivity(id: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.scheduleActivity.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new Error('Activity not found');
  }
  const activity = await prisma.scheduleActivity.delete({
    where: { id },
  });
  await recalculateSchedule(existing.projectId);
  return activity;
}

export async function markActivityReady(id: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.scheduleActivity.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new Error('Activity not found');
  }
  const activity = await prisma.scheduleActivity.update({
    where: { id },
    data: { status: ACTIVITY_STATUSES.NOT_STARTED },
  });
  return activity;
}

export async function markActivityComplete(
  id: string,
  _completedBy: string,
  completedAt: Date
) {
  const prisma = getPrismaClient();
  const existing = await prisma.scheduleActivity.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new Error('Activity not found');
  }
  const activity = await prisma.scheduleActivity.update({
    where: { id },
    data: {
      percentComplete: 100,
      status: ACTIVITY_STATUSES.COMPLETE,
      endDate: completedAt,
    },
  });
  await recalculateSchedule(existing.projectId);
  return activity;
}
