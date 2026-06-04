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
  // For V1, set status to not_started as the "ready" trigger point.
  // The activity.ready outbound webhook would fire here in a full implementation.
  const activity = await prisma.scheduleActivity.update({
    where: { id },
    data: { status: ACTIVITY_STATUSES.NOT_STARTED },
  });
  return activity;
}

export async function markActivityComplete(
  id: string,
  completedBy: string,
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
