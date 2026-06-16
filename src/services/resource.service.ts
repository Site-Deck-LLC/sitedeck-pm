import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export interface UpsertEquipmentInput {
  projectId: string;
  externalId: string;
  name: string;
  type?: string;
  currentActivityId?: string;
}

export interface CreateEquipmentInput {
  projectId: string;
  name: string;
  type?: string;
  dailyRate: number;
  isOwned: boolean;
  serialNumber?: string;
  vendor?: string;
  calDueDate?: Date | null;
  externalId?: string;
}

export interface UpdateEquipmentInput {
  name?: string;
  type?: string;
  dailyRate?: number;
  isOwned?: boolean;
  serialNumber?: string | null;
  vendor?: string | null;
  calDueDate?: Date | null;
  status?: string;
}

export interface RecordEquipmentUsageInput {
  projectId: string;
  externalId: string;
  hours: number;
  date: Date;
}

export interface EquipmentCostSummary {
  budgetLineId: string;
  totalAmount: number;
  transactionCount: number;
}

export interface LaborCostSummary {
  budgetLineId: string;
  totalAmount: number;
  transactionCount: number;
}

export interface IdleEquipmentItem {
  equipmentId: string;
  externalId: string;
  name: string;
  activityId: string;
  activityName: string;
  daysIdle: number;
}

export async function upsertEquipment(data: UpsertEquipmentInput) {
  const prisma = getPrismaClient();
  const existing = await prisma.equipment.findUnique({
    where: {
      projectId_externalId: {
        projectId: data.projectId,
        externalId: data.externalId,
      },
    },
  });

  if (existing) {
    return prisma.equipment.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        type: data.type,
        currentActivityId: data.currentActivityId,
      },
    });
  }

  return prisma.equipment.create({
    data: {
      projectId: data.projectId,
      externalId: data.externalId,
      name: data.name,
      type: data.type,
      currentActivityId: data.currentActivityId,
    },
  });
}

export async function recordEquipmentUsage(data: RecordEquipmentUsageInput) {
  const prisma = getPrismaClient();
  const equipment = await prisma.equipment.findUnique({
    where: {
      projectId_externalId: {
        projectId: data.projectId,
        externalId: data.externalId,
      },
    },
  });

  if (!equipment) {
    throw new Error('Equipment not found');
  }

  return prisma.equipment.update({
    where: { id: equipment.id },
    data: {
      totalHours: equipment.totalHours + data.hours,
      lastUsageDate: data.date,
    },
  });
}

export async function getEquipmentByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.equipment.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
  });
}

export async function getEquipmentByExternalId(projectId: string, externalId: string) {
  const prisma = getPrismaClient();
  return prisma.equipment.findUnique({
    where: {
      projectId_externalId: {
        projectId,
        externalId,
      },
    },
  });
}

export async function assignEquipmentToActivity(
  projectId: string,
  externalId: string,
  activityId: string
) {
  const prisma = getPrismaClient();
  const equipment = await prisma.equipment.findUnique({
    where: {
      projectId_externalId: {
        projectId,
        externalId,
      },
    },
  });

  if (!equipment) {
    throw new Error('Equipment not found');
  }

  return prisma.equipment.update({
    where: { id: equipment.id },
    data: { currentActivityId: activityId },
  });
}

export async function unassignEquipmentFromActivity(projectId: string, externalId: string) {
  const prisma = getPrismaClient();
  const equipment = await prisma.equipment.findUnique({
    where: {
      projectId_externalId: {
        projectId,
        externalId,
      },
    },
  });

  if (!equipment) {
    throw new Error('Equipment not found');
  }

  return prisma.equipment.update({
    where: { id: equipment.id },
    data: { currentActivityId: null },
  });
}

export async function getEquipmentCostSummary(projectId: string): Promise<EquipmentCostSummary[]> {
  const prisma = getPrismaClient();
  const transactions = await prisma.costTransaction.findMany({
    where: {
      projectId,
      source: 'equipment_webhook',
    },
    orderBy: { transactionDate: 'desc' },
  });

  const map = new Map<string, { totalAmount: number; count: number }>();
  for (const tx of transactions) {
    const key = tx.budgetLineId;
    const amount =
      tx.amount instanceof Prisma.Decimal ? tx.amount.toNumber() : Number(tx.amount);
    const existing = map.get(key);
    if (existing) {
      existing.totalAmount += amount;
      existing.count += 1;
    } else {
      map.set(key, { totalAmount: amount, count: 1 });
    }
  }

  return Array.from(map.entries()).map(([budgetLineId, value]) => ({
    budgetLineId,
    totalAmount: value.totalAmount,
    transactionCount: value.count,
  }));
}

export async function getLaborCostSummary(projectId: string): Promise<LaborCostSummary[]> {
  const prisma = getPrismaClient();
  const transactions = await prisma.costTransaction.findMany({
    where: {
      projectId,
      source: 'labor_webhook',
    },
    orderBy: { transactionDate: 'desc' },
  });

  const map = new Map<string, { totalAmount: number; count: number }>();
  for (const tx of transactions) {
    const key = tx.budgetLineId;
    const amount =
      tx.amount instanceof Prisma.Decimal ? tx.amount.toNumber() : Number(tx.amount);
    const existing = map.get(key);
    if (existing) {
      existing.totalAmount += amount;
      existing.count += 1;
    } else {
      map.set(key, { totalAmount: amount, count: 1 });
    }
  }

  return Array.from(map.entries()).map(([budgetLineId, value]) => ({
    budgetLineId,
    totalAmount: value.totalAmount,
    transactionCount: value.count,
  }));
}

export interface EquipmentDashboardSummary {
  totalCount: number;
  activeCount: number;
  idleCount: number;
  totalHours: number;
  estimatedDailyCost: number;
}

export async function getEquipmentDashboardSummary(projectId: string): Promise<EquipmentDashboardSummary> {
  const prisma = getPrismaClient();
  const all = await prisma.equipment.findMany({ where: { projectId } });
  const activeCount = all.filter((e) => e.status === 'active').length;
  const idleCount = all.filter((e) => e.status === 'idle' || e.status === 'standby').length;
  const totalHours = all.reduce((sum, e) => sum + e.totalHours, 0);
  const estimatedDailyCost = all.reduce((sum, e) => {
    const rate = e.dailyRate ? (e.dailyRate instanceof Prisma.Decimal ? e.dailyRate.toNumber() : Number(e.dailyRate)) : 0;
    return sum + rate;
  }, 0);
  return {
    totalCount: all.length,
    activeCount,
    idleCount,
    totalHours,
    estimatedDailyCost,
  };
}

export async function setEquipmentDailyRate(projectId: string, externalId: string, dailyRate: number) {
  const prisma = getPrismaClient();
  const equipment = await prisma.equipment.findUnique({
    where: { projectId_externalId: { projectId, externalId } },
  });
  if (!equipment) {
    throw new Error('Equipment not found');
  }
  return prisma.equipment.update({
    where: { id: equipment.id },
    data: { dailyRate: new Prisma.Decimal(dailyRate) },
  });
}

export interface AttendanceDetail {
  presentCount?: number;
  absentCount?: number;
  lateCount?: number;
  notes?: string;
  affectedActivities?: string[];
}

export async function upsertAttendance(
  projectId: string,
  date: Date,
  workerCount: number,
  hours: number,
  detail: AttendanceDetail = {}
) {
  const prisma = getPrismaClient();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const existing = await prisma.attendance.findUnique({
    where: { projectId_date: { projectId, date: day } },
  });
  const data = {
    workerCount,
    hours,
    presentCount: detail.presentCount ?? null,
    absentCount: detail.absentCount ?? null,
    lateCount: detail.lateCount ?? null,
    notes: detail.notes ?? null,
    affectedActivities: detail.affectedActivities ?? [],
  };
  if (existing) {
    return prisma.attendance.update({
      where: { id: existing.id },
      data,
    });
  }
  return prisma.attendance.create({
    data: {
      projectId,
      date: day,
      ...data,
    },
  });
}

export async function getAttendanceForDate(projectId: string, date: Date) {
  const prisma = getPrismaClient();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return prisma.attendance.findUnique({
    where: { projectId_date: { projectId, date: day } },
  });
}

export async function getAttendanceForProject(projectId: string, startDate: Date, endDate: Date) {
  const prisma = getPrismaClient();
  return prisma.attendance.findMany({
    where: {
      projectId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  });
}

export async function getIdleEquipmentOnCriticalPath(projectId: string): Promise<IdleEquipmentItem[]> {
  const prisma = getPrismaClient();
  const now = new Date();

  const equipmentList = await prisma.equipment.findMany({
    where: {
      projectId,
      currentActivityId: { not: null },
    },
  });

  if (equipmentList.length === 0) {
    return [];
  }

  const activityIds = equipmentList
    .map((e) => e.currentActivityId)
    .filter((id): id is string => id !== null);

  const activities = await prisma.scheduleActivity.findMany({
    where: {
      id: { in: activityIds },
      isCritical: true,
      status: { not: 'complete' },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const activityMap = new Map(activities.map((a) => [a.id, a]));
  const idleThresholdDays = 1;
  const msPerDay = 24 * 60 * 60 * 1000;

  const idleItems: IdleEquipmentItem[] = [];

  for (const eq of equipmentList) {
    if (!eq.currentActivityId || !activityMap.has(eq.currentActivityId)) {
      continue;
    }

    const lastUsage = eq.lastUsageDate;
    if (!lastUsage) {
      const activity = activityMap.get(eq.currentActivityId)!;
      idleItems.push({
        equipmentId: eq.id,
        externalId: eq.externalId,
        name: eq.name,
        activityId: activity.id,
        activityName: activity.name,
        daysIdle: Number.POSITIVE_INFINITY,
      });
      continue;
    }

    const daysIdle = Math.floor((now.getTime() - lastUsage.getTime()) / msPerDay);
    if (daysIdle >= idleThresholdDays) {
      const activity = activityMap.get(eq.currentActivityId)!;
      idleItems.push({
        equipmentId: eq.id,
        externalId: eq.externalId,
        name: eq.name,
        activityId: activity.id,
        activityName: activity.name,
        daysIdle,
      });
    }
  }

  return idleItems;
}

export interface CrewStatus {
  plannedCrewToday: number;
  confirmedPresent: number;
  absentCount: number;
  lateCount: number;
  crewGapPct: number;
  gapStatus: 'green' | 'amber' | 'red';
  criticalPathImpacted: boolean;
  equipmentOnSite: number;
  equipmentIdle: number;
  equipmentDailyBurn: number;
  equipmentBudgetRate: number;
}

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export async function getCrewStatus(projectId: string): Promise<CrewStatus> {
  const prisma = getPrismaClient();
  const now = new Date();
  const todayStart = startOfDayUTC(now);
  const todayEnd = endOfDayUTC(now);

  // ── Planned crew: count activities that start today or are active today ──
  // Active = started before/on today and finishing on/after today, not complete
  const todaysActivities = await prisma.scheduleActivity.findMany({
    where: {
      projectId,
      status: { not: 'complete' },
      startDate: { lte: todayEnd },
      endDate: { gte: todayStart },
    },
    select: { id: true, isCritical: true },
  });
  const plannedCrewToday = todaysActivities.length;

  // ── Confirmed present: from attendance for today ──
  const todayAttendance = await prisma.attendance.findUnique({
    where: { projectId_date: { projectId, date: todayStart } },
  });
  const confirmedPresent = todayAttendance?.workerCount ?? 0;
  const hoursLogged = todayAttendance?.hours ?? 0;

  // Prefer stored detail counts; fall back to heuristic for projects without detail
  const hasDetail = todayAttendance?.presentCount != null && todayAttendance?.absentCount != null;
  const storedPresent = todayAttendance?.presentCount ?? null;
  const storedAbsent = todayAttendance?.absentCount ?? null;
  const storedLate = todayAttendance?.lateCount ?? null;

  // "Late" = expected crew size 75% of planned (heuristic) but actual is 25-75% of that
  // "Absent" = anything below 25% (i.e. nothing came in)
  const expected = plannedCrewToday;
  const attendanceRatio = expected > 0 ? confirmedPresent / expected : 1;
  const heuristicAbsent = expected > 0 ? Math.max(0, expected - confirmedPresent) : 0;
  const heuristicLate = attendanceRatio > 0.25 && attendanceRatio < 0.75 ? Math.round(expected * (1 - attendanceRatio)) : 0;
  const absentCount = hasDetail && storedAbsent != null ? storedAbsent : heuristicAbsent;
  const lateCount = hasDetail && storedLate != null ? storedLate : heuristicLate;

  // ── Crew gap percentage ──
  const crewGapPct = plannedCrewToday > 0
    ? Math.max(0, (plannedCrewToday - confirmedPresent) / plannedCrewToday) * 100
    : 0;

  // ── Critical path impact: any critical activity active today with no attendance? ──
  const criticalActiveIds = todaysActivities.filter((a) => a.isCritical).map((a) => a.id);
  const criticalPathImpacted =
    criticalActiveIds.length > 0 &&
    (confirmedPresent === 0 || hoursLogged === 0) &&
    plannedCrewToday > 0;

  // ── Gap status ──
  let gapStatus: 'green' | 'amber' | 'red';
  if (crewGapPct > 20 || (criticalPathImpacted && crewGapPct > 0)) {
    gapStatus = 'red';
  } else if (crewGapPct >= 10 || (criticalPathImpacted && crewGapPct > 0)) {
    gapStatus = 'amber';
  } else {
    gapStatus = 'green';
  }

  // ── Equipment ──
  const equipmentList = await prisma.equipment.findMany({ where: { projectId } });
  const equipmentOnSite = equipmentList.length;
  const equipmentIdle = equipmentList.filter((e) => e.status === 'idle' || e.status === 'standby').length;
  const equipmentDailyBurn = equipmentList
    .filter((e) => e.status === 'active')
    .reduce((sum, e) => {
      const rate = e.dailyRate ? (e.dailyRate instanceof Prisma.Decimal ? e.dailyRate.toNumber() : Number(e.dailyRate)) : 0;
      return sum + rate;
    }, 0);
  // Budgeted daily equipment cost = sum of all daily rates
  const equipmentBudgetRate = equipmentList.reduce((sum, e) => {
    const rate = e.dailyRate ? (e.dailyRate instanceof Prisma.Decimal ? e.dailyRate.toNumber() : Number(e.dailyRate)) : 0;
    return sum + rate;
  }, 0);

  return {
    plannedCrewToday,
    confirmedPresent,
    absentCount,
    lateCount,
    crewGapPct: Math.round(crewGapPct * 10) / 10,
    gapStatus,
    criticalPathImpacted,
    equipmentOnSite,
    equipmentIdle,
    equipmentDailyBurn: Math.round(equipmentDailyBurn),
    equipmentBudgetRate: Math.round(equipmentBudgetRate),
  };
}

export interface EquipmentStatusLogInput {
  equipmentId: string;
  date: Date;
  status: string;
  hours: number;
  notes?: string;
  loggedBy?: string;
}

export async function logEquipmentStatus(input: EquipmentStatusLogInput) {
  const prisma = getPrismaClient();
  const day = new Date(input.date.getFullYear(), input.date.getMonth(), input.date.getDate());

  // Update the equipment row's current status + lastUsageDate
  await prisma.equipment.update({
    where: { id: input.equipmentId },
    data: {
      status: input.status,
      lastUsageDate: input.hours > 0 ? day : undefined,
      totalHours: { increment: input.hours },
    },
  });

  return prisma.equipmentStatusLog.create({
    data: {
      equipmentId: input.equipmentId,
      date: day,
      status: input.status,
      hours: input.hours,
      notes: input.notes ?? null,
      loggedBy: input.loggedBy ?? null,
    },
  });
}

export async function getEquipmentStatusLog(projectId: string, startDate: Date, endDate: Date) {
  const prisma = getPrismaClient();
  const dayStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const dayEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return prisma.equipmentStatusLog.findMany({
    where: {
      equipment: { projectId },
      date: { gte: dayStart, lte: dayEnd },
    },
    include: { equipment: { select: { id: true, externalId: true, name: true } } },
    orderBy: { date: 'desc' },
  });
}

// ─── Equipment Registry CRUD (Sprint 6) ───────────────────────────────────

let _equipmentCounter = 0;

/**
 * Generate a unique external_id for a new equipment record. The format is
 * EQ-NNNN where NNNN is a per-process counter; combined with the projectId
 * unique constraint this is collision-free for development. In production,
 * the integration would assign external_ids from the field system.
 */
function generateExternalId(): string {
  _equipmentCounter += 1;
  return `EQ-${String(_equipmentCounter).padStart(4, '0')}`;
}

export async function createEquipment(data: CreateEquipmentInput) {
  const prisma = getPrismaClient();
  const externalId = data.externalId || generateExternalId();
  return prisma.equipment.create({
    data: {
      projectId: data.projectId,
      externalId,
      name: data.name,
      type: data.type || null,
      dailyRate: new Prisma.Decimal(data.dailyRate),
      isOwned: data.isOwned,
      serialNumber: data.serialNumber || null,
      vendor: data.vendor || null,
      calDueDate: data.calDueDate || null,
      status: 'active',
    },
  });
}

export async function getEquipmentById(equipmentId: string) {
  const prisma = getPrismaClient();
  return prisma.equipment.findUnique({
    where: { id: equipmentId },
  });
}

export async function updateEquipment(equipmentId: string, data: UpdateEquipmentInput) {
  const prisma = getPrismaClient();
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.dailyRate !== undefined) updateData.dailyRate = new Prisma.Decimal(data.dailyRate);
  if (data.isOwned !== undefined) updateData.isOwned = data.isOwned;
  if (data.serialNumber !== undefined) updateData.serialNumber = data.serialNumber;
  if (data.vendor !== undefined) updateData.vendor = data.vendor;
  if (data.calDueDate !== undefined) updateData.calDueDate = data.calDueDate;
  if (data.status !== undefined) updateData.status = data.status;
  return prisma.equipment.update({
    where: { id: equipmentId },
    data: updateData,
  });
}

export async function getEquipmentStatusHistory(equipmentId: string) {
  const prisma = getPrismaClient();
  return prisma.equipmentStatusLog.findMany({
    where: { equipmentId },
    orderBy: { date: 'desc' },
  });
}

export interface EquipmentListItem {
  id: string;
  externalId: string;
  name: string;
  type: string | null;
  status: string;
  dailyRate: number | null;
  isOwned: boolean;
  lastUsageDate: Date | null;
  updatedAt: Date;
  calDueDate: Date | null;
  calDueSoon: boolean;
  totalCostToDate: number;
  daysOnProject: number;
}

/**
 * List equipment for a project with derived columns:
 *   - totalCostToDate: rate × totalHours
 *   - daysOnProject: days since creation
 *   - calDueSoon: cal_due_date within 30 days from today
 */
export async function getEquipmentListForProject(projectId: string): Promise<EquipmentListItem[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.equipment.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
  });
  const now = new Date();
  const calDueThreshold = new Date(now);
  calDueThreshold.setDate(calDueThreshold.getDate() + 30);

  return rows.map((r) => {
    const rate = r.dailyRate
      ? r.dailyRate instanceof Prisma.Decimal
        ? r.dailyRate.toNumber()
        : Number(r.dailyRate)
      : 0;
    const totalCost = rate * r.totalHours;
    const days = Math.max(1, Math.floor((now.getTime() - r.createdAt.getTime()) / (24 * 60 * 60 * 1000)));
    return {
      id: r.id,
      externalId: r.externalId,
      name: r.name,
      type: r.type,
      status: r.status,
      dailyRate: rate,
      isOwned: r.isOwned,
      lastUsageDate: r.lastUsageDate,
      updatedAt: r.updatedAt,
      calDueDate: r.calDueDate,
      calDueSoon: r.calDueDate != null && r.calDueDate <= calDueThreshold,
      totalCostToDate: totalCost,
      daysOnProject: days,
    };
  });
}
