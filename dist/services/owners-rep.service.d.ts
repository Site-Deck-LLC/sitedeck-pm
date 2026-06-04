import { Issue } from '@prisma/client';
import { Role } from '../constants/roles';
import { DashboardTile, SafetyData } from './dashboard.service';
export interface OwnersRepDashboard {
    projectId: string;
    generatedAt: Date;
    tiles: {
        safety: DashboardTile;
        schedule: DashboardTile;
        materials: DashboardTile;
        clientIssues: DashboardTile;
        fieldIssues: DashboardTile;
    };
}
export interface OwnersRepRfiSummary {
    projectId: string;
    totalRfis: number;
    openRfis: number;
    answeredRfis: number;
    closedRfis: number;
    overdueRfis: number;
    recentRfis: {
        rfiNumber: string;
        subject: string;
        status: string;
        submittedAt: Date | null;
    }[];
}
export interface OwnersRepSubmittalSummary {
    projectId: string;
    totalSubmittals: number;
    pendingSubmittals: number;
    approvedSubmittals: number;
    rejectedSubmittals: number;
    underReviewSubmittals: number;
    recentSubmittals: {
        submittalNumber: string;
        title: string;
        status: string;
        submittedAt: Date | null;
    }[];
}
export interface OwnersRepProjectSummary {
    projectId: string;
    projectName: string;
    dashboard: OwnersRepDashboard;
    issues: {
        total: number;
        open: number;
        highPriority: number;
        items: Issue[];
    };
    rfiStatus: OwnersRepRfiSummary;
    submittalStatus: OwnersRepSubmittalSummary;
}
export declare function getOwnersRepDashboard(projectId: string, safetyData: SafetyData): Promise<OwnersRepDashboard>;
export declare function getOwnersRepIssues(projectId: string): Promise<Issue[]>;
export declare function getOwnersRepRfiStatus(projectId: string): Promise<OwnersRepRfiSummary>;
export declare function getOwnersRepSubmittalStatus(projectId: string): Promise<OwnersRepSubmittalSummary>;
export declare function canAccessOwnersRepPortal(userRole: Role): boolean;
export declare function getOwnersRepProjectSummary(projectId: string, safetyData: SafetyData): Promise<OwnersRepProjectSummary>;
//# sourceMappingURL=owners-rep.service.d.ts.map