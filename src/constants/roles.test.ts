import { ROLES, Role, isRoleAtLeast, ROLE_PERMISSIONS } from './roles';

describe('roles', () => {
  describe('isRoleAtLeast', () => {
    it('returns true when roles are identical', () => {
      expect(isRoleAtLeast(ROLES.PROJECT_MANAGER, ROLES.PROJECT_MANAGER)).toBe(true);
    });

    it('returns true when user role is higher in hierarchy', () => {
      expect(isRoleAtLeast(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER)).toBe(true);
      expect(isRoleAtLeast(ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT)).toBe(true);
      expect(isRoleAtLeast(ROLES.SUPERINTENDENT, ROLES.SUPERVISOR)).toBe(true);
      expect(isRoleAtLeast(ROLES.SUPERVISOR, ROLES.FIELD_CREW)).toBe(true);
    });

    it('returns false when user role is lower in hierarchy', () => {
      expect(isRoleAtLeast(ROLES.FIELD_CREW, ROLES.SUPERVISOR)).toBe(false);
      expect(isRoleAtLeast(ROLES.SUPERVISOR, ROLES.SUPERINTENDENT)).toBe(false);
      expect(isRoleAtLeast(ROLES.SUPERINTENDENT, ROLES.PROJECT_MANAGER)).toBe(false);
      expect(isRoleAtLeast(ROLES.PROJECT_MANAGER, ROLES.OWNER_ADMIN)).toBe(false);
    });

    it('returns false for cross-hierarchy scoped roles', () => {
      expect(isRoleAtLeast(ROLES.SUBCONTRACTOR_PM, ROLES.PROJECT_MANAGER)).toBe(false);
      expect(isRoleAtLeast(ROLES.OWNERS_REP, ROLES.PROJECT_MANAGER)).toBe(false);
      expect(isRoleAtLeast(ROLES.ACCOUNTANT_AP, ROLES.OWNER_ADMIN)).toBe(false);
    });

    it('returns true for exact match of scoped roles', () => {
      expect(isRoleAtLeast(ROLES.SUBCONTRACTOR_PM, ROLES.SUBCONTRACTOR_PM)).toBe(true);
      expect(isRoleAtLeast(ROLES.OWNERS_REP, ROLES.OWNERS_REP)).toBe(true);
    });
  });

  describe('ROLE_PERMISSIONS', () => {
    it('defines permissions for every canonical role', () => {
      const allRoles = Object.values(ROLES) as Role[];
      for (const role of allRoles) {
        expect(ROLE_PERMISSIONS[role]).toBeDefined();
        expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
      }
    });

    it('grants admin full permission set', () => {
      expect(ROLE_PERMISSIONS[ROLES.OWNER_ADMIN]).toContain('admin');
      expect(ROLE_PERMISSIONS[ROLES.OWNER_ADMIN]).toContain('manage_users');
      expect(ROLE_PERMISSIONS[ROLES.OWNER_ADMIN]).toContain('view_cost');
    });

    it('grants owners_rep read-only dashboard access', () => {
      expect(ROLE_PERMISSIONS[ROLES.OWNERS_REP]).toEqual(
        expect.arrayContaining(['read', 'view_dashboard', 'view_issues', 'view_rfi_status'])
      );
      expect(ROLE_PERMISSIONS[ROLES.OWNERS_REP]).not.toContain('write');
    });
  });
});
