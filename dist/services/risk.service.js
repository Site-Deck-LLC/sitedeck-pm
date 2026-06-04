"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRiskItem = createRiskItem;
exports.getRiskItemById = getRiskItemById;
exports.getRiskItemsByProject = getRiskItemsByProject;
exports.getOpenRisksByProject = getOpenRisksByProject;
exports.updateRiskItem = updateRiskItem;
exports.closeRiskItem = closeRiskItem;
exports.acceptRiskItem = acceptRiskItem;
exports.mitigateRiskItem = mitigateRiskItem;
exports.getRiskMatrix = getRiskMatrix;
exports.getRiskDashboardStatus = getRiskDashboardStatus;
exports.autoCreateRiskFromSafetyIncident = autoCreateRiskFromSafetyIncident;
const prisma_1 = require("../lib/prisma");
const risk_1 = require("../constants/risk");
async function createRiskItem(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const score = (0, risk_1.getRiskScore)(data.probability, data.impact);
    return prisma.riskItem.create({
        data: {
            projectId: data.projectId,
            description: data.description,
            category: data.category,
            probability: data.probability,
            impact: data.impact,
            score,
            mitigationPlan: data.mitigationPlan,
            owner: data.owner,
            status: risk_1.RISK_STATUSES.OPEN,
            linkedActivityId: data.linkedActivityId,
            linkedBudgetLineId: data.linkedBudgetLineId,
            source: risk_1.RISK_SOURCES.MANUAL,
        },
    });
}
async function getRiskItemById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.riskItem.findUnique({
        where: { id },
        include: { project: true },
    });
}
async function getRiskItemsByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.riskItem.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
    });
}
async function getOpenRisksByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.riskItem.findMany({
        where: { projectId, status: risk_1.RISK_STATUSES.OPEN },
        orderBy: { score: 'desc' },
    });
}
async function updateRiskItem(id, data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.riskItem.findUnique({
        where: { id },
    });
    if (!existing) {
        throw new Error('Risk item not found');
    }
    const probability = data.probability ?? existing.probability;
    const impact = data.impact ?? existing.impact;
    const score = (0, risk_1.getRiskScore)(probability, impact);
    return prisma.riskItem.update({
        where: { id },
        data: {
            ...data,
            score,
        },
    });
}
async function closeRiskItem(id, notes) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.riskItem.findUnique({
        where: { id },
    });
    if (!existing) {
        throw new Error('Risk item not found');
    }
    return prisma.riskItem.update({
        where: { id },
        data: {
            status: risk_1.RISK_STATUSES.CLOSED,
            mitigationPlan: notes ? `${existing.mitigationPlan ?? ''}\nClose notes: ${notes}`.trim() : existing.mitigationPlan,
        },
    });
}
async function acceptRiskItem(id, notes) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.riskItem.findUnique({
        where: { id },
    });
    if (!existing) {
        throw new Error('Risk item not found');
    }
    return prisma.riskItem.update({
        where: { id },
        data: {
            status: risk_1.RISK_STATUSES.ACCEPTED,
            mitigationPlan: notes ? `${existing.mitigationPlan ?? ''}\nAccept notes: ${notes}`.trim() : existing.mitigationPlan,
        },
    });
}
async function mitigateRiskItem(id, mitigationPlan) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.riskItem.findUnique({
        where: { id },
    });
    if (!existing) {
        throw new Error('Risk item not found');
    }
    return prisma.riskItem.update({
        where: { id },
        data: {
            status: risk_1.RISK_STATUSES.MITIGATED,
            mitigationPlan,
        },
    });
}
async function getRiskMatrix(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const risks = await prisma.riskItem.findMany({
        where: { projectId },
    });
    const probabilities = ['low', 'medium', 'high'];
    const impacts = ['low', 'medium', 'high'];
    const cells = [];
    for (const probability of probabilities) {
        for (const impact of impacts) {
            const score = (0, risk_1.getRiskScore)(probability, impact);
            const color = (0, risk_1.getRiskColor)(score);
            const cellRisks = risks
                .filter((r) => r.probability === probability && r.impact === impact)
                .map((r) => ({
                id: r.id,
                description: r.description,
                owner: r.owner,
                status: r.status,
            }));
            cells.push({
                probability,
                impact,
                score,
                color,
                risks: cellRisks,
            });
        }
    }
    const highRisks = risks
        .filter((r) => r.score >= 7)
        .map((r) => ({
        id: r.id,
        description: r.description,
        owner: r.owner,
        status: r.status,
        score: r.score,
    }));
    const totalOpen = risks.filter((r) => r.status === risk_1.RISK_STATUSES.OPEN).length;
    return {
        projectId,
        cells,
        highRisks,
        totalOpen,
    };
}
async function getRiskDashboardStatus(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const openRisks = await prisma.riskItem.findMany({
        where: { projectId, status: risk_1.RISK_STATUSES.OPEN },
    });
    if (openRisks.length === 0) {
        return {
            status: 'green',
            summary: '0 open risks',
            count: 0,
        };
    }
    const highRisks = openRisks.filter((r) => r.score >= 7);
    if (highRisks.length > 0) {
        return {
            status: 'red',
            summary: `${highRisks.length} open high-risk item${highRisks.length !== 1 ? 's' : ''}`,
            count: highRisks.length,
        };
    }
    const mediumRisks = openRisks.filter((r) => r.score >= 4 && r.score <= 6);
    if (mediumRisks.length > 0) {
        return {
            status: 'amber',
            summary: `${mediumRisks.length} open medium-risk item${mediumRisks.length !== 1 ? 's' : ''}`,
            count: mediumRisks.length,
        };
    }
    return {
        status: 'green',
        summary: `${openRisks.length} open low-risk item${openRisks.length !== 1 ? 's' : ''}`,
        count: openRisks.length,
    };
}
function mapSeverityToProbabilityAndImpact(severity, recordable) {
    let probability;
    let impact;
    if (severity <= 2) {
        probability = 'low';
        impact = 'low';
    }
    else if (severity <= 4) {
        probability = 'medium';
        impact = 'medium';
    }
    else {
        probability = 'high';
        impact = 'high';
    }
    if (recordable && impact === 'low') {
        impact = 'medium';
    }
    return { probability, impact };
}
async function autoCreateRiskFromSafetyIncident(projectId, incidentData, incidentReference) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.riskItem.findFirst({
        where: {
            projectId,
            incidentReference,
        },
    });
    if (existing) {
        return existing;
    }
    const { probability, impact } = mapSeverityToProbabilityAndImpact(incidentData.severity, incidentData.recordable);
    const score = (0, risk_1.getRiskScore)(probability, impact);
    return prisma.riskItem.create({
        data: {
            projectId,
            description: `Safety incident: ${incidentData.incidentType}. ${incidentData.description}`,
            category: risk_1.RISK_CATEGORIES.SAFETY,
            probability,
            impact,
            score,
            owner: 'safety_system',
            source: risk_1.RISK_SOURCES.SAFETY_INCIDENT_WEBHOOK,
            incidentReference,
        },
    });
}
//# sourceMappingURL=risk.service.js.map