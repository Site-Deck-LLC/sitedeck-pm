export const PROJECT_STATUSES = {
  ACTIVE: 'active',
  PLANNING: 'planning',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[keyof typeof PROJECT_STATUSES];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  [PROJECT_STATUSES.ACTIVE]: 'Active',
  [PROJECT_STATUSES.PLANNING]: 'Planning',
  [PROJECT_STATUSES.ON_HOLD]: 'On Hold',
  [PROJECT_STATUSES.COMPLETED]: 'Completed',
  [PROJECT_STATUSES.CANCELLED]: 'Cancelled',
};
