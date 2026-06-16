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
exports.DEFAULT_CLOSEOUT_ITEMS = void 0;
exports.createIssue = createIssue;
exports.getIssueById = getIssueById;
exports.getIssuesByProject = getIssuesByProject;
exports.getIssuesByType = getIssuesByType;
exports.updateIssue = updateIssue;
exports.resolveIssue = resolveIssue;
exports.appendIssueNote = appendIssueNote;
exports.closeIssue = closeIssue;
exports.getIssuePdfData = getIssuePdfData;
exports.voiceToIssue = voiceToIssue;
exports.createVoiceMemo = createVoiceMemo;
exports.processVoiceMemo = processVoiceMemo;
exports.getVoiceMemosByProject = getVoiceMemosByProject;
exports.getVoiceMemoById = getVoiceMemoById;
exports.createSelfMemo = createSelfMemo;
exports.getSelfMemosByUser = getSelfMemosByUser;
exports.logChange = logChange;
exports.getChangeLogByProject = getChangeLogByProject;
exports.getChangeLogByModule = getChangeLogByModule;
exports.getChangeLogByRecord = getChangeLogByRecord;
exports.initializeCloseoutChecklist = initializeCloseoutChecklist;
exports.getCloseoutChecklist = getCloseoutChecklist;
exports.completeChecklistItem = completeChecklistItem;
exports.getCloseoutProgress = getCloseoutProgress;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const integration_1 = require("../constants/integration");
exports.DEFAULT_CLOSEOUT_ITEMS = [
    { id: '1', name: 'Punch list complete', category: integration_1.CLOSEOUT_CATEGORIES.TECHNICAL, completed: false },
    { id: '2', name: 'O&M manuals submitted', category: integration_1.CLOSEOUT_CATEGORIES.TECHNICAL, completed: false },
    { id: '3', name: 'As-builts submitted', category: integration_1.CLOSEOUT_CATEGORIES.TECHNICAL, completed: false },
    { id: '4', name: 'Final lien waiver received', category: integration_1.CLOSEOUT_CATEGORIES.FINANCIAL, completed: false },
    { id: '5', name: 'Final invoice approved', category: integration_1.CLOSEOUT_CATEGORIES.FINANCIAL, completed: false },
    { id: '6', name: 'Retention released', category: integration_1.CLOSEOUT_CATEGORIES.FINANCIAL, completed: false },
    { id: '7', name: 'Warranty documentation complete', category: integration_1.CLOSEOUT_CATEGORIES.CONTRACTUAL, completed: false },
    { id: '8', name: 'Closeout photos archived', category: integration_1.CLOSEOUT_CATEGORIES.ADMINISTRATIVE, completed: false },
    { id: '9', name: 'Lessons learned documented', category: integration_1.CLOSEOUT_CATEGORIES.ADMINISTRATIVE, completed: false },
    { id: '10', name: 'Project archive complete', category: integration_1.CLOSEOUT_CATEGORIES.ADMINISTRATIVE, completed: false },
];
async function generateIssueNumber(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const year = new Date().getFullYear();
    const prefix = `ISS-${year}-`;
    const latest = await prisma.issue.findFirst({
        where: {
            projectId,
            issueNumber: { startsWith: prefix },
        },
        orderBy: { issueNumber: 'desc' },
    });
    let sequence = 1;
    if (latest) {
        const parts = latest.issueNumber.split('-');
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) {
            sequence = lastSeq + 1;
        }
    }
    const padded = String(sequence).padStart(4, '0');
    return `${prefix}${padded}`;
}
// Issue Tracker
async function createIssue(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const issueNumber = await generateIssueNumber(data.projectId);
    const created = await prisma.issue.create({
        data: {
            projectId: data.projectId,
            issueNumber,
            type: data.type,
            source: data.source,
            title: data.title,
            description: data.description,
            status: integration_1.ISSUE_STATUSES.OPEN,
            priority: data.priority || integration_1.ISSUE_PRIORITIES.MEDIUM,
            activityId: data.activityId,
            assignee: data.assignee,
            dueDate: data.dueDate,
            createdBy: data.createdBy,
        },
    });
    // Notification: when an issue is created with an assignee, that
    // person gets a bell. We only fire on initial create — re-assigns
    // use updateIssue below.
    if (created.assignee && created.assignee !== data.createdBy) {
        const { createNotificationSafe } = await Promise.resolve().then(() => __importStar(require('./notifications.service')));
        await createNotificationSafe({
            userId: created.assignee,
            kind: 'issue_assigned',
            title: `Issue ${created.issueNumber} assigned to you`,
            body: created.title,
            payload: { projectId: created.projectId, issueId: created.id, issueNumber: created.issueNumber },
        });
    }
    return created;
}
async function getIssueById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.issue.findUnique({
        where: { id },
        include: { project: true },
    });
}
async function getIssuesByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.issue.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
    });
}
async function getIssuesByType(projectId, type) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.issue.findMany({
        where: { projectId, type },
        orderBy: { createdAt: 'desc' },
    });
}
async function updateIssue(id, data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.issue.findUnique({
        where: { id },
    });
    if (!existing) {
        throw new Error('Issue not found');
    }
    const updated = await prisma.issue.update({
        where: { id },
        data: {
            type: data.type,
            title: data.title,
            description: data.description,
            status: data.status,
            priority: data.priority,
            activityId: data.activityId,
            assignee: data.assignee,
            dueDate: data.dueDate,
        },
    });
    // Notification: when an issue is re-assigned to a new person,
    // notify them. We only fire when the assignee actually changed
    // and is non-empty.
    if (data.assignee !== undefined &&
        data.assignee &&
        data.assignee !== existing.assignee) {
        const { createNotificationSafe } = await Promise.resolve().then(() => __importStar(require('./notifications.service')));
        await createNotificationSafe({
            userId: data.assignee,
            kind: 'issue_assigned',
            title: `Issue ${updated.issueNumber} assigned to you`,
            body: updated.title,
            payload: { projectId: updated.projectId, issueId: updated.id, issueNumber: updated.issueNumber },
        });
    }
    return updated;
}
async function resolveIssue(id, resolvedBy) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.issue.findUnique({
        where: { id },
    });
    if (!existing) {
        throw new Error('Issue not found');
    }
    return prisma.issue.update({
        where: { id },
        data: {
            status: integration_1.ISSUE_STATUSES.RESOLVED,
            resolvedAt: new Date(),
        },
    });
}
async function appendIssueNote(input) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.issue.findUnique({ where: { id: input.issueId } });
    if (!existing) {
        throw new Error('Issue not found');
    }
    const prior = existing.notes || [];
    const next = [
        ...prior,
        {
            id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: input.text,
            author: input.author,
            createdAt: new Date().toISOString(),
        },
    ];
    return prisma.issue.update({
        where: { id: input.issueId },
        data: { notes: next },
    });
}
async function closeIssue(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.issue.findUnique({
        where: { id },
    });
    if (!existing) {
        throw new Error('Issue not found');
    }
    return prisma.issue.update({
        where: { id },
        data: {
            status: integration_1.ISSUE_STATUSES.CLOSED,
        },
    });
}
async function getIssuePdfData(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const issue = await prisma.issue.findUnique({
        where: { id },
        include: { project: true },
    });
    if (!issue) {
        throw new Error('Issue not found');
    }
    return {
        issueNumber: issue.issueNumber,
        projectName: issue.project.name,
        type: issue.type,
        source: issue.source,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        priority: issue.priority,
        assignee: issue.assignee,
        dueDate: issue.dueDate,
        resolvedAt: issue.resolvedAt,
        createdBy: issue.createdBy,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
    };
}
/**
 * Stub for voice-to-issue flow. Persists a voice memo with status 'pending'
 * so the iOS / web client can hand off audio for background transcription.
 * The actual STT + LLM extraction lives in a later sprint — for V1 the UI
 * just shows "Voice logging coming soon" and records the attempt.
 */
async function voiceToIssue(input) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const memo = await prisma.voiceMemo.create({
        data: {
            projectId: input.projectId,
            audioUrl: input.audioUrl || '',
            transcription: '',
            structuredData: client_1.Prisma.JsonNull,
            status: integration_1.VOICE_MEMO_STATUSES.PENDING,
            createdBy: input.createdBy,
        },
    });
    return {
        status: 'pending',
        memoId: memo.id,
        message: 'Voice memo recorded. Transcription will be processed in a future release.',
    };
}
async function createVoiceMemo(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.voiceMemo.create({
        data: {
            projectId: data.projectId,
            audioUrl: data.audioUrl,
            transcription: data.transcription,
            structuredData: data.structuredData,
            status: integration_1.VOICE_MEMO_STATUSES.PENDING,
            createdBy: data.createdBy,
        },
    });
}
async function processVoiceMemo(memoId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const memo = await prisma.voiceMemo.findUnique({
        where: { id: memoId },
    });
    if (!memo) {
        throw new Error('Voice memo not found');
    }
    const updated = await prisma.voiceMemo.update({
        where: { id: memoId },
        data: { status: integration_1.VOICE_MEMO_STATUSES.PROCESSED },
    });
    // If structuredData contains enough info, auto-create an issue
    const structured = memo.structuredData;
    if (structured?.type && structured?.description) {
        const issue = await createIssue({
            projectId: memo.projectId,
            type: structured.type,
            source: structured.source || integration_1.ISSUE_SOURCES.VOICE_MEMO,
            title: `Voice memo: ${memo.transcription.slice(0, 80)}`,
            description: structured.description,
            priority: structured.priority || integration_1.ISSUE_PRIORITIES.MEDIUM,
            activityId: structured.activityLink || undefined,
            assignee: structured.assignee || undefined,
            createdBy: memo.createdBy,
        });
        return { memo: updated, issue };
    }
    return { memo: updated, issue: null };
}
async function getVoiceMemosByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.voiceMemo.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
    });
}
async function getVoiceMemoById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.voiceMemo.findUnique({
        where: { id },
    });
}
// Self-Memo iOS Tool
async function createSelfMemo(projectId, userId, title, description) {
    return createIssue({
        projectId,
        type: integration_1.ISSUE_TYPES.FIELD_ISSUE,
        source: integration_1.ISSUE_SOURCES.SELF_MEMO,
        title,
        description,
        createdBy: userId,
    });
}
async function getSelfMemosByUser(userId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.issue.findMany({
        where: {
            createdBy: userId,
            source: integration_1.ISSUE_SOURCES.SELF_MEMO,
        },
        orderBy: { createdAt: 'desc' },
    });
}
// Unified Change Log
async function logChange(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.unifiedChangeLog.create({
        data: {
            projectId: data.projectId,
            module: data.module,
            changeType: data.changeType,
            description: data.description,
            affectedRecordId: data.affectedRecordId,
            affectedRecordType: data.affectedRecordType,
            changedBy: data.changedBy,
            changedAt: data.changedAt || new Date(),
        },
    });
}
async function getChangeLogByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.unifiedChangeLog.findMany({
        where: { projectId },
        orderBy: { changedAt: 'desc' },
    });
}
async function getChangeLogByModule(projectId, module) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.unifiedChangeLog.findMany({
        where: { projectId, module },
        orderBy: { changedAt: 'desc' },
    });
}
async function getChangeLogByRecord(recordId, recordType) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.unifiedChangeLog.findMany({
        where: {
            affectedRecordId: recordId,
            affectedRecordType: recordType,
        },
        orderBy: { changedAt: 'desc' },
    });
}
// Closeout Checklist
async function initializeCloseoutChecklist(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const existing = await prisma.closeoutChecklist.findFirst({
        where: { projectId },
    });
    if (existing) {
        return existing;
    }
    return prisma.closeoutChecklist.create({
        data: {
            projectId,
            items: exports.DEFAULT_CLOSEOUT_ITEMS,
            status: 'in_progress',
        },
    });
}
async function getCloseoutChecklist(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.closeoutChecklist.findFirst({
        where: { projectId },
    });
}
async function completeChecklistItem(checklistId, itemId, completedBy) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const checklist = await prisma.closeoutChecklist.findUnique({
        where: { id: checklistId },
    });
    if (!checklist) {
        throw new Error('Closeout checklist not found');
    }
    const items = checklist.items || [];
    const updatedItems = items.map((item) => {
        if (item.id === itemId) {
            return {
                ...item,
                completed: true,
                completedAt: new Date().toISOString(),
                completedBy,
            };
        }
        return item;
    });
    const allCompleted = updatedItems.every((item) => item.completed);
    return prisma.closeoutChecklist.update({
        where: { id: checklistId },
        data: {
            items: updatedItems,
            status: allCompleted ? 'complete' : 'in_progress',
        },
    });
}
async function getCloseoutProgress(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const checklist = await prisma.closeoutChecklist.findFirst({
        where: { projectId },
    });
    if (!checklist) {
        return {
            total: 0,
            completed: 0,
            percentComplete: 0,
            status: 'in_progress',
        };
    }
    const items = checklist.items || [];
    const total = items.length;
    const completed = items.filter((item) => item.completed).length;
    const percentComplete = total === 0 ? 0 : Math.round((completed / total) * 100);
    return {
        total,
        completed,
        percentComplete,
        status: checklist.status,
    };
}
//# sourceMappingURL=integration.service.js.map