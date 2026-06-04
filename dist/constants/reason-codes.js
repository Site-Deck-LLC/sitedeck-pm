"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTIVITY_STATUS_LABELS = exports.ACTIVITY_STATUSES = exports.SCHEDULE_CHANGE_REASON_LABELS = exports.SCHEDULE_CHANGE_REASONS = void 0;
exports.SCHEDULE_CHANGE_REASONS = {
    WEATHER_DELAY: 'weather_delay',
    MATERIAL_DELAY: 'material_delay',
    CREW_AVAILABILITY: 'crew_availability',
    SCOPE_CHANGE: 'scope_change',
    EQUIPMENT: 'equipment',
    ACCESS_PERMIT: 'access_permit',
    OTHER: 'other',
};
exports.SCHEDULE_CHANGE_REASON_LABELS = {
    [exports.SCHEDULE_CHANGE_REASONS.WEATHER_DELAY]: 'Weather Delay',
    [exports.SCHEDULE_CHANGE_REASONS.MATERIAL_DELAY]: 'Material Delay',
    [exports.SCHEDULE_CHANGE_REASONS.CREW_AVAILABILITY]: 'Crew Availability',
    [exports.SCHEDULE_CHANGE_REASONS.SCOPE_CHANGE]: 'Scope Change',
    [exports.SCHEDULE_CHANGE_REASONS.EQUIPMENT]: 'Equipment',
    [exports.SCHEDULE_CHANGE_REASONS.ACCESS_PERMIT]: 'Access/Permit',
    [exports.SCHEDULE_CHANGE_REASONS.OTHER]: 'Other',
};
exports.ACTIVITY_STATUSES = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    COMPLETE: 'complete',
    DELAYED: 'delayed',
};
exports.ACTIVITY_STATUS_LABELS = {
    [exports.ACTIVITY_STATUSES.NOT_STARTED]: 'Not Started',
    [exports.ACTIVITY_STATUSES.IN_PROGRESS]: 'In Progress',
    [exports.ACTIVITY_STATUSES.COMPLETE]: 'Complete',
    [exports.ACTIVITY_STATUSES.DELAYED]: 'Delayed',
};
//# sourceMappingURL=reason-codes.js.map