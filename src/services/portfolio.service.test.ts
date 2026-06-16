/**
 * Tests for the portfolio service. The service has two
 * responsibilities:
 *   1. Roll up per-project summaries (CPI/SPI, open issues, open RFIs)
 *   2. Apply tenant isolation via the user's orgId
 *
 * We mock `getMorningDashboard` so the test doesn't depend on the
 * schedule / cost / RFI service chain. We mock the prisma query
 * surface used by the service: project.findMany, rfi.count, and
 * project.findUnique (called inside summarizeOne for the project
 * metadata).
 */

import { getPortfolioSummary } from './portfolio.service';
import * as dashboardService from './dashboard.service';

const mockProjectFindMany = jest.fn();
const mockProjectFindUnique = jest.fn();
const mockRfiCount = jest.fn();

jest.mock('../lib/prisma', () => ({
  getPrismaClient: () => ({
    project: {
      findMany: mockProjectFindMany,
      findUnique: mockProjectFindUnique,
    },
    rfi: { count: mockRfiCount },
  }),
}));

jest.mock('./dashboard.service', () => ({
  getMorningDashboard: jest.fn(),
}));

const mockGetMorningDashboard = dashboardService.getMorningDashboard as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no projects, no RFIs, no dashboard. Tests override
  // these per scenario.
  mockProjectFindMany.mockResolvedValue([]);
  mockRfiCount.mockResolvedValue(0);
  mockGetMorningDashboard.mockResolvedValue({
    performance: { cpi: 1, spi: 1 },
    tiles: {
      clientIssues: { count: 0 },
      fieldIssues: { count: 0 },
    },
  });
  mockProjectFindUnique.mockResolvedValue({
    id: 'proj-1',
    name: 'Project 1',
    city: 'Midland',
    state: 'TX',
    updatedAt: new Date('2026-06-01T00:00:00Z'),
  });
});

describe('portfolio.service.getPortfolioSummary', () => {
  it('returns an empty summary when the user has no projects', async () => {
    const result = await getPortfolioSummary('org-empty');
    expect(result.totalProjects).toBe(0);
    expect(result.onSchedule).toBe(0);
    expect(result.onBudget).toBe(0);
    expect(result.totalOpenIssues).toBe(0);
    expect(result.totalOpenRfis).toBe(0);
    expect(result.projects).toEqual([]);
    expect(result.generatedAt).toBeTruthy();
  });

  it('aggregates CPI, SPI, openIssues, and openRfis across projects', async () => {
    mockProjectFindMany.mockResolvedValue([
      { id: 'proj-a', name: 'Project A' },
      { id: 'proj-b', name: 'Project B' },
    ]);
    mockProjectFindUnique
      .mockResolvedValueOnce({
        id: 'proj-a',
        name: 'Project A',
        city: 'Midland',
        state: 'TX',
        updatedAt: new Date('2026-06-01'),
      })
      .mockResolvedValueOnce({
        id: 'proj-b',
        name: 'Project B',
        city: 'Odessa',
        state: 'TX',
        updatedAt: new Date('2026-06-02'),
      });
    mockGetMorningDashboard
      .mockResolvedValueOnce({
        performance: { cpi: 1.05, spi: 0.95 },
        tiles: { clientIssues: { count: 2 }, fieldIssues: { count: 1 } },
      })
      .mockResolvedValueOnce({
        performance: { cpi: 0.92, spi: 0.80 },
        tiles: { clientIssues: { count: 0 }, fieldIssues: { count: 4 } },
      });
    mockRfiCount
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(7);

    const result = await getPortfolioSummary('org-1');

    expect(result.totalProjects).toBe(2);
    // Project A: cpi 1.05 -> green, spi 0.95 -> green. Project B: cpi 0.92 -> red, spi 0.80 -> red.
    expect(result.onBudget).toBe(1);
    expect(result.onSchedule).toBe(1);
    expect(result.totalOpenIssues).toBe(7); // 2+1 + 0+4
    expect(result.totalOpenRfis).toBe(10); // 3 + 7

    const a = result.projects.find((p) => p.id === 'proj-a')!;
    const b = result.projects.find((p) => p.id === 'proj-b')!;
    expect(a.cpi).toBe(1.05);
    expect(a.spi).toBe(0.95);
    expect(a.scheduleStatus).toBe('green'); // SPI >= 0.90
    expect(a.costStatus).toBe('green'); // CPI >= 1.0
    expect(a.openIssues).toBe(3);
    expect(a.openRfis).toBe(3);

    expect(b.cpi).toBe(0.92);
    expect(b.spi).toBe(0.8);
    expect(b.costStatus).toBe('red'); // CPI < 0.95
    expect(b.scheduleStatus).toBe('red'); // SPI < 0.85
    expect(b.openIssues).toBe(4);
    expect(b.openRfis).toBe(7);
  });

  it('scopes the project list to the user\'s org when orgId is provided', async () => {
    mockProjectFindMany.mockResolvedValue([]);
    await getPortfolioSummary('org-xyz');
    expect(mockProjectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: 'org-xyz' }) })
    );
  });

  it('does not include an orgId filter when orgId is null (dev-token fallback)', async () => {
    mockProjectFindMany.mockResolvedValue([]);
    await getPortfolioSummary(null);
    const whereArg = mockProjectFindMany.mock.calls[0][0].where;
    expect(whereArg.orgId).toBeUndefined();
  });

  it('applies CPI thresholds: >= 1.0 green, 0.95-1.0 amber, < 0.95 red', async () => {
    mockProjectFindMany.mockResolvedValue([
      { id: 'p1' }, { id: 'p2' }, { id: 'p3' },
    ]);
    mockProjectFindUnique.mockImplementation(async ({ where }: any) => ({
      id: where.id, name: 'X', city: null, state: null, updatedAt: new Date(),
    }));
    mockGetMorningDashboard
      .mockResolvedValueOnce({ performance: { cpi: 1.0, spi: 1 }, tiles: { clientIssues: { count: 0 }, fieldIssues: { count: 0 } } })
      .mockResolvedValueOnce({ performance: { cpi: 0.96, spi: 1 }, tiles: { clientIssues: { count: 0 }, fieldIssues: { count: 0 } } })
      .mockResolvedValueOnce({ performance: { cpi: 0.94, spi: 1 }, tiles: { clientIssues: { count: 0 }, fieldIssues: { count: 0 } } });

    const result = await getPortfolioSummary('org-1');
    const statuses = result.projects.map((p) => p.costStatus);
    expect(statuses).toEqual(['green', 'amber', 'red']);
  });

  it('applies SPI thresholds: >= 0.90 green, 0.85-0.90 amber, < 0.85 red', async () => {
    mockProjectFindMany.mockResolvedValue([
      { id: 'p1' }, { id: 'p2' }, { id: 'p3' },
    ]);
    mockProjectFindUnique.mockImplementation(async ({ where }: any) => ({
      id: where.id, name: 'X', city: null, state: null, updatedAt: new Date(),
    }));
    mockGetMorningDashboard
      .mockResolvedValueOnce({ performance: { cpi: 1, spi: 0.92 }, tiles: { clientIssues: { count: 0 }, fieldIssues: { count: 0 } } })
      .mockResolvedValueOnce({ performance: { cpi: 1, spi: 0.87 }, tiles: { clientIssues: { count: 0 }, fieldIssues: { count: 0 } } })
      .mockResolvedValueOnce({ performance: { cpi: 1, spi: 0.80 }, tiles: { clientIssues: { count: 0 }, fieldIssues: { count: 0 } } });

    const result = await getPortfolioSummary('org-1');
    const statuses = result.projects.map((p) => p.scheduleStatus);
    expect(statuses).toEqual(['green', 'amber', 'red']);
  });

  it('does not throw when one project\'s dashboard service fails (standalone degradation)', async () => {
    mockProjectFindMany.mockResolvedValue([
      { id: 'p-good' },
      { id: 'p-broken' },
    ]);
    mockProjectFindUnique.mockImplementation(async ({ where }: any) => ({
      id: where.id, name: 'X', city: null, state: null, updatedAt: new Date(),
    }));
    mockGetMorningDashboard
      .mockResolvedValueOnce({ performance: { cpi: 1.02, spi: 1.0 }, tiles: { clientIssues: { count: 1 }, fieldIssues: { count: 0 } } })
      .mockRejectedValueOnce(new Error('dashboard service timeout'));

    const result = await getPortfolioSummary('org-1');
    expect(result.totalProjects).toBe(2);

    const broken = result.projects.find((p) => p.id === 'p-broken')!;
    // Placeholder values from the standalone-degradation branch.
    expect(broken.cpi).toBe(1);
    expect(broken.spi).toBe(1);
    expect(broken.openIssues).toBe(0);
    expect(broken.costStatus).toBe('green');
    expect(broken.scheduleStatus).toBe('green');

    const good = result.projects.find((p) => p.id === 'p-good')!;
    expect(good.openIssues).toBe(1);
    expect(good.cpi).toBe(1.02);
  });

  it('does not throw when one project\'s RFI count query fails', async () => {
    mockProjectFindMany.mockResolvedValue([{ id: 'p-rfi-broken' }]);
    mockProjectFindUnique.mockResolvedValue({
      id: 'p-rfi-broken', name: 'X', city: null, state: null, updatedAt: new Date(),
    });
    mockGetMorningDashboard.mockResolvedValue({
      performance: { cpi: 1, spi: 1 },
      tiles: { clientIssues: { count: 0 }, fieldIssues: { count: 0 } },
    });
    mockRfiCount.mockRejectedValue(new Error('rfi count down'));

    const result = await getPortfolioSummary('org-1');
    expect(result.totalOpenRfis).toBe(0);
    expect(result.projects[0].openRfis).toBe(0);
  });

  it('includes generatedAt and lastUpdated timestamps as ISO strings', async () => {
    mockProjectFindMany.mockResolvedValue([{ id: 'p-stamp' }]);
    mockProjectFindUnique.mockResolvedValue({
      id: 'p-stamp', name: 'X', city: null, state: null, updatedAt: new Date('2026-05-01T12:00:00Z'),
    });

    const result = await getPortfolioSummary('org-1');
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.projects[0].lastUpdated).toBe('2026-05-01T12:00:00.000Z');
  });

  it('rounds CPI and SPI to two decimal places', async () => {
    mockProjectFindMany.mockResolvedValue([{ id: 'p-round' }]);
    mockProjectFindUnique.mockResolvedValue({
      id: 'p-round', name: 'X', city: null, state: null, updatedAt: new Date(),
    });
    mockGetMorningDashboard.mockResolvedValue({
      performance: { cpi: 1.123456, spi: 0.876543 },
      tiles: { clientIssues: { count: 0 }, fieldIssues: { count: 0 } },
    });
    const result = await getPortfolioSummary('org-1');
    expect(result.projects[0].cpi).toBe(1.12);
    expect(result.projects[0].spi).toBe(0.88);
  });
});
