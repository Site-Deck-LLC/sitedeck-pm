import { Prisma } from '@prisma/client';
export interface UpsertEquipmentInput {
    projectId: string;
    externalId: string;
    name: string;
    type?: string;
    currentActivityId?: string;
}
export interface CreateEquipmentInput {
    projectId: string;
    name: string;
    type?: string;
    dailyRate: number;
    isOwned: boolean;
    serialNumber?: string;
    vendor?: string;
    calDueDate?: Date | null;
    externalId?: string;
}
export interface UpdateEquipmentInput {
    name?: string;
    type?: string;
    dailyRate?: number;
    isOwned?: boolean;
    serialNumber?: string | null;
    vendor?: string | null;
    calDueDate?: Date | null;
    status?: string;
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
    status: string;
    createdAt: Date;
    name: string;
    projectId: string;
    updatedAt: Date;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
    dailyRate: Prisma.Decimal | null;
    isOwned: boolean;
    serialNumber: string | null;
    vendor: string | null;
    calDueDate: Date | null;
}>;
export declare function recordEquipmentUsage(data: RecordEquipmentUsageInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    projectId: string;
    updatedAt: Date;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
    dailyRate: Prisma.Decimal | null;
    isOwned: boolean;
    serialNumber: string | null;
    vendor: string | null;
    calDueDate: Date | null;
}>;
export declare function getEquipmentByProject(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    projectId: string;
    updatedAt: Date;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
    dailyRate: Prisma.Decimal | null;
    isOwned: boolean;
    serialNumber: string | null;
    vendor: string | null;
    calDueDate: Date | null;
}[]>;
export declare function getEquipmentByExternalId(projectId: string, externalId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    projectId: string;
    updatedAt: Date;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
    dailyRate: Prisma.Decimal | null;
    isOwned: boolean;
    serialNumber: string | null;
    vendor: string | null;
    calDueDate: Date | null;
} | null>;
export declare function assignEquipmentToActivity(projectId: string, externalId: string, activityId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    projectId: string;
    updatedAt: Date;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
    dailyRate: Prisma.Decimal | null;
    isOwned: boolean;
    serialNumber: string | null;
    vendor: string | null;
    calDueDate: Date | null;
}>;
export declare function unassignEquipmentFromActivity(projectId: string, externalId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    projectId: string;
    updatedAt: Date;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
    dailyRate: Prisma.Decimal | null;
    isOwned: boolean;
    serialNumber: string | null;
    vendor: string | null;
    calDueDate: Date | null;
}>;
export declare function getEquipmentCostSummary(projectId: string): Promise<EquipmentCostSummary[]>;
export declare function getLaborCostSummary(projectId: string): Promise<LaborCostSummary[]>;
export interface EquipmentDashboardSummary {
    totalCount: number;
    activeCount: number;
    idleCount: number;
    totalHours: number;
    estimatedDailyCost: number;
}
export declare function getEquipmentDashboardSummary(projectId: string): Promise<EquipmentDashboardSummary>;
export declare function setEquipmentDailyRate(projectId: string, externalId: string, dailyRate: number): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    projectId: string;
    updatedAt: Date;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
    dailyRate: Prisma.Decimal | null;
    isOwned: boolean;
    serialNumber: string | null;
    vendor: string | null;
    calDueDate: Date | null;
}>;
export interface AttendanceDetail {
    presentCount?: number;
    absentCount?: number;
    lateCount?: number;
    notes?: string;
    affectedActivities?: string[];
}
export declare function upsertAttendance(projectId: string, date: Date, workerCount: number, hours: number, detail?: AttendanceDetail): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    notes: string | null;
    date: Date;
    workerCount: number;
    hours: number;
    presentCount: number | null;
    absentCount: number | null;
    lateCount: number | null;
    affectedActivities: string[];
}>;
export declare function getAttendanceForDate(projectId: string, date: Date): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    notes: string | null;
    date: Date;
    workerCount: number;
    hours: number;
    presentCount: number | null;
    absentCount: number | null;
    lateCount: number | null;
    affectedActivities: string[];
} | null>;
export declare function getAttendanceForProject(projectId: string, startDate: Date, endDate: Date): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    updatedAt: Date;
    notes: string | null;
    date: Date;
    workerCount: number;
    hours: number;
    presentCount: number | null;
    absentCount: number | null;
    lateCount: number | null;
    affectedActivities: string[];
}[]>;
export declare function getIdleEquipmentOnCriticalPath(projectId: string): Promise<IdleEquipmentItem[]>;
export interface CrewStatus {
    plannedCrewToday: number;
    confirmedPresent: number;
    absentCount: number;
    lateCount: number;
    crewGapPct: number;
    gapStatus: 'green' | 'amber' | 'red';
    criticalPathImpacted: boolean;
    equipmentOnSite: number;
    equipmentIdle: number;
    equipmentDailyBurn: number;
    equipmentBudgetRate: number;
}
export declare function getCrewStatus(projectId: string): Promise<CrewStatus>;
export interface EquipmentStatusLogInput {
    equipmentId: string;
    date: Date;
    status: string;
    hours: number;
    notes?: string;
    loggedBy?: string;
}
export declare function logEquipmentStatus(input: EquipmentStatusLogInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    notes: string | null;
    date: Date;
    hours: number;
    loggedBy: string | null;
    equipmentId: string;
}>;
export declare function getEquipmentStatusLog(projectId: string, startDate: Date, endDate: Date): Promise<({
    equipment: {
        id: string;
        name: string;
        externalId: string;
    };
} & {
    id: string;
    status: string;
    createdAt: Date;
    notes: string | null;
    date: Date;
    hours: number;
    loggedBy: string | null;
    equipmentId: string;
})[]>;
export declare function createEquipment(data: CreateEquipmentInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    projectId: string;
    updatedAt: Date;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
    dailyRate: Prisma.Decimal | null;
    isOwned: boolean;
    serialNumber: string | null;
    vendor: string | null;
    calDueDate: Date | null;
}>;
export declare function getEquipmentById(equipmentId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    projectId: string;
    updatedAt: Date;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
    dailyRate: Prisma.Decimal | null;
    isOwned: boolean;
    serialNumber: string | null;
    vendor: string | null;
    calDueDate: Date | null;
} | null>;
export declare function updateEquipment(equipmentId: string, data: UpdateEquipmentInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    projectId: string;
    updatedAt: Date;
    type: string | null;
    externalId: string;
    currentActivityId: string | null;
    lastUsageDate: Date | null;
    totalHours: number;
    dailyRate: Prisma.Decimal | null;
    isOwned: boolean;
    serialNumber: string | null;
    vendor: string | null;
    calDueDate: Date | null;
}>;
export declare function getEquipmentStatusHistory(equipmentId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    notes: string | null;
    date: Date;
    hours: number;
    loggedBy: string | null;
    equipmentId: string;
}[]>;
export interface EquipmentListItem {
    id: string;
    externalId: string;
    name: string;
    type: string | null;
    status: string;
    dailyRate: number | null;
    isOwned: boolean;
    lastUsageDate: Date | null;
    updatedAt: Date;
    calDueDate: Date | null;
    calDueSoon: boolean;
    totalCostToDate: number;
    daysOnProject: number;
}
/**
 * List equipment for a project with derived columns:
 *   - totalCostToDate: rate × totalHours
 *   - daysOnProject: days since creation
 *   - calDueSoon: cal_due_date within 30 days from today
 */
export declare function getEquipmentListForProject(projectId: string): Promise<EquipmentListItem[]>;
//# sourceMappingURL=resource.service.d.ts.map