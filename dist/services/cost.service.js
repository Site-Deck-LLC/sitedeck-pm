"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateEvm = calculateEvm;
exports.recalculateVarianceFlag = recalculateVarianceFlag;
exports.calculateProjectEvm = calculateProjectEvm;
exports.updateBudgetLineCommitted = updateBudgetLineCommitted;
exports.updateBudgetLineIncurred = updateBudgetLineIncurred;
exports.setBudgetLinePercentComplete = setBudgetLinePercentComplete;
exports.createBudgetLine = createBudgetLine;
exports.getBudgetLineById = getBudgetLineById;
exports.getBudgetLinesByProject = getBudgetLinesByProject;
exports.updateBudgetLine = updateBudgetLine;
exports.deleteBudgetLine = deleteBudgetLine;
exports.createCostTransaction = createCostTransaction;
exports.getCostTransactionsByProject = getCostTransactionsByProject;
exports.getCostTransactionsByBudgetLine = getCostTransactionsByBudgetLine;
const prisma_1 = require("../lib/prisma");
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
//# sourceMappingURL=cost.service.js.map