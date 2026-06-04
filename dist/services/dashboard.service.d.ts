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