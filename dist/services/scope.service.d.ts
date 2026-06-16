import { Prisma } from '@prisma/client';
import { RecalculateBaselineResult } from './cost.service';
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
    projectId: string;
    updatedAt: Date;
    description: string;
    date: Date;
    coNumber: string;
    dollarValue: Prisma.Decimal | null;
    scheduleImpact: number | null;
    approver: string | null;
    approvedAt: Date | null;
    affectedActivityIds: Prisma.JsonValue | null;
}>;
export declare function getChangeOrderById(id: string): Promise<({
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
    description: string;
    date: Date;
    coNumber: string;
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
    projectId: string;
    updatedAt: Date;
    description: string;
    date: Date;
    coNumber: string;
    dollarValue: Prisma.Decimal | null;
    scheduleImpact: number | null;
    approver: string | null;
    approvedAt: Date | null;
    affectedActivityIds: Prisma.JsonValue | null;
}[]>;
export declare function approveChangeOrder(id: string, approver: string): Promise<{
    changeOrder: any;
    baseline: RecalculateBaselineResult;
}>;
export declare function rejectChangeOrder(id: string, approver: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    description: string;
    date: Date;
    coNumber: string;
    dollarValue: Prisma.Decimal | null;
    scheduleImpact: number | null;
    approver: string | null;
    approvedAt: Date | null;
    affectedActivityIds: Prisma.JsonValue | null;
}>;
export declare function submitChangeOrder(id: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    description: string;
    date: Date;
    coNumber: string;
    dollarValue: Prisma.Decimal | null;
    scheduleImpact: number | null;
    approver: string | null;
    approvedAt: Date | null;
    affectedActivityIds: Prisma.JsonValue | null;
}>;
export declare function updateChangeOrder(id: string, data: UpdateChangeOrderInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    description: string;
    date: Date;
    coNumber: string;
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