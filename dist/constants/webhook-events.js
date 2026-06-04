"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTBOUND_EVENTS = exports.INBOUND_EVENTS = void 0;
exports.INBOUND_EVENTS = {
    TASK_COMPLETED: 'task-completed',
    MATERIAL_RECEIVED: 'material-received',
    LABOR_HOURS_LOGGED: 'labor-hours-logged',
    EQUIPMENT_USAGE_LOGGED: 'equipment-usage-logged',
    SAFETY_INCIDENT: 'safety-incident',
    FIELD_ISSUE_LOGGED: 'field-issue-logged',
    SCHEDULE_CHANGE_REQUESTED: 'schedule-change-requested',
};
exports.OUTBOUND_EVENTS = {
    ACTIVITY_READY: 'activity-ready',
    MATERIAL_NEEDED: 'material-needed',
    RFI_STATUS_UPDATED: 'rfi-status-updated',
    SUBMITTAL_STATUS_UPDATED: 'submittal-status-updated',
    SCHEDULE_CHANGE_DECIDED: 'schedule-change-decided',
};
//# sourceMappingURL=webhook-events.js.map