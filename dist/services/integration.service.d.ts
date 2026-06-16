import { Prisma } from '@prisma/client';
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
export declare const DEFAULT_CLOSEOUT_ITEMS: CloseoutItem[];
export declare function createIssue(data: CreateIssueInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    type: string;
    description: string;
    activityId: string | null;
    createdBy: string;
    title: string;
    issueNumber: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
    notes: Prisma.JsonValue | null;
}>;
export declare function getIssueById(id: string): Promise<({
    project: {
        orgId: string;
        id: string;
        status: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        structureType: string;
        structureLocked: boolean;
        startDate: Date | null;
        endDate: Date | null;
        activeMilestones: Prisma.JsonValue | null;
        superintendentAssignments: Prisma.JsonValue | null;
        contractValue: Prisma.Decimal | null;
        trirTarget: number | null;
        latitude: number | null;
        longitude: number | null;
        city: string | null;
        state: string | null;
    };
} & {
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    type: string;
    description: string;
    activityId: string | null;
    createdBy: string;
    title: string;
    issueNumber: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
    notes: Prisma.JsonValue | null;
}) | null>;
export declare function getIssuesByProject(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    type: string;
    description: string;
    activityId: string | null;
    createdBy: string;
    title: string;
    issueNumber: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
    notes: Prisma.JsonValue | null;
}[]>;
export declare function getIssuesByType(projectId: string, type: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    type: string;
    description: string;
    activityId: string | null;
    createdBy: string;
    title: string;
    issueNumber: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
    notes: Prisma.JsonValue | null;
}[]>;
export declare function updateIssue(id: string, data: UpdateIssueInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    type: string;
    description: string;
    activityId: string | null;
    createdBy: string;
    title: string;
    issueNumber: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
    notes: Prisma.JsonValue | null;
}>;
export declare function resolveIssue(id: string, resolvedBy: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    type: string;
    description: string;
    activityId: string | null;
    createdBy: string;
    title: string;
    issueNumber: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
    notes: Prisma.JsonValue | null;
}>;
export interface AppendIssueNoteInput {
    issueId: string;
    text: string;
    author: string;
}
export declare function appendIssueNote(input: AppendIssueNoteInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    type: string;
    description: string;
    activityId: string | null;
    createdBy: string;
    title: string;
    issueNumber: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
    notes: Prisma.JsonValue | null;
}>;
export declare function closeIssue(id: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    type: string;
    description: string;
    activityId: string | null;
    createdBy: string;
    title: string;
    issueNumber: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
    notes: Prisma.JsonValue | null;
}>;
export declare function getIssuePdfData(id: string): Promise<{
    issueNumber: string;
    projectName: string;
    type: string;
    source: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}>;
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
export declare function voiceToIssue(input: VoiceToIssueInput): Promise<VoiceToIssueResult>;
export declare function createVoiceMemo(data: CreateVoiceMemoInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    createdBy: string;
    audioUrl: string;
    transcription: string;
    structuredData: Prisma.JsonValue | null;
}>;
export declare function processVoiceMemo(memoId: string): Promise<{
    memo: {
        id: string;
        status: string;
        createdAt: Date;
        projectId: string;
        updatedAt: Date;
        createdBy: string;
        audioUrl: string;
        transcription: string;
        structuredData: Prisma.JsonValue | null;
    };
    issue: {
        id: string;
        status: string;
        createdAt: Date;
        projectId: string;
        updatedAt: Date;
        source: string;
        type: string;
        description: string;
        activityId: string | null;
        createdBy: string;
        title: string;
        issueNumber: string;
        priority: string;
        assignee: string | null;
        dueDate: Date | null;
        resolvedAt: Date | null;
        notes: Prisma.JsonValue | null;
    };
} | {
    memo: {
        id: string;
        status: string;
        createdAt: Date;
        projectId: string;
        updatedAt: Date;
        createdBy: string;
        audioUrl: string;
        transcription: string;
        structuredData: Prisma.JsonValue | null;
    };
    issue: null;
}>;
export declare function getVoiceMemosByProject(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    createdBy: string;
    audioUrl: string;
    transcription: string;
    structuredData: Prisma.JsonValue | null;
}[]>;
export declare function getVoiceMemoById(id: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    createdBy: string;
    audioUrl: string;
    transcription: string;
    structuredData: Prisma.JsonValue | null;
} | null>;
export declare function createSelfMemo(projectId: string, userId: string, title: string, description: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    type: string;
    description: string;
    activityId: string | null;
    createdBy: string;
    title: string;
    issueNumber: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
    notes: Prisma.JsonValue | null;
}>;
export declare function getSelfMemosByUser(userId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    type: string;
    description: string;
    activityId: string | null;
    createdBy: string;
    title: string;
    issueNumber: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
    notes: Prisma.JsonValue | null;
}[]>;
export declare function logChange(data: LogChangeInput): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    description: string;
    module: string;
    changeType: string;
    affectedRecordId: string | null;
    affectedRecordType: string | null;
    changedBy: string;
    changedAt: Date;
}>;
export declare function getChangeLogByProject(projectId: string): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    description: string;
    module: string;
    changeType: string;
    affectedRecordId: string | null;
    affectedRecordType: string | null;
    changedBy: string;
    changedAt: Date;
}[]>;
export declare function getChangeLogByModule(projectId: string, module: string): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    description: string;
    module: string;
    changeType: string;
    affectedRecordId: string | null;
    affectedRecordType: string | null;
    changedBy: string;
    changedAt: Date;
}[]>;
export declare function getChangeLogByRecord(recordId: string, recordType: string): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    description: string;
    module: string;
    changeType: string;
    affectedRecordId: string | null;
    affectedRecordType: string | null;
    changedBy: string;
    changedAt: Date;
}[]>;
export declare function initializeCloseoutChecklist(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    items: Prisma.JsonValue;
}>;
export declare function getCloseoutChecklist(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    items: Prisma.JsonValue;
} | null>;
export declare function completeChecklistItem(checklistId: string, itemId: string, completedBy: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    items: Prisma.JsonValue;
}>;
export declare function getCloseoutProgress(projectId: string): Promise<{
    total: number;
    completed: number;
    percentComplete: number;
    status: string;
}>;
//# sourceMappingURL=integration.service.d.ts.map