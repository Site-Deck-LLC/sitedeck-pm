export interface UpsertEquipmentInput {
    projectId: string;
    externalId: string;
    name: string;
    type?: string;
    currentActivityId?: string;
}
export interface RecordEquipmentUsageInput {
    projectId: string;
    externalId: string;
    hours: number;
    date: Date;
}
export interface EquipmentCostSummary {
    budgetLineId: string;
    totalAmount: number;
    transactionCount: number;
}
export interface LaborCostSummary {
    budgetLineId: string;
    totalAmount: number;
    transactionCount: number;
}
export interface IdleEquipmentItem {
    equipmentId: string;
    externalId: string;
    name: string;
    activityId: string;
    activityName: string;
    daysIdle: number;
}
export declare function upsertEquipment(data: UpsertEquipmentInput): Promise<{
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
}>;
export declare function recordEquipmentUsage(data: RecordEquipmentUsageInput): Promise<{
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
}>;
export declare function getEquipmentByProject(projectId: string): Promise<{
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
}[]>;
export declare function getEquipmentByExternalId(projectId: string, externalId: string): Promise<{
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
} | null>;
export declare function assignEquipmentToActivity(projectId: string, externalId: string, activityId: string): Promise<{
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
}>;
export declare function unassignEquipmentFromActivity(projectId: string, externalId: string): Promise<{
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
}>;
export declare function getEquipmentCostSummary(projectId: string): Promise<EquipmentCostSummary[]>;
export declare function getLaborCostSummary(projectId: string): Promise<LaborCostSummary[]>;
export declare function getIdleEquipmentOnCriticalPath(projectId: string): Promise<IdleEquipmentItem[]>;
//# sourceMappingURL=resource.service.d.ts.map