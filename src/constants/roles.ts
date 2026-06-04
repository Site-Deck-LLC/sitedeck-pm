export const ROLES = {
  OWNER_ADMIN: 'owner_admin',
  PROJECT_MANAGER: 'project_manager',
  SUPERINTENDENT: 'superintendent',
  SUPERVISOR: 'supervisor',
  FIELD_CREW: 'field_crew',
  SUBCONTRACTOR_PM: 'subcontractor_pm',
  SUBCONTRACTOR_SUPER: 'subcontractor_super',
  OWNERS_REP: 'owners_rep',
  ACCOUNTANT_AP: 'accountant_ap',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  [ROLES.OWNER_ADMIN]: [
    'read',
    'write',
    'admin',
    'delete',
    'manage_users',
    'manage_projects',
    'view_cost',
    'view_dashboard',
    'approve_changes',
    'export_reports',
  ],
  [ROLES.PROJECT_MANAGER]: [
    'read',
    'write',
    'delete',
    'manage_projects',
    'view_cost',
    'view_dashboard',
    'approve_changes',
    'export_reports',
  ],
  [ROLES.SUPERINTENDENT]: [
    'read',
    'view_dashboard',
    'schedule_read',
    'material_status',
    'rfi_status',
    'submittal_status',
    'schedule_change_request',
  ],
  [ROLES.SUPERVISOR]: [],
  [ROLES.FIELD_CREW]: [],
  [ROLES.SUBCONTRACTOR_PM]: [
    'read',
    'write',
    'view_subcontract',
    'view_schedule_window',
    'submittals',
  ],
  [ROLES.SUBCONTRACTOR_SUPER]: [],
  [ROLES.OWNERS_REP]: [
    'read',
    'view_dashboard',
    'view_issues',
    'view_rfi_status',
  ],
  [ROLES.ACCOUNTANT_AP]: ['export_reports'],
};

const HIERARCHY_LEVELS: Record<Role, number | null> = {
  [ROLES.OWNER_ADMIN]: 5,
  [ROLES.PROJECT_MANAGER]: 4,
  [ROLES.SUPERINTENDENT]: 3,
  [ROLES.SUPERVISOR]: 2,
  [ROLES.FIELD_CREW]: 1,
  [ROLES.SUBCONTRACTOR_PM]: null,
  [ROLES.SUBCONTRACTOR_SUPER]: null,
  [ROLES.OWNERS_REP]: null,
  [ROLES.ACCOUNTANT_AP]: null,
};

export function isRoleAtLeast(userRole: Role, minimumRole: Role): boolean {
  if (userRole === minimumRole) {
    return true;
  }
  const userLevel = HIERARCHY_LEVELS[userRole];
  const minLevel = HIERARCHY_LEVELS[minimumRole];
  if (userLevel === null || minLevel === null) {
    return false;
  }
  return userLevel >= minLevel;
}
