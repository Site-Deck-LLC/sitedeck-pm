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
  linkedBenchmarkDfowId: string | null;
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
      linkedBenchmarkDfowId: a.linkedBenchmarkDfowId || null,
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

// ─── Activity Relationships ───

export interface CreateRelationshipInput {
  projectId: string;
  predecessorId: string;
  successorId: string;
  relationshipType: 'FS' | 'SS' | 'FF' | 'SF';
  lagDays?: number;
  constraintType?: 'hard' | 'soft';
}

export async function getRelationshipsForActivity(activityId: string) {
  const prisma = getPrismaClient();
  const [predecessors, successors] = await Promise.all([
    prisma.activityRelationship.findMany({
      where: { successorId: activityId },
      include: { predecessor: { select: { id: true, name: true } } },
    }),
    prisma.activityRelationship.findMany({
      where: { predecessorId: activityId },
      include: { successor: { select: { id: true, name: true } } },
    }),
  ]);
  return { predecessors, successors };
}

export async function createRelationship(input: CreateRelationshipInput) {
  const prisma = getPrismaClient();

  if (input.predecessorId === input.successorId) {
    throw new Error('An activity cannot be its own predecessor or successor');
  }

  // Verify both activities exist and belong to the same project
  const [pred, succ] = await Promise.all([
    prisma.scheduleActivity.findUnique({ where: { id: input.predecessorId } }),
    prisma.scheduleActivity.findUnique({ where: { id: input.successorId } }),
  ]);
  if (!pred || !succ) {
    throw new Error('One or both activities not found');
  }
  if (pred.projectId !== input.projectId || succ.projectId !== input.projectId) {
    throw new Error('Activities must belong to the same project');
  }

  // Check for duplicate
  const existing = await prisma.activityRelationship.findUnique({
    where: {
      predecessorId_successorId_relationshipType: {
        predecessorId: input.predecessorId,
        successorId: input.successorId,
        relationshipType: input.relationshipType,
      },
    },
  });
  if (existing) {
    throw new Error('Relationship already exists');
  }

  // Circular dependency check
  const wouldCycle = await detectCircularDependency(
    input.projectId,
    input.predecessorId,
    input.successorId
  );
  if (wouldCycle) {
    throw new Error('Circular dependency detected');
  }

  const rel = await prisma.activityRelationship.create({
    data: {
      projectId: input.projectId,
      predecessorId: input.predecessorId,
      successorId: input.successorId,
      relationshipType: input.relationshipType,
      lagDays: input.lagDays ?? 0,
      constraintType: input.constraintType ?? 'hard',
    },
  });

  // Sync to JSON fields for backward compatibility during transition
  await syncRelationshipsToJson(input.projectId, input.predecessorId, input.successorId);

  await recalculateSchedule(input.projectId);
  return rel;
}

export async function deleteRelationship(relId: string) {
  const prisma = getPrismaClient();
  const rel = await prisma.activityRelationship.findUnique({
    where: { id: relId },
  });
  if (!rel) {
    throw new Error('Relationship not found');
  }
  await prisma.activityRelationship.delete({
    where: { id: relId },
  });
  await syncRelationshipsToJson(rel.projectId, rel.predecessorId, rel.successorId);
  await recalculateSchedule(rel.projectId);
  return rel;
}

async function detectCircularDependency(
  projectId: string,
  newPredecessorId: string,
  newSuccessorId: string
): Promise<boolean> {
  const prisma = getPrismaClient();
  const allRels = await prisma.activityRelationship.findMany({
    where: { projectId },
    select: { predecessorId: true, successorId: true },
  });

  // Build adjacency list (predecessor -> successors)
  const adj = new Map<string, string[]>();
  for (const r of allRels) {
    if (!adj.has(r.predecessorId)) adj.set(r.predecessorId, []);
    adj.get(r.predecessorId)!.push(r.successorId);
  }
  // Add the proposed new edge
  if (!adj.has(newPredecessorId)) adj.set(newPredecessorId, []);
  adj.get(newPredecessorId)!.push(newSuccessorId);

  // DFS to detect if newSuccessorId can reach newPredecessorId
  const visited = new Set<string>();
  const stack = [newSuccessorId];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === newPredecessorId) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const neighbor of adj.get(node) || []) {
      stack.push(neighbor);
    }
  }
  return false;
}

async function syncRelationshipsToJson(
  projectId: string,
  predecessorId: string,
  successorId: string
) {
  const prisma = getPrismaClient();
  const allRels = await prisma.activityRelationship.findMany({
    where: { projectId },
    select: { predecessorId: true, successorId: true, relationshipType: true, lagDays: true },
  });

  const predMap = new Map<string, { activityId: string; type: string; lag: number }[]>();
  const succMap = new Map<string, { activityId: string; type: string; lag: number }[]>();

  for (const r of allRels) {
    const predEntry = { activityId: r.successorId, type: r.relationshipType, lag: r.lagDays };
    const succEntry = { activityId: r.predecessorId, type: r.relationshipType, lag: r.lagDays };
    if (!predMap.has(r.predecessorId)) predMap.set(r.predecessorId, []);
    if (!succMap.has(r.successorId)) succMap.set(r.successorId, []);
    predMap.get(r.predecessorId)!.push(predEntry);
    succMap.get(r.successorId)!.push(succEntry);
  }

  const activityIds = [...new Set([...predMap.keys(), ...succMap.keys()])];
  const updates = activityIds.map((id) =>
    prisma.scheduleActivity.update({
      where: { id },
      data: {
        predecessors: predMap.get(id) || [],
        successors: succMap.get(id) || [],
      },
    })
  );
  await Promise.all(updates);
}
