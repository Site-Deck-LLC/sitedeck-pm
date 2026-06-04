export declare const ROLES: {
    readonly OWNER_ADMIN: "owner_admin";
    readonly PROJECT_MANAGER: "project_manager";
    readonly SUPERINTENDENT: "superintendent";
    readonly SUPERVISOR: "supervisor";
    readonly FIELD_CREW: "field_crew";
    readonly SUBCONTRACTOR_PM: "subcontractor_pm";
    readonly SUBCONTRACTOR_SUPER: "subcontractor_super";
    readonly OWNERS_REP: "owners_rep";
    readonly ACCOUNTANT_AP: "accountant_ap";
};
export type Role = (typeof ROLES)[keyof typeof ROLES];
export declare const ROLE_PERMISSIONS: Record<Role, string[]>;
export declare function isRoleAtLeast(userRole: Role, minimumRole: Role): boolean;
//# sourceMappingURL=roles.d.ts.map