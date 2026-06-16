"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createScopeStatement = createScopeStatement;
exports.updateScopeStatement = updateScopeStatement;
exports.getScopeStatementsByProject = getScopeStatementsByProject;
exports.getLatestScopeStatement = getLatestScopeStatement;
exports.getScopeStatementById = getScopeStatementById;
exports.createChangeOrder = createChangeOrder;
exports.getChangeOrderById = getChangeOrderById;
exports.getChangeOrdersByProject = getChangeOrdersByProject;
exports.approveChangeOrder = approveChangeOrder;
exports.rejectChangeOrder = rejectChangeOrder;
exports.submitChangeOrder = submitChangeOrder;
exports.updateChangeOrder = updateChangeOrder;
exports.getChangeOrderPdfData = getChangeOrderPdfData;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const cost_service_1 = require("./cost.service");
const integration_service_1 = require("./integration.service");
async function createScopeStatement(projectId, content, createdBy) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.scopeStatement.create({
        data: {
            projectId,
            content,
            version: 1,
            createdBy,
        },
    });
}
async function updateScopeStatement(id, content, createdBy) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
async function getScopeStatementsByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.scopeStatement.findMany({
        where: { projectId },
        orderBy: { version: 'desc' },
    });
}
async function getLatestScopeStatement(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.scopeStatement.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
    });
}
async function getScopeStatementById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.scopeStatement.findUnique({
        where: { id },
    });
}
function generateCoNumber(sequence) {
    const year = new Date().getFullYear();
    const padded = String(sequence).padStart(4, '0');
    return `CO-${year}-${padded}`;
}
async function createChangeOrder(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existingCount = await prisma.changeOrder.count({
        where: { projectId: data.projectId },
    });
    const coNumber = generateCoNumber(existingCount + 1);
    const createData = {
        project: { connect: { id: data.projectId } },
        coNumber,
        date: data.date,
        description: data.description,
        status: 'pending',
        dollarValue: data.dollarValue !== undefined ? new client_1.Prisma.Decimal(data.dollarValue) : undefined,
        scheduleImpact: data.scheduleImpact,
        affectedActivityIds: data.affectedActivityIds ?? undefined,
    };
    return prisma.changeOrder.create({
        data: createData,
    });
}
async function getChangeOrderById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.changeOrder.findUnique({
        where: { id },
        include: { project: true },
    });
}
async function getChangeOrdersByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.changeOrder.findMany({
        where: { projectId },
        orderBy: { date: 'desc' },
    });
}
async function approveChangeOrder(id, approver) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
        const baseline = await (0, cost_service_1.recalculateBaseline)(co.projectId, 0);
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
    const dollarValue = co.dollarValue ? co.dollarValue.toNumber() : 0;
    const updated = await prisma.changeOrder.update({
        where: { id },
        data: {
            status: 'approved',
            approver,
            approvedAt: new Date(),
        },
    });
    const baseline = await (0, cost_service_1.recalculateBaseline)(co.projectId, dollarValue);
    // Unified change log entry — EVM/baseline updates are part of the
    // integrated change history so the dashboard and the Owner's Rep can
    // see the cost progression.
    await (0, integration_service_1.logChange)({
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
async function rejectChangeOrder(id, approver) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
async function submitChangeOrder(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
async function updateChangeOrder(id, data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const updateData = {};
    if (data.description !== undefined)
        updateData.description = data.description;
    if (data.dollarValue !== undefined)
        updateData.dollarValue = new client_1.Prisma.Decimal(data.dollarValue);
    if (data.scheduleImpact !== undefined)
        updateData.scheduleImpact = data.scheduleImpact;
    if (data.affectedActivityIds !== undefined) {
        updateData.affectedActivityIds = data.affectedActivityIds;
    }
    return prisma.changeOrder.update({
        where: { id },
        data: updateData,
    });
}
async function getChangeOrderPdfData(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
        dollarValue: co.dollarValue ? co.dollarValue.toNumber() : null,
        scheduleImpact: co.scheduleImpact ?? null,
        approver: co.approver,
        projectName: co.project.name,
    };
}
//# sourceMappingURL=scope.service.js.map