import { getPrismaClient } from '../lib/prisma';
import {
  parseXer,
  getXerActivities,
  getXerRelationships,
  getXerWbsItems,
  getXerProject,
  xerDateToDate,
  xerHoursToDays,
  xerLagHoursToDays,
  xerPredTypeToInternal,
  isXerMilestone,
  isXerCritical,
  type ParsedXer,
  type XerActivity,
  type XerRelationship,
} from './xer-parser.service';
import { recalculateSchedule } from './schedule.service';

export interface ImportXerResult {
  projectId: string;
  importedActivities: number;
  importedRelationships: number;
  importedWbsItems: number;
  xerProjectName: string;
}

export async function importXerSchedule(
  projectId: string,
  xerContent: string
): Promise<ImportXerResult> {
  const prisma = getPrismaClient();
  const parsed = parseXer(xerContent);

  const xerProject = getXerProject(parsed);
  const xerProjId = xerProject?.projId;

  const xerWbsList = getXerWbsItems(parsed, xerProjId);
  const xerActivities = getXerActivities(parsed, xerProjId);
  const xerRelationships = getXerRelationships(parsed, xerProjId);

  // Step 1: Upsert WBS items (map xer wbs_id to our WorkBreakdownItem.id)
  const wbsIdMap = new Map<string, string>(); // xer wbs_id -> our wbsItem.id
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { structureType: true, structureLocked: true },
  });
  const structureType = project?.structureType || 'wbs';

  for (const wbs of xerWbsList) {
    const existing = await prisma.workBreakdownItem.findFirst({
      where: { projectId, code: wbs.wbsShortName },
      select: { id: true },
    });
    if (existing) {
      wbsIdMap.set(wbs.wbsId, existing.id);
    } else {
      const created = await prisma.workBreakdownItem.create({
        data: {
          projectId,
          structureType,
          code: wbs.wbsShortName || wbs.wbsId,
          name: wbs.wbsName || wbs.wbsShortName || 'Untitled',
          parentId: wbs.parentWbsId ? wbsIdMap.get(wbs.parentWbsId) || null : null,
          level: 1,
        },
      });
      wbsIdMap.set(wbs.wbsId, created.id);
    }
  }

  // Step 2: Create activities (map xer task_id to our ScheduleActivity.id)
  const activityIdMap = new Map<string, string>(); // xer task_id -> our activity.id
  const importedActivityIds: string[] = [];

  for (const act of xerActivities) {
    const startDate = xerDateToDate(act.targetStartDate);
    const endDate = xerDateToDate(act.targetEndDate);
    const duration = xerHoursToDays(act.targetDurationHours);
    const milestone = isXerMilestone(act.taskType);

    // For milestones, duration should be 0
    const finalDuration = milestone ? 0 : Math.max(1, duration);
    const finalEndDate = milestone ? startDate : endDate;

    const created = await prisma.scheduleActivity.create({
      data: {
        projectId,
        name: act.taskName || act.taskCode || 'Untitled Activity',
        wbsItemId: act.wbsId ? wbsIdMap.get(act.wbsId) || null : null,
        startDate,
        endDate: finalEndDate,
        duration: finalDuration,
        percentComplete: 0,
        status: 'not_started',
        isMilestone: milestone,
        isCritical: isXerCritical(act.totalFloatHours),
        totalFloat: act.totalFloatHours != null ? xerHoursToDays(act.totalFloatHours) : null,
        freeFloat: act.freeFloatHours != null ? xerHoursToDays(act.freeFloatHours) : null,
        predecessors: [],
        successors: [],
      },
    });

    activityIdMap.set(act.taskId, created.id);
    importedActivityIds.push(created.id);
  }

  // Step 3: Create relationships
  let importedRelationships = 0;
  for (const rel of xerRelationships) {
    const predecessorId = activityIdMap.get(rel.predTaskId);
    const successorId = activityIdMap.get(rel.taskId);
    if (!predecessorId || !successorId) continue;

    try {
      await prisma.activityRelationship.create({
        data: {
          projectId,
          predecessorId,
          successorId,
          relationshipType: xerPredTypeToInternal(rel.predType),
          lagDays: xerLagHoursToDays(rel.lagHours),
          constraintType: 'hard',
        },
      });
      importedRelationships++;
    } catch (err: any) {
      // Ignore duplicate relationship errors (@@unique constraint)
      if (!err.message?.includes('Unique constraint')) {
        throw err;
      }
    }
  }

  // Step 4: Recalculate CPM
  await recalculateSchedule(projectId);

  return {
    projectId,
    importedActivities: importedActivityIds.length,
    importedRelationships,
    importedWbsItems: xerWbsList.length,
    xerProjectName: xerProject?.projName || '',
  };
}
