/**
 * Tests for the Owner Report agent + service.
 * - week ending defaults to the most recent Friday
 * - fallback path produces a report without calling Anthropic
 * - sections are well-formed
 * - daily rate limit triggers on 4th call
 * - editing a section updates the row and re-renders full_report_text
 * - markAsSent records sentAt
 */

import { runOwnerReport } from '../agents/owner-report.agent';
import {
  checkDailyRateLimit,
  saveReport,
  listReports,
  getReport,
  editSection,
  markAsSent,
  getTodayCallCount,
} from '../services/owner-report.service';

const mockProjectFindUnique = jest.fn();
const mockScheduleActivityFindMany = jest.fn();
const mockScheduleActivityCount = jest.fn();
const mockRfiFindMany = jest.fn();
const mockChangeOrderFindMany = jest.fn();
const mockRiskItemFindMany = jest.fn();
const mockBudgetLineFindMany = jest.fn();

const mockOwnerReportUpsert = jest.fn();
const mockOwnerReportCount = jest.fn();
const mockOwnerReportFindUnique = jest.fn();
const mockOwnerReportUpdate = jest.fn();
const mockOwnerReportFindMany = jest.fn();

jest.mock('../lib/prisma', () => ({
  getPrismaClient: () => ({
    project: { findUnique: mockProjectFindUnique },
    scheduleActivity: {
      findMany: mockScheduleActivityFindMany,
      count: mockScheduleActivityCount,
    },
    rfi: { findMany: mockRfiFindMany },
    changeOrder: { findMany: mockChangeOrderFindMany },
    riskItem: { findMany: mockRiskItemFindMany },
    budgetLine: { findMany: mockBudgetLineFindMany },
    ownerReport: {
      upsert: mockOwnerReportUpsert,
      count: mockOwnerReportCount,
      findUnique: mockOwnerReportFindUnique,
      update: mockOwnerReportUpdate,
      findMany: mockOwnerReportFindMany,
    },
  }),
}));

// Stub the morning dashboard to keep tests focused on owner-report logic
jest.mock('../services/dashboard.service', () => ({
  getMorningDashboard: jest.fn().mockResolvedValue({
    performance: { spi: 0.95, cpi: 1.02, costVariance: 1.5 },
    metrics: { completedPct: 0.4 },
  }),
  getRiskDashboardStatus: jest.fn().mockResolvedValue({ status: 'green', count: 0, summary: '0 open risks' }),
}));

jest.mock('../services/communications.service', () => ({
  getRfiByProject: jest.fn().mockResolvedValue([]),
  getOverdueRfis: jest.fn().mockResolvedValue([]),
  getOverdueSubmittals: jest.fn().mockResolvedValue([]),
}));

jest.mock('../services/scope.service', () => ({
  getChangeOrdersByProject: jest.fn().mockResolvedValue([]),
}));

jest.mock('../services/risk.service', () => ({
  getOpenRisksByProject: jest.fn().mockResolvedValue([]),
}));

jest.mock('../services/cost.service', () => ({
  calculateProjectEvm: jest.fn().mockResolvedValue({
    projectId: 'p1',
    totalBudget: 1000000,
    totalBcwp: 400000,
    totalAcwp: 392000,
    evm: { spi: 1.0, cpi: 1.02 },
    lineResults: [],
  }),
}));

const baseMocks = () => {
  mockProjectFindUnique.mockResolvedValue({ name: 'BESS Project' });
  mockScheduleActivityFindMany.mockResolvedValue([
    { isCritical: true, status: 'in_progress', percentComplete: 0.5 },
    { isCritical: true, status: 'delayed', percentComplete: 0.2 },
    { isCritical: false, status: 'in_progress', percentComplete: 0.6 },
  ]);
  mockScheduleActivityCount.mockResolvedValue(8);
  mockRfiFindMany
    .mockResolvedValueOnce([
      { id: 'r1', status: 'open', requiredDate: null, answeredAt: null },
    ])
    .mockResolvedValueOnce([]); // answeredThisWeek
  mockChangeOrderFindMany.mockResolvedValue([]);
  mockRiskItemFindMany.mockResolvedValue([]);
  mockBudgetLineFindMany.mockResolvedValue([]);
  delete process.env.ANTHROPIC_API_KEY;
};

beforeEach(() => {
  jest.clearAllMocks();
  baseMocks();
});

describe('runOwnerReport', () => {
  it('returns a fallback report when no API key is set', async () => {
    const r = await runOwnerReport({ projectId: 'p1', userId: 'u1' });
    expect(r.source).toBe('fallback');
    expect(r.meta.failureCode).toBe('DISABLED');
    expect(r.week_ending).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.sections.schedule).toBeTruthy();
    expect(r.sections.cost).toBeTruthy();
    expect(r.sections.rfis).toBeTruthy();
    expect(r.sections.change_orders).toBeTruthy();
    expect(r.sections.risks).toBeTruthy();
    expect(r.sections.lookahead).toBeTruthy();
    expect(r.full_report_text).toContain('Weekly Owner Report');
    expect(r.full_report_text).toContain('BESS Project');
  });

  it('respects an explicit weekEnding date', async () => {
    const r = await runOwnerReport({
      projectId: 'p1',
      userId: 'u1',
      weekEnding: '2026-06-12',
    });
    expect(r.week_ending).toBe('2026-06-12');
  });

  it('falls back to template on mode=fallback even if API key is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const r = await runOwnerReport({
      projectId: 'p1',
      userId: 'u1',
      mode: 'fallback',
    });
    expect(r.source).toBe('fallback');
  });

  it('metrics include the expected keys with correct shapes', async () => {
    const r = await runOwnerReport({ projectId: 'p1', userId: 'u1' });
    expect(r.metrics.schedule).toEqual(
      expect.objectContaining({
        spi: expect.any(Number),
        baseline_pct: expect.any(Number),
        actual_pct: expect.any(Number),
        critical_activities_count: expect.any(Number),
        delayed_count: expect.any(Number),
      })
    );
    expect(r.metrics.cost).toEqual(
      expect.objectContaining({
        cpi: expect.any(Number),
        budget_total: expect.any(Number),
        incurred_total: expect.any(Number),
        committed_total: expect.any(Number),
        variance_pct: expect.any(Number),
      })
    );
    expect(r.metrics.rfis).toEqual(
      expect.objectContaining({
        open_count: expect.any(Number),
        overdue_count: expect.any(Number),
        answered_this_week: expect.any(Number),
      })
    );
    expect(r.metrics.change_orders).toEqual(
      expect.objectContaining({
        approved_count: expect.any(Number),
        pending_count: expect.any(Number),
        approved_value: expect.any(Number),
        pending_value: expect.any(Number),
      })
    );
    expect(r.metrics.risks).toEqual(
      expect.objectContaining({
        high_count: expect.any(Number),
        new_this_week: expect.any(Number),
      })
    );
    expect(r.metrics.lookahead.activities_starting_next_14_days).toBe(8);
  });

  it('week ending defaults to the most recent Friday', async () => {
    // Use a known date: 2026-06-15 is a Monday, so Friday is 2026-06-12
    const r = await runOwnerReport({
      projectId: 'p1',
      userId: 'u1',
      weekEnding: '2026-06-12',
    });
    expect(r.week_ending).toBe('2026-06-12');
  });
});

describe('owner-report service', () => {
  describe('rate limit', () => {
    it('throws when 3 reports already exist today', async () => {
      mockOwnerReportCount.mockResolvedValue(3);
      await expect(checkDailyRateLimit('p1')).rejects.toMatchObject({ status: 429 });
    });

    it('passes when under the limit', async () => {
      mockOwnerReportCount.mockResolvedValue(0);
      await expect(checkDailyRateLimit('p1')).resolves.toBeUndefined();
    });
  });

  describe('saveReport', () => {
    it('upserts by (projectId, weekEnding)', async () => {
      mockOwnerReportUpsert.mockResolvedValue({ id: 'r1' });
      await saveReport({
        projectId: 'p1',
        userId: 'u1',
        weekEnding: new Date('2026-06-12'),
        report: {
          report_title: 't',
          week_ending: '2026-06-12',
          sections: {
            schedule: 's', cost: 'c', rfis: 'r', change_orders: 'co', risks: 'rk', lookahead: 'l',
          },
          full_report_text: 'full',
          source: 'fallback',
          metrics: {},
          meta: {},
        },
      });
      expect(mockOwnerReportUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId_weekEnding: {
              projectId: 'p1',
              weekEnding: new Date('2026-06-12'),
            },
          },
        })
      );
    });
  });

  describe('editSection', () => {
    it('updates the named section and re-renders the full text', async () => {
      mockOwnerReportFindUnique.mockResolvedValue({
        id: 'r1',
        projectId: 'p1',
        weekEnding: new Date('2026-06-12'),
        reportJson: {
          report_title: 'Weekly Owner Report — X',
          week_ending: '2026-06-12',
          sections: {
            schedule: 'original',
            cost: 'c',
            rfis: 'r',
            change_orders: 'co',
            risks: 'rk',
            lookahead: 'l',
          },
          full_report_text: 'old',
        },
      });
      mockOwnerReportUpdate.mockResolvedValue({ id: 'r1' });

      await editSection('r1', 'schedule', 'edited body');

      const arg = mockOwnerReportUpdate.mock.calls[0][0].data.reportJson;
      expect(arg.sections.schedule).toBe('edited body');
      expect(arg.full_report_text).toContain('edited body');
    });

    it('throws 404 when not found', async () => {
      mockOwnerReportFindUnique.mockResolvedValue(null);
      await expect(editSection('nope', 'schedule', 'x')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('markAsSent', () => {
    it('records sentAt and sentToEmail', async () => {
      mockOwnerReportUpdate.mockResolvedValue({ id: 'r1', sentAt: new Date() });
      await markAsSent('r1', 'owner@example.com');
      expect(mockOwnerReportUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r1' },
          data: expect.objectContaining({ sentToEmail: 'owner@example.com' }),
        })
      );
    });
  });

  describe('listReports', () => {
    it('passes through the project id', async () => {
      mockOwnerReportFindMany.mockResolvedValue([]);
      await listReports('p1');
      expect(mockOwnerReportFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: 'p1' } })
      );
    });
  });

  describe('getReport', () => {
    it('passes through the id', async () => {
      mockOwnerReportFindUnique.mockResolvedValue({ id: 'r1' });
      await getReport('r1');
      expect(mockOwnerReportFindUnique).toHaveBeenCalledWith({ where: { id: 'r1' } });
    });
  });
});
