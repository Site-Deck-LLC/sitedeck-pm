"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCpm = calculateCpm;
exports.calculateBaselineVariance = calculateBaselineVariance;
exports.calculateCriticalPathImpact = calculateCriticalPathImpact;
exports.getSchedulePerformance = getSchedulePerformance;
exports.recalculateSchedule = recalculateSchedule;
const prisma_1 = require("../lib/prisma");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function addDays(date, days) {
    return new Date(date.getTime() + days * MS_PER_DAY);
}
function diffInDays(a, b) {
    return (a.getTime() - b.getTime()) / MS_PER_DAY;
}
function calculateCpm(activities, projectStart) {
    const activityMap = new Map();
    for (const act of activities) {
        activityMap.set(act.id, act);
    }
    // Build adjacency list and in-degree for topological sort
    const inDegree = new Map();
    const adj = new Map(); // predecessor -> successors
    for (const act of activities) {
        inDegree.set(act.id, 0);
        adj.set(act.id, []);
    }
    for (const act of activities) {
        for (const pred of act.predecessors || []) {
            const predId = pred.activityId;
            if (!adj.has(predId)) {
                adj.set(predId, []);
            }
            adj.get(predId).push(act.id);
            inDegree.set(act.id, (inDegree.get(act.id) || 0) + 1);
        }
    }
    // Kahn's algorithm for topological sort
    const queue = [];
    for (const [id, degree] of inDegree) {
        if (degree === 0)
            queue.push(id);
    }
    const topoOrder = [];
    while (queue.length > 0) {
        const id = queue.shift();
        topoOrder.push(id);
        for (const succId of adj.get(id) || []) {
            inDegree.set(succId, inDegree.get(succId) - 1);
            if (inDegree.get(succId) === 0) {
                queue.push(succId);
            }
        }
    }
    if (topoOrder.length !== activities.length) {
        throw new Error('Cycle detected in activity network');
    }
    // Forward pass: compute ES, EF as day offsets from projectStart
    const esOffset = new Map();
    const efOffset = new Map();
    for (const id of topoOrder) {
        const act = activityMap.get(id);
        let maxEs = -Infinity;
        for (const pred of act.predecessors || []) {
            const predEs = esOffset.get(pred.activityId);
            const predEf = efOffset.get(pred.activityId);
            let candidate;
            switch (pred.type) {
                case 'FS':
                default:
                    candidate = predEf + pred.lag;
                    break;
                case 'SS':
                    candidate = predEs + pred.lag;
                    break;
                case 'FF':
                    candidate = predEf + pred.lag - act.duration;
                    break;
                case 'SF':
                    candidate = predEs + pred.lag - act.duration;
                    break;
            }
            if (candidate > maxEs) {
                maxEs = candidate;
            }
        }
        const actEs = Math.max(0, maxEs === -Infinity ? 0 : maxEs);
        const actEf = actEs + act.duration;
        esOffset.set(id, actEs);
        efOffset.set(id, actEf);
    }
    const projectEndOffset = Math.max(...Array.from(efOffset.values()));
    // Backward pass: compute LF, LS as day offsets from projectStart
    const lsOffset = new Map();
    const lfOffset = new Map();
    for (let i = topoOrder.length - 1; i >= 0; i--) {
        const id = topoOrder[i];
        const act = activityMap.get(id);
        const successors = adj.get(id) || [];
        if (successors.length === 0) {
            lfOffset.set(id, projectEndOffset);
        }
        else {
            let minLf = Infinity;
            for (const succId of successors) {
                const succLs = lsOffset.get(succId);
                const succLf = lfOffset.get(succId);
                const succAct = activityMap.get(succId);
                const link = succAct.predecessors?.find((p) => p.activityId === id);
                const lag = link?.lag || 0;
                let candidate;
                switch (link?.type) {
                    case 'FS':
                    default:
                        candidate = succLs - lag;
                        break;
                    case 'SS':
                        candidate = succLs - lag + act.duration;
                        break;
                    case 'FF':
                        candidate = succLf - lag;
                        break;
                    case 'SF':
                        candidate = succLf - lag + act.duration;
                        break;
                }
                if (candidate < minLf) {
                    minLf = candidate;
                }
            }
            lfOffset.set(id, minLf);
        }
        lsOffset.set(id, lfOffset.get(id) - act.duration);
    }
    // Calculate floats and criticality
    const result = new Map();
    for (const id of topoOrder) {
        const act = activityMap.get(id);
        const actEs = esOffset.get(id);
        const actEf = efOffset.get(id);
        const actLs = lsOffset.get(id);
        const actLf = lfOffset.get(id);
        const totalFloat = actLs - actEs;
        let freeFloat;
        const successors = adj.get(id) || [];
        if (successors.length === 0) {
            freeFloat = projectEndOffset - actEf;
        }
        else {
            let minFf = Infinity;
            for (const succId of successors) {
                const succEs = esOffset.get(succId);
                const succEf = efOffset.get(succId);
                const succAct = activityMap.get(succId);
                const link = succAct.predecessors?.find((p) => p.activityId === id);
                const lag = link?.lag || 0;
                let candidate;
                switch (link?.type) {
                    case 'FS':
                    default:
                        candidate = succEs - actEf - lag;
                        break;
                    case 'SS':
                        candidate = succEs - actEs - lag;
                        break;
                    case 'FF':
                        candidate = succEf - actEf - lag;
                        break;
                    case 'SF':
                        candidate = succEf - actEs - lag;
                        break;
                }
                if (candidate < minFf) {
                    minFf = candidate;
                }
            }
            freeFloat = minFf === Infinity ? 0 : minFf;
        }
        result.set(id, {
            earlyStart: addDays(projectStart, actEs),
            earlyFinish: addDays(projectStart, actEf),
            lateStart: addDays(projectStart, actLs),
            lateFinish: addDays(projectStart, actLf),
            totalFloat,
            freeFloat,
            isCritical: Math.abs(totalFloat) <= 0.0001,
        });
    }
    return result;
}
function calculateBaselineVariance(current, baseline) {
    return {
        startVarianceDays: diffInDays(current.startDate, baseline.startDate),
        finishVarianceDays: diffInDays(current.endDate, baseline.endDate),
    };
}
function calculateCriticalPathImpact(activities, changedActivityId, newDuration, projectStart) {
    const originalResult = calculateCpm(activities, projectStart);
    const originalEnd = Math.max(...Array.from(originalResult.values()).map((r) => r.earlyFinish.getTime()));
    const modifiedActivities = activities.map((a) => a.id === changedActivityId ? { ...a, duration: newDuration } : a);
    const modifiedResult = calculateCpm(modifiedActivities, projectStart);
    const modifiedEnd = Math.max(...Array.from(modifiedResult.values()).map((r) => r.earlyFinish.getTime()));
    return (modifiedEnd - originalEnd) / MS_PER_DAY;
}
async function getSchedulePerformance(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { startDate: true, endDate: true },
    });
    if (!project || !project.startDate) {
        throw new Error('Project start date required');
    }
    const start = project.startDate;
    const end = project.endDate || new Date(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate());
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    // Get locked baseline, or the most recent one
    const baseline = await prisma.scheduleBaseline.findFirst({
        where: { projectId },
        orderBy: { locked: 'desc', baselineDate: 'desc' },
    });
    const baselineActivities = baseline
        ? (baseline.activities || [])
        : [];
    const currentActivities = await prisma.scheduleActivity.findMany({
        where: { projectId },
        select: { startDate: true, endDate: true, duration: true, percentComplete: true },
    });
    // Calculate total baseline and current durations
    const totalBaselineDuration = baselineActivities.reduce((s, a) => s + Math.max(1, a.duration), 0);
    const totalCurrentDuration = currentActivities.reduce((s, a) => s + Math.max(1, a.duration), 0);
    // Current actual % complete (weighted by duration)
    const currentActualPct = totalCurrentDuration > 0
        ? currentActivities.reduce((s, a) => s + a.duration * a.percentComplete, 0) / totalCurrentDuration
        : 0;
    // Generate daily points
    const data = [];
    const cursor = new Date(start);
    cursor.setUTCHours(0, 0, 0, 0);
    const endCursor = new Date(end);
    endCursor.setUTCHours(0, 0, 0, 0);
    while (cursor <= endCursor) {
        const dayTime = cursor.getTime();
        // Baseline %: weighted sum of planned progress for each baseline activity
        let baselinePct = 0;
        if (totalBaselineDuration > 0) {
            for (const act of baselineActivities) {
                const actStart = new Date(act.startDate).getTime();
                const actEnd = new Date(act.endDate).getTime();
                const actDuration = Math.max(1, act.duration);
                let actPct = 0;
                if (dayTime >= actEnd) {
                    actPct = 1;
                }
                else if (dayTime > actStart) {
                    actPct = (dayTime - actStart) / (actEnd - actStart);
                }
                baselinePct += actPct * actDuration;
            }
            baselinePct = baselinePct / totalBaselineDuration;
        }
        // Actual %: current actual % for all days up to today, 0 before start
        let actualPct = 0;
        if (dayTime <= today.getTime()) {
            // Interpolate from 0% at start to currentActualPct at today
            const totalSpan = Math.max(1, today.getTime() - start.getTime());
            actualPct = currentActualPct * Math.min(1, (dayTime - start.getTime()) / totalSpan);
        }
        // Forecast %: from today onward, project linear completion to 100% by end
        let forecastPct = 0;
        if (dayTime >= today.getTime()) {
            const remainingSpan = Math.max(1, end.getTime() - today.getTime());
            forecastPct = currentActualPct + (1 - currentActualPct) * ((dayTime - today.getTime()) / remainingSpan);
        }
        else {
            forecastPct = actualPct;
        }
        data.push({
            date: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`,
            baselinePct: Math.round(baselinePct * 10000) / 10000,
            actualPct: Math.round(actualPct * 10000) / 10000,
            forecastPct: Math.round(forecastPct * 10000) / 10000,
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return { projectId, data };
}
async function recalculateSchedule(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { scheduleActivities: true },
    });
    if (!project) {
        throw new Error('Project not found');
    }
    if (!project.scheduleActivities || project.scheduleActivities.length === 0) {
        return;
    }
    const projectStart = project.startDate || project.scheduleActivities[0].startDate;
    if (!projectStart) {
        throw new Error('Project start date not available');
    }
    // Read relationships from the relational table (source of truth)
    const relationships = await prisma.activityRelationship.findMany({
        where: { projectId },
        select: { predecessorId: true, successorId: true, relationshipType: true, lagDays: true },
    });
    // Build predecessor/successor maps from relational data
    const predMap = new Map();
    const succMap = new Map();
    for (const rel of relationships) {
        const predEntry = {
            activityId: rel.predecessorId,
            type: rel.relationshipType,
            lag: rel.lagDays,
        };
        const succEntry = {
            activityId: rel.successorId,
            type: rel.relationshipType,
            lag: rel.lagDays,
        };
        if (!predMap.has(rel.successorId))
            predMap.set(rel.successorId, []);
        if (!succMap.has(rel.predecessorId))
            succMap.set(rel.predecessorId, []);
        predMap.get(rel.successorId).push(predEntry);
        succMap.get(rel.predecessorId).push(succEntry);
    }
    const nodes = project.scheduleActivities.map((a) => ({
        id: a.id,
        startDate: a.startDate,
        endDate: a.endDate,
        duration: a.duration,
        predecessors: predMap.get(a.id) || undefined,
        successors: succMap.get(a.id) || undefined,
    }));
    const cpmResult = calculateCpm(nodes, projectStart);
    const updates = [];
    for (const activity of project.scheduleActivities) {
        const result = cpmResult.get(activity.id);
        if (!result)
            continue;
        updates.push(prisma.scheduleActivity.update({
            where: { id: activity.id },
            data: {
                earlyStart: result.earlyStart,
                earlyFinish: result.earlyFinish,
                lateStart: result.lateStart,
                lateFinish: result.lateFinish,
                totalFloat: result.totalFloat,
                freeFloat: result.freeFloat,
                isCritical: result.isCritical,
            },
        }));
    }
    await Promise.all(updates);
}
//# sourceMappingURL=schedule.service.js.map