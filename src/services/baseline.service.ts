import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { Role, ROLES, isRoleAtLeast } from '../constants/roles';
import { calculateBaselineVariance, ActivityNode } from './schedule.service';

export async function createBaseline(
  projectId: string,
  name: string,
  createdBy: string
) {
  const prisma = getPrismaClient();
  const activities = await prisma.scheduleActivity.findMany({
    where: { projectId },
  });

  const snapshot = activities.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    wbsItemId: a.wbsItemId,
    startDate: a.startDate.toISOString(),
    endDate: a.endDate.toISOString(),
    duration: a.duration,
    percentComplete: a.percentComplete,
    status: a.status,
    isMilestone: a.isMilestone,
    isCritical: a.isCritical,
    predecessors: a.predecessors,
    successors: a.successors,
  }));

  return prisma.scheduleBaseline.create({
    data: {
      projectId,
      name,
      locked: false,
      baselineDate: new Date(),
      activities: snapshot as Prisma.InputJsonValue,
      createdBy,
    },
  });
}

export async function lockBaseline(baselineId: string) {
  const prisma = getPrismaClient();
  const baseline = await prisma.scheduleBaseline.findUnique({
    where: { id: baselineId },
  });
  if (!baseline) {
    throw new Error('Baseline not found');
  }
  if (baseline.locked) {
    return baseline;
  }
  return prisma.scheduleBaseline.update({
    where: { id: baselineId },
    data: { locked: true },
  });
}

export async function getBaselineById(id: string) {
  const prisma = getPrismaClient();
  return prisma.scheduleBaseline.findUnique({
    where: { id },
  });
}

export async function getBaselinesByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.scheduleBaseline.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function compareToBaseline(projectId: string, baselineId: string) {
  const prisma = getPrismaClient();
  const baseline = await prisma.scheduleBaseline.findUnique({
    where: { id: baselineId },
  });
  if (!baseline) {
    throw new Error('Baseline not found');
  }
  if (baseline.projectId !== projectId) {
    throw new Error('Baseline does not belong to project');
  }

  const currentActivities = await prisma.scheduleActivity.findMany({
    where: { projectId },
  });

  const baselineActivities = baseline.activities as Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    duration: number;
  }>;

  const baselineMap = new Map(baselineActivities.map((a) => [a.id, a]));

  const results: {
    activityId: string;
    activityName: string;
    baselineStart: Date;
    currentStart: Date;
    startVarianceDays: number;
    baselineFinish: Date;
    currentFinish: Date;
    finishVarianceDays: number;
  }[] = [];

  for (const current of currentActivities) {
    const baselineActivity = baselineMap.get(current.id);
    if (!baselineActivity) continue;

    const baselineNode: ActivityNode = {
      id: baselineActivity.id,
      startDate: new Date(baselineActivity.startDate),
      endDate: new Date(baselineActivity.endDate),
      duration: baselineActivity.duration,
    };

    const currentNode: ActivityNode = {
      id: current.id,
      startDate: current.startDate,
      endDate: current.endDate,
      duration: current.duration,
    };

    const variance = calculateBaselineVariance(currentNode, baselineNode);

    results.push({
      activityId: current.id,
      activityName: current.name,
      baselineStart: baselineNode.startDate,
      currentStart: current.startDate,
      startVarianceDays: variance.startVarianceDays,
      baselineFinish: baselineNode.endDate,
      currentFinish: current.endDate,
      finishVarianceDays: variance.finishVarianceDays,
    });
  }

  return results;
}

export function canRebaseline(
  _projectId: string,
  userRole: Role,
  _justification?: string
): boolean {
  return (
    isRoleAtLeast(userRole, ROLES.OWNER_ADMIN) ||
    isRoleAtLeast(userRole, ROLES.PROJECT_MANAGER)
  );
}
