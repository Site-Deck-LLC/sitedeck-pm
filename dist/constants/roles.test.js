"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const roles_1 = require("./roles");
describe('roles', () => {
    describe('isRoleAtLeast', () => {
        it('returns true when roles are identical', () => {
            expect((0, roles_1.isRoleAtLeast)(roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.PROJECT_MANAGER)).toBe(true);
        });
        it('returns true when user role is higher in hierarchy', () => {
            expect((0, roles_1.isRoleAtLeast)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER)).toBe(true);
            expect((0, roles_1.isRoleAtLeast)(roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT)).toBe(true);
            expect((0, roles_1.isRoleAtLeast)(roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.SUPERVISOR)).toBe(true);
            expect((0, roles_1.isRoleAtLeast)(roles_1.ROLES.SUPERVISOR, roles_1.ROLES.FIELD_CREW)).toBe(true);
        });
        it('returns false when user role is lower in hierarchy', () => {
            expect((0, roles_1.isRoleAtLeast)(roles_1.ROLES.FIELD_CREW, roles_1.ROLES.SUPERVISOR)).toBe(false);
            expect((0, roles_1.isRoleAtLeast)(roles_1.ROLES.SUPERVISOR, roles_1.ROLES.SUPERINTENDENT)).toBe(false);
            expect((0, roles_1.isRoleAtLeast)(roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.PROJECT_MANAGER)).toBe(false);
            expect((0, roles_1.isRoleAtLeast)(roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.OWNER_ADMIN)).toBe(false);
        });
        it('returns false for cross-hierarchy scoped roles', () => {
            expect((0, roles_1.isRoleAtLeast)(roles_1.ROLES.SUBCONTRACTOR_PM, roles_1.ROLES.PROJECT_MANAGER)).toBe(false);
            expect((0, roles_1.isRoleAtLeast)(roles_1.ROLES.OWNERS_REP, roles_1.ROLES.PROJECT_MANAGER)).toBe(false);
            expect((0, roles_1.isRoleAtLeast)(roles_1.ROLES.ACCOUNTANT_AP, roles_1.ROLES.OWNER_ADMIN)).toBe(false);
        });
        it('returns true for exact match of scoped roles', () => {
            expect((0, roles_1.isRoleAtLeast)(roles_1.ROLES.SUBCONTRACTOR_PM, roles_1.ROLES.SUBCONTRACTOR_PM)).toBe(true);
            expect((0, roles_1.isRoleAtLeast)(roles_1.ROLES.OWNERS_REP, roles_1.ROLES.OWNERS_REP)).toBe(true);
        });
    });
    describe('ROLE_PERMISSIONS', () => {
        it('defines permissions for every canonical role', () => {
            const allRoles = Object.values(roles_1.ROLES);
            for (const role of allRoles) {
                expect(roles_1.ROLE_PERMISSIONS[role]).toBeDefined();
                expect(Array.isArray(roles_1.ROLE_PERMISSIONS[role])).toBe(true);
            }
        });
        it('grants admin full permission set', () => {
            expect(roles_1.ROLE_PERMISSIONS[roles_1.ROLES.OWNER_ADMIN]).toContain('admin');
            expect(roles_1.ROLE_PERMISSIONS[roles_1.ROLES.OWNER_ADMIN]).toContain('manage_users');
            expect(roles_1.ROLE_PERMISSIONS[roles_1.ROLES.OWNER_ADMIN]).toContain('view_cost');
        });
        it('grants owners_rep read-only dashboard access', () => {
            expect(roles_1.ROLE_PERMISSIONS[roles_1.ROLES.OWNERS_REP]).toEqual(expect.arrayContaining(['read', 'view_dashboard', 'view_issues', 'view_rfi_status']));
            expect(roles_1.ROLE_PERMISSIONS[roles_1.ROLES.OWNERS_REP]).not.toContain('write');
        });
    });
});
//# sourceMappingURL=roles.test.js.map