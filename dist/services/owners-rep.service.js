"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOwnersRepDashboard = getOwnersRepDashboard;
exports.getOwnersRepIssues = getOwnersRepIssues;
exports.getOwnersRepRfiStatus = getOwnersRepRfiStatus;
exports.getOwnersRepSubmittalStatus = getOwnersRepSubmittalStatus;
exports.canAccessOwnersRepPortal = canAccessOwnersRepPortal;
exports.getOwnersRepProjectSummary = getOwnersRepProjectSummary;
const roles_1 = require("../constants/roles");
const communications_1 = require("../constants/communications");
const prisma_1 = require("../lib/prisma");
const dashboard_service_1 = require("./dashboard.service");
const integration_service_1 = require("./integration.service");
const PRIORITY_WEIGHT = {
    high: 3,
    medium: 2,
    low: 1,
};
function sortIssuesByPriorityDesc(issues) {
    return [...issues].sort((a, b) => {
        const aWeight = PRIORITY_WEIGHT[a.priority] ?? 0;
        const bWeight = PRIORITY_WEIGHT[b.priority] ?? 0;
        if (aWeight !== bWeight) {
            return bWeight - aWeight;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}
async function getOwnersRepDashboard(projectId, safetyData) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const activities = await prisma.scheduleActivity.findMany({
        where: { projectId },
        select: {
            id: true,
            name: true,
            status: true,
            isCritical: true,
            totalFloat: true,
        },
    });
    const safetyTile = (0, dashboard_service_1.getSafetyTileStatus)(safetyData);
    const scheduleTile = (0, dashboard_service_1.getScheduleTileStatus)(activities);
    const materialsTile = await (0, dashboard_service_1.getMaterialsTileStatus)(projectId);
    const clientIssuesTile = await (0, dashboard_service_1.getClientIssuesTileStatus)(projectId);
    const fieldIssuesTile = await (0, dashboard_service_1.getFieldIssuesTileStatus)(projectId);
    return {
        projectId,
        generatedAt: new Date(),
        tiles: {
            safety: safetyTile,
            schedule: scheduleTile,
            materials: materialsTile,
            clientIssues: clientIssuesTile,
            fieldIssues: fieldIssuesTile,
        },
    };
}
async function getOwnersRepIssues(projectId) {
    const issues = await (0, integration_service_1.getIssuesByType)(projectId, 'client_issue');
    return sortIssuesByPriorityDesc(issues);
}
async function getOwnersRepRfiStatus(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const rfis = await prisma.rfi.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
    });
    const totalRfis = rfis.length;
    const openRfis = rfis.filter((r) => r.status === communications_1.RFI_STATUSES.SUBMITTED || r.status === communications_1.RFI_STATUSES.UNDER_REVIEW).length;
    const answeredRfis = rfis.filter((r) => r.status === communications_1.RFI_STATUSES.ANSWERED).length;
    const closedRfis = rfis.filter((r) => r.status === communications_1.RFI_STATUSES.CLOSED).length;
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const overdueRfis = rfis.filter((r) => {
        const isOpen = r.status === communications_1.RFI_STATUSES.SUBMITTED ||
            r.status === communications_1.RFI_STATUSES.UNDER_REVIEW;
        const submittedAt = r.submittedAt ? new Date(r.submittedAt) : null;
        return isOpen && submittedAt !== null && submittedAt < fourteenDaysAgo;
    }).length;
    const recentRfis = rfis.slice(0, 5).map((r) => ({
        rfiNumber: r.rfiNumber,
        subject: r.subject,
        status: r.status,
        submittedAt: r.submittedAt,
    }));
    return {
        projectId,
        totalRfis,
        openRfis,
        answeredRfis,
        closedRfis,
        overdueRfis,
        recentRfis,
    };
}
async function getOwnersRepSubmittalStatus(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const submittals = await prisma.submittal.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
    });
    const totalSubmittals = submittals.length;
    const pendingSubmittals = submittals.filter((s) => s.status === communications_1.SUBMITTAL_STATUSES.PENDING).length;
    const approvedSubmittals = submittals.filter((s) => s.status === communications_1.SUBMITTAL_STATUSES.APPROVED).length;
    const rejectedSubmittals = submittals.filter((s) => s.status === communications_1.SUBMITTAL_STATUSES.REJECTED).length;
    const underReviewSubmittals = submittals.filter((s) => s.status === communications_1.SUBMITTAL_STATUSES.UNDER_REVIEW).length;
    const recentSubmittals = submittals.slice(0, 5).map((s) => ({
        submittalNumber: s.submittalNumber,
        title: s.title,
        status: s.status,
        submittedAt: s.submittedAt,
    }));
    return {
        projectId,
        totalSubmittals,
        pendingSubmittals,
        approvedSubmittals,
        rejectedSubmittals,
        underReviewSubmittals,
        recentSubmittals,
    };
}
function canAccessOwnersRepPortal(userRole) {
    return userRole === roles_1.ROLES.OWNERS_REP;
}
async function getOwnersRepProjectSummary(projectId, safetyData) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
    });
    if (!project) {
        throw new Error('Project not found');
    }
    const [dashboard, issues, rfiStatus, submittalStatus] = await Promise.all([
        getOwnersRepDashboard(projectId, safetyData),
        getOwnersRepIssues(projectId),
        getOwnersRepRfiStatus(projectId),
        getOwnersRepSubmittalStatus(projectId),
    ]);
    const openStatuses = ['open', 'in_progress'];
    const open = issues.filter((i) => openStatuses.includes(i.status)).length;
    const highPriority = issues.filter((i) => i.priority === 'high').length;
    return {
        projectId,
        projectName: project.name,
        dashboard,
        issues: {
            total: issues.length,
            open,
            highPriority,
            items: issues,
        },
        rfiStatus,
        submittalStatus,
    };
}
//# sourceMappingURL=owners-rep.service.js.map