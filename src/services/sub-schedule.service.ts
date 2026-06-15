/**
 * Sub-Schedule Service
 * ============================================================================
 * Sprint 12 Task 6. Subcontractors have their own schedule that rolls
 * up to the master schedule.
 *
 * Architectural note: PM stores its own sub-schedule rows. Master
 * schedule (ScheduleActivity) is the system of record for project
 * dates; sub activities can OPTIONALLY link to a master activity
 * for rollup. SPI for a sub is computed only from its own rows —
 * never from the master. This is the difference between a true
 * sub-schedule and a slice of the master.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';

export type SubActivityStatus = 'pending' | 'in_progress' | 'complete' | 'delayed';

export interface CreateSubScheduleInput {
  projectId: string;
  subcontractId: string;
  name: string;
  description?: string;
  baselineStartDate?: Date | string;
  baselineEndDate?: Date | string;
  createdBy: string;
}

export interface AddActivityInput {
  subScheduleId: string;
  name: string;
  description?: string;
  plannedStart?: Date | string;
  plannedEnd?: Date | string;
  percentComplete?: number;
  status?: SubActivityStatus;
}

export interface UpdateActivityInput {
  name?: string;
  description?: string;
  plannedStart?: Date | string | null;
  plannedEnd?: Date | string | null;
  actualStart?: Date | string | null;
  actualEnd?: Date | string | null;
  percentComplete?: number;
  status?: SubActivityStatus;
  linkedMasterActivityId?: string | null;
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v : new Date(v);
}

export async function createSubSchedule(input: CreateSubScheduleInput) {
  const prisma = getPrismaClient();
  // Tenant isolation: the subcontract must belong to the project.
  const sub = await prisma.subcontract.findUnique({ where: { id: input.subcontractId } });
  if (!sub || sub.projectId !== input.projectId) {
    throw new Error('Subcontract not found in this project');
  }
  return prisma.subSchedule.create({
    data: {
      projectId: input.projectId,
      subcontractId: input.subcontractId,
      name: input.name,
      description: input.description ?? null,
      baselineStartDate: toDate(input.baselineStartDate),
      baselineEndDate: toDate(input.baselineEndDate),
      createdBy: input.createdBy,
    },
  });
}

export async function addActivity(input: AddActivityInput) {
  const prisma = getPrismaClient();
  return prisma.subScheduleActivity.create({
    data: {
      subScheduleId: input.subScheduleId,
      name: input.name,
      description: input.description ?? null,
      plannedStart: toDate(input.plannedStart),
      plannedEnd: toDate(input.plannedEnd),
      percentComplete: input.percentComplete ?? 0,
      status: input.status ?? 'pending',
    },
  });
}

export async function updateActivity(activityId: string, patch: UpdateActivityInput) {
  const prisma = getPrismaClient();
  return prisma.subScheduleActivity.update({
    where: { id: activityId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.plannedStart !== undefined ? { plannedStart: toDate(patch.plannedStart) } : {}),
      ...(patch.plannedEnd !== undefined ? { plannedEnd: toDate(patch.plannedEnd) } : {}),
      ...(patch.actualStart !== undefined ? { actualStart: toDate(patch.actualStart) } : {}),
      ...(patch.actualEnd !== undefined ? { actualEnd: toDate(patch.actualEnd) } : {}),
      ...(patch.percentComplete !== undefined ? { percentComplete: patch.percentComplete } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.linkedMasterActivityId !== undefined
        ? { linkedMasterActivityId: patch.linkedMasterActivityId }
        : {}),
    },
  });
}

export async function linkToMaster(activityId: string, masterActivityId: string | null) {
  const prisma = getPrismaClient();
  return prisma.subScheduleActivity.update({
    where: { id: activityId },
    data: { linkedMasterActivityId: masterActivityId },
  });
}

export async function getSubSchedules(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.subSchedule.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    include: { activities: true },
  });
}

export async function getSubSchedule(projectId: string, subId: string) {
  const prisma = getPrismaClient();
  const ss = await prisma.subSchedule.findUnique({
    where: { id: subId },
    include: { activities: { orderBy: { plannedStart: 'asc' } } },
  });
  if (!ss || ss.projectId !== projectId) return null;
  return ss;
}

export interface SubSPI {
  subcontractId: string;
  planned: number; // planned duration total in days
  actual: number; // actual elapsed in days (capped at planned)
  spi: number; // planned / max(actual, 1)
  activityCount: number;
  completePct: number;
  status: 'ahead' | 'on_track' | 'at_risk';
}

/**
 * Schedule Performance Index for a single subcontractor.
 * SPI = planned / actual at the activity level. Average across the
 * sub's activities. Clamped to [0, 2] for the status flag.
 *
 *   SPI >= 1.0  → on track or ahead
 *   SPI >= 0.85 → on track
 *   SPI <  0.85 → at risk
 */
export async function calculateSubSPI(subcontractId: string): Promise<SubSPI> {
  const prisma = getPrismaClient();
  const activities = await prisma.subScheduleActivity.findMany({
    where: { subSchedule: { subcontractId } },
  });

  let plannedDaysTotal = 0;
  let actualDaysTotal = 0;
  let completeCount = 0;
  for (const a of activities) {
    const plannedStart = a.plannedStart;
    const plannedEnd = a.plannedEnd;
    if (plannedStart && plannedEnd) {
      const plannedDays = Math.max(1, (plannedEnd.getTime() - plannedStart.getTime()) / 86400000);
      plannedDaysTotal += plannedDays;
      if (a.actualStart) {
        const actualEnd = a.actualEnd ?? new Date();
        const actualDays = Math.max(1, (actualEnd.getTime() - a.actualStart.getTime()) / 86400000);
        actualDaysTotal += actualDays;
      } else {
        // No actual start yet — count planned days as "actual" so
        // we don't over-penalize the sub before work begins.
        actualDaysTotal += plannedDays;
      }
    }
    if (a.status === 'complete') completeCount++;
  }

  const spi = plannedDaysTotal === 0 ? 1 : plannedDaysTotal / Math.max(actualDaysTotal, 1);
  const clamped = Math.max(0, Math.min(2, spi));
  const completePct = activities.length === 0 ? 0 : completeCount / activities.length;
  let status: SubSPI['status'] = 'on_track';
  if (clamped < 0.85) status = 'at_risk';
  else if (clamped >= 1.0) status = 'ahead';

  return {
    subcontractId,
    planned: plannedDaysTotal,
    actual: actualDaysTotal,
    spi: clamped,
    activityCount: activities.length,
    completePct,
    status,
  };
}

export interface SubRollup {
  subcontractId: string;
  subcontractorName: string;
  spi: number;
  status: 'ahead' | 'on_track' | 'at_risk';
  completePct: number;
  activityCount: number;
}

/**
 * Project-wide sub-schedule rollup. One row per subcontract. Powers
 * the Schedule page "Subcontract Schedules" panel.
 */
export async function getRollup(projectId: string): Promise<SubRollup[]> {
  const prisma = getPrismaClient();
  const subs = await prisma.subcontract.findMany({
    where: { projectId },
    orderBy: { subcontractorName: 'asc' },
  });
  const rollup: SubRollup[] = [];
  for (const s of subs) {
    const spi = await calculateSubSPI(s.id);
    rollup.push({
      subcontractId: s.id,
      subcontractorName: s.subcontractorName,
      spi: spi.spi,
      status: spi.status,
      completePct: spi.completePct,
      activityCount: spi.activityCount,
    });
  }
  return rollup;
}
