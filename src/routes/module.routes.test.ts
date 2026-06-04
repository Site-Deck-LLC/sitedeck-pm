import request from 'supertest';
import { createApp } from '../index';
import { setPrismaClient } from '../lib/prisma';
import { PrismaClient } from '@prisma/client';
import { setAuthInstance } from '../services/auth.service';

// ---------- Prisma mocks ----------
const mockScheduleActivityFindMany = jest.fn();
const mockScheduleActivityCreate = jest.fn();
const mockScheduleActivityFindUnique = jest.fn();
const mockScheduleActivityUpdate = jest.fn();
const mockScheduleActivityDelete = jest.fn();
const mockScheduleBaselineFindMany = jest.fn();
const mockScheduleBaselineCreate = jest.fn();
const mockScheduleChangeRequestFindMany = jest.fn();
const mockScheduleChangeRequestCreate = jest.fn();
const mockBudgetLineFindMany = jest.fn();
const mockBudgetLineCreate = jest.fn();
const mockBudgetLineFindUnique = jest.fn();
const mockBudgetLineUpdate = jest.fn();
const mockCostTransactionFindMany = jest.fn();
const mockPurchaseOrderFindMany = jest.fn();
const mockPurchaseOrderCreate = jest.fn();
const mockPurchaseOrderFindUnique = jest.fn();
const mockPurchaseOrderUpdate = jest.fn();
const mockSubcontractFindMany = jest.fn();
const mockSubcontractCreate = jest.fn();
const mockInvoiceFindMany = jest.fn();
const mockScopeStatementFindMany = jest.fn();
const mockScopeStatementCreate = jest.fn();
const mockChangeOrderFindMany = jest.fn();
const mockChangeOrderCreate = jest.fn();
const mockChangeOrderCount = jest.fn();
const mockRfiFindMany = jest.fn();
const mockRfiCreate = jest.fn();
const mockRfiCount = jest.fn();
const mockRfiFindFirst = jest.fn();
const mockSubmittalFindMany = jest.fn();
const mockSubmittalCreate = jest.fn();
const mockSubmittalCount = jest.fn();
const mockSubmittalFindFirst = jest.fn();
const mockRiskItemFindMany = jest.fn();
const mockRiskItemCreate = jest.fn();
const mockIssueFindMany = jest.fn();
const mockIssueCreate = jest.fn();
const mockIssueFindFirst = jest.fn();
const mockUnifiedChangeLogFindMany = jest.fn();
const mockCloseoutChecklistFindFirst = jest.fn();
const mockCloseoutChecklistCreate = jest.fn();
const mockEquipmentFindMany = jest.fn();
const mockProjectFindUnique = jest.fn();

const mockPrisma = {
  scheduleActivity: {
    findMany: mockScheduleActivityFindMany,
    create: mockScheduleActivityCreate,
    findUnique: mockScheduleActivityFindUnique,
    update: mockScheduleActivityUpdate,
    delete: mockScheduleActivityDelete,
  },
  scheduleBaseline: {
    findMany: mockScheduleBaselineFindMany,
    create: mockScheduleBaselineCreate,
  },
  scheduleChangeRequest: {
    findMany: mockScheduleChangeRequestFindMany,
    create: mockScheduleChangeRequestCreate,
  },
  budgetLine: {
    findMany: mockBudgetLineFindMany,
    create: mockBudgetLineCreate,
    findUnique: mockBudgetLineFindUnique,
    update: mockBudgetLineUpdate,
  },
  costTransaction: {
    findMany: mockCostTransactionFindMany,
  },
  purchaseOrder: {
    findMany: mockPurchaseOrderFindMany,
    create: mockPurchaseOrderCreate,
    findUnique: mockPurchaseOrderFindUnique,
    update: mockPurchaseOrderUpdate,
  },
  subcontract: {
    findMany: mockSubcontractFindMany,
    create: mockSubcontractCreate,
  },
  invoice: {
    findMany: mockInvoiceFindMany,
  },
  scopeStatement: {
    findMany: mockScopeStatementFindMany,
    create: mockScopeStatementCreate,
  },
  changeOrder: {
    findMany: mockChangeOrderFindMany,
    create: mockChangeOrderCreate,
    count: mockChangeOrderCount,
  },
  rfi: {
    findMany: mockRfiFindMany,
    create: mockRfiCreate,
    count: mockRfiCount,
    findFirst: mockRfiFindFirst,
  },
  submittal: {
    findMany: mockSubmittalFindMany,
    create: mockSubmittalCreate,
    count: mockSubmittalCount,
    findFirst: mockSubmittalFindFirst,
  },
  riskItem: {
    findMany: mockRiskItemFindMany,
    create: mockRiskItemCreate,
  },
  issue: {
    findMany: mockIssueFindMany,
    create: mockIssueCreate,
    findFirst: mockIssueFindFirst,
  },
  unifiedChangeLog: {
    findMany: mockUnifiedChangeLogFindMany,
  },
  closeoutChecklist: {
    findFirst: mockCloseoutChecklistFindFirst,
    create: mockCloseoutChecklistCreate,
  },
  equipment: {
    findMany: mockEquipmentFindMany,
  },
  project: {
    findUnique: mockProjectFindUnique,
  },
} as unknown as PrismaClient;

// ---------- Auth mock ----------
const mockVerifyIdToken = jest.fn();
const mockAuth = {
  verifyIdToken: mockVerifyIdToken,
} as unknown as import('firebase-admin/auth').Auth;

beforeEach(() => {
  jest.clearAllMocks();
  setPrismaClient(mockPrisma);
  setAuthInstance(mockAuth);
});

describe('module.routes', () => {
  const app = createApp();

  function authHeader(role = 'project_manager') {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-1', role });
    return { Authorization: 'Bearer valid-token' };
  }

  // ─── Schedule ───
  describe('Schedule routes', () => {
    it('GET /projects/:id/schedule/activities', async () => {
      mockScheduleActivityFindMany.mockResolvedValue([{ id: 'act-1', name: 'Foundation' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/schedule/activities')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('POST /projects/:id/schedule/activities', async () => {
      mockScheduleActivityCreate.mockResolvedValue({ id: 'act-1', name: 'Foundation' });
      mockProjectFindUnique.mockResolvedValue({ id: 'proj-1', startDate: new Date('2026-01-01'), scheduleActivities: [] });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/schedule/activities')
        .set(authHeader())
        .send({
          name: 'Foundation',
          startDate: '2026-01-01',
          endDate: '2026-01-05',
          duration: 4,
        });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Foundation');
    });

    it('GET /projects/:id/schedule/baselines', async () => {
      mockScheduleBaselineFindMany.mockResolvedValue([{ id: 'bl-1', name: 'Kickoff' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/schedule/baselines')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('POST /projects/:id/schedule/baselines', async () => {
      mockScheduleBaselineCreate.mockResolvedValue({ id: 'bl-1', name: 'Kickoff' });
      mockScheduleActivityFindMany.mockResolvedValue([]);
      const res = await request(app)
        .post('/api/v1/projects/proj-1/schedule/baselines')
        .set(authHeader())
        .send({ name: 'Kickoff', createdBy: 'user-1' });
      expect(res.status).toBe(201);
    });

    it('GET /projects/:id/schedule/change-requests', async () => {
      mockScheduleChangeRequestFindMany.mockResolvedValue([{ id: 'cr-1' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/schedule/change-requests')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('POST /projects/:id/schedule/change-requests', async () => {
      mockScheduleChangeRequestCreate.mockResolvedValue({ id: 'cr-1' });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/schedule/change-requests')
        .set(authHeader())
        .send({ activityId: 'act-1', requestedBy: 'user-1', reasonCode: 'weather_delay' });
      expect(res.status).toBe(201);
    });
  });

  // ─── Cost ───
  describe('Cost routes', () => {
    it('GET /projects/:id/cost/budget-lines', async () => {
      mockBudgetLineFindMany.mockResolvedValue([{ id: 'bl-1', name: 'Labor' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/cost/budget-lines')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('POST /projects/:id/cost/budget-lines', async () => {
      mockBudgetLineCreate.mockResolvedValue({ id: 'bl-1', name: 'Labor', budgetAmount: 100_000 });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/cost/budget-lines')
        .set(authHeader())
        .send({ name: 'Labor', budgetAmount: 100_000 });
      expect(res.status).toBe(201);
    });

    it('GET /projects/:id/cost/evm', async () => {
      mockBudgetLineFindMany.mockResolvedValue([
        { id: 'bl-1', budgetAmount: 100_000, incurredAmount: 50_000, percentComplete: 0.5, varianceFlag: 'green' },
      ]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/cost/evm')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.evm).toBeDefined();
    });

    it('GET /projects/:id/cost/transactions', async () => {
      mockCostTransactionFindMany.mockResolvedValue([{ id: 'tx-1' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/cost/transactions')
        .set(authHeader());
      expect(res.status).toBe(200);
    });
  });

  // ─── Dashboard ───
  describe('Dashboard routes', () => {
    it('GET /projects/:id/dashboard/morning', async () => {
      mockScheduleActivityFindMany.mockResolvedValue([]);
      mockBudgetLineFindMany.mockResolvedValue([]);
      mockPurchaseOrderFindMany.mockResolvedValue([]);
      mockIssueFindMany.mockResolvedValue([]);
      mockEquipmentFindMany.mockResolvedValue([]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/dashboard/morning')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.tiles).toBeDefined();
    });
  });

  // ─── Procurement ───
  describe('Procurement routes', () => {
    it('GET /projects/:id/procurement/purchase-orders', async () => {
      mockPurchaseOrderFindMany.mockResolvedValue([{ id: 'po-1' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/procurement/purchase-orders')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('POST /projects/:id/procurement/purchase-orders', async () => {
      mockPurchaseOrderCreate.mockResolvedValue({ id: 'po-1', poNumber: 'PO-001' });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/procurement/purchase-orders')
        .set(authHeader())
        .send({
          poNumber: 'PO-001',
          vendorName: 'Acme',
          createdBy: 'user-1',
          lineItems: [{ materialName: 'Steel', quantity: 100, unit: 'ft', unitPrice: 10 }],
        });
      expect(res.status).toBe(201);
    });

    it('GET /projects/:id/procurement/subcontracts', async () => {
      mockSubcontractFindMany.mockResolvedValue([{ id: 'sub-1' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/procurement/subcontracts')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('POST /projects/:id/procurement/subcontracts', async () => {
      mockSubcontractCreate.mockResolvedValue({ id: 'sub-1' });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/procurement/subcontracts')
        .set(authHeader())
        .send({ subcontractorName: 'ABC', contractAmount: 50_000 });
      expect(res.status).toBe(201);
    });
  });

  // ─── Scope ───
  describe('Scope routes', () => {
    it('GET /projects/:id/scope/scope-statements', async () => {
      mockScopeStatementFindMany.mockResolvedValue([{ id: 'ss-1' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/scope/scope-statements')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('POST /projects/:id/scope/scope-statements', async () => {
      mockScopeStatementCreate.mockResolvedValue({ id: 'ss-1' });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/scope/scope-statements')
        .set(authHeader())
        .send({ content: 'Scope content', createdBy: 'user-1' });
      expect(res.status).toBe(201);
    });

    it('GET /projects/:id/scope/change-orders', async () => {
      mockChangeOrderFindMany.mockResolvedValue([{ id: 'co-1' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/scope/change-orders')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('POST /projects/:id/scope/change-orders', async () => {
      mockChangeOrderCount.mockResolvedValue(0);
      mockChangeOrderCreate.mockResolvedValue({ id: 'co-1' });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/scope/change-orders')
        .set(authHeader())
        .send({ coNumber: 'CO-001', date: '2026-06-01', description: 'Change' });
      expect(res.status).toBe(201);
    });
  });

  // ─── Communications ───
  describe('Communications routes', () => {
    it('GET /projects/:id/communications/rfis', async () => {
      mockRfiFindMany.mockResolvedValue([{ id: 'rfi-1' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/communications/rfis')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('POST /projects/:id/communications/rfis', async () => {
      mockRfiCount.mockResolvedValue(0);
      mockRfiFindFirst.mockResolvedValue(null);
      mockRfiCreate.mockResolvedValue({ id: 'rfi-1' });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/communications/rfis')
        .set(authHeader())
        .send({ rfiNumber: 'RFI-001', subject: 'Question', description: 'Details', submittedBy: 'user-1' });
      expect(res.status).toBe(201);
    });

    it('GET /projects/:id/communications/submittals', async () => {
      mockSubmittalFindMany.mockResolvedValue([{ id: 'sub-1' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/communications/submittals')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('POST /projects/:id/communications/submittals', async () => {
      mockSubmittalCount.mockResolvedValue(0);
      mockSubmittalFindFirst.mockResolvedValue(null);
      mockSubmittalCreate.mockResolvedValue({ id: 'sub-1' });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/communications/submittals')
        .set(authHeader())
        .send({ submittalNumber: 'SUB-001', title: 'Drawing', submittedBy: 'user-1' });
      expect(res.status).toBe(201);
    });
  });

  // ─── Risk ───
  describe('Risk routes', () => {
    it('GET /projects/:id/risk/risk-items', async () => {
      mockRiskItemFindMany.mockResolvedValue([{ id: 'risk-1' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/risk/risk-items')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('POST /projects/:id/risk/risk-items', async () => {
      mockRiskItemCreate.mockResolvedValue({ id: 'risk-1' });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/risk/risk-items')
        .set(authHeader())
        .send({
          description: 'Weather risk',
          category: 'external',
          probability: 'high',
          impact: 'high',
          owner: 'user-1',
        });
      expect(res.status).toBe(201);
    });
  });

  // ─── Integration ───
  describe('Integration routes', () => {
    it('GET /projects/:id/integration/issues', async () => {
      mockIssueFindMany.mockResolvedValue([{ id: 'issue-1' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/integration/issues')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('POST /projects/:id/integration/issues', async () => {
      mockIssueFindFirst.mockResolvedValue(null);
      mockIssueCreate.mockResolvedValue({ id: 'issue-1' });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/integration/issues')
        .set(authHeader())
        .send({
          type: 'field_issue',
          source: 'manual',
          title: 'Problem',
          description: 'Details',
          createdBy: 'user-1',
        });
      expect(res.status).toBe(201);
    });

    it('GET /projects/:id/integration/change-log', async () => {
      mockUnifiedChangeLogFindMany.mockResolvedValue([{ id: 'log-1' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/integration/change-log')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('GET /projects/:id/integration/closeout', async () => {
      mockCloseoutChecklistFindFirst.mockResolvedValue({ id: 'cl-1', items: [] });
      const res = await request(app)
        .get('/api/v1/projects/proj-1/integration/closeout')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('POST /projects/:id/integration/closeout', async () => {
      mockCloseoutChecklistFindFirst.mockResolvedValue(null);
      mockCloseoutChecklistCreate.mockResolvedValue({ id: 'cl-1', items: [] });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/integration/closeout')
        .set(authHeader())
        .send({});
      expect(res.status).toBe(201);
    });
  });

  // ─── Resource ───
  describe('Resource routes', () => {
    it('GET /projects/:id/resource/equipment', async () => {
      mockEquipmentFindMany.mockResolvedValue([{ id: 'eq-1' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/resource/equipment')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('GET /projects/:id/resource/equipment-cost-summary', async () => {
      mockCostTransactionFindMany.mockResolvedValue([{ budgetLineId: 'bl-1', amount: 100, source: 'equipment_webhook' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/resource/equipment-cost-summary')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('GET /projects/:id/resource/labor-cost-summary', async () => {
      mockCostTransactionFindMany.mockResolvedValue([{ budgetLineId: 'bl-1', amount: 8, source: 'labor_webhook' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/resource/labor-cost-summary')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('GET /projects/:id/resource/idle-equipment', async () => {
      mockEquipmentFindMany.mockResolvedValue([]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/resource/idle-equipment')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ─── Owners Rep ───
  describe('Owners Rep routes', () => {
    it('GET /projects/:id/owners-rep/dashboard', async () => {
      mockScheduleActivityFindMany.mockResolvedValue([]);
      mockBudgetLineFindMany.mockResolvedValue([]);
      mockPurchaseOrderFindMany.mockResolvedValue([]);
      mockIssueFindMany.mockResolvedValue([]);
      mockEquipmentFindMany.mockResolvedValue([]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/owners-rep/dashboard')
        .set(authHeader('owners_rep'));
      expect(res.status).toBe(200);
      expect(res.body.tiles).toBeDefined();
    });

    it('GET /projects/:id/owners-rep/issues', async () => {
      mockIssueFindMany.mockResolvedValue([{ id: 'issue-1', type: 'client_issue' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/owners-rep/issues')
        .set(authHeader('owners_rep'));
      expect(res.status).toBe(200);
    });

    it('GET /projects/:id/owners-rep/rfis', async () => {
      mockRfiFindMany.mockResolvedValue([{ id: 'rfi-1' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/owners-rep/rfis')
        .set(authHeader('owners_rep'));
      expect(res.status).toBe(200);
    });
  });
});
