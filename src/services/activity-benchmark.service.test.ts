import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import { linkActivityToBenchmark } from './activity-benchmark.service';

const mockScheduleActivityFindUnique = jest.fn();
const mockScheduleActivityUpdate = jest.fn();

const mockPrisma = {
  scheduleActivity: {
    findUnique: mockScheduleActivityFindUnique,
    update: mockScheduleActivityUpdate,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.clearAllMocks();
  setPrismaClient(mockPrisma);
  delete process.env.PM_BENCHMARK_ACTIVITY_URL;
  delete process.env.PM_BENCHMARK_WEBHOOK_URL;
  delete process.env.PM_BENCHMARK_WEBHOOK_SECRET;
});

describe('activity-benchmark.service', () => {
  describe('linkActivityToBenchmark', () => {
    it('throws when activity does not exist', async () => {
      mockScheduleActivityFindUnique.mockResolvedValue(null);
      await expect(linkActivityToBenchmark('act-1', 'dfow-1')).rejects.toThrow('Activity not found');
    });

    it('sets linkedBenchmarkDfowId and returns updated activity', async () => {
      mockScheduleActivityFindUnique.mockResolvedValue({
        id: 'act-1',
        projectId: 'proj-1',
        name: 'Foundation Pour',
        linkedBenchmarkDfowId: null,
      });
      mockScheduleActivityUpdate.mockResolvedValue({
        id: 'act-1',
        linkedBenchmarkDfowId: 'dfow-1',
      });

      const result = await linkActivityToBenchmark('act-1', 'dfow-1');
      expect(mockScheduleActivityUpdate).toHaveBeenCalledWith({
        where: { id: 'act-1' },
        data: { linkedBenchmarkDfowId: 'dfow-1' },
      });
      expect(result.linkedBenchmarkDfowId).toBe('dfow-1');
    });

    it('is idempotent when already linked to same dfowId', async () => {
      mockScheduleActivityFindUnique.mockResolvedValue({
        id: 'act-1',
        projectId: 'proj-1',
        name: 'Foundation Pour',
        linkedBenchmarkDfowId: 'dfow-1',
      });

      const result = await linkActivityToBenchmark('act-1', 'dfow-1');
      expect(mockScheduleActivityUpdate).not.toHaveBeenCalled();
      expect(result.linkedBenchmarkDfowId).toBe('dfow-1');
    });

    it('fires webhook when URL is configured', async () => {
      process.env.PM_BENCHMARK_ACTIVITY_URL = 'http://localhost:9999/webhook';
      process.env.PM_BENCHMARK_WEBHOOK_SECRET = 'secret';

      mockScheduleActivityFindUnique.mockResolvedValue({
        id: 'act-1',
        projectId: 'proj-1',
        name: 'Foundation Pour',
        linkedBenchmarkDfowId: null,
      });
      mockScheduleActivityUpdate.mockResolvedValue({
        id: 'act-1',
        linkedBenchmarkDfowId: 'dfow-1',
      });

      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      await linkActivityToBenchmark('act-1', 'dfow-1');

      // Wait for setImmediate
      await new Promise((r) => setImmediate(r));

      expect(global.fetch).toHaveBeenCalled();
      const call = (global.fetch as jest.Mock).mock.calls[0];
      expect(call[0]).toBe('http://localhost:9999/webhook');
      expect(call[1].method).toBe('POST');
    });
  });
});
