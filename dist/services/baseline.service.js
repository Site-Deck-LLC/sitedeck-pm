"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBaseline = createBaseline;
exports.lockBaseline = lockBaseline;
exports.getBaselineById = getBaselineById;
exports.getBaselinesByProject = getBaselinesByProject;
exports.compareToBaseline = compareToBaseline;
exports.canRebaseline = canRebaseline;
const prisma_1 = require("../lib/prisma");
const roles_1 = require("../constants/roles");
const schedule_service_1 = require("./schedule.service");
async function createBaseline(projectId, name, createdBy) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const activities = await prisma.scheduleActivity.findMany({
        where: { projectId },
    });
    const snapshot = activities.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        wbsItemId: a.wbsItemId,
        startDate: a.startDate.toISOString(),
        endDate: a.endDate.toISOString(),
        duration: a.duration,
        percentComplete: a.percentComplete,
        status: a.status,
        isMilestone: a.isMilestone,
        isCritical: a.isCritical,
        predecessors: a.predecessors,
        successors: a.successors,
    }));
    return prisma.scheduleBaseline.create({
        data: {
            projectId,
            name,
            locked: false,
            baselineDate: new Date(),
            activities: snapshot,
            createdBy,
        },
    });
}
async function lockBaseline(baselineId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const baseline = await prisma.scheduleBaseline.findUnique({
        where: { id: baselineId },
    });
    if (!baseline) {
        throw new Error('Baseline not found');
    }
    if (baseline.locked) {
        return baseline;
    }
    return prisma.scheduleBaseline.update({
        where: { id: baselineId },
        data: { locked: true },
    });
}
async function getBaselineById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.scheduleBaseline.findUnique({
        where: { id },
    });
}
async function getBaselinesByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.scheduleBaseline.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
    });
}
async function compareToBaseline(projectId, baselineId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const baseline = await prisma.scheduleBaseline.findUnique({
        where: { id: baselineId },
    });
    if (!baseline) {
        throw new Error('Baseline not found');
    }
    if (baseline.projectId !== projectId) {
        throw new Error('Baseline does not belong to project');
    }
    const currentActivities = await prisma.scheduleActivity.findMany({
        where: { projectId },
    });
    const baselineActivities = baseline.activities;
    const baselineMap = new Map(baselineActivities.map((a) => [a.id, a]));
    const results = [];
    for (const current of currentActivities) {
        const baselineActivity = baselineMap.get(current.id);
        if (!baselineActivity)
            continue;
        const baselineNode = {
            id: baselineActivity.id,
            startDate: new Date(baselineActivity.startDate),
            endDate: new Date(baselineActivity.endDate),
            duration: baselineActivity.duration,
        };
        const currentNode = {
            id: current.id,
            startDate: current.startDate,
            endDate: current.endDate,
            duration: current.duration,
        };
        const variance = (0, schedule_service_1.calculateBaselineVariance)(currentNode, baselineNode);
        results.push({
            activityId: current.id,
            activityName: current.name,
            baselineStart: baselineNode.startDate,
            currentStart: current.startDate,
            startVarianceDays: variance.startVarianceDays,
            baselineFinish: baselineNode.endDate,
            currentFinish: current.endDate,
            finishVarianceDays: variance.finishVarianceDays,
        });
    }
    return results;
}
function canRebaseline(_projectId, userRole, _justification) {
    return ((0, roles_1.isRoleAtLeast)(userRole, roles_1.ROLES.OWNER_ADMIN) ||
        (0, roles_1.isRoleAtLeast)(userRole, roles_1.ROLES.PROJECT_MANAGER));
}
//# sourceMappingURL=baseline.service.js.map