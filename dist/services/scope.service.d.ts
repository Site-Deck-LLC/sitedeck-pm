import { Prisma } from '@prisma/client';
export interface CreateChangeOrderInput {
    projectId: string;
    date: Date;
    description: string;
    dollarValue?: number;
    scheduleImpact?: number;
    affectedActivityIds?: string[];
}
export interface UpdateChangeOrderInput {
    description?: string;
    dollarValue?: number;
    scheduleImpact?: number;
    affectedActivityIds?: string[];
}
export declare function createScopeStatement(projectId: string, content: string, createdBy: string): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    createdBy: string;
    content: string;
    version: number;
}>;
export declare function updateScopeStatement(id: string, content: string, createdBy: string): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    createdBy: string;
    content: string;
    version: number;
}>;
export declare function getScopeStatementsByProject(projectId: string): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    createdBy: string;
    content: string;
    version: number;
}[]>;
export declare function getLatestScopeStatement(projectId: string): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    createdBy: string;
    content: string;
    version: number;
} | null>;
export declare function getScopeStatementById(id: string): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    createdBy: string;
    content: string;
    version: number;
} | null>;
export declare function createChangeOrder(data: CreateChangeOrderInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    coNumber: string;
    date: Date;
    dollarValue: Prisma.Decimal | null;
    scheduleImpact: number | null;
    approver: string | null;
    approvedAt: Date | null;
    affectedActivityIds: Prisma.JsonValue | null;
}>;
export declare function getChangeOrderById(id: string): Promise<({
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
    coNumber: string;
    date: Date;
    dollarValue: Prisma.Decimal | null;
    scheduleImpact: number | null;
    approver: string | null;
    approvedAt: Date | null;
    affectedActivityIds: Prisma.JsonValue | null;
}) | null>;
export declare function getChangeOrdersByProject(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    coNumber: string;
    date: Date;
    dollarValue: Prisma.Decimal | null;
    scheduleImpact: number | null;
    approver: string | null;
    approvedAt: Date | null;
    affectedActivityIds: Prisma.JsonValue | null;
}[]>;
export declare function approveChangeOrder(id: string, approver: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    coNumber: string;
    date: Date;
    dollarValue: Prisma.Decimal | null;
    scheduleImpact: number | null;
    approver: string | null;
    approvedAt: Date | null;
    affectedActivityIds: Prisma.JsonValue | null;
}>;
export declare function rejectChangeOrder(id: string, approver: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    coNumber: string;
    date: Date;
    dollarValue: Prisma.Decimal | null;
    scheduleImpact: number | null;
    approver: string | null;
    approvedAt: Date | null;
    affectedActivityIds: Prisma.JsonValue | null;
}>;
export interface ChangeOrderPdfData {
    coNumber: string;
    date: Date;
    description: string;
    status: string;
    dollarValue: number | null;
    scheduleImpact: number | null;
    approver: string | null;
    projectName: string;
}
export declare function getChangeOrderPdfData(id: string): Promise<ChangeOrderPdfData>;
//# sourceMappingURL=scope.service.d.ts.map