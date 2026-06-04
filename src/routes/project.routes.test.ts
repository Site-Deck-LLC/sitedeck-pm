import request from 'supertest';
import { createApp } from '../index';
import { setPrismaClient } from '../lib/prisma';
import { PrismaClient } from '@prisma/client';
import { setAuthInstance } from '../services/auth.service';

const mockProjectCreate = jest.fn();
const mockProjectFindUnique = jest.fn();
const mockProjectUpdate = jest.fn();
const mockWorkBreakdownItemCreate = jest.fn();
const mockWorkBreakdownItemCount = jest.fn();

const mockPrisma = {
  project: {
    create: mockProjectCreate,
    findUnique: mockProjectFindUnique,
    update: mockProjectUpdate,
  },
  workBreakdownItem: {
    create: mockWorkBreakdownItemCreate,
    count: mockWorkBreakdownItemCount,
  },
} as unknown as PrismaClient;

const mockVerifyIdToken = jest.fn();
const mockAuth = {
  verifyIdToken: mockVerifyIdToken,
} as unknown as import('firebase-admin/auth').Auth;

beforeEach(() => {
  jest.clearAllMocks();
  setPrismaClient(mockPrisma);
  setAuthInstance(mockAuth);
});

describe('project.routes', () => {
  const app = createApp();

  function authHeader(role = 'project_manager') {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-1', role });
    return { Authorization: 'Bearer valid-token' };
  }

  describe('POST /api/v1/projects', () => {
    it('creates a project when authenticated as project_manager', async () => {
      mockProjectCreate.mockResolvedValue({ id: 'proj-1', name: 'Test Project' });

      const res = await request(app)
        .post('/api/v1/projects')
        .set(authHeader())
        .send({ name: 'Test Project', orgId: 'org-1', structureType: 'WBS' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('proj-1');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await request(app).post('/api/v1/projects').send({});
      expect(res.status).toBe(401);
    });

    it('returns 403 when role is not allowed', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set(authHeader('field_crew'))
        .send({});

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    it('returns a project', async () => {
      mockProjectFindUnique.mockResolvedValue({ id: 'proj-1', name: 'Test' });

      const res = await request(app).get('/api/v1/projects/proj-1').set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('proj-1');
    });
  });

  describe('POST /api/v1/projects/:id/wbs-items', () => {
    it('adds a WBS item', async () => {
      mockProjectFindUnique.mockResolvedValue({
        id: 'proj-1',
        structureType: 'WBS',
        structureLocked: false,
      });
      mockWorkBreakdownItemCount.mockResolvedValue(0);
      mockWorkBreakdownItemCreate.mockResolvedValue({ id: 'wbs-1', code: '1.1', name: 'Foundation' });
      mockProjectUpdate.mockResolvedValue({ id: 'proj-1', structureLocked: true });

      const res = await request(app)
        .post('/api/v1/projects/proj-1/wbs-items')
        .set(authHeader())
        .send({ code: '1.1', name: 'Foundation' });

      expect(res.status).toBe(201);
      expect(res.body.code).toBe('1.1');
    });
  });
});
