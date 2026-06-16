import { getPrismaClient } from '../lib/prisma';
import {
  parseMsProjectXml,
  type MspTask,
  type MspRelationship,
} from './msproject-parser.service';
import { recalculateSchedule } from './schedule.service';

export interface ImportMsProjectResult {
  projectId: string;
  importedActivities: number;
  importedRelationships: number;
  importedWbsItems: number;
  mspProjectName: string;
}

export async function importMsProjectSchedule(
  projectId: string,
  xmlContent: string
): Promise<ImportMsProjectResult> {
  const prisma = getPrismaClient();
  const parsed = parseMsProjectXml(xmlContent);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { structureType: true, structureLocked: true },
  });
  const structureType = project?.structureType || 'wbs';

  // Build WBS map: group tasks by WBS code
  const wbsCodes = new Map<string, string>(); // wbs code -> our wbsItem.id
  const uniqueWbs = new Map<string, { code: string; name: string; level: number }>();

  for (const task of parsed.tasks) {
    if (!task.wbs || task.summary) continue;
    if (!uniqueWbs.has(task.wbs)) {
      uniqueWbs.set(task.wbs, {
        code: task.wbs,
        name: task.name,
        level: task.outlineLevel,
      });
    }
  }

  // Upsert WBS items
  for (const [, wbs] of uniqueWbs) {
    const existing = await prisma.workBreakdownItem.findFirst({
      where: { projectId, code: wbs.code },
      select: { id: true },
    });
    if (existing) {
      wbsCodes.set(wbs.code, existing.id);
    } else {
      const created = await prisma.workBreakdownItem.create({
        data: {
          projectId,
          structureType,
          code: wbs.code,
          name: wbs.name || wbs.code,
          level: wbs.level,
        },
      });
      wbsCodes.set(wbs.code, created.id);
    }
  }

  // Create activities (skip summary tasks)
  const activityIdMap = new Map<string, string>(); // msp uid -> our activity.id
  let importedActivities = 0;

  for (const task of parsed.tasks) {
    if (task.summary) continue; // Skip summary/group rows

    const startDate = normalizeDate(task.startDate);
    const endDate = normalizeDate(task.finishDate);
    const duration = task.milestone ? 0 : Math.max(1, task.durationDays);
    const finalEndDate = task.milestone ? startDate : endDate;

    const created = await prisma.scheduleActivity.create({
      data: {
        projectId,
        name: task.name,
        wbsItemId: task.wbs ? wbsCodes.get(task.wbs) || null : null,
        startDate,
        endDate: finalEndDate,
        duration,
        percentComplete: task.percentComplete,
        status: task.percentComplete >= 1 ? 'complete' : task.percentComplete > 0 ? 'in_progress' : 'not_started',
        isMilestone: task.milestone,
        isCritical: false,
        predecessors: [],
        successors: [],
      },
    });

    activityIdMap.set(task.uid, created.id);
    importedActivities++;
  }

  // Create relationships
  let importedRelationships = 0;
  for (const rel of parsed.relationships) {
    const predecessorId = activityIdMap.get(rel.predecessorUid);
    const successorId = activityIdMap.get(rel.successorUid);
    if (!predecessorId || !successorId) continue;

    try {
      await prisma.activityRelationship.create({
        data: {
          projectId,
          predecessorId,
          successorId,
          relationshipType: rel.type,
          lagDays: rel.lagDays,
          constraintType: 'hard',
        },
      });
      importedRelationships++;
    } catch (err: any) {
      if (!err.message?.includes('Unique constraint')) {
        throw err;
      }
    }
  }

  await recalculateSchedule(projectId);

  return {
    projectId,
    importedActivities,
    importedRelationships,
    importedWbsItems: uniqueWbs.size,
    mspProjectName: parsed.project.name,
  };
}

function normalizeDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  return new Date(dateStr);
}
