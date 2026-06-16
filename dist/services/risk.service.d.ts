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
    projectId: string;
    updatedAt: Date;
    source: string;
    description: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
    recordable: boolean;
}>;
export declare function getRiskItemById(id: string): Promise<({
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
        activeMilestones: import("@prisma/client/runtime/library").JsonValue | null;
        superintendentAssignments: import("@prisma/client/runtime/library").JsonValue | null;
        contractValue: import("@prisma/client/runtime/library").Decimal | null;
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
    description: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
    recordable: boolean;
}) | null>;
export declare function getRiskItemsByProject(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    description: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
    recordable: boolean;
}[]>;
export declare function getOpenRisksByProject(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    description: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
    recordable: boolean;
}[]>;
export declare function updateRiskItem(id: string, data: UpdateRiskItemInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    description: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
    recordable: boolean;
}>;
export declare function closeRiskItem(id: string, notes?: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    description: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
    recordable: boolean;
}>;
export declare function acceptRiskItem(id: string, notes?: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    description: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
    recordable: boolean;
}>;
export declare function mitigateRiskItem(id: string, mitigationPlan: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    source: string;
    description: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
    recordable: boolean;
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
    projectId: string;
    updatedAt: Date;
    source: string;
    description: string;
    category: string;
    probability: string;
    impact: string;
    score: number;
    mitigationPlan: string | null;
    owner: string;
    linkedActivityId: string | null;
    linkedBudgetLineId: string | null;
    incidentReference: string | null;
    recordable: boolean;
}>;
//# sourceMappingURL=risk.service.d.ts.map