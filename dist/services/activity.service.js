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
exports.getRelationshipsForActivity = getRelationshipsForActivity;
exports.createRelationship = createRelationship;
exports.deleteRelationship = deleteRelationship;
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
            linkedBenchmarkDfowId: a.linkedBenchmarkDfowId || null,
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
async function getRelationshipsForActivity(activityId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const [predecessors, successors] = await Promise.all([
        prisma.activityRelationship.findMany({
            where: { successorId: activityId },
            include: { predecessor: { select: { id: true, name: true } } },
        }),
        prisma.activityRelationship.findMany({
            where: { predecessorId: activityId },
            include: { successor: { select: { id: true, name: true } } },
        }),
    ]);
    return { predecessors, successors };
}
async function createRelationship(input) {
    const prisma = (0, prisma_1.getPrismaClient)();
    if (input.predecessorId === input.successorId) {
        throw new Error('An activity cannot be its own predecessor or successor');
    }
    // Verify both activities exist and belong to the same project
    const [pred, succ] = await Promise.all([
        prisma.scheduleActivity.findUnique({ where: { id: input.predecessorId } }),
        prisma.scheduleActivity.findUnique({ where: { id: input.successorId } }),
    ]);
    if (!pred || !succ) {
        throw new Error('One or both activities not found');
    }
    if (pred.projectId !== input.projectId || succ.projectId !== input.projectId) {
        throw new Error('Activities must belong to the same project');
    }
    // Check for duplicate
    const existing = await prisma.activityRelationship.findUnique({
        where: {
            predecessorId_successorId_relationshipType: {
                predecessorId: input.predecessorId,
                successorId: input.successorId,
                relationshipType: input.relationshipType,
            },
        },
    });
    if (existing) {
        throw new Error('Relationship already exists');
    }
    // Circular dependency check
    const wouldCycle = await detectCircularDependency(input.projectId, input.predecessorId, input.successorId);
    if (wouldCycle) {
        throw new Error('Circular dependency detected');
    }
    const rel = await prisma.activityRelationship.create({
        data: {
            projectId: input.projectId,
            predecessorId: input.predecessorId,
            successorId: input.successorId,
            relationshipType: input.relationshipType,
            lagDays: input.lagDays ?? 0,
            constraintType: input.constraintType ?? 'hard',
        },
    });
    // Sync to JSON fields for backward compatibility during transition
    await syncRelationshipsToJson(input.projectId, input.predecessorId, input.successorId);
    await (0, schedule_service_1.recalculateSchedule)(input.projectId);
    return rel;
}
async function deleteRelationship(relId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const rel = await prisma.activityRelationship.findUnique({
        where: { id: relId },
    });
    if (!rel) {
        throw new Error('Relationship not found');
    }
    await prisma.activityRelationship.delete({
        where: { id: relId },
    });
    await syncRelationshipsToJson(rel.projectId, rel.predecessorId, rel.successorId);
    await (0, schedule_service_1.recalculateSchedule)(rel.projectId);
    return rel;
}
async function detectCircularDependency(projectId, newPredecessorId, newSuccessorId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const allRels = await prisma.activityRelationship.findMany({
        where: { projectId },
        select: { predecessorId: true, successorId: true },
    });
    // Build adjacency list (predecessor -> successors)
    const adj = new Map();
    for (const r of allRels) {
        if (!adj.has(r.predecessorId))
            adj.set(r.predecessorId, []);
        adj.get(r.predecessorId).push(r.successorId);
    }
    // Add the proposed new edge
    if (!adj.has(newPredecessorId))
        adj.set(newPredecessorId, []);
    adj.get(newPredecessorId).push(newSuccessorId);
    // DFS to detect if newSuccessorId can reach newPredecessorId
    const visited = new Set();
    const stack = [newSuccessorId];
    while (stack.length > 0) {
        const node = stack.pop();
        if (node === newPredecessorId)
            return true;
        if (visited.has(node))
            continue;
        visited.add(node);
        for (const neighbor of adj.get(node) || []) {
            stack.push(neighbor);
        }
    }
    return false;
}
async function syncRelationshipsToJson(projectId, predecessorId, successorId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const allRels = await prisma.activityRelationship.findMany({
        where: { projectId },
        select: { predecessorId: true, successorId: true, relationshipType: true, lagDays: true },
    });
    const predMap = new Map();
    const succMap = new Map();
    for (const r of allRels) {
        const predEntry = { activityId: r.successorId, type: r.relationshipType, lag: r.lagDays };
        const succEntry = { activityId: r.predecessorId, type: r.relationshipType, lag: r.lagDays };
        if (!predMap.has(r.predecessorId))
            predMap.set(r.predecessorId, []);
        if (!succMap.has(r.successorId))
            succMap.set(r.successorId, []);
        predMap.get(r.predecessorId).push(predEntry);
        succMap.get(r.successorId).push(succEntry);
    }
    const activityIds = [...new Set([...predMap.keys(), ...succMap.keys()])];
    const updates = activityIds.map((id) => prisma.scheduleActivity.update({
        where: { id },
        data: {
            predecessors: predMap.get(id) || [],
            successors: succMap.get(id) || [],
        },
    }));
    await Promise.all(updates);
}
//# sourceMappingURL=activity.service.js.map