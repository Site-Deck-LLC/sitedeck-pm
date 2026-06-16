import { EvmResult } from './cost.service';
import { getRiskDashboardStatus } from './risk.service';
export { getRiskDashboardStatus };
export interface DashboardTile {
    name: string;
    status: 'green' | 'amber' | 'red';
    summary: string;
    count?: number;
    detailUrl?: string;
}
export interface MorningDashboard {
    projectId: string;
    generatedAt: Date;
    tiles: {
        safety: DashboardTile;
        schedule: DashboardTile;
        cost: DashboardTile;
        materials: DashboardTile;
        clientIssues: DashboardTile;
        fieldIssues: DashboardTile;
    };
    projectValue: number | null;
    crew: {
        speciality: number;
        general: number;
        equipment: number;
        equipmentActive: number;
        equipmentIdle: number;
        dailyBurnRate: number;
    };
    upcoming: {
        nextMilestone: {
            name: string;
            daysLeft: number;
            taskValue: number;
        } | null;
        nextCheckpoint: {
            name: string;
            daysLeft: number;
            taskCount: number;
        } | null;
        nextDraw: {
            name: string;
            daysLeft: number;
            drawValue: number;
        } | null;
    };
    performance: {
        cpi: number;
        spi: number;
        costVariance: number;
        scheduleVariance: number;
        costBars: {
            label: string;
            planned: number;
            actual: number;
            color: string;
        }[];
        effortBars: {
            label: string;
            planned: number;
            actual: number;
            color: string;
        }[];
    };
    healthTiles: DashboardTile[];
    communications: {
        rfis: {
            id: string;
            number: string;
            recordId: string;
            subject: string;
            status: string;
            date: string;
        }[];
        fieldIssues: {
            id: string;
            title: string;
            status: string;
            priority: string;
            date: string;
        }[];
    };
    changeOrders: {
        approved: number;
        pending: number;
        approvedCost: number;
        approvedSchedule: number;
        pendingCost: number;
        pendingSchedule: number;
    };
    metrics: {
        plannedDays: number;
        plannedEffort: number;
        completedPct: number;
    };
    taskDays: {
        actualDays: number;
        estimateDays: number;
        totalDays: number;
        completedPct: number;
    };
    financialOverview: {
        bidValue: {
            taskCost: number;
            overhead: number;
            profit: number;
        };
        currentValue: {
            taskCost: number;
            overhead: number;
            profit: number;
        };
    };
    quickActions: {
        label: string;
        iconKey: string;
        color: string;
    }[];
}
export interface SafetyData {
    incidents: number;
    openObservations: number;
}
export declare function getSafetyTileStatus(safetyData: SafetyData): DashboardTile;
export interface ScheduleActivityInput {
    id: string;
    name: string;
    status: string;
    isCritical: boolean;
    totalFloat: number | null;
}
export declare function getScheduleTileStatus(activities: ScheduleActivityInput[], idleEquipmentCount?: number): DashboardTile;
export declare function getCostTileStatus(evmResult: EvmResult, lineFlags: string[]): DashboardTile;
export declare function getMaterialsTileStatus(projectId: string): Promise<DashboardTile>;
export declare function getClientIssuesTileStatus(projectId: string): Promise<DashboardTile>;
export declare function getFieldIssuesTileStatus(projectId: string): Promise<DashboardTile>;
export declare function getMorningDashboard(projectId: string, safetyData: SafetyData): Promise<MorningDashboard>;
//# sourceMappingURL=dashboard.service.d.ts.map