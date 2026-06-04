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
const cost_service_1 = require("./cost.service");
const procurement_service_1 = require("./procurement.service");
const risk_service_1 = require("./risk.service");
Object.defineProperty(exports, "getRiskDashboardStatus", { enumerable: true, get: function () { return risk_service_1.getRiskDashboardStatus; } });
const integration_service_1 = require("./integration.service");
const resource_service_1 = require("./resource.service");
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
    if (cpi < 0.9 || hasRedLine) {
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
    const { evm, lineResults } = await (0, cost_service_1.calculateProjectEvm)(projectId);
    const lineFlags = lineResults.map((l) => l.flag).filter((f) => f !== null);
    const idleEquipment = await (0, resource_service_1.getIdleEquipmentOnCriticalPath)(projectId);
    const safetyTile = getSafetyTileStatus(safetyData);
    const scheduleTile = getScheduleTileStatus(activities, idleEquipment.length);
    const costTile = getCostTileStatus(evm, lineFlags);
    const materialsTile = await getMaterialsTileStatus(projectId);
    const clientIssuesTile = await getClientIssuesTileStatus(projectId);
    const fieldIssuesTile = await getFieldIssuesTileStatus(projectId);
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
    };
}
//# sourceMappingURL=dashboard.service.js.map