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
exports.createRfi = createRfi;
exports.getRfiById = getRfiById;
exports.getRfiByProject = getRfiByProject;
exports.submitRfi = submitRfi;
exports.answerRfi = answerRfi;
exports.closeRfi = closeRfi;
exports.updateRfi = updateRfi;
exports.getRfiPdfData = getRfiPdfData;
exports.createSubmittal = createSubmittal;
exports.getSubmittalById = getSubmittalById;
exports.getSubmittalsByProject = getSubmittalsByProject;
exports.submitSubmittal = submitSubmittal;
exports.reviewSubmittal = reviewSubmittal;
exports.getSubmittalPdfData = getSubmittalPdfData;
exports.createMeeting = createMeeting;
exports.getMeetingsByProject = getMeetingsByProject;
exports.getMeetingById = getMeetingById;
exports.updateMeeting = updateMeeting;
exports.updateMeetingActionItemStatus = updateMeetingActionItemStatus;
exports.deleteMeeting = deleteMeeting;
exports.getMeetingPdfData = getMeetingPdfData;
exports.getOverdueRfis = getOverdueRfis;
exports.getOverdueSubmittals = getOverdueSubmittals;
const prisma_1 = require("../lib/prisma");
const communications_1 = require("../constants/communications");
function appendHistory(prior, newStatus) {
    const list = Array.isArray(prior) ? prior : [];
    return [
        ...list,
        { status: newStatus, changedBy: 'system', changedAt: new Date().toISOString() },
    ];
}
function generateRfiNumber(sequence) {
    const year = new Date().getFullYear();
    const padded = String(sequence).padStart(4, '0');
    return `RFI-${year}-${padded}`;
}
function generateSubmittalNumber(sequence) {
    const year = new Date().getFullYear();
    const padded = String(sequence).padStart(4, '0');
    return `SUB-${year}-${padded}`;
}
// RFI Log
async function createRfi(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    // Idempotency: skip if sourceReference already exists for this project
    if (data.sourceReference) {
        const existing = await prisma.rfi.findFirst({
            where: {
                projectId: data.projectId,
                sourceReference: data.sourceReference,
            },
        });
        if (existing) {
            return existing;
        }
    }
    const existingCount = await prisma.rfi.count({
        where: { projectId: data.projectId },
    });
    const rfiNumber = generateRfiNumber(existingCount + 1);
    return prisma.rfi.create({
        data: {
            projectId: data.projectId,
            rfiNumber,
            subject: data.subject,
            description: data.description,
            status: communications_1.RFI_STATUSES.DRAFT,
            submittedBy: data.submittedBy,
            assignedTo: data.assignedTo,
            holdOnActivityId: data.holdOnActivityId,
            sourceReference: data.sourceReference,
        },
    });
}
async function getRfiById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.rfi.findUnique({
        where: { id },
    });
}
async function getRfiByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.rfi.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
    });
}
async function submitRfi(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.rfi.findUnique({ where: { id } });
    if (!existing)
        throw new Error('RFI not found');
    const history = appendHistory(existing.statusHistory, communications_1.RFI_STATUSES.SUBMITTED);
    const updated = await prisma.rfi.update({
        where: { id },
        data: {
            status: communications_1.RFI_STATUSES.SUBMITTED,
            submittedAt: new Date(),
            statusHistory: history,
            ballInCourt: existing.assignedTo || 'EOR',
        },
    });
    // Notification: when an RFI is submitted and the ball is in
    // someone else's court, that person gets a bell. We treat
    // assignedTo as the recipient unless it's empty (unassigned
    // RFIs have no one to ping).
    if (updated.assignedTo) {
        const { createNotificationSafe } = await Promise.resolve().then(() => __importStar(require('./notifications.service')));
        await createNotificationSafe({
            userId: updated.assignedTo,
            kind: 'rfi_assigned',
            title: `RFI ${updated.rfiNumber} needs your response`,
            body: updated.subject,
            payload: { projectId: updated.projectId, rfiId: updated.id, rfiNumber: updated.rfiNumber },
        });
    }
    return updated;
}
async function answerRfi(id, responseText, answeredBy) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.rfi.findUnique({ where: { id } });
    if (!existing)
        throw new Error('RFI not found');
    const history = appendHistory(existing.statusHistory, communications_1.RFI_STATUSES.ANSWERED);
    const updated = await prisma.rfi.update({
        where: { id },
        data: {
            status: communications_1.RFI_STATUSES.ANSWERED,
            responseText,
            answeredAt: new Date(),
            assignedTo: answeredBy,
            ballInCourt: 'PM',
            statusHistory: history,
        },
    });
    // Notification: the original submitter gets a "your RFI was
    // answered" bell. We use submittedBy as the recipient.
    if (existing.submittedBy && existing.submittedBy !== answeredBy) {
        const { createNotificationSafe } = await Promise.resolve().then(() => __importStar(require('./notifications.service')));
        await createNotificationSafe({
            userId: existing.submittedBy,
            kind: 'rfi_answered',
            title: `RFI ${updated.rfiNumber} was answered`,
            body: updated.subject,
            payload: { projectId: updated.projectId, rfiId: updated.id, rfiNumber: updated.rfiNumber },
        });
    }
    return updated;
}
async function closeRfi(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.rfi.findUnique({ where: { id } });
    if (!existing)
        throw new Error('RFI not found');
    const history = appendHistory(existing.statusHistory, communications_1.RFI_STATUSES.CLOSED);
    return prisma.rfi.update({
        where: { id },
        data: {
            status: communications_1.RFI_STATUSES.CLOSED,
            statusHistory: history,
        },
    });
}
async function updateRfi(id, data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.rfi.findUnique({ where: { id } });
    if (!existing)
        throw new Error('RFI not found');
    const newStatus = data.status && data.status !== existing.status ? data.status : null;
    const history = newStatus ? appendHistory(existing.statusHistory, newStatus) : existing.statusHistory;
    return prisma.rfi.update({
        where: { id },
        data: {
            ballInCourt: data.ballInCourt !== undefined ? data.ballInCourt : undefined,
            assignedTo: data.assignedTo !== undefined ? data.assignedTo : undefined,
            responseText: data.responseText !== undefined ? data.responseText : undefined,
            status: newStatus || undefined,
            statusHistory: history,
        },
    });
}
async function getRfiPdfData(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const rfi = await prisma.rfi.findUnique({
        where: { id },
        include: { project: true },
    });
    if (!rfi) {
        throw new Error('RFI not found');
    }
    return {
        rfiNumber: rfi.rfiNumber,
        subject: rfi.subject,
        description: rfi.description,
        status: rfi.status,
        submittedBy: rfi.submittedBy,
        submittedAt: rfi.submittedAt,
        responseText: rfi.responseText,
        answeredAt: rfi.answeredAt,
        projectName: rfi.project.name,
    };
}
// Submittal Register
async function createSubmittal(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existingCount = await prisma.submittal.count({
        where: { projectId: data.projectId },
    });
    const submittalNumber = generateSubmittalNumber(existingCount + 1);
    return prisma.submittal.create({
        data: {
            projectId: data.projectId,
            submittalNumber,
            title: data.title,
            description: data.description,
            status: communications_1.SUBMITTAL_STATUSES.PENDING,
            specSection: data.specSection,
            submittedBy: data.submittedBy,
            holdOnActivityId: data.holdOnActivityId,
        },
    });
}
async function getSubmittalById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.submittal.findUnique({
        where: { id },
    });
}
async function getSubmittalsByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.submittal.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
    });
}
async function submitSubmittal(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.submittal.findUnique({ where: { id } });
    if (!existing)
        throw new Error('Submittal not found');
    const history = appendHistory(existing.statusHistory, communications_1.SUBMITTAL_STATUSES.SUBMITTED);
    return prisma.submittal.update({
        where: { id },
        data: {
            status: communications_1.SUBMITTAL_STATUSES.SUBMITTED,
            submittedAt: new Date(),
            statusHistory: history,
        },
    });
}
async function reviewSubmittal(id, decision, reviewedBy, notes) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const statusMap = {
        approved: communications_1.SUBMITTAL_STATUSES.APPROVED,
        rejected: communications_1.SUBMITTAL_STATUSES.REJECTED,
        revision_required: communications_1.SUBMITTAL_STATUSES.REVISION_REQUIRED,
    };
    const submittal = await prisma.submittal.findUnique({ where: { id } });
    if (!submittal) {
        throw new Error('Submittal not found');
    }
    const history = appendHistory(submittal.statusHistory, statusMap[decision]);
    return prisma.submittal.update({
        where: { id },
        data: {
            status: statusMap[decision],
            reviewedBy,
            reviewedAt: new Date(),
            reviewComments: notes ?? null,
            statusHistory: history,
        },
    });
}
async function getSubmittalPdfData(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const submittal = await prisma.submittal.findUnique({
        where: { id },
        include: { project: true },
    });
    if (!submittal) {
        throw new Error('Submittal not found');
    }
    return {
        submittalNumber: submittal.submittalNumber,
        title: submittal.title,
        description: submittal.description,
        status: submittal.status,
        specSection: submittal.specSection,
        submittedBy: submittal.submittedBy,
        submittedAt: submittal.submittedAt,
        reviewedBy: submittal.reviewedBy,
        reviewedAt: submittal.reviewedAt,
        projectName: submittal.project.name,
    };
}
async function createMeeting(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.meeting.create({
        data: {
            projectId: data.projectId,
            title: data.title,
            meetingDate: data.meetingDate,
            location: data.location,
            facilitator: data.facilitator,
            attendees: data.attendees,
            agenda: data.agenda,
            minutes: data.minutes,
            actionItems: data.actionItems,
            status: data.status ?? communications_1.MEETING_STATUSES.DRAFT,
            createdBy: data.createdBy,
        },
    });
}
async function getMeetingsByProject(projectId, startDate, endDate) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.meeting.findMany({
        where: {
            projectId,
            ...(startDate || endDate
                ? {
                    meetingDate: {
                        ...(startDate ? { gte: startDate } : {}),
                        ...(endDate ? { lte: endDate } : {}),
                    },
                }
                : {}),
        },
        orderBy: { meetingDate: 'desc' },
    });
}
async function getMeetingById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.meeting.findUnique({ where: { id } });
}
async function updateMeeting(id, data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.meeting.update({
        where: { id },
        data: {
            title: data.title,
            meetingDate: data.meetingDate,
            location: data.location,
            facilitator: data.facilitator,
            attendees: data.attendees,
            agenda: data.agenda,
            minutes: data.minutes,
            actionItems: data.actionItems,
            status: data.status,
        },
    });
}
async function updateMeetingActionItemStatus(meetingId, actionItemIndex, status) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
        throw new Error('Meeting not found');
    }
    const actionItems = meeting.actionItems ?? [];
    if (actionItemIndex < 0 || actionItemIndex >= actionItems.length) {
        throw new Error('Action item index out of range');
    }
    actionItems[actionItemIndex] = { ...actionItems[actionItemIndex], status };
    return prisma.meeting.update({
        where: { id: meetingId },
        data: { actionItems: actionItems },
    });
}
async function deleteMeeting(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.meeting.delete({ where: { id } });
}
async function getMeetingPdfData(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const meeting = await prisma.meeting.findUnique({
        where: { id },
        include: { project: true },
    });
    if (!meeting) {
        throw new Error('Meeting not found');
    }
    return {
        title: meeting.title,
        meetingDate: meeting.meetingDate,
        location: meeting.location,
        facilitator: meeting.facilitator,
        attendees: meeting.attendees ?? [],
        agenda: meeting.agenda ?? [],
        minutes: meeting.minutes,
        actionItems: meeting.actionItems ?? [],
        status: meeting.status,
        projectName: meeting.project.name,
    };
}
async function getOverdueRfis(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const now = new Date();
    const rfis = await prisma.rfi.findMany({
        where: {
            projectId,
            status: { notIn: ['closed', 'answered'] },
            requiredDate: { not: null, lt: now },
        },
    });
    return rfis.map((r) => ({
        id: r.id,
        rfiNumber: r.rfiNumber,
        subject: r.subject,
        requiredDate: r.requiredDate,
        daysOverdue: r.requiredDate
            ? Math.max(0, Math.ceil((now.getTime() - new Date(r.requiredDate).getTime()) / (1000 * 60 * 60 * 24)))
            : 0,
        status: r.status,
    }));
}
async function getOverdueSubmittals(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const now = new Date();
    const subs = await prisma.submittal.findMany({
        where: {
            projectId,
            status: { notIn: ['approved', 'rejected'] },
            requiredDate: { not: null, lt: now },
        },
    });
    return subs.map((s) => ({
        id: s.id,
        submittalNumber: s.submittalNumber,
        title: s.title,
        requiredDate: s.requiredDate,
        daysOverdue: s.requiredDate
            ? Math.max(0, Math.ceil((now.getTime() - new Date(s.requiredDate).getTime()) / (1000 * 60 * 60 * 24)))
            : 0,
        status: s.status,
    }));
}
//# sourceMappingURL=communications.service.js.map