import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';

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

export async function approveChangeOrder(id: string, approver: string) {
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
      status: 'approved',
      approver,
      approvedAt: new Date(),
    },
  });
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
