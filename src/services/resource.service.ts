import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export interface UpsertEquipmentInput {
  projectId: string;
  externalId: string;
  name: string;
  type?: string;
  currentActivityId?: string;
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
