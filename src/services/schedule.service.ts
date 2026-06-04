import { getPrismaClient } from '../lib/prisma';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function diffInDays(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / MS_PER_DAY;
}

export interface ActivityNode {
  id: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  predecessors?: { activityId: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }[];
  successors?: { activityId: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }[];
}

export interface CpmResult {
  earlyStart: Date;
  earlyFinish: Date;
  lateStart: Date;
  lateFinish: Date;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
}

export function calculateCpm(
  activities: ActivityNode[],
  projectStart: Date
): Map<string, CpmResult> {
  const activityMap = new Map<string, ActivityNode>();
  for (const act of activities) {
    activityMap.set(act.id, act);
  }

  // Build adjacency list and in-degree for topological sort
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>(); // predecessor -> successors
  for (const act of activities) {
    inDegree.set(act.id, 0);
    adj.set(act.id, []);
  }
  for (const act of activities) {
    for (const pred of act.predecessors || []) {
      const predId = pred.activityId;
      if (!adj.has(predId)) {
        adj.set(predId, []);
      }
      adj.get(predId)!.push(act.id);
      inDegree.set(act.id, (inDegree.get(act.id) || 0) + 1);
    }
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }
  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    topoOrder.push(id);
    for (const succId of adj.get(id) || []) {
      inDegree.set(succId, inDegree.get(succId)! - 1);
      if (inDegree.get(succId) === 0) {
        queue.push(succId);
      }
    }
  }

  if (topoOrder.length !== activities.length) {
    throw new Error('Cycle detected in activity network');
  }

  // Forward pass: compute ES, EF as day offsets from projectStart
  const esOffset = new Map<string, number>();
  const efOffset = new Map<string, number>();

  for (const id of topoOrder) {
    const act = activityMap.get(id)!;
    let maxPredFinish = -Infinity;
    for (const pred of act.predecessors || []) {
      const predEf = efOffset.get(pred.activityId)!;
      // V1: FS only. TODO: implement SS, FF, SF for V2
      if (pred.type === 'FS' || !pred.type) {
        const predFinish = predEf + pred.lag;
        if (predFinish > maxPredFinish) {
          maxPredFinish = predFinish;
        }
      }
    }
    const actEs = maxPredFinish === -Infinity ? 0 : maxPredFinish;
    const actEf = actEs + act.duration;
    esOffset.set(id, actEs);
    efOffset.set(id, actEf);
  }

  const projectEndOffset = Math.max(...Array.from(efOffset.values()));

  // Backward pass: compute LF, LS as day offsets from projectStart
  const lsOffset = new Map<string, number>();
  const lfOffset = new Map<string, number>();

  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const id = topoOrder[i];
    const act = activityMap.get(id)!;
    const successors = adj.get(id) || [];
    if (successors.length === 0) {
      lfOffset.set(id, projectEndOffset);
    } else {
      let minSuccStart = Infinity;
      for (const succId of successors) {
        const succLs = lsOffset.get(succId)!;
        const succAct = activityMap.get(succId)!;
        const link = succAct.predecessors?.find((p) => p.activityId === id);
        const lag = link?.lag || 0;
        // V1: FS only. TODO: implement SS, FF, SF for V2
        const candidate = succLs - lag;
        if (candidate < minSuccStart) {
          minSuccStart = candidate;
        }
      }
      lfOffset.set(id, minSuccStart);
    }
    lsOffset.set(id, lfOffset.get(id)! - act.duration);
  }

  // Calculate floats and criticality
  const result = new Map<string, CpmResult>();
  for (const id of topoOrder) {
    const act = activityMap.get(id)!;
    const actEs = esOffset.get(id)!;
    const actEf = efOffset.get(id)!;
    const actLs = lsOffset.get(id)!;
    const actLf = lfOffset.get(id)!;
    const totalFloat = actLs - actEs;

    let freeFloat: number;
    const successors = adj.get(id) || [];
    if (successors.length === 0) {
      freeFloat = projectEndOffset - actEf;
    } else {
      let minFf = Infinity;
      for (const succId of successors) {
        const succEs = esOffset.get(succId)!;
        const succAct = activityMap.get(succId)!;
        const link = succAct.predecessors?.find((p) => p.activityId === id);
        const lag = link?.lag || 0;
        // V1: FS only. TODO: implement SS, FF, SF for V2
        const candidate = succEs - actEf - lag;
        if (candidate < minFf) {
          minFf = candidate;
        }
      }
      freeFloat = minFf === Infinity ? 0 : minFf;
    }

    result.set(id, {
      earlyStart: addDays(projectStart, actEs),
      earlyFinish: addDays(projectStart, actEf),
      lateStart: addDays(projectStart, actLs),
      lateFinish: addDays(projectStart, actLf),
      totalFloat,
      freeFloat,
      isCritical: totalFloat <= 0.0001,
    });
  }

  return result;
}

export function calculateBaselineVariance(
  current: ActivityNode,
  baseline: ActivityNode
): { startVarianceDays: number; finishVarianceDays: number } {
  return {
    startVarianceDays: diffInDays(current.startDate, baseline.startDate),
    finishVarianceDays: diffInDays(current.endDate, baseline.endDate),
  };
}

export function calculateCriticalPathImpact(
  activities: ActivityNode[],
  changedActivityId: string,
  newDuration: number,
  projectStart: Date
): number {
  const originalResult = calculateCpm(activities, projectStart);
  const originalEnd = Math.max(
    ...Array.from(originalResult.values()).map((r) => r.earlyFinish.getTime())
  );

  const modifiedActivities = activities.map((a) =>
    a.id === changedActivityId ? { ...a, duration: newDuration } : a
  );
  const modifiedResult = calculateCpm(modifiedActivities, projectStart);
  const modifiedEnd = Math.max(
    ...Array.from(modifiedResult.values()).map((r) => r.earlyFinish.getTime())
  );

  return (modifiedEnd - originalEnd) / MS_PER_DAY;
}

export async function recalculateSchedule(projectId: string): Promise<void> {
  const prisma = getPrismaClient();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { scheduleActivities: true },
  });
  if (!project) {
    throw new Error('Project not found');
  }
  if (!project.scheduleActivities || project.scheduleActivities.length === 0) {
    return;
  }

  const projectStart =
    project.startDate || project.scheduleActivities[0].startDate;
  if (!projectStart) {
    throw new Error('Project start date not available');
  }

  const nodes: ActivityNode[] = project.scheduleActivities.map((a) => ({
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

  const cpmResult = calculateCpm(nodes, projectStart);

  const updates = [];
  for (const activity of project.scheduleActivities) {
    const result = cpmResult.get(activity.id);
    if (!result) continue;
    updates.push(
      prisma.scheduleActivity.update({
        where: { id: activity.id },
        data: {
          earlyStart: result.earlyStart,
          earlyFinish: result.earlyFinish,
          lateStart: result.lateStart,
          lateFinish: result.lateFinish,
          totalFloat: result.totalFloat,
          freeFloat: result.freeFloat,
          isCritical: result.isCritical,
        },
      })
    );
  }

  await Promise.all(updates);
}
