"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRfi = createRfi;
exports.getRfiById = getRfiById;
exports.getRfiByProject = getRfiByProject;
exports.submitRfi = submitRfi;
exports.answerRfi = answerRfi;
exports.closeRfi = closeRfi;
exports.getRfiPdfData = getRfiPdfData;
exports.createSubmittal = createSubmittal;
exports.getSubmittalById = getSubmittalById;
exports.getSubmittalsByProject = getSubmittalsByProject;
exports.submitSubmittal = submitSubmittal;
exports.reviewSubmittal = reviewSubmittal;
exports.getSubmittalPdfData = getSubmittalPdfData;
const prisma_1 = require("../lib/prisma");
const communications_1 = require("../constants/communications");
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
    return prisma.rfi.update({
        where: { id },
        data: {
            status: communications_1.RFI_STATUSES.SUBMITTED,
            submittedAt: new Date(),
        },
    });
}
async function answerRfi(id, responseText, answeredBy) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.rfi.update({
        where: { id },
        data: {
            status: communications_1.RFI_STATUSES.ANSWERED,
            responseText,
            answeredAt: new Date(),
            assignedTo: answeredBy,
        },
    });
}
async function closeRfi(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.rfi.update({
        where: { id },
        data: {
            status: communications_1.RFI_STATUSES.CLOSED,
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
    return prisma.submittal.update({
        where: { id },
        data: {
            status: communications_1.SUBMITTAL_STATUSES.SUBMITTED,
            submittedAt: new Date(),
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
    const updatedDescription = notes
        ? `${submittal.description ?? ''}\n\nReview notes: ${notes}`
        : submittal.description;
    return prisma.submittal.update({
        where: { id },
        data: {
            status: statusMap[decision],
            reviewedBy,
            reviewedAt: new Date(),
            description: updatedDescription,
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
//# sourceMappingURL=communications.service.js.map