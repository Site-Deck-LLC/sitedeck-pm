import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import {
  ISSUE_TYPES,
  ISSUE_SOURCES,
  ISSUE_STATUSES,
  ISSUE_PRIORITIES,
  VOICE_MEMO_STATUSES,
  CLOSEOUT_CATEGORIES,
} from '../constants/integration';

export interface CreateIssueInput {
  projectId: string;
  type: string;
  source: string;
  title: string;
  description: string;
  priority?: string;
  activityId?: string;
  assignee?: string;
  dueDate?: Date;
  createdBy: string;
}

export interface UpdateIssueInput {
  type?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  activityId?: string | null;
  assignee?: string | null;
  dueDate?: Date | null;
}

export interface CreateVoiceMemoInput {
  projectId: string;
  audioUrl: string;
  transcription: string;
  structuredData?: Prisma.InputJsonValue;
  createdBy: string;
}

export interface LogChangeInput {
  projectId: string;
  module: string;
  changeType: string;
  description: string;
  affectedRecordId?: string;
  affectedRecordType?: string;
  changedBy: string;
  changedAt?: Date;
}

export interface CloseoutItem {
  id: string;
  name: string;
  category: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export const DEFAULT_CLOSEOUT_ITEMS: CloseoutItem[] = [
  { id: '1', name: 'Punch list complete', category: CLOSEOUT_CATEGORIES.TECHNICAL, completed: false },
  { id: '2', name: 'O&M manuals submitted', category: CLOSEOUT_CATEGORIES.TECHNICAL, completed: false },
  { id: '3', name: 'As-builts submitted', category: CLOSEOUT_CATEGORIES.TECHNICAL, completed: false },
  { id: '4', name: 'Final lien waiver received', category: CLOSEOUT_CATEGORIES.FINANCIAL, completed: false },
  { id: '5', name: 'Final invoice approved', category: CLOSEOUT_CATEGORIES.FINANCIAL, completed: false },
  { id: '6', name: 'Retention released', category: CLOSEOUT_CATEGORIES.FINANCIAL, completed: false },
  { id: '7', name: 'Warranty documentation complete', category: CLOSEOUT_CATEGORIES.CONTRACTUAL, completed: false },
  { id: '8', name: 'Closeout photos archived', category: CLOSEOUT_CATEGORIES.ADMINISTRATIVE, completed: false },
  { id: '9', name: 'Lessons learned documented', category: CLOSEOUT_CATEGORIES.ADMINISTRATIVE, completed: false },
  { id: '10', name: 'Project archive complete', category: CLOSEOUT_CATEGORIES.ADMINISTRATIVE, completed: false },
];

async function generateIssueNumber(projectId: string): Promise<string> {
  const prisma = getPrismaClient();
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

export async function createIssue(data: CreateIssueInput) {
  const prisma = getPrismaClient();
  const issueNumber = await generateIssueNumber(data.projectId);

  const created = await prisma.issue.create({
    data: {
      projectId: data.projectId,
      issueNumber,
      type: data.type,
      source: data.source,
      title: data.title,
      description: data.description,
      status: ISSUE_STATUSES.OPEN,
      priority: data.priority || ISSUE_PRIORITIES.MEDIUM,
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
    const { createNotificationSafe } = await import('./notifications.service');
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

export async function getIssueById(id: string) {
  const prisma = getPrismaClient();
  return prisma.issue.findUnique({
    where: { id },
    include: { project: true },
  });
}

export async function getIssuesByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.issue.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getIssuesByType(projectId: string, type: string) {
  const prisma = getPrismaClient();
  return prisma.issue.findMany({
    where: { projectId, type },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateIssue(id: string, data: UpdateIssueInput) {
  const prisma = getPrismaClient();
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
  if (
    data.assignee !== undefined &&
    data.assignee &&
    data.assignee !== existing.assignee
  ) {
    const { createNotificationSafe } = await import('./notifications.service');
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

export async function resolveIssue(id: string, resolvedBy: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.issue.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new Error('Issue not found');
  }

  return prisma.issue.update({
    where: { id },
    data: {
      status: ISSUE_STATUSES.RESOLVED,
      resolvedAt: new Date(),
    },
  });
}

export interface AppendIssueNoteInput {
  issueId: string;
  text: string;
  author: string;
}

export async function appendIssueNote(input: AppendIssueNoteInput) {
  const prisma = getPrismaClient();
  const existing = await prisma.issue.findUnique({ where: { id: input.issueId } });
  if (!existing) {
    throw new Error('Issue not found');
  }

  const prior = (existing.notes as any) || [];
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
    data: { notes: next as Prisma.InputJsonValue },
  });
}

export async function closeIssue(id: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.issue.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new Error('Issue not found');
  }

  return prisma.issue.update({
    where: { id },
    data: {
      status: ISSUE_STATUSES.CLOSED,
    },
  });
}

export async function getIssuePdfData(id: string) {
  const prisma = getPrismaClient();
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

// Voice-to-Issue

export interface VoiceToIssueInput {
  projectId: string;
  audioBlob?: Buffer;
  audioUrl?: string;
  durationSeconds?: number;
  createdBy: string;
}

export interface VoiceToIssueResult {
  status: 'pending' | 'unsupported';
  memoId?: string;
  message: string;
}

/**
 * Stub for voice-to-issue flow. Persists a voice memo with status 'pending'
 * so the iOS / web client can hand off audio for background transcription.
 * The actual STT + LLM extraction lives in a later sprint — for V1 the UI
 * just shows "Voice logging coming soon" and records the attempt.
 */
export async function voiceToIssue(input: VoiceToIssueInput): Promise<VoiceToIssueResult> {
  const prisma = getPrismaClient();
  const memo = await prisma.voiceMemo.create({
    data: {
      projectId: input.projectId,
      audioUrl: input.audioUrl || '',
      transcription: '',
      structuredData: Prisma.JsonNull,
      status: VOICE_MEMO_STATUSES.PENDING,
      createdBy: input.createdBy,
    },
  });
  return {
    status: 'pending',
    memoId: memo.id,
    message: 'Voice memo recorded. Transcription will be processed in a future release.',
  };
}

export async function createVoiceMemo(data: CreateVoiceMemoInput) {
  const prisma = getPrismaClient();
  return prisma.voiceMemo.create({
    data: {
      projectId: data.projectId,
      audioUrl: data.audioUrl,
      transcription: data.transcription,
      structuredData: data.structuredData,
      status: VOICE_MEMO_STATUSES.PENDING,
      createdBy: data.createdBy,
    },
  });
}

export async function processVoiceMemo(memoId: string) {
  const prisma = getPrismaClient();
  const memo = await prisma.voiceMemo.findUnique({
    where: { id: memoId },
  });
  if (!memo) {
    throw new Error('Voice memo not found');
  }

  const updated = await prisma.voiceMemo.update({
    where: { id: memoId },
    data: { status: VOICE_MEMO_STATUSES.PROCESSED },
  });

  // If structuredData contains enough info, auto-create an issue
  const structured = memo.structuredData as
    | {
        type?: string;
        source?: string;
        description?: string;
        activityLink?: string;
        assignee?: string;
        priority?: string;
      }
    | null
    | undefined;

  if (structured?.type && structured?.description) {
    const issue = await createIssue({
      projectId: memo.projectId,
      type: structured.type,
      source: structured.source || ISSUE_SOURCES.VOICE_MEMO,
      title: `Voice memo: ${memo.transcription.slice(0, 80)}`,
      description: structured.description,
      priority: structured.priority || ISSUE_PRIORITIES.MEDIUM,
      activityId: structured.activityLink || undefined,
      assignee: structured.assignee || undefined,
      createdBy: memo.createdBy,
    });
    return { memo: updated, issue };
  }

  return { memo: updated, issue: null };
}

export async function getVoiceMemosByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.voiceMemo.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getVoiceMemoById(id: string) {
  const prisma = getPrismaClient();
  return prisma.voiceMemo.findUnique({
    where: { id },
  });
}

// Self-Memo iOS Tool

export async function createSelfMemo(
  projectId: string,
  userId: string,
  title: string,
  description: string
) {
  return createIssue({
    projectId,
    type: ISSUE_TYPES.FIELD_ISSUE,
    source: ISSUE_SOURCES.SELF_MEMO,
    title,
    description,
    createdBy: userId,
  });
}

export async function getSelfMemosByUser(userId: string) {
  const prisma = getPrismaClient();
  return prisma.issue.findMany({
    where: {
      createdBy: userId,
      source: ISSUE_SOURCES.SELF_MEMO,
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Unified Change Log

export async function logChange(data: LogChangeInput) {
  const prisma = getPrismaClient();
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

export async function getChangeLogByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.unifiedChangeLog.findMany({
    where: { projectId },
    orderBy: { changedAt: 'desc' },
  });
}

export async function getChangeLogByModule(projectId: string, module: string) {
  const prisma = getPrismaClient();
  return prisma.unifiedChangeLog.findMany({
    where: { projectId, module },
    orderBy: { changedAt: 'desc' },
  });
}

export async function getChangeLogByRecord(recordId: string, recordType: string) {
  const prisma = getPrismaClient();
  return prisma.unifiedChangeLog.findMany({
    where: {
      affectedRecordId: recordId,
      affectedRecordType: recordType,
    },
    orderBy: { changedAt: 'desc' },
  });
}

// Closeout Checklist

export async function initializeCloseoutChecklist(projectId: string) {
  const prisma = getPrismaClient();

  const existing = await prisma.closeoutChecklist.findFirst({
    where: { projectId },
  });
  if (existing) {
    return existing;
  }

  return prisma.closeoutChecklist.create({
    data: {
      projectId,
      items: DEFAULT_CLOSEOUT_ITEMS as unknown as Prisma.InputJsonValue,
      status: 'in_progress',
    },
  });
}

export async function getCloseoutChecklist(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.closeoutChecklist.findFirst({
    where: { projectId },
  });
}

export async function completeChecklistItem(
  checklistId: string,
  itemId: string,
  completedBy: string
) {
  const prisma = getPrismaClient();
  const checklist = await prisma.closeoutChecklist.findUnique({
    where: { id: checklistId },
  });
  if (!checklist) {
    throw new Error('Closeout checklist not found');
  }

  const items = (checklist.items as CloseoutItem[] | null) || [];
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
      items: updatedItems as unknown as Prisma.InputJsonValue,
      status: allCompleted ? 'complete' : 'in_progress',
    },
  });
}

export async function getCloseoutProgress(projectId: string) {
  const prisma = getPrismaClient();
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

  const items = (checklist.items as CloseoutItem[] | null) || [];
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
