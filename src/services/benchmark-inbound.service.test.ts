import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import {
  verifyBenchmarkSignature,
  handleBenchmarkWebhook,
} from './benchmark-inbound.service';

const mockWebhooksLogCreate = jest.fn();
const mockWebhooksLogFindFirst = jest.fn();
const mockReworkTaskCreate = jest.fn();
const mockReworkTaskFindFirst = jest.fn();
const mockReworkTaskFindUnique = jest.fn();
const mockReworkTaskUpdate = jest.fn();

const mockPrisma = {
  webhooksLog: {
    create: mockWebhooksLogCreate,
    findFirst: mockWebhooksLogFindFirst,
  },
  reworkTask: {
    create: mockReworkTaskCreate,
    findFirst: mockReworkTaskFindFirst,
    findUnique: mockReworkTaskFindUnique,
    update: mockReworkTaskUpdate,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.resetAllMocks();
  setPrismaClient(mockPrisma);
  delete process.env.BENCHMARK_WEBHOOK_SECRET;
  delete process.env.PM_BENCHMARK_WEBHOOK_SECRET;
  delete process.env.NODE_ENV;
});

describe('benchmark-inbound.service', () => {
  describe('verifyBenchmarkSignature', () => {
    it('allows requests when secret is not configured in non-production', () => {
      expect(verifyBenchmarkSignature('{"event":"test"}', undefined)).toBe(true);
    });

    it('rejects when secret is not configured in production', () => {
      process.env.NODE_ENV = 'production';
      expect(verifyBenchmarkSignature('{"event":"test"}', undefined)).toBe(false);
    });

    it('rejects when signature is missing and secret is set', () => {
      process.env.BENCHMARK_WEBHOOK_SECRET = 'my-secret';
      expect(verifyBenchmarkSignature('{"event":"test"}', undefined)).toBe(false);
    });

    it('accepts a valid signature', () => {
      process.env.BENCHMARK_WEBHOOK_SECRET = 'my-secret';
      const body = '{"event":"test"}';
      const { createHmac } = require('crypto');
      const expected = 'sha256=' + createHmac('sha256', 'my-secret').update(body).digest('hex');
      expect(verifyBenchmarkSignature(body, expected)).toBe(true);
    });

    it('accepts PM_BENCHMARK_WEBHOOK_SECRET as fallback', () => {
      process.env.PM_BENCHMARK_WEBHOOK_SECRET = 'fallback-secret';
      const body = '{"event":"test"}';
      const { createHmac } = require('crypto');
      const expected = 'sha256=' + createHmac('sha256', 'fallback-secret').update(body).digest('hex');
      expect(verifyBenchmarkSignature(body, expected)).toBe(true);
    });

    it('rejects an invalid signature', () => {
      process.env.BENCHMARK_WEBHOOK_SECRET = 'my-secret';
      expect(verifyBenchmarkSignature('{"event":"test"}', 'sha256=invalid')).toBe(false);
    });
  });

  describe('handleBenchmarkWebhook', () => {
    it('handles unknown events as logged_only', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleBenchmarkWebhook({ event: 'benchmark.unknown' });

      expect(result.action).toBe('logged_only');
    });

    it('ncr.opened creates a rework task', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });
      mockReworkTaskFindFirst.mockResolvedValue(null);
      mockReworkTaskCreate.mockResolvedValue({ id: 'task-1', projectId: 'proj-1', source: 'ncr' });

      const result = await handleBenchmarkWebhook({
        event: 'benchmark.ncr.opened',
        projectId: 'proj-1',
        dfowId: 'dfow-123',
        ncrId: 'ncr-1',
        internalNumber: 'NCR-2026-001',
        description: 'Rebar spacing issue',
        severity: 'high',
      });

      expect(result.action).toBe('rework_task_created');
      expect(mockReworkTaskCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'proj-1',
            dfowId: 'dfow-123',
            ncrId: 'ncr-1',
            source: 'ncr',
            title: 'NCR NCR-2026-001',
            priority: 'high',
            status: 'open',
          }),
        })
      );
    });

    it('ncr.closed resolves an existing rework task', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });
      mockReworkTaskFindFirst.mockResolvedValue({ id: 'task-1', status: 'open' });
      mockReworkTaskFindUnique.mockResolvedValue({ id: 'task-1', status: 'open' });
      mockReworkTaskUpdate.mockResolvedValue({ id: 'task-1', status: 'resolved' });

      const result = await handleBenchmarkWebhook({
        event: 'benchmark.ncr.closed',
        projectId: 'proj-1',
        ncrId: 'ncr-1',
      });

      expect(result.action).toBe('rework_task_resolved');
      expect(mockReworkTaskUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ status: 'resolved', resolvedAt: expect.any(Date) }),
        })
      );
    });

    it('inspection.completed with failed result creates a high-priority rework task', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });
      mockReworkTaskFindFirst.mockResolvedValue(null);
      mockReworkTaskCreate.mockResolvedValue({ id: 'task-2', projectId: 'proj-1', source: 'inspection' });

      const result = await handleBenchmarkWebhook({
        event: 'benchmark.inspection.completed',
        projectId: 'proj-1',
        dfowId: 'dfow-123',
        inspectionRecordId: 'insp-1',
        result: 'failed',
        description: 'Rebar spacing failed',
      });

      expect(result.action).toBe('rework_task_created');
      expect(mockReworkTaskCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'proj-1',
            source: 'inspection',
            priority: 'high',
            inspectionRecordId: 'insp-1',
          }),
        })
      );
    });

    it('inspection.completed with passed result logs only', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleBenchmarkWebhook({
        event: 'benchmark.inspection.completed',
        projectId: 'proj-1',
        dfowId: 'dfow-123',
        inspectionRecordId: 'insp-1',
        result: 'passed',
      });

      expect(result.action).toBe('logged_only');
      expect(mockReworkTaskCreate).not.toHaveBeenCalled();
    });

    it('hold_point.released logs as processed', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleBenchmarkWebhook({
        event: 'benchmark.hold_point.released',
        projectId: 'proj-1',
        holdPointId: 'hp-1',
      });

      expect(result.action).toBe('logged');
    });

    it('daily_report.posted logs as processed', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleBenchmarkWebhook({
        event: 'benchmark.daily_report.posted',
        projectId: 'proj-1',
        reportDate: '2026-06-16',
      });

      expect(result.action).toBe('logged');
    });

    it('qcp.exported logs as processed', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleBenchmarkWebhook({
        event: 'benchmark.qcp.exported',
        projectId: 'proj-1',
        qcpId: 'qcp-1',
      });

      expect(result.action).toBe('logged');
    });

    it('is idempotent by eventId', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue({ id: 'log-prev' });

      const result = await handleBenchmarkWebhook({
        event: 'benchmark.ncr.opened',
        projectId: 'proj-1',
        eventId: 'evt-1',
        ncrId: 'ncr-1',
      });

      expect(result.action).toBe('duplicate');
      expect(mockReworkTaskCreate).not.toHaveBeenCalled();
    });
  });
});
