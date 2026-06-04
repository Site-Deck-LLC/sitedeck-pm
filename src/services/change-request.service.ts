import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import {
  calculateCriticalPathImpact,
  ActivityNode,
  recalculateSchedule,
} from './schedule.service';

export interface CreateChangeRequestInput {
  projectId: string;
  activityId: string;
  requestedBy: string;
  reasonCode: string;
  proposedStart?: Date;
  proposedEnd?: Date;
  impactDescription?: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function diffInDays(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / MS_PER_DAY;
}

export async function createChangeRequest(data: CreateChangeRequestInput) {
  const prisma = getPrismaClient();
  return prisma.scheduleChangeRequest.create({
    data: {
      projectId: data.projectId,
      activityId: data.activityId,
      requestedBy: data.requestedBy,
      reasonCode: data.reasonCode,
      proposedStart: data.proposedStart,
      proposedEnd: data.proposedEnd,
      impactDescription: data.impactDescription,
      status: 'pending',
    },
  });
}

export async function getChangeRequestById(id: string) {
  const prisma = getPrismaClient();
  return prisma.scheduleChangeRequest.findUnique({
    where: { id },
    include: { project: true },
  });
}

export async function getChangeRequestsByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.scheduleChangeRequest.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function calculateImpact(requestId: string) {
  const prisma = getPrismaClient();
  const request = await prisma.scheduleChangeRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    throw new Error('Change request not found');
  }

  const activity = await prisma.scheduleActivity.findUnique({
    where: { id: request.activityId },
  });
  if (!activity) {
    throw new Error('Activity not found');
  }

  const allActivities = await prisma.scheduleActivity.findMany({
    where: { projectId: request.projectId },
  });

  const project = await prisma.project.findUnique({
    where: { id: request.projectId },
  });
  if (!project || !project.startDate) {
    throw new Error('Project start date not available');
  }

  let newDuration: number;
  if (request.proposedStart && request.proposedEnd) {
    newDuration = diffInDays(request.proposedEnd, request.proposedStart);
  } else if (request.proposedEnd) {
    newDuration = diffInDays(request.proposedEnd, activity.startDate);
  } else if (request.proposedStart) {
    newDuration = diffInDays(activity.endDate, request.proposedStart);
  } else {
    throw new Error('No proposed dates available to calculate impact');
  }

  const nodes: ActivityNode[] = allActivities.map((a) => ({
    id: a.id,
    startDate: a.startDate,
    endDate: a.endDate,
    duration: a.duration,
    predecessors:
      (a.predecessors as
        | { activityId: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }[]
        | null) || undefined,
    successors:
      (a.successors as
        | { activityId: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }[]
        | null) || undefined,
  }));

  const impact = calculateCriticalPathImpact(
    nodes,
    request.activityId,
    newDuration,
    project.startDate
  );

  return prisma.scheduleChangeRequest.update({
    where: { id: requestId },
    data: { criticalPathImpact: impact },
  });
}

export async function decideChangeRequest(
  requestId: string,
  decision: 'approved' | 'modified' | 'rejected',
  decidedBy: string,
  notes?: string,
  modifiedDates?: { startDate?: Date; endDate?: Date }
) {
  const prisma = getPrismaClient();
  const request = await prisma.scheduleChangeRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    throw new Error('Change request not found');
  }

  const updated = await prisma.scheduleChangeRequest.update({
    where: { id: requestId },
    data: {
      status: decision,
      decidedBy,
      decidedAt: new Date(),
      decisionNotes: notes || null,
    },
  });

  if (decision === 'approved' || decision === 'modified') {
    const activity = await prisma.scheduleActivity.findUnique({
      where: { id: request.activityId },
    });
    if (!activity) {
      throw new Error('Activity not found');
    }

    const newStartDate =
      decision === 'modified' ? modifiedDates?.startDate : request.proposedStart;
    const newEndDate =
      decision === 'modified' ? modifiedDates?.endDate : request.proposedEnd;

    const updateData: Prisma.ScheduleActivityUpdateInput = {};
    if (newStartDate) updateData.startDate = newStartDate;
    if (newEndDate) updateData.endDate = newEndDate;
    if (newStartDate && newEndDate) {
      updateData.duration = diffInDays(newEndDate, newStartDate);
    } else if (newEndDate) {
      updateData.duration = diffInDays(newEndDate, activity.startDate);
    } else if (newStartDate) {
      updateData.duration = diffInDays(activity.endDate, newStartDate);
    }

    await prisma.scheduleActivity.update({
      where: { id: request.activityId },
      data: updateData,
    });

    await recalculateSchedule(request.projectId);
  }

  return updated;
}
