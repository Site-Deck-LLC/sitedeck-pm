import { getPrismaClient } from '../lib/prisma';
import { parseExcelSchedule, type ExcelScheduleRow } from './excel-schedule-parser.service';
import { recalculateSchedule } from './schedule.service';

export interface ImportExcelResult {
  projectId: string;
  importedActivities: number;
  importedRelationships: number;
  importedWbsItems: number;
}

export async function importExcelSchedule(
  projectId: string,
  buffer: Buffer,
  filename: string
): Promise<ImportExcelResult> {
  const prisma = getPrismaClient();
  const rows = parseExcelSchedule(buffer, filename);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { structureType: true, structureLocked: true },
  });
  const structureType = project?.structureType || 'wbs';

  // Upsert WBS items
  const wbsCodes = new Map<string, string>();
  const uniqueWbs = new Map<string, string>();
  for (const row of rows) {
    if (row.wbsCode && !uniqueWbs.has(row.wbsCode)) {
      uniqueWbs.set(row.wbsCode, row.name);
    }
  }

  for (const [code, name] of uniqueWbs) {
    const existing = await prisma.workBreakdownItem.findFirst({
      where: { projectId, code },
      select: { id: true },
    });
    if (existing) {
      wbsCodes.set(code, existing.id);
    } else {
      const created = await prisma.workBreakdownItem.create({
        data: {
          projectId,
          structureType,
          code,
          name: name || code,
          level: 1,
        },
      });
      wbsCodes.set(code, created.id);
    }
  }

  // Create activities
  const activityIdMap = new Map<string, string>();
  let importedActivities = 0;

  for (const row of rows) {
    const startDate = new Date(row.startDate);
    const endDate = new Date(row.endDate);

    const created = await prisma.scheduleActivity.create({
      data: {
        projectId,
        name: row.name,
        wbsItemId: row.wbsCode ? wbsCodes.get(row.wbsCode) || null : null,
        startDate,
        endDate,
        duration: row.duration,
        percentComplete: row.percentComplete || 0,
        status: row.status || 'not_started',
        isMilestone: row.milestone || false,
        isCritical: false,
        predecessors: [],
        successors: [],
      },
    });

    activityIdMap.set(row.name, created.id);
    importedActivities++;
  }

  // Create relationships from predecessor strings
  let importedRelationships = 0;
  for (const row of rows) {
    if (!row.predecessors) continue;
    const successorId = activityIdMap.get(row.name);
    if (!successorId) continue;

    const predNames = row.predecessors.split(',').map((s) => s.trim());
    for (const predName of predNames) {
      if (!predName) continue;
      const predecessorId = activityIdMap.get(predName);
      if (!predecessorId) continue;

      try {
        await prisma.activityRelationship.create({
          data: {
            projectId,
            predecessorId,
            successorId,
            relationshipType: (row.relationshipType as 'FS' | 'SS' | 'FF' | 'SF') || 'FS',
            lagDays: row.lagDays || 0,
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
  }

  await recalculateSchedule(projectId);

  return {
    projectId,
    importedActivities,
    importedRelationships,
    importedWbsItems: uniqueWbs.size,
  };
}
