"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateEvm = calculateEvm;
exports.recalculateVarianceFlag = recalculateVarianceFlag;
exports.calculateProjectEvm = calculateProjectEvm;
exports.calculateForecasts = calculateForecasts;
exports.updateBudgetLineCommitted = updateBudgetLineCommitted;
exports.updateBudgetLineIncurred = updateBudgetLineIncurred;
exports.setBudgetLinePercentComplete = setBudgetLinePercentComplete;
exports.recalculateBaseline = recalculateBaseline;
exports.createBudgetLine = createBudgetLine;
exports.getBudgetLineById = getBudgetLineById;
exports.getBudgetLinesByProject = getBudgetLinesByProject;
exports.updateBudgetLine = updateBudgetLine;
exports.deleteBudgetLine = deleteBudgetLine;
exports.createCostTransaction = createCostTransaction;
exports.getCostTransactionsByProject = getCostTransactionsByProject;
exports.getCostTransactionsByBudgetLine = getCostTransactionsByBudgetLine;
exports.getCashFlow = getCashFlow;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
function decimalToNumber(value) {
    if (value === null || value === undefined)
        return 0;
    if (typeof value === 'number')
        return value;
    return value.toNumber();
}
function calculateEvm(budgetAmount, percentComplete, incurredAmount) {
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
    const tcpi = budgetAmount === 0 || tcpiDenominator === 0 ? 0 : (budgetAmount - bcwp) / tcpiDenominator;
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
function recalculateVarianceFlag(budgetLine) {
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
async function calculateProjectEvm(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
async function calculateForecasts(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
    let tcpiFlag = 'unknown';
    if (bac > 0) {
        const remainingBudget = bac - ac;
        if (remainingBudget > 0) {
            tcpi = (bac - ev) / remainingBudget;
            if (tcpi > 1.1)
                tcpiFlag = 'tight';
            else if (tcpi < 0.9)
                tcpiFlag = 'cushion';
            else
                tcpiFlag = 'on_pace';
        }
        else {
            // AC has already hit/exceeded BAC. Performance index is undefined.
            tcpi = 0;
            tcpiFlag = 'tight';
        }
    }
    // Forecast completion date. At the current AC/day rate, how many days
    // remain to finish the remaining budget? remaining / (AC / daysElapsed).
    let daysRemaining = 0;
    let forecastCompleteDate = null;
    let completeDateDeltaDays = null;
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
async function updateBudgetLineCommitted(budgetLineId, amount) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
async function updateBudgetLineIncurred(budgetLineId, amount) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
async function setBudgetLinePercentComplete(budgetLineId, percent) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
async function recalculateBaseline(projectId, amount) {
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error('Baseline recalculation amount must be a non-negative number');
    }
    const prisma = (0, prisma_1.getPrismaClient)();
    const lines = await prisma.budgetLine.findMany({ where: { projectId } });
    const previousTotal = lines.reduce((sum, l) => sum + decimalToNumber(l.budgetAmount), 0);
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
                budgetAmount: new client_1.Prisma.Decimal(amount),
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
    await prisma.$transaction(additions
        .filter((a) => a.shareCents !== 0)
        .map((a) => {
        const line = lines.find((l) => l.id === a.id);
        const newBudget = decimalToNumber(line.budgetAmount) + a.shareCents / 100;
        return prisma.budgetLine.update({
            where: { id: a.id },
            data: { budgetAmount: new client_1.Prisma.Decimal(newBudget) },
        });
    }));
    return {
        projectId,
        previousTotalBudget: previousTotal,
        newTotalBudget: previousTotal + amount,
        addedAmount: amount,
        source: 'proportional_distribution',
        affectedBudgetLineIds: additions.filter((a) => a.shareCents !== 0).map((a) => a.id),
    };
}
async function createBudgetLine(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
async function getBudgetLineById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.budgetLine.findUnique({
        where: { id },
        include: { costTransactions: true },
    });
}
async function getBudgetLinesByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.budgetLine.findMany({
        where: { projectId },
        include: { costTransactions: true },
    });
}
async function updateBudgetLine(id, data) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
async function deleteBudgetLine(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.budgetLine.delete({
        where: { id },
    });
}
async function createCostTransaction(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
    }
    else if (data.type === 'incurred') {
        await updateBudgetLineIncurred(data.budgetLineId, data.amount);
    }
    return transaction;
}
async function getCostTransactionsByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.costTransaction.findMany({
        where: { projectId },
        orderBy: { transactionDate: 'desc' },
    });
}
async function getCostTransactionsByBudgetLine(budgetLineId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.costTransaction.findMany({
        where: { budgetLineId },
        orderBy: { transactionDate: 'desc' },
    });
}
function getMonthKey(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
function parseMonthKey(key) {
    const [year, month] = key.split('-').map(Number);
    return { year, month };
}
function monthLabel(year, month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[month - 1]} ${year}`;
}
function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function* monthRange(start, end) {
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const limit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    while (cursor <= limit) {
        yield { year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 };
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
}
async function getCashFlow(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
    const wbsBudgetMap = new Map();
    for (const bl of budgetLines) {
        if (!bl.wbsItemId)
            continue;
        const amount = decimalToNumber(bl.budgetAmount);
        wbsBudgetMap.set(bl.wbsItemId, (wbsBudgetMap.get(bl.wbsItemId) || 0) + amount);
    }
    const plannedSpendByMonth = new Map();
    for (const act of activities) {
        if (!act.wbsItemId || act.duration <= 0)
            continue;
        const budget = wbsBudgetMap.get(act.wbsItemId) || 0;
        if (budget <= 0)
            continue;
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
    const actualSpendByMonth = new Map();
    for (const tx of transactions) {
        const key = getMonthKey(tx.transactionDate);
        const amount = decimalToNumber(tx.amount);
        actualSpendByMonth.set(key, (actualSpendByMonth.get(key) || 0) + amount);
    }
    // ─── Earned value: approximate by distributing current BCWP across transaction months,
    //     or evenly from start to today if no transactions ───
    const today = new Date();
    const earnedValueByMonth = new Map();
    const totalBcwp = budgetLines.reduce((s, bl) => s + decimalToNumber(bl.budgetAmount) * bl.percentComplete, 0);
    if (totalBcwp > 0 && transactions.length > 0) {
        const totalTxAmount = transactions.reduce((s, tx) => s + decimalToNumber(tx.amount), 0);
        for (const tx of transactions) {
            const key = getMonthKey(tx.transactionDate);
            const txAmount = decimalToNumber(tx.amount);
            const ratio = totalTxAmount > 0 ? txAmount / totalTxAmount : 0;
            earnedValueByMonth.set(key, (earnedValueByMonth.get(key) || 0) + totalBcwp * ratio);
        }
    }
    else if (totalBcwp > 0) {
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
    const committedByMonth = new Map();
    for (const po of pos) {
        const key = getMonthKey(po.createdAt);
        committedByMonth.set(key, (committedByMonth.get(key) || 0) + decimalToNumber(po.totalAmount));
    }
    for (const sub of subs) {
        const key = getMonthKey(sub.createdAt);
        committedByMonth.set(key, (committedByMonth.get(key) || 0) + decimalToNumber(sub.contractAmount));
    }
    // ─── Assemble month array ───
    const months = [];
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
//# sourceMappingURL=cost.service.js.map