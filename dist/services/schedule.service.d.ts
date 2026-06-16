export interface ActivityNode {
    id: string;
    startDate: Date;
    endDate: Date;
    duration: number;
    predecessors?: {
        activityId: string;
        type: 'FS' | 'SS' | 'FF' | 'SF';
        lag: number;
    }[];
    successors?: {
        activityId: string;
        type: 'FS' | 'SS' | 'FF' | 'SF';
        lag: number;
    }[];
}
export interface CpmResult {
    earlyStart: Date;
    earlyFinish: Date;
    lateStart: Date;
    lateFinish: Date;
    totalFloat: number;
    freeFloat: number;
    isCritical: boolean;
}
export declare function calculateCpm(activities: ActivityNode[], projectStart: Date): Map<string, CpmResult>;
export declare function calculateBaselineVariance(current: ActivityNode, baseline: ActivityNode): {
    startVarianceDays: number;
    finishVarianceDays: number;
};
export declare function calculateCriticalPathImpact(activities: ActivityNode[], changedActivityId: string, newDuration: number, projectStart: Date): number;
export interface SchedulePerformancePoint {
    date: string;
    baselinePct: number;
    actualPct: number;
    forecastPct: number;
}
export declare function getSchedulePerformance(projectId: string): Promise<{
    projectId: string;
    data: SchedulePerformancePoint[];
}>;
export declare function recalculateSchedule(projectId: string): Promise<void>;
//# sourceMappingURL=schedule.service.d.ts.map