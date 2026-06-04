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
    updatedAt: Date;
    projectId: string;
    description: string;
    createdBy: string;
    activityId: string | null;
    type: string;
    source: string;
    issueNumber: string;
    title: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
}>;
export declare function getIssueById(id: string): Promise<({
    project: {
        id: string;
        name: string;
        status: string;
        orgId: string;
        structureType: string;
        structureLocked: boolean;
        startDate: Date | null;
        endDate: Date | null;
        activeMilestones: Prisma.JsonValue | null;
        superintendentAssignments: Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    };
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    createdBy: string;
    activityId: string | null;
    type: string;
    source: string;
    issueNumber: string;
    title: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
}) | null>;
export declare function getIssuesByProject(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    createdBy: string;
    activityId: string | null;
    type: string;
    source: string;
    issueNumber: string;
    title: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
}[]>;
export declare function getIssuesByType(projectId: string, type: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    createdBy: string;
    activityId: string | null;
    type: string;
    source: string;
    issueNumber: string;
    title: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
}[]>;
export declare function updateIssue(id: string, data: UpdateIssueInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    createdBy: string;
    activityId: string | null;
    type: string;
    source: string;
    issueNumber: string;
    title: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
}>;
export declare function resolveIssue(id: string, resolvedBy: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    createdBy: string;
    activityId: string | null;
    type: string;
    source: string;
    issueNumber: string;
    title: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
}>;
export declare function closeIssue(id: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    createdBy: string;
    activityId: string | null;
    type: string;
    source: string;
    issueNumber: string;
    title: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
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
export declare function createVoiceMemo(data: CreateVoiceMemoInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
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
        updatedAt: Date;
        projectId: string;
        createdBy: string;
        audioUrl: string;
        transcription: string;
        structuredData: Prisma.JsonValue | null;
    };
    issue: {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        description: string;
        createdBy: string;
        activityId: string | null;
        type: string;
        source: string;
        issueNumber: string;
        title: string;
        priority: string;
        assignee: string | null;
        dueDate: Date | null;
        resolvedAt: Date | null;
    };
} | {
    memo: {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
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
    updatedAt: Date;
    projectId: string;
    createdBy: string;
    audioUrl: string;
    transcription: string;
    structuredData: Prisma.JsonValue | null;
}[]>;
export declare function getVoiceMemoById(id: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    createdBy: string;
    audioUrl: string;
    transcription: string;
    structuredData: Prisma.JsonValue | null;
} | null>;
export declare function createSelfMemo(projectId: string, userId: string, title: string, description: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    createdBy: string;
    activityId: string | null;
    type: string;
    source: string;
    issueNumber: string;
    title: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
}>;
export declare function getSelfMemosByUser(userId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    createdBy: string;
    activityId: string | null;
    type: string;
    source: string;
    issueNumber: string;
    title: string;
    priority: string;
    assignee: string | null;
    dueDate: Date | null;
    resolvedAt: Date | null;
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
    updatedAt: Date;
    projectId: string;
    items: Prisma.JsonValue;
}>;
export declare function getCloseoutChecklist(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    items: Prisma.JsonValue;
} | null>;
export declare function completeChecklistItem(checklistId: string, itemId: string, completedBy: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    items: Prisma.JsonValue;
}>;
export declare function getCloseoutProgress(projectId: string): Promise<{
    total: number;
    completed: number;
    percentComplete: number;
    status: string;
}>;
//# sourceMappingURL=integration.service.d.ts.map