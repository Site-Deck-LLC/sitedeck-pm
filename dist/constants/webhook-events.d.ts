export declare const INBOUND_EVENTS: {
    readonly TASK_COMPLETED: "task-completed";
    readonly MATERIAL_RECEIVED: "material-received";
    readonly LABOR_HOURS_LOGGED: "labor-hours-logged";
    readonly EQUIPMENT_USAGE_LOGGED: "equipment-usage-logged";
    readonly SAFETY_INCIDENT: "safety-incident";
    readonly FIELD_ISSUE_LOGGED: "field-issue-logged";
    readonly SCHEDULE_CHANGE_REQUESTED: "schedule-change-requested";
};
export type InboundEvent = (typeof INBOUND_EVENTS)[keyof typeof INBOUND_EVENTS];
export declare const OUTBOUND_EVENTS: {
    readonly ACTIVITY_READY: "activity-ready";
    readonly MATERIAL_NEEDED: "material-needed";
    readonly RFI_STATUS_UPDATED: "rfi-status-updated";
    readonly SUBMITTAL_STATUS_UPDATED: "submittal-status-updated";
    readonly SCHEDULE_CHANGE_DECIDED: "schedule-change-decided";
};
export type OutboundEvent = (typeof OUTBOUND_EVENTS)[keyof typeof OUTBOUND_EVENTS];
//# sourceMappingURL=webhook-events.d.ts.map