import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { recalculateBaseline, RecalculateBaselineResult } from './cost.service';
import { logChange } from './integration.service';

export interface CreateChangeOrderInput {
  projectId: string;
  date: Date;
  description: string;
  dollarValue?: number;
  scheduleImpact?: number;
  affectedActivityIds?: string[];
}

export interface UpdateChangeOrderInput {
  description?: string;
  dollarValue?: number;
  scheduleImpact?: number;
  affectedActivityIds?: string[];
}

export async function createScopeStatement(
  projectId: string,
  content: string,
  createdBy: string
) {
  const prisma = getPrismaClient();
  return prisma.scopeStatement.create({
    data: {
      projectId,
      content,
      version: 1,
      createdBy,
    },
  });
}

export async function updateScopeStatement(
  id: string,
  content: string,
  createdBy: string
) {
  const prisma = getPrismaClient();
  const existing = await prisma.scopeStatement.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new Error('Scope statement not found');
  }

  return prisma.scopeStatement.create({
    data: {
      projectId: existing.projectId,
      content,
      version: existing.version + 1,
      createdBy,
    },
  });
}

export async function getScopeStatementsByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.scopeStatement.findMany({
    where: { projectId },
    orderBy: { version: 'desc' },
  });
}

export async function getLatestScopeStatement(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.scopeStatement.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
  });
}

export async function getScopeStatementById(id: string) {
  const prisma = getPrismaClient();
  return prisma.scopeStatement.findUnique({
    where: { id },
  });
}

function generateCoNumber(sequence: number): string {
  const year = new Date().getFullYear();
  const padded = String(sequence).padStart(4, '0');
  return `CO-${year}-${padded}`;
}

export async function createChangeOrder(data: CreateChangeOrderInput) {
  const prisma = getPrismaClient();
  const existingCount = await prisma.changeOrder.count({
    where: { projectId: data.projectId },
  });
  const coNumber = generateCoNumber(existingCount + 1);

  const createData: Prisma.ChangeOrderCreateInput = {
    project: { connect: { id: data.projectId } },
    coNumber,
    date: data.date,
    description: data.description,
    status: 'pending',
    dollarValue: data.dollarValue !== undefined ? new Prisma.Decimal(data.dollarValue) : undefined,
    scheduleImpact: data.scheduleImpact,
    affectedActivityIds: data.affectedActivityIds ?? undefined,
  };

  return prisma.changeOrder.create({
    data: createData,
  });
}

export async function getChangeOrderById(id: string) {
  const prisma = getPrismaClient();
  return prisma.changeOrder.findUnique({
    where: { id },
    include: { project: true },
  });
}

export async function getChangeOrdersByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.changeOrder.findMany({
    where: { projectId },
    orderBy: { date: 'desc' },
  });
}

export async function approveChangeOrder(
  id: string,
  approver: string
): Promise<{
  changeOrder: any;
  baseline: RecalculateBaselineResult;
}> {
  const prisma = getPrismaClient();
  const co = await prisma.changeOrder.findUnique({
    where: { id },
  });
  if (!co) {
    throw new Error('Change order not found');
  }
  if (co.status === 'approved') {
    // Idempotent: re-approving an already-approved CO is a no-op for the
    // budget (BAC has already been adjusted). We still return the current
    // baseline state so the caller gets a consistent response shape.
    const baseline = await recalculateBaseline(co.projectId, 0);
    const changeOrder = await prisma.changeOrder.findUnique({ where: { id } });
    return { changeOrder, baseline };
  }
  if (co.status === 'rejected') {
    throw new Error('Cannot approve a rejected change order');
  }

  // Update the CO first so the dollarValue is durable, then flow it into the
  // cost baseline. We do recalc AFTER the CO update so any concurrent read
  // of the CO sees the new status; recalc itself is idempotent because
  // BAC only ever grows on the first approval (re-approval short-circuits
  // above).
  const dollarValue = co.dollarValue ? (co.dollarValue as Prisma.Decimal).toNumber() : 0;
  const updated = await prisma.changeOrder.update({
    where: { id },
    data: {
      status: 'approved',
      approver,
      approvedAt: new Date(),
    },
  });

  const baseline = await recalculateBaseline(co.projectId, dollarValue);

  // Unified change log entry — EVM/baseline updates are part of the
  // integrated change history so the dashboard and the Owner's Rep can
  // see the cost progression.
  await logChange({
    projectId: co.projectId,
    module: 'scope',
    changeType: 'change_order_approved',
    description: `Change order ${co.coNumber} approved by ${approver}. ` +
      `Baseline updated: +$${dollarValue.toLocaleString()} ` +
      `(BAC $${baseline.previousTotalBudget.toLocaleString()} → $${baseline.newTotalBudget.toLocaleString()}).`,
    affectedRecordId: co.id,
    affectedRecordType: 'change_order',
    changedBy: approver,
  });

  return { changeOrder: updated, baseline };
}

export async function rejectChangeOrder(id: string, approver: string) {
  const prisma = getPrismaClient();
  const co = await prisma.changeOrder.findUnique({
    where: { id },
  });
  if (!co) {
    throw new Error('Change order not found');
  }

  return prisma.changeOrder.update({
    where: { id },
    data: {
      status: 'rejected',
      approver,
      approvedAt: new Date(),
    },
  });
}

export async function submitChangeOrder(id: string) {
  const prisma = getPrismaClient();
  const co = await prisma.changeOrder.findUnique({ where: { id } });
  if (!co) {
    throw new Error('Change order not found');
  }
  // Submitted COs flow to the owner for approval
  return prisma.changeOrder.update({
    where: { id },
    data: { status: 'submitted' },
  });
}

export async function updateChangeOrder(id: string, data: UpdateChangeOrderInput) {
  const prisma = getPrismaClient();
  const updateData: Prisma.ChangeOrderUpdateInput = {};
  if (data.description !== undefined) updateData.description = data.description;
  if (data.dollarValue !== undefined) updateData.dollarValue = new Prisma.Decimal(data.dollarValue);
  if (data.scheduleImpact !== undefined) updateData.scheduleImpact = data.scheduleImpact;
  if (data.affectedActivityIds !== undefined) {
    updateData.affectedActivityIds = data.affectedActivityIds as unknown as Prisma.InputJsonValue;
  }
  return prisma.changeOrder.update({
    where: { id },
    data: updateData,
  });
}

export interface ChangeOrderPdfData {
  coNumber: string;
  date: Date;
  description: string;
  status: string;
  dollarValue: number | null;
  scheduleImpact: number | null;
  approver: string | null;
  projectName: string;
}

export async function getChangeOrderPdfData(id: string): Promise<ChangeOrderPdfData> {
  const prisma = getPrismaClient();
  const co = await prisma.changeOrder.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!co) {
    throw new Error('Change order not found');
  }

  return {
    coNumber: co.coNumber,
    date: co.date,
    description: co.description,
    status: co.status,
    dollarValue: co.dollarValue ? (co.dollarValue as Prisma.Decimal).toNumber() : null,
    scheduleImpact: co.scheduleImpact ?? null,
    approver: co.approver,
    projectName: co.project.name,
  };
}
