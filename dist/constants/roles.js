"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = exports.ROLES = void 0;
exports.isRoleAtLeast = isRoleAtLeast;
exports.ROLES = {
    OWNER_ADMIN: 'owner_admin',
    PROJECT_MANAGER: 'project_manager',
    SUPERINTENDENT: 'superintendent',
    SUPERVISOR: 'supervisor',
    FIELD_CREW: 'field_crew',
    SUBCONTRACTOR_PM: 'subcontractor_pm',
    SUBCONTRACTOR_SUPER: 'subcontractor_super',
    OWNERS_REP: 'owners_rep',
    ACCOUNTANT_AP: 'accountant_ap',
};
exports.ROLE_PERMISSIONS = {
    [exports.ROLES.OWNER_ADMIN]: [
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
    [exports.ROLES.PROJECT_MANAGER]: [
        'read',
        'write',
        'delete',
        'manage_projects',
        'view_cost',
        'view_dashboard',
        'approve_changes',
        'export_reports',
    ],
    [exports.ROLES.SUPERINTENDENT]: [
        'read',
        'view_dashboard',
        'schedule_read',
        'material_status',
        'rfi_status',
        'submittal_status',
        'schedule_change_request',
    ],
    [exports.ROLES.SUPERVISOR]: [],
    [exports.ROLES.FIELD_CREW]: [],
    [exports.ROLES.SUBCONTRACTOR_PM]: [
        'read',
        'write',
        'view_subcontract',
        'view_schedule_window',
        'submittals',
    ],
    [exports.ROLES.SUBCONTRACTOR_SUPER]: [],
    [exports.ROLES.OWNERS_REP]: [
        'read',
        'view_dashboard',
        'view_issues',
        'view_rfi_status',
    ],
    [exports.ROLES.ACCOUNTANT_AP]: ['export_reports'],
};
const HIERARCHY_LEVELS = {
    [exports.ROLES.OWNER_ADMIN]: 5,
    [exports.ROLES.PROJECT_MANAGER]: 4,
    [exports.ROLES.SUPERINTENDENT]: 3,
    [exports.ROLES.SUPERVISOR]: 2,
    [exports.ROLES.FIELD_CREW]: 1,
    [exports.ROLES.SUBCONTRACTOR_PM]: null,
    [exports.ROLES.SUBCONTRACTOR_SUPER]: null,
    [exports.ROLES.OWNERS_REP]: null,
    [exports.ROLES.ACCOUNTANT_AP]: null,
};
function isRoleAtLeast(userRole, minimumRole) {
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
//# sourceMappingURL=roles.js.map