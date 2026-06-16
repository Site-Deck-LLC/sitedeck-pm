import request from 'supertest';
import { createApp } from '../index';
import { setPrismaClient } from '../lib/prisma';
import { PrismaClient } from '@prisma/client';

const mockWebhooksLogCreate = jest.fn();
const mockWebhooksLogFindFirst = jest.fn();
const mockScheduleActivityFindUnique = jest.fn();
const mockScheduleActivityUpdate = jest.fn();
const mockScheduleActivityFindMany = jest.fn();
const mockProjectFindUnique = jest.fn();
const mockScheduleChangeRequestCreate = jest.fn();
const mockActivityRelationshipFindMany = jest.fn();

const mockPrisma = {
  webhooksLog: {
    create: mockWebhooksLogCreate,
    findFirst: mockWebhooksLogFindFirst,
  },
  scheduleActivity: {
    findUnique: mockScheduleActivityFindUnique,
    update: mockScheduleActivityUpdate,
    findMany: mockScheduleActivityFindMany,
  },
  project: {
    findUnique: mockProjectFindUnique,
  },
  scheduleChangeRequest: {
    create: mockScheduleChangeRequestCreate,
  },
  activityRelationship: {
    findMany: mockActivityRelationshipFindMany,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.clearAllMocks();
  setPrismaClient(mockPrisma);
});

describe('webhook.routes', () => {
  const app = createApp();

  it('accepts task-completed webhook without auth', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue(null);
    mockScheduleActivityFindUnique.mockResolvedValue({
      id: 'act-1',
      projectId: 'proj-1',
      percentComplete: 0,
      status: 'not_started',
    });
    mockScheduleActivityUpdate.mockResolvedValue({ id: 'act-1', status: 'complete' });
    mockProjectFindUnique.mockResolvedValue({
      id: 'proj-1',
      startDate: new Date('2026-01-01'),
      scheduleActivities: [
        { id: 'act-1', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-05'), duration: 4, predecessors: null, successors: null },
      ],
    });
    mockActivityRelationshipFindMany.mockResolvedValue([]);
    mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

    const res = await request(app).post('/api/v1/webhooks/task-completed').send({
      project_id: 'proj-1',
      activity_id: 'act-1',
      completed_by: 'user-1',
      completed_at: '2026-06-01T00:00:00Z',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 for unknown event', async () => {
    const res = await request(app).post('/api/v1/webhooks/unknown-event').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNKNOWN_EVENT');
  });

  it('is idempotent for duplicate events', async () => {
    mockWebhooksLogFindFirst.mockResolvedValue({ id: 'log-prev' });

    const res = await request(app).post('/api/v1/webhooks/task-completed').send({
      project_id: 'proj-1',
      activity_id: 'act-1',
      eventId: 'evt-1',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Duplicate event ignored');
  });
});
