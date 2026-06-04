import { Prisma } from '@prisma/client';
export interface CreateChangeRequestInput {
    projectId: string;
    activityId: string;
    requestedBy: string;
    reasonCode: string;
    proposedStart?: Date;
    proposedEnd?: Date;
    impactDescription?: string;
}
export declare function createChangeRequest(data: CreateChangeRequestInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    activityId: string;
    requestedBy: string;
    reasonCode: string;
    proposedStart: Date | null;
    proposedEnd: Date | null;
    impactDescription: string | null;
    criticalPathImpact: number | null;
    decisionNotes: string | null;
    decidedBy: string | null;
    decidedAt: Date | null;
}>;
export declare function getChangeRequestById(id: string): Promise<({
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
    activityId: string;
    requestedBy: string;
    reasonCode: string;
    proposedStart: Date | null;
    proposedEnd: Date | null;
    impactDescription: string | null;
    criticalPathImpact: number | null;
    decisionNotes: string | null;
    decidedBy: string | null;
    decidedAt: Date | null;
}) | null>;
export declare function getChangeRequestsByProject(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    activityId: string;
    requestedBy: string;
    reasonCode: string;
    proposedStart: Date | null;
    proposedEnd: Date | null;
    impactDescription: string | null;
    criticalPathImpact: number | null;
    decisionNotes: string | null;
    decidedBy: string | null;
    decidedAt: Date | null;
}[]>;
export declare function calculateImpact(requestId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    activityId: string;
    requestedBy: string;
    reasonCode: string;
    proposedStart: Date | null;
    proposedEnd: Date | null;
    impactDescription: string | null;
    criticalPathImpact: number | null;
    decisionNotes: string | null;
    decidedBy: string | null;
    decidedAt: Date | null;
}>;
export declare function decideChangeRequest(requestId: string, decision: 'approved' | 'modified' | 'rejected', decidedBy: string, notes?: string, modifiedDates?: {
    startDate?: Date;
    endDate?: Date;
}): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    activityId: string;
    requestedBy: string;
    reasonCode: string;
    proposedStart: Date | null;
    proposedEnd: Date | null;
    impactDescription: string | null;
    criticalPathImpact: number | null;
    decisionNotes: string | null;
    decidedBy: string | null;
    decidedAt: Date | null;
}>;
//# sourceMappingURL=change-request.service.d.ts.map