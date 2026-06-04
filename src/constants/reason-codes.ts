export const SCHEDULE_CHANGE_REASONS = {
  WEATHER_DELAY: 'weather_delay',
  MATERIAL_DELAY: 'material_delay',
  CREW_AVAILABILITY: 'crew_availability',
  SCOPE_CHANGE: 'scope_change',
  EQUIPMENT: 'equipment',
  ACCESS_PERMIT: 'access_permit',
  OTHER: 'other',
} as const;

export type ScheduleChangeReason =
  (typeof SCHEDULE_CHANGE_REASONS)[keyof typeof SCHEDULE_CHANGE_REASONS];

export const SCHEDULE_CHANGE_REASON_LABELS: Record<ScheduleChangeReason, string> = {
  [SCHEDULE_CHANGE_REASONS.WEATHER_DELAY]: 'Weather Delay',
  [SCHEDULE_CHANGE_REASONS.MATERIAL_DELAY]: 'Material Delay',
  [SCHEDULE_CHANGE_REASONS.CREW_AVAILABILITY]: 'Crew Availability',
  [SCHEDULE_CHANGE_REASONS.SCOPE_CHANGE]: 'Scope Change',
  [SCHEDULE_CHANGE_REASONS.EQUIPMENT]: 'Equipment',
  [SCHEDULE_CHANGE_REASONS.ACCESS_PERMIT]: 'Access/Permit',
  [SCHEDULE_CHANGE_REASONS.OTHER]: 'Other',
};

export const ACTIVITY_STATUSES = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  DELAYED: 'delayed',
} as const;

export type ActivityStatus =
  (typeof ACTIVITY_STATUSES)[keyof typeof ACTIVITY_STATUSES];

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  [ACTIVITY_STATUSES.NOT_STARTED]: 'Not Started',
  [ACTIVITY_STATUSES.IN_PROGRESS]: 'In Progress',
  [ACTIVITY_STATUSES.COMPLETE]: 'Complete',
  [ACTIVITY_STATUSES.DELAYED]: 'Delayed',
};
