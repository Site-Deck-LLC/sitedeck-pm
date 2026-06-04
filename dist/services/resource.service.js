"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertEquipment = upsertEquipment;
exports.recordEquipmentUsage = recordEquipmentUsage;
exports.getEquipmentByProject = getEquipmentByProject;
exports.getEquipmentByExternalId = getEquipmentByExternalId;
exports.assignEquipmentToActivity = assignEquipmentToActivity;
exports.unassignEquipmentFromActivity = unassignEquipmentFromActivity;
exports.getEquipmentCostSummary = getEquipmentCostSummary;
exports.getLaborCostSummary = getLaborCostSummary;
exports.getIdleEquipmentOnCriticalPath = getIdleEquipmentOnCriticalPath;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
async function upsertEquipment(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
async function recordEquipmentUsage(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
async function getEquipmentByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.equipment.findMany({
        where: { projectId },
        orderBy: { name: 'asc' },
    });
}
async function getEquipmentByExternalId(projectId, externalId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.equipment.findUnique({
        where: {
            projectId_externalId: {
                projectId,
                externalId,
            },
        },
    });
}
async function assignEquipmentToActivity(projectId, externalId, activityId) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
async function unassignEquipmentFromActivity(projectId, externalId) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
async function getEquipmentCostSummary(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const transactions = await prisma.costTransaction.findMany({
        where: {
            projectId,
            source: 'equipment_webhook',
        },
        orderBy: { transactionDate: 'desc' },
    });
    const map = new Map();
    for (const tx of transactions) {
        const key = tx.budgetLineId;
        const amount = tx.amount instanceof client_1.Prisma.Decimal ? tx.amount.toNumber() : Number(tx.amount);
        const existing = map.get(key);
        if (existing) {
            existing.totalAmount += amount;
            existing.count += 1;
        }
        else {
            map.set(key, { totalAmount: amount, count: 1 });
        }
    }
    return Array.from(map.entries()).map(([budgetLineId, value]) => ({
        budgetLineId,
        totalAmount: value.totalAmount,
        transactionCount: value.count,
    }));
}
async function getLaborCostSummary(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const transactions = await prisma.costTransaction.findMany({
        where: {
            projectId,
            source: 'labor_webhook',
        },
        orderBy: { transactionDate: 'desc' },
    });
    const map = new Map();
    for (const tx of transactions) {
        const key = tx.budgetLineId;
        const amount = tx.amount instanceof client_1.Prisma.Decimal ? tx.amount.toNumber() : Number(tx.amount);
        const existing = map.get(key);
        if (existing) {
            existing.totalAmount += amount;
            existing.count += 1;
        }
        else {
            map.set(key, { totalAmount: amount, count: 1 });
        }
    }
    return Array.from(map.entries()).map(([budgetLineId, value]) => ({
        budgetLineId,
        totalAmount: value.totalAmount,
        transactionCount: value.count,
    }));
}
async function getIdleEquipmentOnCriticalPath(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
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
        .filter((id) => id !== null);
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
    const idleItems = [];
    for (const eq of equipmentList) {
        if (!eq.currentActivityId || !activityMap.has(eq.currentActivityId)) {
            continue;
        }
        const lastUsage = eq.lastUsageDate;
        if (!lastUsage) {
            const activity = activityMap.get(eq.currentActivityId);
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
            const activity = activityMap.get(eq.currentActivityId);
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
//# sourceMappingURL=resource.service.js.map