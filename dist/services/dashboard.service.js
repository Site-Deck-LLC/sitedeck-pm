"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRiskDashboardStatus = void 0;
exports.getSafetyTileStatus = getSafetyTileStatus;
exports.getScheduleTileStatus = getScheduleTileStatus;
exports.getCostTileStatus = getCostTileStatus;
exports.getMaterialsTileStatus = getMaterialsTileStatus;
exports.getClientIssuesTileStatus = getClientIssuesTileStatus;
exports.getFieldIssuesTileStatus = getFieldIssuesTileStatus;
exports.getMorningDashboard = getMorningDashboard;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const cost_service_1 = require("./cost.service");
const procurement_service_1 = require("./procurement.service");
const risk_service_1 = require("./risk.service");
Object.defineProperty(exports, "getRiskDashboardStatus", { enumerable: true, get: function () { return risk_service_1.getRiskDashboardStatus; } });
const integration_service_1 = require("./integration.service");
const resource_service_1 = require("./resource.service");
const scope_service_1 = require("./scope.service");
const communications_service_1 = require("./communications.service");
function getSafetyTileStatus(safetyData) {
    const { incidents, openObservations } = safetyData;
    if (incidents > 0) {
        return {
            name: 'Safety',
            status: 'red',
            summary: `${incidents} incident${incidents !== 1 ? 's' : ''}, ${openObservations} open observation${openObservations !== 1 ? 's' : ''}`,
            count: incidents + openObservations,
        };
    }
    if (openObservations > 0) {
        return {
            name: 'Safety',
            status: 'amber',
            summary: `0 incidents, ${openObservations} open observation${openObservations !== 1 ? 's' : ''}`,
            count: openObservations,
        };
    }
    return {
        name: 'Safety',
        status: 'green',
        summary: '0 incidents, 0 open observations',
        count: 0,
    };
}
function getScheduleTileStatus(activities, idleEquipmentCount = 0) {
    if (activities.length === 0) {
        return {
            name: 'Schedule',
            status: idleEquipmentCount > 0 ? 'amber' : 'green',
            summary: idleEquipmentCount > 0
                ? `${idleEquipmentCount} idle equipment item${idleEquipmentCount !== 1 ? 's' : ''} on critical path`
                : 'No activities scheduled',
            count: idleEquipmentCount,
        };
    }
    const criticalDelayed = activities.filter((a) => a.isCritical && (a.totalFloat ?? 0) <= 0 && a.status !== 'complete');
    const criticalLowFloat = activities.filter((a) => a.isCritical &&
        (a.totalFloat ?? 0) > 0 &&
        (a.totalFloat ?? 0) <= 3 &&
        a.status !== 'complete');
    const nonCriticalDelayed = activities.filter((a) => !a.isCritical && a.status === 'delayed');
    if (criticalDelayed.length > 0) {
        return {
            name: 'Schedule',
            status: 'red',
            summary: `${criticalDelayed.length} critical activit${criticalDelayed.length !== 1 ? 'ies' : 'y'} delayed`,
            count: criticalDelayed.length,
        };
    }
    if (criticalLowFloat.length > 0 || nonCriticalDelayed.length > 0 || idleEquipmentCount > 0) {
        const parts = [];
        if (criticalLowFloat.length > 0) {
            parts.push(`${criticalLowFloat.length} critical activit${criticalLowFloat.length !== 1 ? 'ies' : 'y'} with low float`);
        }
        if (nonCriticalDelayed.length > 0) {
            parts.push(`${nonCriticalDelayed.length} non-critical activit${nonCriticalDelayed.length !== 1 ? 'ies' : 'y'} delayed`);
        }
        if (idleEquipmentCount > 0) {
            parts.push(`${idleEquipmentCount} idle equipment item${idleEquipmentCount !== 1 ? 's' : ''} on critical path`);
        }
        return {
            name: 'Schedule',
            status: 'amber',
            summary: parts.join('; '),
            count: criticalLowFloat.length + nonCriticalDelayed.length + idleEquipmentCount,
        };
    }
    return {
        name: 'Schedule',
        status: 'green',
        summary: 'All activities on track',
        count: 0,
    };
}
function getCostTileStatus(evmResult, lineFlags) {
    const hasRedLine = lineFlags.some((f) => f === 'red');
    const hasAmberLine = lineFlags.some((f) => f === 'amber');
    const cpi = evmResult.cpi;
    if (cpi < 0.95 || hasRedLine) {
        return {
            name: 'Cost',
            status: 'red',
            summary: `CPI ${cpi.toFixed(2)} — ${hasRedLine ? 'budget overrun flagged' : 'cost overrun'}`,
            count: hasRedLine ? lineFlags.filter((f) => f === 'red').length : 1,
        };
    }
    if (cpi < 1.0 || hasAmberLine) {
        return {
            name: 'Cost',
            status: 'amber',
            summary: `CPI ${cpi.toFixed(2)} — ${hasAmberLine ? 'budget line attention needed' : 'slight cost underrun'}`,
            count: hasAmberLine ? lineFlags.filter((f) => f === 'amber').length : 1,
        };
    }
    return {
        name: 'Cost',
        status: 'green',
        summary: `CPI ${cpi.toFixed(2)} — on budget`,
        count: 0,
    };
}
async function getMaterialsTileStatus(projectId) {
    try {
        const alert = await (0, procurement_service_1.getMaterialsAlertStatus)(projectId);
        return {
            name: 'Materials',
            status: alert.status,
            summary: alert.summary,
            count: alert.count,
        };
    }
    catch {
        // Fallback if procurement service is unavailable or returns null/undefined
        return {
            name: 'Materials',
            status: 'green',
            summary: 'Procurement module pending',
            count: 0,
        };
    }
}
async function getClientIssuesTileStatus(projectId) {
    const issues = await (0, integration_service_1.getIssuesByType)(projectId, 'client_issue');
    const openStatuses = ['open', 'in_progress'];
    const openIssues = issues.filter((i) => openStatuses.includes(i.status));
    if (openIssues.length === 0) {
        return {
            name: 'Client Issues',
            status: 'green',
            summary: '0 open client issues',
            count: 0,
        };
    }
    const now = new Date();
    const pastDue = openIssues.filter((i) => i.dueDate && new Date(i.dueDate) < now);
    if (pastDue.length > 0) {
        return {
            name: 'Client Issues',
            status: 'red',
            summary: `${pastDue.length} open client issue${pastDue.length !== 1 ? 's' : ''} past due`,
            count: pastDue.length,
        };
    }
    return {
        name: 'Client Issues',
        status: 'amber',
        summary: `${openIssues.length} open client issue${openIssues.length !== 1 ? 's' : ''}`,
        count: openIssues.length,
    };
}
async function getFieldIssuesTileStatus(projectId) {
    const issues = await (0, integration_service_1.getIssuesByType)(projectId, 'field_issue');
    const openStatuses = ['open', 'in_progress'];
    const openIssues = issues.filter((i) => openStatuses.includes(i.status));
    if (openIssues.length === 0) {
        return {
            name: 'Field Issues',
            status: 'green',
            summary: '0 open field issues',
            count: 0,
        };
    }
    const now = new Date();
    const pastDue = openIssues.filter((i) => i.dueDate && new Date(i.dueDate) < now);
    if (pastDue.length > 0) {
        return {
            name: 'Field Issues',
            status: 'red',
            summary: `${pastDue.length} open field issue${pastDue.length !== 1 ? 's' : ''} past due`,
            count: pastDue.length,
        };
    }
    return {
        name: 'Field Issues',
        status: 'amber',
        summary: `${openIssues.length} open field issue${openIssues.length !== 1 ? 's' : ''}`,
        count: openIssues.length,
    };
}
async function getMorningDashboard(projectId, safetyData) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
            contractValue: true,
            startDate: true,
            endDate: true,
        },
    });
    const activities = await prisma.scheduleActivity.findMany({
        where: { projectId },
        select: {
            id: true,
            name: true,
            status: true,
            isCritical: true,
            totalFloat: true,
            isMilestone: true,
            endDate: true,
            percentComplete: true,
        },
    });
    const { evm, lineResults } = await (0, cost_service_1.calculateProjectEvm)(projectId);
    const lineFlags = lineResults.map((l) => l.flag).filter((f) => f !== null);
    const idleEquipment = await (0, resource_service_1.getIdleEquipmentOnCriticalPath)(projectId);
    const eqSummary = await (0, resource_service_1.getEquipmentDashboardSummary)(projectId);
    const safetyTile = getSafetyTileStatus(safetyData);
    const scheduleTile = getScheduleTileStatus(activities, idleEquipment.length);
    const costTile = getCostTileStatus(evm, lineFlags);
    const materialsTile = await getMaterialsTileStatus(projectId);
    const clientIssuesTile = await getClientIssuesTileStatus(projectId);
    const fieldIssuesTile = await getFieldIssuesTileStatus(projectId);
    // Crew: use attendance for general crew count, equipment count from resource module
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendanceToday = await prisma.attendance.findUnique({
        where: { projectId_date: { projectId, date: today } },
    });
    const crewGeneral = attendanceToday?.workerCount ?? 0;
    // Specialty crew is not yet tracked separately; default to general or 0
    const crewSpeciality = crewGeneral > 0 ? Math.max(1, Math.round(crewGeneral * 0.35)) : 0;
    // Planned effort: total hours logged across all attendance records for this project
    const allAttendance = await prisma.attendance.findMany({
        where: { projectId },
        select: { hours: true },
    });
    const plannedEffort = allAttendance.reduce((sum, a) => sum + a.hours, 0);
    // Upcoming: find next milestone and nearest incomplete activity as checkpoint
    const now = new Date();
    const incompleteActivities = activities
        .filter((a) => a.status !== 'complete')
        .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
    const nextMilestoneActivity = incompleteActivities.find((a) => a.isMilestone);
    const nextCheckpointActivity = incompleteActivities[0] ?? null;
    const daysLeft = (date) => {
        const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };
    const nextMilestone = nextMilestoneActivity
        ? {
            name: nextMilestoneActivity.name,
            daysLeft: daysLeft(nextMilestoneActivity.endDate),
            taskValue: 0, // not yet tracked per-activity
        }
        : null;
    const nextCheckpoint = nextCheckpointActivity
        ? {
            name: nextCheckpointActivity.name,
            daysLeft: daysLeft(nextCheckpointActivity.endDate),
            taskCount: incompleteActivities.length,
        }
        : null;
    const nextDraw = nextMilestone
        ? {
            name: `${nextMilestone.name} — Draw`,
            daysLeft: nextMilestone.daysLeft,
            drawValue: project?.contractValue
                ? Math.round((project.contractValue instanceof client_1.Prisma.Decimal ? project.contractValue.toNumber() : Number(project.contractValue)) * 0.15)
                : 0,
        }
        : null;
    // Communications: latest 2 open RFIs and latest 2 open field issues
    const allRfis = await (0, communications_service_1.getRfiByProject)(projectId);
    const fieldIssues = await (0, integration_service_1.getIssuesByType)(projectId, 'field_issue');
    const openStatuses = ['open', 'in_progress', 'under_review', 'submitted'];
    const mapRfi = (r) => ({
        id: r.rfiNumber,
        number: r.rfiNumber,
        recordId: r.id,
        subject: r.subject,
        status: r.status,
        date: r.createdAt.toISOString().split('T')[0],
    });
    const mapIssue = (i) => ({
        id: i.issueNumber,
        recordId: i.id,
        title: i.title,
        status: i.status,
        priority: i.priority,
        date: i.createdAt.toISOString().split('T')[0],
    });
    const communications = {
        rfis: allRfis.filter((r) => openStatuses.includes(r.status)).slice(0, 2).map(mapRfi),
        fieldIssues: fieldIssues.filter((i) => openStatuses.includes(i.status)).slice(0, 2).map(mapIssue),
    };
    // Change orders
    const allChangeOrders = await (0, scope_service_1.getChangeOrdersByProject)(projectId);
    const approvedCos = allChangeOrders.filter((co) => co.status === 'approved');
    const pendingCos = allChangeOrders.filter((co) => co.status === 'pending');
    const coDollarValue = (co) => co.dollarValue ? (co.dollarValue instanceof client_1.Prisma.Decimal ? co.dollarValue.toNumber() : Number(co.dollarValue)) : 0;
    const coScheduleImpact = (co) => co.scheduleImpact ?? 0;
    const changeOrders = {
        approved: approvedCos.length,
        pending: pendingCos.length,
        approvedCost: Math.round(approvedCos.reduce((sum, co) => sum + coDollarValue(co), 0)),
        approvedSchedule: Math.round(approvedCos.reduce((sum, co) => sum + coScheduleImpact(co), 0)),
        pendingCost: Math.round(pendingCos.reduce((sum, co) => sum + coDollarValue(co), 0)),
        pendingSchedule: Math.round(pendingCos.reduce((sum, co) => sum + coScheduleImpact(co), 0)),
        recentIds: allChangeOrders.slice(0, 5).map((co) => ({
            id: co.id,
            coNumber: co.coNumber,
            description: co.description,
            status: co.status,
            dollarValue: coDollarValue(co),
        })),
    };
    // Performance bars: use budget lines for cost and effort
    const budgetLines = await prisma.budgetLine.findMany({
        where: { projectId },
        select: { budgetAmount: true, incurredAmount: true, percentComplete: true, name: true },
    });
    const totalBudget = budgetLines.reduce((s, b) => s + decimalToNumber(b.budgetAmount), 0);
    const totalIncurred = budgetLines.reduce((s, b) => s + decimalToNumber(b.incurredAmount), 0);
    const totalEarned = budgetLines.reduce((s, b) => s + decimalToNumber(b.budgetAmount) * (b.percentComplete / 100), 0);
    const costBars = [
        { label: 'Planned', planned: Math.round(totalBudget), actual: Math.round(totalEarned), color: '#E8720C' },
        { label: 'Actual', planned: Math.round(totalBudget), actual: Math.round(totalIncurred), color: '#0EA5A0' },
    ];
    const effortBars = [
        { label: 'Planned', planned: Math.round(totalBudget), actual: Math.round(totalEarned), color: '#E8720C' },
        { label: 'Actual', planned: Math.round(totalBudget), actual: Math.round(totalIncurred), color: '#0EA5A0' },
    ];
    const performance = {
        cpi: evm.cpi,
        spi: evm.spi,
        costVariance: evm.cv,
        scheduleVariance: evm.sv,
        costBars,
        effortBars,
    };
    const contractValueNum = project?.contractValue
        ? (project.contractValue instanceof client_1.Prisma.Decimal ? project.contractValue.toNumber() : Number(project.contractValue))
        : null;
    const projectPercentComplete = totalBudget > 0 ? evm.bcwp / totalBudget : 0;
    // Metrics
    const start = project?.startDate ? new Date(project.startDate) : new Date();
    const end = project?.endDate ? new Date(project.endDate) : new Date();
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const actualDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const estimateDays = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    // Financial overview
    const approvedCoValue = changeOrders.approvedCost;
    const currentContractValue = (contractValueNum ?? 0) + approvedCoValue;
    const bidProfit = Math.max(0, (contractValueNum ?? 0) - totalBudget);
    const currentProfit = Math.max(0, currentContractValue - totalIncurred);
    const metrics = {
        plannedDays: totalDays,
        plannedEffort: Math.round(plannedEffort),
        completedPct: Math.round(projectPercentComplete * 100),
    };
    const taskDays = {
        actualDays,
        estimateDays,
        totalDays,
        completedPct: Math.round(projectPercentComplete * 100),
    };
    const financialOverview = {
        bidValue: { taskCost: Math.round(totalBudget), overhead: 0, profit: Math.round(bidProfit) },
        currentValue: { taskCost: Math.round(totalIncurred), overhead: 0, profit: Math.round(currentProfit) },
    };
    return {
        projectId,
        generatedAt: new Date(),
        tiles: {
            safety: safetyTile,
            schedule: scheduleTile,
            cost: costTile,
            materials: materialsTile,
            clientIssues: clientIssuesTile,
            fieldIssues: fieldIssuesTile,
        },
        projectValue: contractValueNum,
        crew: {
            speciality: crewSpeciality,
            general: crewGeneral,
            equipment: eqSummary.totalCount,
            equipmentActive: eqSummary.activeCount,
            equipmentIdle: eqSummary.idleCount,
            dailyBurnRate: eqSummary.estimatedDailyCost,
        },
        upcoming: {
            nextMilestone,
            nextCheckpoint,
            nextDraw,
        },
        performance,
        healthTiles: [safetyTile, scheduleTile, costTile, materialsTile, clientIssuesTile, fieldIssuesTile],
        communications,
        changeOrders,
        metrics,
        taskDays,
        financialOverview,
        quickActions: [
            { label: 'New RFI', iconKey: 'rfi', color: '#1B2A4A' },
            { label: 'New Submittal', iconKey: 'chat', color: '#D68A00' },
            { label: 'Daily Report', iconKey: 'report', color: '#22A06B' },
            { label: 'New Issue', iconKey: 'schedule', color: '#C9372D' },
        ],
    };
}
function decimalToNumber(value) {
    if (value === null || value === undefined)
        return 0;
    if (typeof value === 'number')
        return value;
    return value.toNumber();
}
//# sourceMappingURL=dashboard.service.js.map