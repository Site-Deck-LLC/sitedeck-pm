"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
    // Notification: tell the original requester that their SCR was
    // decided. We don't notify on 'pending' (the create path is
    // already a notification in itself; the requester doesn't need
    // to be told their own request is in flight).
    if (request.requestedBy && request.requestedBy !== decidedBy) {
        const verb = decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'modified';
        const { createNotificationSafe } = await Promise.resolve().then(() => __importStar(require('./notifications.service')));
        await createNotificationSafe({
            userId: request.requestedBy,
            kind: decision === 'rejected' ? 'co_rejected' : 'co_approved',
            title: `Schedule change request ${verb}`,
            body: notes || `Reason: ${request.reasonCode}`,
            payload: { projectId: request.projectId, changeRequestId: request.id, decision },
        });
    }
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