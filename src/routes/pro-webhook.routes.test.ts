import request from 'supertest';
import { createApp } from '../index';
import { setPrismaClient } from '../lib/prisma';
import { PrismaClient } from '@prisma/client';

jest.mock('../services/auth.service', () => ({
  getUserClaims: jest.fn().mockResolvedValue(null),
  setUserProjectClaims: jest.fn().mockResolvedValue(undefined),
}));

const mockWebhooksLogFindFirst = jest.fn();
const mockWebhooksLogCreate = jest.fn();
const mockScheduleActivityFindUnique = jest.fn();
const mockScheduleActivityUpdate = jest.fn();
const mockReworkTaskFindFirst = jest.fn();
const mockReworkTaskUpdate = jest.fn();
const mockRiskItemCreate = jest.fn();
const mockProjectMemberFindMany = jest.fn();
const mockOrganizationMemberFindUnique = jest.fn();
const mockOrganizationMemberCreate = jest.fn();
const mockOrganizationMemberUpdate = jest.fn();
const mockProjectMemberFindFirst = jest.fn();
const mockProjectMemberCreate = jest.fn();
const mockNotificationCreate = jest.fn();

const mockPrisma = {
  webhooksLog: {
    create: mockWebhooksLogCreate,
    findFirst: mockWebhooksLogFindFirst,
  },
  scheduleActivity: {
    findUnique: mockScheduleActivityFindUnique,
    update: mockScheduleActivityUpdate,
  },
  reworkTask: {
    findFirst: mockReworkTaskFindFirst,
    update: mockReworkTaskUpdate,
  },
  riskItem: {
    create: mockRiskItemCreate,
  },
  projectMember: {
    findMany: mockProjectMemberFindMany,
    findFirst: mockProjectMemberFindFirst,
    create: mockProjectMemberCreate,
  },
  organizationMember: {
    findUnique: mockOrganizationMemberFindUnique,
    create: mockOrganizationMemberCreate,
    update: mockOrganizationMemberUpdate,
  },
  notification: {
    create: mockNotificationCreate,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.resetAllMocks();
  setPrismaClient(mockPrisma);
  process.env.PRO_SERVICE_TOKEN = 'test-pro-token';
  delete process.env.NODE_ENV;
});

afterAll(() => {
  delete process.env.PRO_SERVICE_TOKEN;
  delete process.env.NODE_ENV;
});

describe('pro-webhook.routes', () => {
  const app = createApp();

  it('rejects request without service token', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/pro')
      .send({ event: 'pro.work.complete', projectId: 'proj-1' });

    expect(res.status).toBe(401);
    expect(res.body.action).toBe('ignored');
    expect(res.body.details).toContain('Invalid or missing service token');
  });

  it('rejects request with invalid service token', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/pro')
      .set('X-Service-Token', 'bad-token')
      .send({ event: 'pro.work.complete', projectId: 'proj-1' });

    expect(res.status).toBe(401);
    expect(res.body.action).toBe('ignored');
  });

  it('ignores unknown event but returns 200', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

    const res = await request(app)
      .post('/api/v1/webhooks/pro')
      .set('X-Service-Token', 'test-pro-token')
      .send({ event: 'pro.unknown', eventId: 'evt-1' });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('logged_only');
  });

  it('is idempotent by eventId', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue({ id: 'dup-1' });
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

    const res = await request(app)
      .post('/api/v1/webhooks/pro')
      .set('X-Service-Token', 'test-pro-token')
      .send({ event: 'pro.work.complete', eventId: 'evt-dup', projectId: 'proj-1' });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('duplicate');
  });

  it('updates activity on pro.work.complete', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });
    mockScheduleActivityFindUnique.mockResolvedValue({
      id: 'act-1',
      name: 'Concrete Pour',
    });
    mockScheduleActivityUpdate.mockResolvedValue({ id: 'act-1' });

    const res = await request(app)
      .post('/api/v1/webhooks/pro')
      .set('X-Service-Token', 'test-pro-token')
      .send({
        event: 'pro.work.complete',
        eventId: 'evt-work-1',
        pmProjectId: 'proj-1',
        pmActivityId: 'act-1',
      });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('activity_updated');
    expect(mockScheduleActivityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'act-1' },
        data: { status: 'complete' },
      })
    );
  });

  it('resolves ReworkTask on pro.rework.complete', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });
    mockReworkTaskFindFirst.mockResolvedValue({ id: 'rt-1', projectId: 'proj-1', ncrId: 'ncr-1' });
    mockReworkTaskUpdate.mockResolvedValue({ id: 'rt-1' });

    const res = await request(app)
      .post('/api/v1/webhooks/pro')
      .set('X-Service-Token', 'test-pro-token')
      .send({
        event: 'pro.rework.complete',
        eventId: 'evt-rework-1',
        pmProjectId: 'proj-1',
        ncrId: 'ncr-1',
        dfowId: 'dfow-1',
        unitReference: 'BAT-001',
      });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('rework_task_resolved');
    expect(mockReworkTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt-1' },
        data: expect.objectContaining({ status: 'resolved' }),
      })
    );
  });

  it('creates risk item on pro.safety_incident', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });
    mockRiskItemCreate.mockResolvedValue({ id: 'risk-1' });
    mockProjectMemberFindMany.mockResolvedValue([
      { userId: 'pm-1', email: 'pm@test.com' },
    ]);
    mockNotificationCreate.mockResolvedValue({ id: 'notif-1' });

    const res = await request(app)
      .post('/api/v1/webhooks/pro')
      .set('X-Service-Token', 'test-pro-token')
      .send({
        event: 'pro.safety_incident',
        eventId: 'evt-safe-1',
        pmProjectId: 'proj-1',
        severity: 'high',
        description: 'Worker fell from scaffold',
      });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('risk_created');
    expect(mockRiskItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          category: 'safety',
          description: 'Worker fell from scaffold',
        }),
      })
    );
  });

  it('upserts user on pro.user.approved', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });
    mockOrganizationMemberFindUnique.mockResolvedValue(null);
    mockOrganizationMemberCreate.mockResolvedValue({ id: 'om-1' });
    mockProjectMemberFindFirst.mockResolvedValue(null);
    mockProjectMemberCreate.mockResolvedValue({ id: 'mem-1' });

    const res = await request(app)
      .post('/api/v1/webhooks/pro')
      .set('X-Service-Token', 'test-pro-token')
      .send({
        event: 'pro.user.approved',
        eventId: 'evt-user-1',
        uid: 'YUcAjSkVx6aCvzxBpG9NzIciVFG2',
        email: 'vasquezj@orionfsl.com',
        name: 'Jose Vasquez',
        orgId: 'orion-fiber-solutions',
        role: 'admin',
        projectIds: ['willow-creek'],
      });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('user_upserted');
    expect(mockOrganizationMemberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: 'orion-fiber-solutions',
          userId: 'YUcAjSkVx6aCvzxBpG9NzIciVFG2',
          email: 'vasquezj@orionfsl.com',
          role: 'project_manager',
        }),
      })
    );
  });
});
