export interface CreateRiskItemInput {
    projectId: string;
    description: string;
    category: string;
    probability: string;
    impact: string;
    mitigationPlan?: string;
    owner: string;
    linkedActivityId?: string;
    linkedBudgetLineId?: string;
}
export interface UpdateRiskItemInput {
    description?: string;
    category?: string;
    probability?: string;
    impact?: string;
    mitigationPlan?: string;
    owner?: string;
    status?: string;
    linkedActivityId?: string;
    linkedBudgetLineId?: string;
}
export interface SafetyIncidentData {
    incidentType: string;
    severity: number;
    recordable: boolean;
    description: string;
}
export interface RiskMatrixCell {
    probability: string;
    impact: string;
    score: number;
    color: 'green' | 'amber' | 'red';
    risks: {
        id: string;
        description: string;
        owner: string;
        status: string;
    }[];
}
export interface RiskMatrixResult {
    projectId: string;
    cells: RiskMatrixCell[];
    highRisks: {
        id: string;
        description: string;
        owner: string;
        status: string;
        score: number;
    }[];
    totalOpen: number;
}
export declare function createRiskItem(data: CreateRiskItemInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    source: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
}>;
export declare function getRiskItemById(id: string): Promise<({
    project: {
        id: string;
        name: string;
        status: string;
        orgId: string;
        structureType: string;
        structureLocked: boolean;
        startDate: Date | null;
        endDate: Date | null;
        activeMilestones: import("@prisma/client/runtime/library").JsonValue | null;
        superintendentAssignments: import("@prisma/client/runtime/library").JsonValue | null;
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
    source: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
}) | null>;
export declare function getRiskItemsByProject(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    source: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
}[]>;
export declare function getOpenRisksByProject(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    source: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
}[]>;
export declare function updateRiskItem(id: string, data: UpdateRiskItemInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    source: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
}>;
export declare function closeRiskItem(id: string, notes?: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    source: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
}>;
export declare function acceptRiskItem(id: string, notes?: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    source: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
}>;
export declare function mitigateRiskItem(id: string, mitigationPlan: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    source: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
}>;
export declare function getRiskMatrix(projectId: string): Promise<RiskMatrixResult>;
export declare function getRiskDashboardStatus(projectId: string): Promise<{
    status: 'green' | 'amber' | 'red';
    summary: string;
    count: number;
}>;
export declare function autoCreateRiskFromSafetyIncident(projectId: string, incidentData: SafetyIncidentData, incidentReference: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    description: string;
    source: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
}>;
//# sourceMappingURL=risk.service.d.ts.map