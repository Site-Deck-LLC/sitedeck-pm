import * as team from './team.service';

const mockProjectMemberFindMany = jest.fn();
const mockProjectMemberFindUnique = jest.fn();
const mockProjectMemberCreate = jest.fn();
const mockProjectMemberUpdate = jest.fn();
const mockOrganizationFindUnique = jest.fn();
const mockOrganizationCreate = jest.fn();
const mockOrganizationMemberCount = jest.fn();

jest.mock('./email.service', () => ({
  sendWelcomeEmail: jest.fn(async () => ({ ok: true, sent: 1, messageId: null, fallback: true })),
}));

jest.mock('../lib/prisma', () => ({
  getPrismaClient: () => ({
    projectMember: {
      findMany: mockProjectMemberFindMany,
      findUnique: mockProjectMemberFindUnique,
      create: mockProjectMemberCreate,
      update: mockProjectMemberUpdate,
    },
    organization: {
      findUnique: mockOrganizationFindUnique,
      create: mockOrganizationCreate,
    },
    organizationMember: {
      count: mockOrganizationMemberCount,
    },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockProjectMemberCreate.mockImplementation(async ({ data }: any) => ({
    id: 'pm-new',
    ...data,
    addedAt: new Date(),
  }));
});

describe('getProjectTeam', () => {
  it('returns all non-inactive members', async () => {
    mockProjectMemberFindMany.mockResolvedValueOnce([]);
    await team.getProjectTeam('p1');
    const where = mockProjectMemberFindMany.mock.calls[0][0].where;
    expect(where.projectId).toBe('p1');
    expect(where.status.not).toBe('inactive');
  });
});

describe('addProjectMember', () => {
  it('rejects malformed email', async () => {
    await expect(
      team.addProjectMember('p1', { email: 'not-an-email', displayName: 'X', role: 'project_manager' }, 'u1')
    ).rejects.toThrow(/email/);
  });

  it('rejects unknown role', async () => {
    await expect(
      team.addProjectMember('p1', { email: 'pm@example.com', displayName: 'X', role: 'unknown' }, 'u1')
    ).rejects.toThrow(/role/);
  });

  it('throws DuplicateMemberError on conflict', async () => {
    mockProjectMemberFindUnique.mockResolvedValueOnce({ id: 'pm-1', status: 'invited' });
    await expect(
      team.addProjectMember('p1', { email: 'pm@example.com', displayName: 'PM', role: 'project_manager' }, 'u1')
    ).rejects.toThrow(/already exists/);
  });

  it('reactivates a previously inactive member', async () => {
    mockProjectMemberFindUnique.mockResolvedValueOnce({ id: 'pm-1', status: 'inactive' });
    mockProjectMemberUpdate.mockResolvedValueOnce({ id: 'pm-1', status: 'invited', role: 'project_manager' });
    const row = await team.addProjectMember(
      'p1',
      { email: 'pm@example.com', displayName: 'PM', role: 'project_manager' },
      'u1'
    );
    expect(row.status).toBe('invited');
    expect(mockProjectMemberUpdate).toHaveBeenCalled();
  });

  it('creates a new member and fires a welcome email', async () => {
    mockProjectMemberFindUnique.mockResolvedValueOnce(null);
    const row = await team.addProjectMember(
      'p1',
      { email: 'NEW@example.com', displayName: 'PM', role: 'project_manager' },
      'u1'
    );
    expect(row.email).toBe('new@example.com');
    expect(row.status).toBe('invited');
  });
});

describe('removeProjectMember', () => {
  it('soft-deletes by setting status=inactive', async () => {
    mockProjectMemberFindUnique.mockResolvedValueOnce({ id: 'pm-1' });
    const r = await team.removeProjectMember('p1', 'u1', 'u-admin');
    expect(r.removed).toBe(true);
    expect(mockProjectMemberUpdate).toHaveBeenCalledWith({
      where: { id: 'pm-1' },
      data: { status: 'inactive' },
    });
  });

  it('returns removed=false when the member is not found', async () => {
    mockProjectMemberFindUnique.mockResolvedValueOnce(null);
    const r = await team.removeProjectMember('p1', 'u1', 'u-admin');
    expect(r.removed).toBe(false);
  });
});

describe('updateMemberRole', () => {
  it('rejects an unknown role with 400-equivalent error', async () => {
    await expect(team.updateMemberRole('p1', 'u1', 'bogus')).rejects.toThrow(/role/);
  });

  it('throws when the member is not found', async () => {
    mockProjectMemberFindUnique.mockResolvedValueOnce(null);
    await expect(team.updateMemberRole('p1', 'u1', 'project_manager')).rejects.toThrow(/not found/);
  });

  it('updates the role', async () => {
    mockProjectMemberFindUnique.mockResolvedValueOnce({ id: 'pm-1' });
    mockProjectMemberUpdate.mockResolvedValueOnce({ id: 'pm-1', role: 'superintendent' });
    const row = await team.updateMemberRole('p1', 'u1', 'superintendent');
    expect(row.role).toBe('superintendent');
  });
});

describe('getOrganization / createOrganization', () => {
  it('returns null when the org is missing', async () => {
    mockOrganizationFindUnique.mockResolvedValueOnce(null);
    expect(await team.getOrganization('org-x')).toBeNull();
  });

  it('returns the org with member count when present', async () => {
    mockOrganizationFindUnique.mockResolvedValueOnce({
      id: 'org-1', name: 'Acme', type: 'contractor', createdBy: 'u1', createdAt: new Date(),
    });
    mockOrganizationMemberCount.mockResolvedValueOnce(7);
    const org = await team.getOrganization('org-1');
    expect(org?.memberCount).toBe(7);
  });

  it('rejects empty name on create', async () => {
    await expect(team.createOrganization({ name: '', type: 'contractor' }, 'u1')).rejects.toThrow(/name/);
  });

  it('rejects invalid type on create', async () => {
    await expect(
      team.createOrganization({ name: 'X', type: 'invalid' as any }, 'u1')
    ).rejects.toThrow(/type/);
  });
});
