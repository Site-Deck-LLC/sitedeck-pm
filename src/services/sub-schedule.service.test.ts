/**
 * Tests for the sub-schedule service.
 * - createSubSchedule: tenant-isolated (rejects cross-project subs)
 * - addActivity / updateActivity: basic CRUD
 * - linkToMaster: sets the FK
 * - calculateSubSPI: ahead / on-track / at-risk thresholds
 * - getRollup: includes one row per subcontract in the project
 */

import * as subs from './sub-schedule.service';

const mockSubcontractFindUnique = jest.fn();
const mockSubScheduleCreate = jest.fn();
const mockSubScheduleFindMany = jest.fn();
const mockSubScheduleFindUnique = jest.fn();
const mockActivityCreate = jest.fn();
const mockActivityUpdate = jest.fn();
const mockActivityFindMany = jest.fn();
const mockSubcontractFindMany = jest.fn();

jest.mock('../lib/prisma', () => ({
  getPrismaClient: () => ({
    subcontract: {
      findUnique: mockSubcontractFindUnique,
      findMany: mockSubcontractFindMany,
    },
    subSchedule: {
      create: mockSubScheduleCreate,
      findMany: mockSubScheduleFindMany,
      findUnique: mockSubScheduleFindUnique,
    },
    subScheduleActivity: {
      create: mockActivityCreate,
      update: mockActivityUpdate,
      findMany: mockActivityFindMany,
    },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSubScheduleCreate.mockImplementation(async ({ data }: any) => ({ id: 'ss-new', ...data }));
  mockActivityCreate.mockImplementation(async ({ data }: any) => ({ id: 'sa-new', ...data }));
  mockActivityUpdate.mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data }));
});

describe('createSubSchedule', () => {
  it('rejects a subcontract from a different project (tenant isolation)', async () => {
    mockSubcontractFindUnique.mockResolvedValueOnce({ id: 's1', projectId: 'p-other' });
    await expect(
      subs.createSubSchedule({ projectId: 'p1', subcontractId: 's1', name: 'Phase 1', createdBy: 'u1' })
    ).rejects.toThrow(/not found in this project/);
    expect(mockSubScheduleCreate).not.toHaveBeenCalled();
  });

  it('creates the sub-schedule when the sub belongs to the project', async () => {
    mockSubcontractFindUnique.mockResolvedValueOnce({ id: 's1', projectId: 'p1' });
    const r = await subs.createSubSchedule({
      projectId: 'p1',
      subcontractId: 's1',
      name: 'Phase 1',
      createdBy: 'u1',
    });
    expect(r.id).toBe('ss-new');
    expect(r.name).toBe('Phase 1');
    expect(mockSubScheduleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: 'p1', subcontractId: 's1' }),
      })
    );
  });
});

describe('addActivity / updateActivity / linkToMaster', () => {
  it('addActivity creates a row with status=pending by default', async () => {
    const a = await subs.addActivity({
      subScheduleId: 'ss-1',
      name: 'Pour concrete',
      plannedStart: new Date('2026-06-01'),
      plannedEnd: new Date('2026-06-05'),
    });
    expect(a.status).toBe('pending');
    expect(mockActivityCreate).toHaveBeenCalled();
  });

  it('updateActivity applies only the provided fields', async () => {
    await subs.updateActivity('sa-1', { percentComplete: 50, status: 'in_progress' });
    expect(mockActivityUpdate).toHaveBeenCalledWith({
      where: { id: 'sa-1' },
      data: { percentComplete: 50, status: 'in_progress' },
    });
  });

  it('linkToMaster sets the linked master activity id', async () => {
    await subs.linkToMaster('sa-1', 'master-1');
    expect(mockActivityUpdate).toHaveBeenCalledWith({
      where: { id: 'sa-1' },
      data: { linkedMasterActivityId: 'master-1' },
    });
  });
});

describe('calculateSubSPI', () => {
  it('returns SPI=1 with no activities (no signal)', async () => {
    mockActivityFindMany.mockResolvedValueOnce([]);
    const r = await subs.calculateSubSPI('s1');
    expect(r.spi).toBe(1);
    expect(r.status).toBe('ahead'); // SPI=1, no data, so on/ahead
  });

  it('flags at_risk when actual is much longer than planned', async () => {
    const plannedStart = new Date('2026-06-01');
    const plannedEnd = new Date('2026-06-05'); // 4 days planned
    const actualStart = new Date('2026-06-01');
    const actualEnd = new Date('2026-06-15'); // 14 days actual
    mockActivityFindMany.mockResolvedValueOnce([
      { plannedStart, plannedEnd, actualStart, actualEnd, status: 'in_progress' },
    ]);
    const r = await subs.calculateSubSPI('s1');
    expect(r.planned).toBeGreaterThan(0);
    expect(r.actual).toBeGreaterThan(r.planned);
    expect(r.status).toBe('at_risk');
  });

  it('flags ahead when actual is shorter than planned', async () => {
    const plannedStart = new Date('2026-06-01');
    const plannedEnd = new Date('2026-06-10'); // 9 days planned
    const actualStart = new Date('2026-06-01');
    const actualEnd = new Date('2026-06-05'); // 4 days actual
    mockActivityFindMany.mockResolvedValueOnce([
      { plannedStart, plannedEnd, actualStart, actualEnd, status: 'complete' },
    ]);
    const r = await subs.calculateSubSPI('s1');
    expect(r.status).toBe('ahead');
  });
});

describe('getRollup', () => {
  it('returns one row per subcontract with its SPI', async () => {
    mockSubcontractFindMany.mockResolvedValueOnce([
      { id: 's1', subcontractorName: 'Acme Elec' },
      { id: 's2', subcontractorName: 'Beta Mech' },
    ]);
    mockActivityFindMany
      .mockResolvedValueOnce([]) // s1 — no activities
      .mockResolvedValueOnce([
        {
          plannedStart: new Date('2026-06-01'),
          plannedEnd: new Date('2026-06-05'),
          actualStart: new Date('2026-06-01'),
          actualEnd: new Date('2026-06-20'),
          status: 'in_progress',
        },
      ]);
    const r = await subs.getRollup('p1');
    expect(r).toHaveLength(2);
    expect(r[0].subcontractorName).toBe('Acme Elec');
    expect(r[1].subcontractorName).toBe('Beta Mech');
    expect(r[1].status).toBe('at_risk');
  });
});
