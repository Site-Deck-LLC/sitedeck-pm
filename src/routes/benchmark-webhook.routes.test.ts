import request from 'supertest';
import { createHmac } from 'crypto';
import { createApp } from '../index';
import { setPrismaClient } from '../lib/prisma';
import { PrismaClient } from '@prisma/client';

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

function signBenchmarkBody(body: Record<string, unknown>, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}

beforeEach(() => {
  jest.resetAllMocks();
  setPrismaClient(mockPrisma);
  delete process.env.BENCHMARK_WEBHOOK_SECRET;
  delete process.env.NODE_ENV;
});

afterAll(() => {
  delete process.env.BENCHMARK_WEBHOOK_SECRET;
  delete process.env.NODE_ENV;
});

describe('benchmark-webhook.routes', () => {
  const app = createApp();

  it('accepts webhook with no secret configured in non-production', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

    const res = await request(app)
      .post('/api/v1/webhooks/benchmark')
      .send({ event: 'benchmark.hold_point.released', projectId: 'proj-1' });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('logged');
  });

  it('rejects webhook in production without secret but returns 200', async () => {
    process.env.NODE_ENV = 'production';

    const res = await request(app)
      .post('/api/v1/webhooks/benchmark')
      .send({ event: 'benchmark.hold_point.released', projectId: 'proj-1' });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('ignored');
    expect(res.body.details).toBe('Invalid or missing signature');
  });

  it('verifies valid signature in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BENCHMARK_WEBHOOK_SECRET = 'benchmark-secret';
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

    const payload = { event: 'benchmark.daily_report.posted', projectId: 'proj-1', reportDate: '2026-06-01' };
    const signature = signBenchmarkBody(payload, 'benchmark-secret');

    const res = await request(app)
      .post('/api/v1/webhooks/benchmark')
      .set('X-Benchmark-Signature', signature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('logged');
  });

  it('rejects invalid signature but returns 200', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BENCHMARK_WEBHOOK_SECRET = 'benchmark-secret';
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

    const res = await request(app)
      .post('/api/v1/webhooks/benchmark')
      .set('X-Benchmark-Signature', 'sha256=bad')
      .send({ event: 'benchmark.daily_report.posted', projectId: 'proj-1' });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('ignored');
  });

  it('creates ReworkTask on benchmark.ncr.opened', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });
    mockReworkTaskCreate.mockResolvedValue({ id: 'task-1', projectId: 'proj-1', source: 'ncr' });

    const res = await request(app).post('/api/v1/webhooks/benchmark').send({
      event: 'benchmark.ncr.opened',
      projectId: 'proj-1',
      dfowId: 'dfow-1',
      ncrId: 'ncr-1',
      internalNumber: 'NCR-2026-001',
      description: 'Concrete finish defect',
      severity: 'high',
    });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('rework_task_created');
    expect(mockReworkTaskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          dfowId: 'dfow-1',
          ncrId: 'ncr-1',
          source: 'ncr',
          title: 'NCR NCR-2026-001',
          priority: 'high',
          status: 'open',
        }),
      })
    );
  });

  it('resolves existing ReworkTask on benchmark.ncr.closed', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });
    mockReworkTaskFindFirst.mockResolvedValue({ id: 'task-1', status: 'open' });
    mockReworkTaskFindUnique.mockResolvedValue({ id: 'task-1', status: 'open' });
    mockReworkTaskUpdate.mockResolvedValue({ id: 'task-1', status: 'resolved' });

    const res = await request(app).post('/api/v1/webhooks/benchmark').send({
      event: 'benchmark.ncr.closed',
      projectId: 'proj-1',
      ncrId: 'ncr-1',
    });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('rework_task_resolved');
    expect(mockReworkTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1' },
        data: expect.objectContaining({ status: 'resolved', resolvedAt: expect.any(Date) }),
      })
    );
  });

  it('creates high-priority ReworkTask on failed inspection.completed', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });
    mockReworkTaskCreate.mockResolvedValue({ id: 'task-2', projectId: 'proj-1', source: 'inspection' });

    const res = await request(app).post('/api/v1/webhooks/benchmark').send({
      event: 'benchmark.inspection.completed',
      projectId: 'proj-1',
      dfowId: 'dfow-1',
      inspectionRecordId: 'insp-1',
      result: 'failed',
      description: 'Rebar spacing failed',
    });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('rework_task_created');
    expect(mockReworkTaskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          dfowId: 'dfow-1',
          inspectionRecordId: 'insp-1',
          source: 'inspection',
          priority: 'high',
          status: 'open',
        }),
      })
    );
  });

  it('logs only on passed inspection.completed', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

    const res = await request(app).post('/api/v1/webhooks/benchmark').send({
      event: 'benchmark.inspection.completed',
      projectId: 'proj-1',
      inspectionRecordId: 'insp-2',
      result: 'passed',
    });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('logged_only');
    expect(mockReworkTaskCreate).not.toHaveBeenCalled();
  });

  it('logs only on hold_point.released', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

    const res = await request(app).post('/api/v1/webhooks/benchmark').send({
      event: 'benchmark.hold_point.released',
      projectId: 'proj-1',
      holdPointId: 'hp-1',
    });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('logged');
  });

  it('logs only on daily_report.posted', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

    const res = await request(app).post('/api/v1/webhooks/benchmark').send({
      event: 'benchmark.daily_report.posted',
      projectId: 'proj-1',
      reportDate: '2026-06-01',
    });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('logged');
  });

  it('logs only on qcp.exported', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

    const res = await request(app).post('/api/v1/webhooks/benchmark').send({
      event: 'benchmark.qcp.exported',
      projectId: 'proj-1',
      qcpId: 'qcp-1',
    });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('logged');
  });

  it('is idempotent by eventId', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue({ id: 'log-prev' });

    const res = await request(app).post('/api/v1/webhooks/benchmark').send({
      event: 'benchmark.ncr.opened',
      projectId: 'proj-1',
      eventId: 'evt-1',
      ncrId: 'ncr-1',
      title: 'Dup',
    });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('duplicate');
    expect(mockReworkTaskCreate).not.toHaveBeenCalled();
  });

  it('ignores unknown event but returns 200', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

    const res = await request(app).post('/api/v1/webhooks/benchmark').send({
      event: 'benchmark.unknown',
    });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('logged_only');
  });
});
