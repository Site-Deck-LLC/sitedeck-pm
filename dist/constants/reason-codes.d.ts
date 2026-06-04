export declare const SCHEDULE_CHANGE_REASONS: {
    readonly WEATHER_DELAY: "weather_delay";
    readonly MATERIAL_DELAY: "material_delay";
    readonly CREW_AVAILABILITY: "crew_availability";
    readonly SCOPE_CHANGE: "scope_change";
    readonly EQUIPMENT: "equipment";
    readonly ACCESS_PERMIT: "access_permit";
    readonly OTHER: "other";
};
export type ScheduleChangeReason = (typeof SCHEDULE_CHANGE_REASONS)[keyof typeof SCHEDULE_CHANGE_REASONS];
export declare const SCHEDULE_CHANGE_REASON_LABELS: Record<ScheduleChangeReason, string>;
export declare const ACTIVITY_STATUSES: {
    readonly NOT_STARTED: "not_started";
    readonly IN_PROGRESS: "in_progress";
    readonly COMPLETE: "complete";
    readonly DELAYED: "delayed";
};
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[keyof typeof ACTIVITY_STATUSES];
export declare const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string>;
//# sourceMappingURL=reason-codes.d.ts.map