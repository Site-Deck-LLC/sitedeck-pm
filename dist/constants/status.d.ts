export declare const PROJECT_STATUSES: {
    readonly ACTIVE: "active";
    readonly PLANNING: "planning";
    readonly ON_HOLD: "on_hold";
    readonly COMPLETED: "completed";
    readonly CANCELLED: "cancelled";
};
export type ProjectStatus = (typeof PROJECT_STATUSES)[keyof typeof PROJECT_STATUSES];
export declare const PROJECT_STATUS_LABELS: Record<ProjectStatus, string>;
//# sourceMappingURL=status.d.ts.map