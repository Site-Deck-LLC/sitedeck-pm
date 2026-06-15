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

// ─── Forecasting ────────────────────────────────────────────────────────────
// EVM forecasting answers the question: at the current burn rate and
// efficiency, where will this project end up?
//
// Three EAC variants are reported:
//   EAC_CPI    = BAC / CPI      — assumes current efficiency continues
//   EAC_SPI    = AC + (BAC-EV)/SPI — assumes schedule affects cost
//   EAC_replan = AC + (BAC-EV)  — assumes remaining work is at budget
//
// The "confidence range" reported to the UI is:
//   Optimistic = EAC_replan
//   Most likely = EAC_CPI
//   Pessimistic = EAC_SPI
//
// Forecast completion date: at the current daily burn rate, how many
// days of work remain to recover the budget gap? (BAC - EV) / (AC / days_elapsed).
//
// TCPI (To-Complete Performance Index) tells the team how much more
// efficient they need to be on the remaining work to land at BAC.
// TCPI > 1.1 = "tight"; TCPI < 0.9 = "comfortable cushion".
// ============================================================================

export interface EvmForecasts {
  projectId: string;
  bac: number;
  ev: number;
  ac: number;
  pv: number;
  cpi: number;
  spi: number;
  tcpi: number;
  tcpiFlag: 'tight' | 'on_pace' | 'cushion' | 'unknown';
  eac_cpi: number;
  eac_spi: number;
  eac_replan: number;
  vac: number; // BAC - EAC_CPI
  daysElapsed: number;
  daysRemaining: number;
  forecastCompleteDate: string | null; // ISO date
  baselineCompleteDate: string | null; // ISO date
  completeDateDeltaDays: number | null; // positive = late, negative = ahead
  confidenceRange: {
    optimistic: number; // EAC_replan
    mostLikely: number; // EAC_CPI
    pessimistic: number; // EAC_SPI
  };
}

export async function calculateForecasts(projectId: string): Promise<EvmForecasts> {
  const prisma = getPrismaClient();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, startDate: true, endDate: true },
  });

  const evm = await calculateProjectEvm(projectId);
  const bac = evm.totalBudget;
  const ev = evm.totalBcwp;
  const ac = evm.totalAcwp;
  const cpi = evm.evm.cpi;
  const spi = evm.evm.spi;

  // PV is the planned value at "today" — we approximate it by assuming
  // a linear schedule from start → endDate, with EV at the burn rate
  // observed so far. If we have a real ScheduleActivity feed that emits
  // PV per period, swap this calculation in.
  const start = project?.startDate;
  const end = project?.endDate;
  const now = new Date();
  const totalDays = start && end ? Math.max(1, (end.getTime() - start.getTime()) / 86400000) : 0;
  const daysElapsed = start ? Math.max(0, (now.getTime() - start.getTime()) / 86400000) : 0;
  const plannedFraction = totalDays === 0 ? 0 : Math.min(1, Math.max(0, daysElapsed / totalDays));
  const pv = bac * plannedFraction;

  // EAC variants
  const eac_cpi = cpi === 0 ? bac : bac / cpi;
  const eac_spi = spi === 0 ? ac + (bac - ev) : ac + (bac - ev) / spi;
  const eac_replan = ac + (bac - ev);
  const vac = bac - eac_cpi;

  // TCPI = (BAC - EV) / (BAC - AC). > 1.1 tight; < 0.9 cushion.
  let tcpi = 0;
  let tcpiFlag: EvmForecasts['tcpiFlag'] = 'unknown';
  if (bac > 0) {
    const remainingBudget = bac - ac;
    if (remainingBudget > 0) {
      tcpi = (bac - ev) / remainingBudget;
      if (tcpi > 1.1) tcpiFlag = 'tight';
      else if (tcpi < 0.9) tcpiFlag = 'cushion';
      else tcpiFlag = 'on_pace';
    } else {
      // AC has already hit/exceeded BAC. Performance index is undefined.
      tcpi = 0;
      tcpiFlag = 'tight';
    }
  }

  // Forecast completion date. At the current AC/day rate, how many days
  // remain to finish the remaining budget? remaining / (AC / daysElapsed).
  let daysRemaining = 0;
  let forecastCompleteDate: string | null = null;
  let completeDateDeltaDays: number | null = null;
  if (daysElapsed > 0 && ac > 0) {
    const dailyBurn = ac / daysElapsed;
    const remainingWork = Math.max(0, bac - ev);
    daysRemaining = dailyBurn > 0 ? remainingWork / dailyBurn : 0;
    const fcd = new Date(now.getTime() + daysRemaining * 86400000);
    forecastCompleteDate = fcd.toISOString();
    if (end) {
      completeDateDeltaDays = Math.round((fcd.getTime() - end.getTime()) / 86400000);
    }
  }

  return {
    projectId,
    bac,
    ev,
    ac,
    pv,
    cpi,
    spi,
    tcpi,
    tcpiFlag,
    eac_cpi,
    eac_spi,
    eac_replan,
    vac,
    daysElapsed: Math.round(daysElapsed),
    daysRemaining: Math.round(daysRemaining),
    forecastCompleteDate,
    baselineCompleteDate: end ? end.toISOString() : null,
    completeDateDeltaDays,
    confidenceRange: {
      optimistic: eac_replan,
      mostLikely: eac_cpi,
      pessimistic: eac_spi,
    },
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

export interface RecalculateBaselineResult {
  projectId: string;
  previousTotalBudget: number;
  newTotalBudget: number;
  addedAmount: number;
  source: 'proportional_distribution' | 'change_order_catchall' | 'no_budget_lines';
  affectedBudgetLineIds: string[];
}

/**
 * Recalculate a project's cost baseline by folding an approved change order
 * into the existing budget lines.
 *
 * Strategy:
 *   - If the project has zero budget lines, create a single "Change Orders"
 *     catch-all line and add the full amount to it.
 *   - If the project has one or more budget lines, distribute the addition
 *     proportionally to current budget amounts. This preserves the
 *     original cost-code allocation ratios.
 *
 * BAC (Budget at Completion) is the sum of all budget lines. After this
 * call, BAC = previous BAC + amount. EVM calculations that read budget
 * lines will see the new BAC on the next call to calculateProjectEvm.
 *
 * This is the V1 approach to EVM re-flow on CO approval: the budget is
 * bumped; schedule impact (hours) is not yet integrated into the schedule
 * module's baseline (a future task).
 */
export async function recalculateBaseline(
  projectId: string,
  amount: number
): Promise<RecalculateBaselineResult> {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Baseline recalculation amount must be a non-negative number');
  }
  const prisma = getPrismaClient();
  const lines = await prisma.budgetLine.findMany({ where: { projectId } });
  const previousTotal = lines.reduce(
    (sum, l) => sum + decimalToNumber(l.budgetAmount),
    0
  );

  if (amount === 0) {
    return {
      projectId,
      previousTotalBudget: previousTotal,
      newTotalBudget: previousTotal,
      addedAmount: 0,
      source: 'proportional_distribution',
      affectedBudgetLineIds: [],
    };
  }

  // No lines → create a catch-all "Change Orders" line and add the full amount
  if (lines.length === 0) {
    const newLine = await prisma.budgetLine.create({
      data: {
        projectId,
        name: 'Change Orders',
        costCode: 'CHG-ORD',
        budgetAmount: new Prisma.Decimal(amount),
      },
    });
    return {
      projectId,
      previousTotalBudget: previousTotal,
      newTotalBudget: previousTotal + amount,
      addedAmount: amount,
      source: 'change_order_catchall',
      affectedBudgetLineIds: [newLine.id],
    };
  }

  // Distribute proportionally. Compute each line's share using integer-cents
  // to avoid rounding drift; assign the remainder to the largest line so the
  // total is exact.
  const totalCents = Math.round(previousTotal * 100);
  const additionCents = Math.round(amount * 100);
  let allocatedCents = 0;
  const additions = lines.map((line) => {
    const budgetCents = Math.round(decimalToNumber(line.budgetAmount) * 100);
    const share = totalCents === 0 ? 0 : Math.floor((budgetCents / totalCents) * additionCents);
    allocatedCents += share;
    return { id: line.id, shareCents: share };
  });
  const remainder = additionCents - allocatedCents;
  if (remainder !== 0 && additions.length > 0) {
    // Find the largest line by budgetAmount to absorb the rounding remainder
    let largestIdx = 0;
    let largestBudget = -1;
    for (let i = 0; i < lines.length; i++) {
      const b = Math.round(decimalToNumber(lines[i].budgetAmount) * 100);
      if (b > largestBudget) {
        largestBudget = b;
        largestIdx = i;
      }
    }
    additions[largestIdx].shareCents += remainder;
  }

  // Apply the additions in a transaction so all-or-nothing.
  await prisma.$transaction(
    additions
      .filter((a) => a.shareCents !== 0)
      .map((a) => {
        const line = lines.find((l) => l.id === a.id)!;
        const newBudget = decimalToNumber(line.budgetAmount) + a.shareCents / 100;
        return prisma.budgetLine.update({
          where: { id: a.id },
          data: { budgetAmount: new Prisma.Decimal(newBudget) },
        });
      })
  );

  return {
    projectId,
    previousTotalBudget: previousTotal,
    newTotalBudget: previousTotal + amount,
    addedAmount: amount,
    source: 'proportional_distribution',
    affectedBudgetLineIds: additions.filter((a) => a.shareCents !== 0).map((a) => a.id),
  };
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

export interface CashFlowMonth {
  year: number;
  month: number;
  monthLabel: string;
  plannedSpend: number;
  actualSpend: number;
  earnedValue: number;
  committed: number;
}

function getMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function parseMonthKey(key: string): { year: number; month: number } {
  const [year, month] = key.split('-').map(Number);
  return { year, month };
}

function monthLabel(year: number, month: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${year}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function* monthRange(start: Date, end: Date): Generator<{ year: number; month: number }> {
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const limit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= limit) {
    yield { year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 };
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
}

export async function getCashFlow(projectId: string): Promise<{
  projectId: string;
  months: CashFlowMonth[];
}> {
  const prisma = getPrismaClient();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { startDate: true, endDate: true },
  });
  if (!project) {
    throw new Error('Project not found');
  }

  const start = project.startDate || new Date();
  const end = project.endDate || new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());

  // ─── Planned spend: distribute activity-linked budgets across activity months ───
  const activities = await prisma.scheduleActivity.findMany({
    where: { projectId },
    select: { wbsItemId: true, startDate: true, endDate: true, duration: true },
  });

  const budgetLines = await prisma.budgetLine.findMany({
    where: { projectId },
    select: { wbsItemId: true, budgetAmount: true, percentComplete: true },
  });

  // Map wbsItemId -> total budget amount
  const wbsBudgetMap = new Map<string, number>();
  for (const bl of budgetLines) {
    if (!bl.wbsItemId) continue;
    const amount = decimalToNumber(bl.budgetAmount);
    wbsBudgetMap.set(bl.wbsItemId, (wbsBudgetMap.get(bl.wbsItemId) || 0) + amount);
  }

  const plannedSpendByMonth = new Map<string, number>();
  for (const act of activities) {
    if (!act.wbsItemId || act.duration <= 0) continue;
    const budget = wbsBudgetMap.get(act.wbsItemId) || 0;
    if (budget <= 0) continue;

    const actStart = new Date(act.startDate);
    const actEnd = new Date(act.endDate);
    const totalDays = Math.max(1, Math.ceil((actEnd.getTime() - actStart.getTime()) / (1000 * 60 * 60 * 24)));

    // Distribute budget evenly by day, then roll up to months
    const dailyRate = budget / totalDays;

    let cursor = new Date(actStart);
    while (cursor <= actEnd) {
      const key = getMonthKey(cursor);
      const dim = daysInMonth(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1);
      const dayOfMonth = cursor.getUTCDate();
      const remainingDays = dim - dayOfMonth + 1;
      const chunkDays = Math.min(remainingDays, totalDays);
      plannedSpendByMonth.set(key, (plannedSpendByMonth.get(key) || 0) + dailyRate * chunkDays);
      cursor.setUTCDate(cursor.getUTCDate() + chunkDays);
    }
  }

  // ─── Actual spend: incurred cost transactions grouped by month ───
  const transactions = await prisma.costTransaction.findMany({
    where: { projectId, type: 'incurred' },
    select: { amount: true, transactionDate: true },
    orderBy: { transactionDate: 'asc' },
  });

  const actualSpendByMonth = new Map<string, number>();
  for (const tx of transactions) {
    const key = getMonthKey(tx.transactionDate);
    const amount = decimalToNumber(tx.amount);
    actualSpendByMonth.set(key, (actualSpendByMonth.get(key) || 0) + amount);
  }

  // ─── Earned value: approximate by distributing current BCWP across transaction months,
  //     or evenly from start to today if no transactions ───
  const today = new Date();
  const earnedValueByMonth = new Map<string, number>();
  const totalBcwp = budgetLines.reduce((s, bl) => s + decimalToNumber(bl.budgetAmount) * bl.percentComplete, 0);

  if (totalBcwp > 0 && transactions.length > 0) {
    const totalTxAmount = transactions.reduce((s, tx) => s + decimalToNumber(tx.amount), 0);
    for (const tx of transactions) {
      const key = getMonthKey(tx.transactionDate);
      const txAmount = decimalToNumber(tx.amount);
      const ratio = totalTxAmount > 0 ? txAmount / totalTxAmount : 0;
      earnedValueByMonth.set(key, (earnedValueByMonth.get(key) || 0) + totalBcwp * ratio);
    }
  } else if (totalBcwp > 0) {
    // No transactions: spread EV evenly from project start to today
    const startToToday = Math.max(1, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyEv = totalBcwp / startToToday;
    let cursor = new Date(start);
    while (cursor <= today) {
      const key = getMonthKey(cursor);
      const dim = daysInMonth(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1);
      const dayOfMonth = cursor.getUTCDate();
      const remainingDays = dim - dayOfMonth + 1;
      const chunkDays = Math.min(remainingDays, startToToday);
      earnedValueByMonth.set(key, (earnedValueByMonth.get(key) || 0) + dailyEv * chunkDays);
      cursor.setUTCDate(cursor.getUTCDate() + chunkDays);
    }
  }

  // ─── Committed: PO + subcontract values grouped by creation month ───
  const pos = await prisma.purchaseOrder.findMany({
    where: { projectId },
    select: { totalAmount: true, createdAt: true },
  });
  const subs = await prisma.subcontract.findMany({
    where: { projectId },
    select: { contractAmount: true, createdAt: true },
  });

  const committedByMonth = new Map<string, number>();
  for (const po of pos) {
    const key = getMonthKey(po.createdAt);
    committedByMonth.set(key, (committedByMonth.get(key) || 0) + decimalToNumber(po.totalAmount));
  }
  for (const sub of subs) {
    const key = getMonthKey(sub.createdAt);
    committedByMonth.set(key, (committedByMonth.get(key) || 0) + decimalToNumber(sub.contractAmount));
  }

  // ─── Assemble month array ───
  const months: CashFlowMonth[] = [];
  for (const { year, month } of monthRange(start, end)) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    months.push({
      year,
      month,
      monthLabel: monthLabel(year, month),
      plannedSpend: Math.round(plannedSpendByMonth.get(key) || 0),
      actualSpend: Math.round(actualSpendByMonth.get(key) || 0),
      earnedValue: Math.round(earnedValueByMonth.get(key) || 0),
      committed: Math.round(committedByMonth.get(key) || 0),
    });
  }

  return { projectId, months };
}
