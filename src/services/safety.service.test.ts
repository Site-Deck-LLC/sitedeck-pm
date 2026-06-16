import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import { getSafetyPerformance, getSafetyStatus } from './safety.service';

const mockProjectFindUnique = jest.fn();
const mockRiskItemCount = jest.fn();
const mockRiskItemFindMany = jest.fn();
const mockAttendanceFindMany = jest.fn();

const mockPrisma = {
  project: {
    findUnique: mockProjectFindUnique,
  },
  riskItem: {
    count: mockRiskItemCount,
    findMany: mockRiskItemFindMany,
  },
  attendance: {
    findMany: mockAttendanceFindMany,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.clearAllMocks();
  setPrismaClient(mockPrisma);
});

describe('safety.service', () => {
  describe('getSafetyStatus', () => {
    it('returns green when ratio is exactly 0.5', () => {
      expect(getSafetyStatus(1.5, 3.0)).toBe('green');
    });

    it('returns green when ratio is below 0.5', () => {
      expect(getSafetyStatus(1.0, 3.0)).toBe('green');
    });

    it('returns amber when ratio is between 0.5 and 0.8', () => {
      expect(getSafetyStatus(2.0, 3.0)).toBe('amber');
    });

    it('returns amber when ratio is just below 0.8', () => {
      expect(getSafetyStatus(2.39, 3.0)).toBe('amber');
    });

    it('returns red when ratio is exactly 0.8', () => {
      expect(getSafetyStatus(2.4, 3.0)).toBe('red');
    });

    it('returns red when ratio is above 0.8', () => {
      expect(getSafetyStatus(3.0, 3.0)).toBe('red');
    });

    it('returns green when target is zero and actual is zero', () => {
      expect(getSafetyStatus(0, 0)).toBe('green');
    });

    it('returns green when target is zero but actual is positive (ratio treated as 0)', () => {
      expect(getSafetyStatus(5.0, 0)).toBe('green');
    });
  });

  describe('getSafetyPerformance', () => {
    it('returns zero TRIR when no hours worked', async () => {
      mockProjectFindUnique.mockResolvedValue({ trirTarget: 1.0, startDate: null, endDate: null });
      mockRiskItemCount.mockResolvedValue(0);
      mockRiskItemFindMany.mockResolvedValue([]);
      mockAttendanceFindMany.mockResolvedValue([]);

      const result = await getSafetyPerformance('proj-1');

      expect(result.projectId).toBe('proj-1');
      expect(result.trirTarget).toBe(1.0);
      expect(result.trirActual).toBe(0);
      expect(result.status).toBe('green');
      expect(result.recordableIncidents).toBe(0);
      expect(result.totalHoursWorked).toBe(0);
    });

    it('calculates TRIR correctly with recordable incidents and hours', async () => {
      mockProjectFindUnique.mockResolvedValue({ trirTarget: 1.0, startDate: null, endDate: null });
      mockRiskItemCount.mockResolvedValue(2);
      mockRiskItemFindMany.mockResolvedValue([
        { createdAt: new Date() },
        { createdAt: new Date() },
      ]);
      mockAttendanceFindMany.mockResolvedValue([
        { hours: 1000, date: new Date() },
        { hours: 500, date: new Date() },
      ]);

      const result = await getSafetyPerformance('proj-1');

      // TRIR = (2 * 200,000) / 1500 = 266.67
      expect(result.trirActual).toBeCloseTo(266.67, 2);
      expect(result.recordableIncidents).toBe(2);
      expect(result.totalHoursWorked).toBe(1500);
      // 266.67 / 1.0 = 266.67 => red
      expect(result.status).toBe('red');
    });

    it('uses default trirTarget when project field is null', async () => {
      mockProjectFindUnique.mockResolvedValue({ trirTarget: null, startDate: null, endDate: null });
      mockRiskItemCount.mockResolvedValue(1);
      mockRiskItemFindMany.mockResolvedValue([{ createdAt: new Date() }]);
      mockAttendanceFindMany.mockResolvedValue([{ hours: 200_000, date: new Date() }]);

      const result = await getSafetyPerformance('proj-1');

      // TRIR = (1 * 200,000) / 200,000 = 1.0
      expect(result.trirTarget).toBe(1.0);
      expect(result.trirActual).toBe(1.0);
      // 1.0 / 1.0 = 1.0 => red (>= 0.8)
      expect(result.status).toBe('red');
    });

    it('throws when project not found', async () => {
      mockProjectFindUnique.mockResolvedValue(null);
      await expect(getSafetyPerformance('proj-1')).rejects.toThrow('Project not found');
    });

    it('rounds TRIR to two decimal places', async () => {
      mockProjectFindUnique.mockResolvedValue({ trirTarget: 1.0, startDate: null, endDate: null });
      mockRiskItemCount.mockResolvedValue(1);
      mockRiskItemFindMany.mockResolvedValue([{ createdAt: new Date() }]);
      mockAttendanceFindMany.mockResolvedValue([{ hours: 3333, date: new Date() }]);

      const result = await getSafetyPerformance('proj-1');
      // TRIR = (1 * 200000) / 3333 = 60.006 => rounded to 60.01
      expect(result.trirActual).toBe(60.01);
    });

    it('returns empty series when no project dates set', async () => {
      mockProjectFindUnique.mockResolvedValue({ trirTarget: 1.0, startDate: null, endDate: null });
      mockRiskItemCount.mockResolvedValue(0);
      mockRiskItemFindMany.mockResolvedValue([]);
      mockAttendanceFindMany.mockResolvedValue([]);

      const result = await getSafetyPerformance('proj-1');

      // Without dates, fallback to today for both start and end so series is one point
      expect(result.series.length).toBe(1);
      expect(result.series[0].trirActual).toBe(0);
      expect(result.series[0].trirTarget).toBe(1.0);
    });

    it('builds monthly running TRIR series with cumulative hours and incidents', async () => {
      mockProjectFindUnique.mockResolvedValue({
        trirTarget: 1.0,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
      });
      mockRiskItemCount.mockResolvedValue(2);
      mockRiskItemFindMany.mockResolvedValue([
        { createdAt: new Date('2026-02-15') },
        { createdAt: new Date('2026-04-10') },
      ]);
      mockAttendanceFindMany.mockResolvedValue([
        { hours: 10000, date: new Date('2026-01-15') },
        { hours: 20000, date: new Date('2026-02-15') },
        { hours: 30000, date: new Date('2026-03-15') },
        { hours: 40000, date: new Date('2026-04-15') },
      ]);

      const result = await getSafetyPerformance('proj-1');

      // 6 months Jan -> Jun
      expect(result.series.length).toBe(6);
      // Jan: 0 incidents, 10k hours => TRIR 0
      expect(result.series[0].trirActual).toBe(0);
      expect(result.series[0].incidents).toBe(0);
      // Feb: 1 incident, 30k hours cumulative => TRIR 6.67
      expect(result.series[1].incidents).toBe(1);
      expect(result.series[1].trirActual).toBeCloseTo(6.67, 1);
      // Apr: 2 incidents, 100k hours cumulative => TRIR 4.0
      expect(result.series[3].incidents).toBe(2);
      expect(result.series[3].trirActual).toBe(4.0);
    });
  });
});
