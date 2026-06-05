"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createActivity = createActivity;
exports.getActivityById = getActivityById;
exports.getActivitiesByProject = getActivitiesByProject;
exports.getActivitiesWithWbs = getActivitiesWithWbs;
exports.updateActivity = updateActivity;
exports.deleteActivity = deleteActivity;
exports.markActivityReady = markActivityReady;
exports.markActivityComplete = markActivityComplete;
const prisma_1 = require("../lib/prisma");
const schedule_service_1 = require("./schedule.service");
const reason_codes_1 = require("../constants/reason-codes");
async function createActivity(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const activity = await prisma.scheduleActivity.create({
        data: {
            projectId: data.projectId,
            name: data.name,
            description: data.description,
            wbsItemId: data.wbsItemId,
            startDate: data.startDate,
            endDate: data.endDate,
            duration: data.duration,
            percentComplete: data.percentComplete,
            status: data.status || reason_codes_1.ACTIVITY_STATUSES.NOT_STARTED,
            isMilestone: data.isMilestone,
            predecessors: data.predecessors,
            successors: data.successors,
        },
    });
    await (0, schedule_service_1.recalculateSchedule)(data.projectId);
    return activity;
}
async function getActivityById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.scheduleActivity.findUnique({
        where: { id },
    });
}
async function getActivitiesByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.scheduleActivity.findMany({
        where: { projectId },
        orderBy: { startDate: 'asc' },
    });
}
async function getActivitiesWithWbs(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const activities = await prisma.scheduleActivity.findMany({
        where: { projectId },
        orderBy: { startDate: 'asc' },
    });
    const wbsItemIds = [...new Set(activities.map(a => a.wbsItemId).filter(Boolean))];
    const wbsItems = wbsItemIds.length
        ? await prisma.workBreakdownItem.findMany({
            where: { id: { in: wbsItemIds } },
        })
        : [];
    const wbsMap = new Map(wbsItems.map(w => [w.id, w]));
    // Fetch level-1 parents for category names
    const parentIds = [...new Set(wbsItems.map(w => w.parentId).filter(Boolean))];
    const parents = parentIds.length
        ? await prisma.workBreakdownItem.findMany({
            where: { id: { in: parentIds } },
        })
        : [];
    const parentMap = new Map(parents.map(p => [p.id, p]));
    return activities.map(a => {
        const wbs = a.wbsItemId ? wbsMap.get(a.wbsItemId) : null;
        const parent = wbs?.parentId ? parentMap.get(wbs.parentId) : null;
        return {
            id: a.id,
            name: a.name,
            description: a.description,
            startDate: a.startDate,
            endDate: a.endDate,
            duration: a.duration,
            percentComplete: a.percentComplete,
            status: a.status,
            isMilestone: a.isMilestone,
            isCritical: a.isCritical,
            wbsItemId: a.wbsItemId,
            wbsCode: wbs?.code || null,
            wbsName: wbs?.name || null,
            wbsCategory: parent?.name || wbs?.name || 'Uncategorized',
            totalFloat: a.totalFloat,
            freeFloat: a.freeFloat,
        };
    });
}
async function updateActivity(id, data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.scheduleActivity.findUnique({
        where: { id },
    });
    if (!existing) {
        throw new Error('Activity not found');
    }
    const activity = await prisma.scheduleActivity.update({
        where: { id },
        data: {
            name: data.name,
            description: data.description,
            wbsItemId: data.wbsItemId,
            startDate: data.startDate,
            endDate: data.endDate,
            duration: data.duration,
            percentComplete: data.percentComplete,
            status: data.status,
            isMilestone: data.isMilestone,
            predecessors: data.predecessors,
            successors: data.successors,
        },
    });
    await (0, schedule_service_1.recalculateSchedule)(existing.projectId);
    return activity;
}
async function deleteActivity(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.scheduleActivity.findUnique({
        where: { id },
    });
    if (!existing) {
        throw new Error('Activity not found');
    }
    const activity = await prisma.scheduleActivity.delete({
        where: { id },
    });
    await (0, schedule_service_1.recalculateSchedule)(existing.projectId);
    return activity;
}
async function markActivityReady(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.scheduleActivity.findUnique({
        where: { id },
    });
    if (!existing) {
        throw new Error('Activity not found');
    }
    const activity = await prisma.scheduleActivity.update({
        where: { id },
        data: { status: reason_codes_1.ACTIVITY_STATUSES.NOT_STARTED },
    });
    return activity;
}
async function markActivityComplete(id, _completedBy, completedAt) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.scheduleActivity.findUnique({
        where: { id },
    });
    if (!existing) {
        throw new Error('Activity not found');
    }
    const activity = await prisma.scheduleActivity.update({
        where: { id },
        data: {
            percentComplete: 100,
            status: reason_codes_1.ACTIVITY_STATUSES.COMPLETE,
            endDate: completedAt,
        },
    });
    await (0, schedule_service_1.recalculateSchedule)(existing.projectId);
    return activity;
}
//# sourceMappingURL=activity.service.js.map