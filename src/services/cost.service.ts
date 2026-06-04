import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export interface EvmResult {
  bcws: number; // Budgeted Cost of Work Scheduled = budgetAmount
  bcwp: number; // Budgeted Cost of Work Performed = budgetAmount * percentComplete
  acwp: number; // Actual Cost of Work Performed = incurredAmount
  sv: number; // Schedule Variance = bcwp - bcws
  cv: number; // Cost Variance = bcwp - acwp
  spi: number; // Schedule Performance Index = bcwp / bcws
  cpi: number; // Cost Performance Index = bcwp / acwp
  eac: number; // Estimate at Completion = budgetAmount / cpi (if cpi != 0)
  vac: number; // Variance at Completion = budgetAmount - eac
  tcpi: number; // To-Complete Performance Index = (budgetAmount - bcwp) / (budgetAmount - acwp)
}

export interface CreateBudgetLineInput {
  projectId: string;
  wbsItemId?: string;
  costCode?: string;
  name: string;
  budgetAmount: number;
  varianceThreshold?: number;
}

export interface UpdateBudgetLineInput {
  name?: string;
  budgetAmount?: number;
  forecastAmount?: number | null;
  varianceThreshold?: number | null;
  wbsItemId?: string | null;
  costCode?: string | null;
}

export interface CreateCostTransactionInput {
  projectId: string;
  budgetLineId: string;
  type: 'committed' | 'incurred';
  source: string;
  amount: number;
  description?: string;
  transactionDate: Date;
  referenceId?: string;
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

export function calculateEvm(
  budgetAmount: number,
  percentComplete: number,
  incurredAmount: number
): EvmResult {
  const bcws = budgetAmount;
  const bcwp = budgetAmount * percentComplete;
  const acwp = incurredAmount;
  const sv = bcwp - bcws;
  const cv = bcwp - acwp;
  const spi = bcws === 0 ? 0 : bcwp / bcws;
  const cpi = acwp === 0 ? 0 : bcwp / acwp;
  const eac = cpi === 0 ? 0 : budgetAmount / cpi;
  const vac = budgetAmount - eac;
  const tcpiDenominator = budgetAmount - acwp;
  const tcpi =
    budgetAmount === 0 || tcpiDenominator === 0 ? 0 : (budgetAmount - bcwp) / tcpiDenominator;

  return {
    bcws,
    bcwp,
    acwp,
    sv,
    cv,
    spi,
    cpi,
    eac,
    vac,
    tcpi,
  };
}

export function recalculateVarianceFlag(
  budgetLine: { budgetAmount: Prisma.Decimal | number; incurredAmount: Prisma.Decimal | number; varianceThreshold: Prisma.Decimal | number | null }
): string | null {
  const budget = decimalToNumber(budgetLine.budgetAmount);
  const incurred = decimalToNumber(budgetLine.incurredAmount);
  const threshold = decimalToNumber(budgetLine.varianceThreshold);

  if (threshold !== null && threshold !== undefined && threshold > 0) {
    if (incurred > budget * (1 + threshold)) {
      return 'red';
    }
    if (incurred > budget) {
      return 'amber';
    }
    return 'green';
  }

  if (incurred > budget) {
    return 'red';
  }
  return 'green';
}

export async function calculateProjectEvm(projectId: string): Promise<{
  projectId: string;
  totalBudget: number;
  totalBcwp: number;
  totalAcwp: number;
  evm: EvmResult;
  lineResults: { lineId: string; name: string; evm: EvmResult; flag: string | null }[];
}> {
  const prisma = getPrismaClient();
  const budgetLines = await prisma.budgetLine.findMany({
    where: { projectId },
  });

  let totalBudget = 0;
  let totalBcwp = 0;
  let totalAcwp = 0;

  const lineResults = budgetLines.map((line) => {
    const budget = decimalToNumber(line.budgetAmount);
    const incurred = decimalToNumber(line.incurredAmount);
    const percentComplete = line.percentComplete;
    const evm = calculateEvm(budget, percentComplete, incurred);
    totalBudget += budget;
    totalBcwp += evm.bcwp;
    totalAcwp += incurred;
    return {
      lineId: line.id,
      name: line.name,
      evm,
      flag: line.varianceFlag,
    };
  });

  const projectPercentComplete = totalBudget === 0 ? 0 : totalBcwp / totalBudget;
  const evm = calculateEvm(totalBudget, projectPercentComplete, totalAcwp);

  return {
    projectId,
    totalBudget,
    totalBcwp,
    totalAcwp,
    evm,
    lineResults,
  };
}

export async function updateBudgetLineCommitted(
  budgetLineId: string,
  amount: number
): Promise<void> {
  const prisma = getPrismaClient();
  const line = await prisma.budgetLine.findUnique({ where: { id: budgetLineId } });
  if (!line) {
    throw new Error('Budget line not found');
  }
  const current = decimalToNumber(line.committedAmount);
  await prisma.budgetLine.update({
    where: { id: budgetLineId },
    data: { committedAmount: current + amount },
  });
}

export async function updateBudgetLineIncurred(
  budgetLineId: string,
  amount: number
): Promise<void> {
  const prisma = getPrismaClient();
  const line = await prisma.budgetLine.findUnique({ where: { id: budgetLineId } });
  if (!line) {
    throw new Error('Budget line not found');
  }
  const current = decimalToNumber(line.incurredAmount);
  const newIncurred = current + amount;
  const flag = recalculateVarianceFlag({
    budgetAmount: line.budgetAmount,
    incurredAmount: newIncurred,
    varianceThreshold: line.varianceThreshold,
  });
  await prisma.budgetLine.update({
    where: { id: budgetLineId },
    data: { incurredAmount: newIncurred, varianceFlag: flag },
  });
}

export async function setBudgetLinePercentComplete(
  budgetLineId: string,
  percent: number
): Promise<void> {
  const prisma = getPrismaClient();
  const line = await prisma.budgetLine.findUnique({ where: { id: budgetLineId } });
  if (!line) {
    throw new Error('Budget line not found');
  }
  const clamped = Math.max(0, Math.min(1, percent));
  const flag = recalculateVarianceFlag({
    budgetAmount: line.budgetAmount,
    incurredAmount: line.incurredAmount,
    varianceThreshold: line.varianceThreshold,
  });
  await prisma.budgetLine.update({
    where: { id: budgetLineId },
    data: { percentComplete: clamped, varianceFlag: flag },
  });
}

export async function createBudgetLine(data: CreateBudgetLineInput) {
  const prisma = getPrismaClient();
  return prisma.budgetLine.create({
    data: {
      projectId: data.projectId,
      wbsItemId: data.wbsItemId,
      costCode: data.costCode,
      name: data.name,
      budgetAmount: data.budgetAmount,
      varianceThreshold: data.varianceThreshold,
      varianceFlag: 'green',
    },
  });
}

export async function getBudgetLineById(id: string) {
  const prisma = getPrismaClient();
  return prisma.budgetLine.findUnique({
    where: { id },
    include: { costTransactions: true },
  });
}

export async function getBudgetLinesByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.budgetLine.findMany({
    where: { projectId },
    include: { costTransactions: true },
  });
}

export async function updateBudgetLine(id: string, data: UpdateBudgetLineInput) {
  const prisma = getPrismaClient();
  const line = await prisma.budgetLine.findUnique({ where: { id } });
  if (!line) {
    throw new Error('Budget line not found');
  }
  const updated = await prisma.budgetLine.update({
    where: { id },
    data: {
      name: data.name,
      budgetAmount: data.budgetAmount,
      forecastAmount: data.forecastAmount,
      varianceThreshold: data.varianceThreshold,
      wbsItemId: data.wbsItemId,
      costCode: data.costCode,
    },
  });
  const flag = recalculateVarianceFlag({
    budgetAmount: updated.budgetAmount,
    incurredAmount: updated.incurredAmount,
    varianceThreshold: updated.varianceThreshold,
  });
  if (flag !== updated.varianceFlag) {
    return prisma.budgetLine.update({
      where: { id },
      data: { varianceFlag: flag },
    });
  }
  return updated;
}

export async function deleteBudgetLine(id: string) {
  const prisma = getPrismaClient();
  return prisma.budgetLine.delete({
    where: { id },
  });
}

export async function createCostTransaction(data: CreateCostTransactionInput) {
  const prisma = getPrismaClient();
  const line = await prisma.budgetLine.findUnique({ where: { id: data.budgetLineId } });
  if (!line) {
    throw new Error('Budget line not found');
  }

  const transaction = await prisma.costTransaction.create({
    data: {
      projectId: data.projectId,
      budgetLineId: data.budgetLineId,
      type: data.type,
      source: data.source,
      amount: data.amount,
      description: data.description,
      transactionDate: data.transactionDate,
      referenceId: data.referenceId,
    },
  });

  if (data.type === 'committed') {
    await updateBudgetLineCommitted(data.budgetLineId, data.amount);
  } else if (data.type === 'incurred') {
    await updateBudgetLineIncurred(data.budgetLineId, data.amount);
  }

  return transaction;
}

export async function getCostTransactionsByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.costTransaction.findMany({
    where: { projectId },
    orderBy: { transactionDate: 'desc' },
  });
}

export async function getCostTransactionsByBudgetLine(budgetLineId: string) {
  const prisma = getPrismaClient();
  return prisma.costTransaction.findMany({
    where: { budgetLineId },
    orderBy: { transactionDate: 'desc' },
  });
}
