"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChangeRequest = createChangeRequest;
exports.getChangeRequestById = getChangeRequestById;
exports.getChangeRequestsByProject = getChangeRequestsByProject;
exports.calculateImpact = calculateImpact;
exports.decideChangeRequest = decideChangeRequest;
const prisma_1 = require("../lib/prisma");
const schedule_service_1 = require("./schedule.service");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function diffInDays(a, b) {
    return (a.getTime() - b.getTime()) / MS_PER_DAY;
}
async function createChangeRequest(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.scheduleChangeRequest.create({
        data: {
            projectId: data.projectId,
            activityId: data.activityId,
            requestedBy: data.requestedBy,
            reasonCode: data.reasonCode,
            proposedStart: data.proposedStart,
            proposedEnd: data.proposedEnd,
            impactDescription: data.impactDescription,
            status: 'pending',
        },
    });
}
async function getChangeRequestById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.scheduleChangeRequest.findUnique({
        where: { id },
        include: { project: true },
    });
}
async function getChangeRequestsByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.scheduleChangeRequest.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
    });
}
async function calculateImpact(requestId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const request = await prisma.scheduleChangeRequest.findUnique({
        where: { id: requestId },
    });
    if (!request) {
        throw new Error('Change request not found');
    }
    const activity = await prisma.scheduleActivity.findUnique({
        where: { id: request.activityId },
    });
    if (!activity) {
        throw new Error('Activity not found');
    }
    const allActivities = await prisma.scheduleActivity.findMany({
        where: { projectId: request.projectId },
    });
    const project = await prisma.project.findUnique({
        where: { id: request.projectId },
    });
    if (!project || !project.startDate) {
        throw new Error('Project start date not available');
    }
    let newDuration;
    if (request.proposedStart && request.proposedEnd) {
        newDuration = diffInDays(request.proposedEnd, request.proposedStart);
    }
    else if (request.proposedEnd) {
        newDuration = diffInDays(request.proposedEnd, activity.startDate);
    }
    else if (request.proposedStart) {
        newDuration = diffInDays(activity.endDate, request.proposedStart);
    }
    else {
        throw new Error('No proposed dates available to calculate impact');
    }
    const nodes = allActivities.map((a) => ({
        id: a.id,
        startDate: a.startDate,
        endDate: a.endDate,
        duration: a.duration,
        predecessors: a.predecessors || undefined,
        successors: a.successors || undefined,
    }));
    const impact = (0, schedule_service_1.calculateCriticalPathImpact)(nodes, request.activityId, newDuration, project.startDate);
    return prisma.scheduleChangeRequest.update({
        where: { id: requestId },
        data: { criticalPathImpact: impact },
    });
}
async function decideChangeRequest(requestId, decision, decidedBy, notes, modifiedDates) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const request = await prisma.scheduleChangeRequest.findUnique({
        where: { id: requestId },
    });
    if (!request) {
        throw new Error('Change request not found');
    }
    const updated = await prisma.scheduleChangeRequest.update({
        where: { id: requestId },
        data: {
            status: decision,
            decidedBy,
            decidedAt: new Date(),
            decisionNotes: notes || null,
        },
    });
    if (decision === 'approved' || decision === 'modified') {
        const activity = await prisma.scheduleActivity.findUnique({
            where: { id: request.activityId },
        });
        if (!activity) {
            throw new Error('Activity not found');
        }
        const newStartDate = decision === 'modified' ? modifiedDates?.startDate : request.proposedStart;
        const newEndDate = decision === 'modified' ? modifiedDates?.endDate : request.proposedEnd;
        const updateData = {};
        if (newStartDate)
            updateData.startDate = newStartDate;
        if (newEndDate)
            updateData.endDate = newEndDate;
        if (newStartDate && newEndDate) {
            updateData.duration = diffInDays(newEndDate, newStartDate);
        }
        else if (newEndDate) {
            updateData.duration = diffInDays(newEndDate, activity.startDate);
        }
        else if (newStartDate) {
            updateData.duration = diffInDays(activity.endDate, newStartDate);
        }
        await prisma.scheduleActivity.update({
            where: { id: request.activityId },
            data: updateData,
        });
        await (0, schedule_service_1.recalculateSchedule)(request.projectId);
    }
    return updated;
}
//# sourceMappingURL=change-request.service.js.map