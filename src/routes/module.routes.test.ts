import request from 'supertest';
import { createApp } from '../index';
import { setPrismaClient } from '../lib/prisma';
import { PrismaClient } from '@prisma/client';
import { setAuthInstance } from '../services/auth.service';

// ---------- Billing / subscription mock (used by feature gate middleware) ----------
const mockGetBillingAccountByOrgId = jest.fn();
jest.mock('../services/billing.service', () => ({
  getBillingAccountByOrgId: (...args: any[]) => mockGetBillingAccountByOrgId(...args),
  getSubscriptionStatus: jest.fn(),
  canCreateProject: jest.fn().mockResolvedValue(true),
  isModuleAllowed: jest.fn().mockResolvedValue(true),
  isFeatureAllowed: jest.fn().mockResolvedValue(true),
  handleCheckoutCompleted: jest.fn(),
  handleSubscriptionUpdated: jest.fn(),
  handleSubscriptionDeleted: jest.fn(),
  createBillingAccount: jest.fn(),
  createCheckoutSession: jest.fn(),
  getPlanConfig: jest.fn(),
}));

// ---------- Prisma mocks ----------
const mockScheduleActivityFindMany = jest.fn();
const mockScheduleActivityCreate = jest.fn();
const mockScheduleActivityFindUnique = jest.fn();
const mockScheduleActivityUpdate = jest.fn();
const mockScheduleActivityDelete = jest.fn();
let mockScheduleActivityCount = jest.fn().mockResolvedValue(0);
const mockBudgetLineCount = jest.fn().mockResolvedValue(0);
const mockPurchaseOrderCount = jest.fn().mockResolvedValue(0);
const mockScheduleBaselineFindMany = jest.fn();
const mockScheduleBaselineCreate = jest.fn();
const mockScheduleBaselineFindFirst = jest.fn();
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
const mockChangeOrderFindUnique = jest.fn();
const mockChangeOrderUpdate = jest.fn();
const mockRfiFindMany = jest.fn();
const mockRfiCreate = jest.fn();
const mockRfiCount = jest.fn();
const mockRfiFindFirst = jest.fn();
const mockRfiFindUnique = jest.fn();
const mockRfiUpdate = jest.fn();
const mockSubmittalFindMany = jest.fn();
const mockSubmittalCreate = jest.fn();
const mockSubmittalCount = jest.fn();
const mockSubmittalFindFirst = jest.fn();
const mockSubmittalFindUnique = jest.fn();
const mockSubmittalUpdate = jest.fn();
const mockRiskItemFindMany = jest.fn();
const mockRiskItemCreate = jest.fn();
const mockIssueFindMany = jest.fn();
const mockIssueCreate = jest.fn();
const mockIssueFindFirst = jest.fn();
const mockIssueFindUnique = jest.fn();
const mockIssueUpdate = jest.fn();
const mockUnifiedChangeLogFindMany = jest.fn();
const mockUnifiedChangeLogCreate = jest.fn();
const mockPrismaTransaction = jest.fn();
const mockCloseoutChecklistFindFirst = jest.fn();
const mockCloseoutChecklistCreate = jest.fn();
const mockEquipmentFindMany = jest.fn();
const mockEquipmentFindUnique = jest.fn();
const mockEquipmentCreate = jest.fn();
const mockEquipmentUpdate = jest.fn();
const mockEquipmentStatusLogCreate = jest.fn();
const mockEquipmentStatusLogFindMany = jest.fn();
const mockProjectFindUnique = jest.fn();
const mockAttendanceFindUnique = jest.fn();
const mockAttendanceFindMany = jest.fn();
const mockAttendanceCreate = jest.fn();
const mockAttendanceUpdate = jest.fn();
const mockRiskItemCount = jest.fn();
const mockActivityRelationshipFindMany = jest.fn();
const mockActivityRelationshipFindUnique = jest.fn();
const mockActivityRelationshipCreate = jest.fn();
const mockActivityRelationshipDelete = jest.fn();
const mockWorkBreakdownItemFindFirst = jest.fn();
const mockWorkBreakdownItemCreate = jest.fn();
const mockWorkBreakdownItemFindMany = jest.fn();
const mockWorkBreakdownItemFindUnique = jest.fn();
const mockWorkBreakdownItemUpdate = jest.fn();
const mockWorkBreakdownItemDelete = jest.fn();
const mockWorkBreakdownItemCount = jest.fn();
const mockWbsCostCodeCrosswalkFindMany = jest.fn();
const mockWbsCostCodeCrosswalkCreate = jest.fn();
const mockWbsCostCodeCrosswalkUpdate = jest.fn();
const mockWbsCostCodeCrosswalkDelete = jest.fn();
const mockMeetingCreate = jest.fn();
const mockMeetingFindMany = jest.fn();
const mockMeetingFindUnique = jest.fn();
const mockMeetingUpdate = jest.fn();
const mockMeetingDelete = jest.fn();

const mockPrisma = {
  scheduleActivity: {
    findMany: mockScheduleActivityFindMany,
    create: mockScheduleActivityCreate,
    findUnique: mockScheduleActivityFindUnique,
    update: mockScheduleActivityUpdate,
    delete: mockScheduleActivityDelete,
    count: jest.fn().mockImplementation(() => mockScheduleActivityCount()),
  },
  scheduleBaseline: {
    findMany: mockScheduleBaselineFindMany,
    create: mockScheduleBaselineCreate,
    findFirst: mockScheduleBaselineFindFirst,
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
    count: mockBudgetLineCount,
  },
  costTransaction: {
    findMany: mockCostTransactionFindMany,
  },
  purchaseOrder: {
    findMany: mockPurchaseOrderFindMany,
    create: mockPurchaseOrderCreate,
    findUnique: mockPurchaseOrderFindUnique,
    update: mockPurchaseOrderUpdate,
    count: mockPurchaseOrderCount,
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
    findUnique: mockChangeOrderFindUnique,
    update: mockChangeOrderUpdate,
  },
  rfi: {
    findMany: mockRfiFindMany,
    create: mockRfiCreate,
    count: mockRfiCount,
    findFirst: mockRfiFindFirst,
    findUnique: mockRfiFindUnique,
    update: mockRfiUpdate,
  },
  submittal: {
    findMany: mockSubmittalFindMany,
    create: mockSubmittalCreate,
    count: mockSubmittalCount,
    findFirst: mockSubmittalFindFirst,
    findUnique: mockSubmittalFindUnique,
    update: mockSubmittalUpdate,
  },
  riskItem: {
    findMany: mockRiskItemFindMany,
    create: mockRiskItemCreate,
    count: mockRiskItemCount,
  },
  issue: {
    findMany: mockIssueFindMany,
    create: mockIssueCreate,
    findFirst: mockIssueFindFirst,
    findUnique: mockIssueFindUnique,
    update: mockIssueUpdate,
  },
  unifiedChangeLog: {
    findMany: mockUnifiedChangeLogFindMany,
    create: mockUnifiedChangeLogCreate,
  },
  closeoutChecklist: {
    findFirst: mockCloseoutChecklistFindFirst,
    create: mockCloseoutChecklistCreate,
  },
  equipment: {
    findMany: mockEquipmentFindMany,
    findUnique: mockEquipmentFindUnique,
    create: mockEquipmentCreate,
    update: mockEquipmentUpdate,
  },
  equipmentStatusLog: {
    create: mockEquipmentStatusLogCreate,
    findMany: mockEquipmentStatusLogFindMany,
  },
  project: {
    findUnique: mockProjectFindUnique,
  },
  attendance: {
    findUnique: mockAttendanceFindUnique,
    findMany: mockAttendanceFindMany,
    create: mockAttendanceCreate,
    update: mockAttendanceUpdate,
  },
  activityRelationship: {
    findMany: mockActivityRelationshipFindMany,
    findUnique: mockActivityRelationshipFindUnique,
    create: mockActivityRelationshipCreate,
    delete: mockActivityRelationshipDelete,
  },
  workBreakdownItem: {
    findFirst: mockWorkBreakdownItemFindFirst,
    create: mockWorkBreakdownItemCreate,
    findMany: mockWorkBreakdownItemFindMany,
    findUnique: mockWorkBreakdownItemFindUnique,
    update: mockWorkBreakdownItemUpdate,
    delete: mockWorkBreakdownItemDelete,
    count: mockWorkBreakdownItemCount,
  },
  wbsCostCodeCrosswalk: {
    findMany: mockWbsCostCodeCrosswalkFindMany,
    create: mockWbsCostCodeCrosswalkCreate,
    update: mockWbsCostCodeCrosswalkUpdate,
    delete: mockWbsCostCodeCrosswalkDelete,
  },
  meeting: {
    create: mockMeetingCreate,
    findMany: mockMeetingFindMany,
    findUnique: mockMeetingFindUnique,
    update: mockMeetingUpdate,
    delete: mockMeetingDelete,
  },
  $transaction: mockPrismaTransaction,
  apiUsageLog: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
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
  // Default: every org in the test has an active professional subscription so
  // the feature gate middleware lets the request through.
  mockGetBillingAccountByOrgId.mockResolvedValue({
    orgId: 'org-1',
    planTier: 'professional',
    status: 'active',
  });
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

    it('GET /projects/:id/schedule/activities/:actId/relationships', async () => {
      mockActivityRelationshipFindMany.mockResolvedValue([]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/schedule/activities/act-1/relationships')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('predecessors');
      expect(res.body).toHaveProperty('successors');
    });

    it('POST /projects/:id/schedule/activities/:actId/relationships', async () => {
      mockScheduleActivityFindUnique.mockResolvedValue({ id: 'act-1', projectId: 'proj-1' });
      mockActivityRelationshipFindUnique.mockResolvedValue(null);
      mockActivityRelationshipCreate.mockResolvedValue({ id: 'rel-1', predecessorId: 'act-0', successorId: 'act-1', relationshipType: 'FS', lagDays: 0 });
      mockActivityRelationshipFindMany.mockResolvedValue([]);
      const res = await request(app)
        .post('/api/v1/projects/proj-1/schedule/activities/act-1/relationships')
        .set(authHeader())
        .send({ predecessorId: 'act-0', relationshipType: 'FS', lagDays: 0 });
      expect(res.status).toBe(201);
      expect(res.body.relationshipType).toBe('FS');
    });

    it('DELETE /projects/:id/schedule/relationships/:relId', async () => {
      mockActivityRelationshipFindUnique.mockResolvedValue({ id: 'rel-1', projectId: 'proj-1', predecessorId: 'act-0', successorId: 'act-1' });
      mockActivityRelationshipDelete.mockResolvedValue({ id: 'rel-1' });
      const res = await request(app)
        .delete('/api/v1/projects/proj-1/schedule/relationships/rel-1')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('GET /projects/:id/schedule/relationships', async () => {
      mockActivityRelationshipFindMany.mockResolvedValue([{ id: 'rel-1', predecessorId: 'act-0', successorId: 'act-1', relationshipType: 'FS', lagDays: 0 }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/schedule/relationships')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('POST /projects/:id/schedule/import/xer', async () => {
      mockProjectFindUnique.mockResolvedValue({ structureType: 'wbs', structureLocked: false });
      mockWorkBreakdownItemFindFirst.mockResolvedValue({ id: 'wbs-1' });
      mockScheduleActivityCreate.mockResolvedValueOnce({ id: 'act-10' });
      mockScheduleActivityCreate.mockResolvedValueOnce({ id: 'act-20' });
      mockActivityRelationshipCreate.mockResolvedValue({ id: 'rel-1' });

      const xerContent = `ERMHDR\t2.0\t2024-01-15 08:30\n
%T\tPROJECT\n
%F\tproj_id\tproj_short_name\tproj_name\n
%R\t100\tDEMO\tDemo Project\n
%T\tTASK\n
%F\ttask_id\ttask_code\ttask_name\twbs_id\tproj_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tact_start_date\tact_end_date\ttask_type\ttotal_float_hr_cnt\tfree_float_hr_cnt\n
%R\t10\tA100\tExcavation\t2\t100\t2024-02-01 08:00\t2024-02-10 17:00\t80\t\t\tTT_Task\t0\t0\n
%R\t20\tA200\tConcrete Pour\t2\t100\t2024-02-11 08:00\t2024-02-20 17:00\t80\t\t\tTT_Task\t0\t0\n
%T\tTASKPRED\n
%F\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt\tproj_id\n
%R\t20\t10\tPR_FS\t0\t100\n
%E\n`;

      const res = await request(app)
        .post('/api/v1/projects/proj-1/schedule/import/xer')
        .set(authHeader())
        .attach('file', Buffer.from(xerContent), 'schedule.xer');

      expect(res.status).toBe(200);
      expect(res.body.importedActivities).toBe(2);
      expect(res.body.importedRelationships).toBe(1);
      expect(res.body.xerProjectName).toBe('Demo Project');
    });

    it('POST /projects/:id/schedule/import/msproject', async () => {
      mockProjectFindUnique.mockResolvedValue({ structureType: 'wbs', structureLocked: false });
      mockWorkBreakdownItemFindFirst.mockResolvedValue({ id: 'wbs-1' });
      mockScheduleActivityCreate.mockResolvedValueOnce({ id: 'act-1' });
      mockScheduleActivityCreate.mockResolvedValueOnce({ id: 'act-2' });
      mockActivityRelationshipCreate.mockResolvedValue({ id: 'rel-1' });

      const xmlContent = `<?xml version="1.0"?>
<Project>
  <Name>Demo MSP</Name>
  <Tasks>
    <Task>
      <UID>1</UID>
      <ID>1</ID>
      <Name>Site Prep</Name>
      <WBS>1.1</WBS>
      <Start>2024-03-01T08:00:00</Start>
      <Finish>2024-03-05T17:00:00</Finish>
      <Duration>P5DT0H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>0</Summary>
      <OutlineLevel>2</OutlineLevel>
    </Task>
    <Task>
      <UID>2</UID>
      <ID>2</ID>
      <Name>Foundation</Name>
      <WBS>1.2</WBS>
      <Start>2024-03-06T08:00:00</Start>
      <Finish>2024-03-15T17:00:00</Finish>
      <Duration>P10DT0H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>0</Summary>
      <OutlineLevel>2</OutlineLevel>
    </Task>
    <Task>
      <UID>3</UID>
      <ID>3</ID>
      <Name>Milestone</Name>
      <WBS>1.3</WBS>
      <Start>2024-03-15T08:00:00</Start>
      <Finish>2024-03-15T17:00:00</Finish>
      <Duration>P0DT0H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
      <Milestone>1</Milestone>
      <Summary>0</Summary>
      <OutlineLevel>2</OutlineLevel>
      <PredecessorLink>
        <PredecessorUID>2</PredecessorUID>
        <Type>1</Type>
        <LinkLag>0</LinkLag>
        <LagFormat>5</LagFormat>
      </PredecessorLink>
    </Task>
  </Tasks>
</Project>`;

      const res = await request(app)
        .post('/api/v1/projects/proj-1/schedule/import/msproject')
        .set(authHeader())
        .attach('file', Buffer.from(xmlContent), 'schedule.xml');

      expect(res.status).toBe(200);
      expect(res.body.importedActivities).toBe(3);
      expect(res.body.importedRelationships).toBe(1);
      expect(res.body.mspProjectName).toBe('Demo MSP');
    });

    it('POST /projects/:id/schedule/import/excel', async () => {
      mockProjectFindUnique.mockResolvedValue({ structureType: 'wbs', structureLocked: false });
      mockWorkBreakdownItemFindFirst.mockResolvedValue({ id: 'wbs-1' });
      mockScheduleActivityCreate
        .mockResolvedValueOnce({ id: 'act-1' })
        .mockResolvedValueOnce({ id: 'act-2' });
      mockActivityRelationshipCreate.mockResolvedValue({ id: 'rel-1' });

      const csvContent = `Activity Name,WBS Code,Start Date,End Date,Duration,Percent Complete,Status,Milestone,Predecessors,Relationship Type,Lag (days)
Site Prep,1.1,2024-03-01,2024-03-05,5,50,in_progress,FALSE,,,
Foundation,1.2,2024-03-06,2024-03-15,10,0,not_started,FALSE,Site Prep,FS,0`;

      const res = await request(app)
        .post('/api/v1/projects/proj-1/schedule/import/excel')
        .set(authHeader())
        .attach('file', Buffer.from(csvContent), 'schedule.csv');

      expect(res.status).toBe(200);
      expect(res.body.importedActivities).toBe(2);
      expect(res.body.importedRelationships).toBe(1);
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
      mockEquipmentFindUnique.mockReset();
      mockEquipmentCreate.mockReset();
      mockEquipmentUpdate.mockReset();
      mockEquipmentStatusLogCreate.mockReset();
      mockEquipmentStatusLogFindMany.mockReset();
      mockProjectFindUnique.mockResolvedValue({ contractValue: null, startDate: null, endDate: null });
      mockAttendanceFindUnique.mockResolvedValue(null);
      mockAttendanceFindMany.mockResolvedValue([]);
      mockAttendanceCreate.mockReset();
      mockAttendanceUpdate.mockReset();
      mockRfiFindMany.mockResolvedValue([]);
      mockChangeOrderFindMany.mockResolvedValue([]);
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

    it('GET /projects/:id/scope/change-orders/:coId returns a change order', async () => {
      mockChangeOrderFindUnique.mockResolvedValue({ id: 'co-1', coNumber: 'CO-2026-0001', status: 'pending' });
      const res = await request(app)
        .get('/api/v1/projects/proj-1/scope/change-orders/co-1')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('co-1');
    });

    it('GET /projects/:id/scope/change-orders/:coId returns 404 when not found', async () => {
      mockChangeOrderFindUnique.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/scope/change-orders/missing')
        .set(authHeader());
      expect(res.status).toBe(404);
    });

    it('PATCH /projects/:id/scope/change-orders/:coId submits a pending CO', async () => {
      mockChangeOrderFindUnique.mockResolvedValue({ id: 'co-1', status: 'pending' });
      mockChangeOrderUpdate.mockResolvedValue({ id: 'co-1', status: 'submitted' });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/scope/change-orders/co-1')
        .set(authHeader('project_manager'))
        .send({ action: 'submit' });
      expect(res.status).toBe(200);
      expect(mockChangeOrderUpdate).toHaveBeenCalled();
    });

    it('PATCH /projects/:id/scope/change-orders/:coId approves a CO with approver and triggers baseline recalc', async () => {
      mockChangeOrderFindUnique.mockResolvedValue({
        id: 'co-1',
        coNumber: 'CO-2026-0001',
        projectId: 'proj-1',
        status: 'submitted',
        dollarValue: { toNumber: () => 5000 } as any,
      });
      mockChangeOrderUpdate.mockResolvedValue({
        id: 'co-1',
        status: 'approved',
        approver: 'Owner',
      });
      // Proportional distribution: 100k budget, 5k addition = +5%.
      mockBudgetLineFindMany.mockResolvedValue([
        { id: 'bl-1', name: 'Foundation', budgetAmount: { toNumber: () => 60000 } as any },
        { id: 'bl-2', name: 'Steel', budgetAmount: { toNumber: () => 40000 } as any },
      ]);
      mockPrismaTransaction.mockResolvedValue([{}, {}]);
      mockUnifiedChangeLogCreate.mockResolvedValue({ id: 'log-1' });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/scope/change-orders/co-1')
        .set(authHeader('owner_admin'))
        .send({ action: 'approve', approver: 'Owner' });
      expect(res.status).toBe(200);
      // Response is now { changeOrder, baseline }
      expect(res.body.changeOrder.status).toBe('approved');
      expect(res.body.baseline).toBeDefined();
      expect(res.body.baseline.projectId).toBe('proj-1');
      expect(res.body.baseline.previousTotalBudget).toBe(100000);
      expect(res.body.baseline.newTotalBudget).toBe(105000);
      expect(res.body.baseline.addedAmount).toBe(5000);
      expect(res.body.baseline.source).toBe('proportional_distribution');
      expect(res.body.baseline.affectedBudgetLineIds).toEqual(expect.arrayContaining(['bl-1', 'bl-2']));
      // The unified change log was written
      expect(mockUnifiedChangeLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'proj-1',
            module: 'scope',
            changeType: 'change_order_approved',
            affectedRecordId: 'co-1',
          }),
        })
      );
    });

    it('PATCH /projects/:id/scope/change-orders/:coId approve with $0 dollar value still creates a baseline record', async () => {
      mockChangeOrderFindUnique.mockResolvedValue({
        id: 'co-2',
        coNumber: 'CO-2026-0002',
        projectId: 'proj-1',
        status: 'submitted',
        dollarValue: null,
      });
      mockChangeOrderUpdate.mockResolvedValue({ id: 'co-2', status: 'approved' });
      mockBudgetLineFindMany.mockResolvedValue([
        { id: 'bl-1', name: 'Foundation', budgetAmount: { toNumber: () => 100000 } as any },
      ]);
      mockPrismaTransaction.mockResolvedValue([]);
      mockUnifiedChangeLogCreate.mockResolvedValue({ id: 'log-2' });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/scope/change-orders/co-2')
        .set(authHeader('owner_admin'))
        .send({ action: 'approve', approver: 'Owner' });
      expect(res.status).toBe(200);
      expect(res.body.baseline.addedAmount).toBe(0);
      expect(res.body.baseline.affectedBudgetLineIds).toEqual([]);
      // No $transaction call when there's nothing to update
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('PATCH /projects/:id/scope/change-orders/:coId approve with no budget lines creates a catch-all line', async () => {
      mockChangeOrderFindUnique.mockResolvedValue({
        id: 'co-3',
        coNumber: 'CO-2026-0003',
        projectId: 'proj-1',
        status: 'submitted',
        dollarValue: { toNumber: () => 12000 } as any,
      });
      mockChangeOrderUpdate.mockResolvedValue({ id: 'co-3', status: 'approved' });
      mockBudgetLineFindMany.mockResolvedValue([]); // no lines
      mockBudgetLineCreate.mockResolvedValue({
        id: 'bl-new',
        name: 'Change Orders',
        costCode: 'CHG-ORD',
      });
      mockUnifiedChangeLogCreate.mockResolvedValue({ id: 'log-3' });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/scope/change-orders/co-3')
        .set(authHeader('owner_admin'))
        .send({ action: 'approve', approver: 'Owner' });
      expect(res.status).toBe(200);
      expect(res.body.baseline.source).toBe('change_order_catchall');
      expect(res.body.baseline.previousTotalBudget).toBe(0);
      expect(res.body.baseline.newTotalBudget).toBe(12000);
      expect(res.body.baseline.affectedBudgetLineIds).toEqual(['bl-new']);
      expect(mockBudgetLineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          name: 'Change Orders',
          costCode: 'CHG-ORD',
        }),
      });
    });

    it('PATCH /projects/:id/scope/change-orders/:coId approve of an already-approved CO is idempotent', async () => {
      mockChangeOrderFindUnique.mockResolvedValue({
        id: 'co-4',
        coNumber: 'CO-2026-0004',
        projectId: 'proj-1',
        status: 'approved',
        approver: 'PrevOwner',
        dollarValue: { toNumber: () => 7000 } as any,
      });
      mockBudgetLineFindMany.mockResolvedValue([
        { id: 'bl-1', name: 'Foundation', budgetAmount: { toNumber: () => 100000 } as any },
      ]);
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/scope/change-orders/co-4')
        .set(authHeader('owner_admin'))
        .send({ action: 'approve', approver: 'Owner' });
      expect(res.status).toBe(200);
      // No re-update, no re-calc
      expect(mockChangeOrderUpdate).not.toHaveBeenCalled();
      expect(mockBudgetLineUpdate).not.toHaveBeenCalled();
      expect(res.body.baseline.addedAmount).toBe(0);
    });

    it('PATCH /projects/:id/scope/change-orders/:coId approve of a rejected CO returns 400', async () => {
      mockChangeOrderFindUnique.mockResolvedValue({
        id: 'co-5',
        coNumber: 'CO-2026-0005',
        projectId: 'proj-1',
        status: 'rejected',
        dollarValue: null,
      });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/scope/change-orders/co-5')
        .set(authHeader('owner_admin'))
        .send({ action: 'approve', approver: 'Owner' });
      // The thrown error message contains "rejected" which maps to BAD_REQUEST
      expect(res.status).toBe(400);
    });

    it('PATCH /projects/:id/scope/change-orders/:coId rejects a CO', async () => {
      mockChangeOrderFindUnique.mockResolvedValue({ id: 'co-1', status: 'submitted' });
      mockChangeOrderUpdate.mockResolvedValue({ id: 'co-1', status: 'rejected' });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/scope/change-orders/co-1')
        .set(authHeader('owner_admin'))
        .send({ action: 'reject', approver: 'Owner' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('rejected');
    });

    it('PATCH /projects/:id/scope/change-orders/:coId returns 400 for unknown action', async () => {
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/scope/change-orders/co-1')
        .set(authHeader('project_manager'))
        .send({ action: 'frob' });
      expect(res.status).toBe(400);
    });

    it('GET /projects/:id/scope/change-orders/:coId/pdf returns application/pdf', async () => {
      // The PDF service is fully wired in production. We exercise the route
      // with a minimal mock data shape and verify the response is a PDF
      // (content-type + %PDF magic bytes).
      mockChangeOrderFindUnique.mockResolvedValue({
        id: 'co-1',
        coNumber: 'CO-2026-0001',
        date: new Date('2026-06-05'),
        description: 'Additional grounding work',
        status: 'approved',
        dollarValue: { toNumber: () => 45000 } as any,
        scheduleImpact: 24,
        approver: 'Owner Rep',
        approvedAt: new Date('2026-06-07'),
        projectId: 'proj-1',
        project: { name: 'Test Project' },
        affectedActivityIds: ['act-1', 'act-2'],
      });
      const res = await request(app)
        .get('/api/v1/projects/proj-1/scope/change-orders/co-1/pdf')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toMatch(/CO-2026-0001\.pdf/);
      // PDF magic bytes
      expect(res.body.slice(0, 4).toString('utf8')).toBe('%PDF');
    });

    it('GET /projects/:id/scope/change-orders/:coId/pdf returns 404 when not found', async () => {
      mockChangeOrderFindUnique.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/scope/change-orders/missing/pdf')
        .set(authHeader());
      expect(res.status).toBe(404);
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

    it('GET /projects/:id/communications/rfis/:rfiId', async () => {
      mockRfiFindUnique.mockResolvedValue({ id: 'rfi-1', rfiNumber: 'RFI-001' });
      const res = await request(app)
        .get('/api/v1/projects/proj-1/communications/rfis/rfi-1')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('GET /projects/:id/communications/rfis/:rfiId returns 404 when missing', async () => {
      mockRfiFindUnique.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/communications/rfis/missing')
        .set(authHeader());
      expect(res.status).toBe(404);
    });

    it('PATCH /projects/:id/communications/rfis/:rfiId with action=submit', async () => {
      mockRfiFindUnique.mockResolvedValue({ id: 'rfi-1', status: 'draft' });
      mockRfiUpdate.mockResolvedValue({ id: 'rfi-1', status: 'submitted' });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/communications/rfis/rfi-1')
        .set(authHeader())
        .send({ action: 'submit' });
      expect(res.status).toBe(200);
    });

    it('PATCH /projects/:id/communications/rfis/:rfiId with action=answer', async () => {
      mockRfiFindUnique.mockResolvedValue({ id: 'rfi-1', status: 'submitted' });
      mockRfiUpdate.mockResolvedValue({ id: 'rfi-1', status: 'answered' });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/communications/rfis/rfi-1')
        .set(authHeader())
        .send({ action: 'answer', responseText: 'Use grade 60 rebar' });
      expect(res.status).toBe(200);
    });

    it('PATCH /projects/:id/communications/rfis/:rfiId with action=close', async () => {
      mockRfiFindUnique.mockResolvedValue({ id: 'rfi-1', status: 'answered' });
      mockRfiUpdate.mockResolvedValue({ id: 'rfi-1', status: 'closed' });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/communications/rfis/rfi-1')
        .set(authHeader())
        .send({ action: 'close' });
      expect(res.status).toBe(200);
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

    it('GET /projects/:id/communications/submittals/:submittalId', async () => {
      mockSubmittalFindUnique.mockResolvedValue({ id: 'sub-1', submittalNumber: 'SUB-001' });
      const res = await request(app)
        .get('/api/v1/projects/proj-1/communications/submittals/sub-1')
        .set(authHeader());
      expect(res.status).toBe(200);
    });

    it('GET /projects/:id/communications/submittals/:submittalId returns 404 when missing', async () => {
      mockSubmittalFindUnique.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/communications/submittals/missing')
        .set(authHeader());
      expect(res.status).toBe(404);
    });

    it('PATCH /projects/:id/communications/submittals/:submittalId with action=submit', async () => {
      mockSubmittalFindUnique.mockResolvedValue({ id: 'sub-1', status: 'pending' });
      mockSubmittalUpdate.mockResolvedValue({ id: 'sub-1', status: 'submitted' });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/communications/submittals/sub-1')
        .set(authHeader())
        .send({ action: 'submit' });
      expect(res.status).toBe(200);
    });

    it('PATCH /projects/:id/communications/submittals/:submittalId with action=review', async () => {
      mockSubmittalFindUnique.mockResolvedValue({ id: 'sub-1', status: 'submitted' });
      mockSubmittalUpdate.mockResolvedValue({ id: 'sub-1', status: 'approved' });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/communications/submittals/sub-1')
        .set(authHeader())
        .send({ action: 'review', decision: 'approved', reviewedBy: 'pm-1', reviewComments: 'LGTM' });
      expect(res.status).toBe(200);
    });

    it('PATCH /projects/:id/communications/submittals/:submittalId with bad action returns 400', async () => {
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/communications/submittals/sub-1')
        .set(authHeader())
        .send({ action: 'unknown' });
      expect(res.status).toBe(400);
    });

    it('GET /projects/:id/communications/rfis/:rfiId/pdf returns application/pdf', async () => {
      mockRfiFindUnique.mockResolvedValue({
        id: 'rfi-1',
        rfiNumber: 'RFI-2026-0001',
        subject: 'Foundation rebar spec',
        description: 'Please clarify the rebar grade.',
        status: 'submitted',
        submittedBy: 'Mr. Robert',
        submittedAt: new Date('2026-06-01'),
        responseText: null,
        answeredAt: null,
        requiredDate: null,
        sourceReference: null,
        ballInCourt: 'Owner',
        statusHistory: null,
        projectId: 'proj-1',
        project: { name: 'Test Project' },
      });
      const res = await request(app)
        .get('/api/v1/projects/proj-1/communications/rfis/rfi-1/pdf')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toMatch(/RFI-2026-0001\.pdf/);
      expect(res.body.slice(0, 4).toString('utf8')).toBe('%PDF');
    });

    it('GET /projects/:id/communications/rfis/:rfiId/pdf returns 404 when not found', async () => {
      mockRfiFindUnique.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/communications/rfis/missing/pdf')
        .set(authHeader());
      expect(res.status).toBe(404);
    });

    it('GET /projects/:id/communications/submittals/:submittalId/pdf returns application/pdf', async () => {
      mockSubmittalFindUnique.mockResolvedValue({
        id: 'sub-1',
        submittalNumber: 'SUB-2026-0001',
        title: 'Concrete mix design',
        description: '3000 PSI mix',
        status: 'approved',
        specSection: '03 30 00',
        submittedBy: 'Super',
        submittedAt: new Date('2026-05-15'),
        reviewedBy: 'Engineer',
        reviewedAt: new Date('2026-05-20'),
        reviewComments: 'Approved as submitted.',
        requiredDate: null,
        statusHistory: null,
        projectId: 'proj-1',
        project: { name: 'Test Project' },
      });
      const res = await request(app)
        .get('/api/v1/projects/proj-1/communications/submittals/sub-1/pdf')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toMatch(/SUB-2026-0001\.pdf/);
      expect(res.body.slice(0, 4).toString('utf8')).toBe('%PDF');
    });

    it('GET /projects/:id/communications/submittals/:submittalId/pdf returns 404 when not found', async () => {
      mockSubmittalFindUnique.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/communications/submittals/missing/pdf')
        .set(authHeader());
      expect(res.status).toBe(404);
    });

    it('GET /projects/:id/communications/submittals/log/pdf returns a multi-page PDF', async () => {
      mockSubmittalFindMany.mockResolvedValue([
        {
          id: 'sub-1',
          submittalNumber: 'SUB-2026-0001',
          specSection: '03 30 00',
          title: 'Concrete mix design',
          status: 'approved',
          submittedAt: new Date('2026-05-15'),
          requiredDate: new Date('2026-06-01'),
          createdAt: new Date('2026-05-15'),
        },
      ]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/communications/submittals/log/pdf')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toMatch(/submittal-log-proj-1\.pdf/);
      expect(res.body.slice(0, 4).toString('utf8')).toBe('%PDF');
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

    it('GET /projects/:id/integration/issues/:issueId', async () => {
      mockIssueFindUnique.mockResolvedValue({ id: 'issue-1', title: 'Test' });
      const res = await request(app)
        .get('/api/v1/projects/proj-1/integration/issues/issue-1')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('issue-1');
    });

    it('GET /projects/:id/integration/issues/:issueId returns 404 when missing', async () => {
      mockIssueFindUnique.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/integration/issues/nonexistent')
        .set(authHeader());
      expect(res.status).toBe(404);
    });

    it('PATCH /projects/:id/integration/issues/:issueId', async () => {
      mockIssueFindUnique.mockResolvedValue({ id: 'issue-1' });
      mockIssueUpdate.mockResolvedValue({ id: 'issue-1', status: 'in_progress' });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/integration/issues/issue-1')
        .set(authHeader())
        .send({ status: 'in_progress', priority: 'high' });
      expect(res.status).toBe(200);
      expect(mockIssueUpdate).toHaveBeenCalled();
    });

    it('PATCH /projects/:id/integration/issues/:issueId with notesAppend creates a note', async () => {
      mockIssueFindUnique.mockResolvedValue({ id: 'issue-1', notes: null });
      mockIssueUpdate.mockResolvedValue({ id: 'issue-1', notes: [{ id: 'n1', text: 'note', author: 'dev-user' }] });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/integration/issues/issue-1')
        .set(authHeader())
        .send({ notesAppend: 'note' });
      expect(res.status).toBe(200);
      expect(mockIssueUpdate).toHaveBeenCalled();
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
      mockEquipmentFindUnique.mockReset();
      mockEquipmentCreate.mockReset();
      mockEquipmentUpdate.mockReset();
      mockEquipmentStatusLogCreate.mockReset();
      mockEquipmentStatusLogFindMany.mockReset();
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
      mockEquipmentFindUnique.mockReset();
      mockEquipmentCreate.mockReset();
      mockEquipmentUpdate.mockReset();
      mockEquipmentStatusLogCreate.mockReset();
      mockEquipmentStatusLogFindMany.mockReset();
      mockProjectFindUnique.mockResolvedValue({ contractValue: null, startDate: null, endDate: null });
      mockAttendanceFindUnique.mockResolvedValue(null);
      mockAttendanceFindMany.mockResolvedValue([]);
      mockAttendanceCreate.mockReset();
      mockAttendanceUpdate.mockReset();
      mockChangeOrderFindMany.mockResolvedValue([]);
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

  // ─── Cost cash flow ───
  describe('Cost cash flow route', () => {
    it('GET /projects/:id/cost/cashflow', async () => {
      mockProjectFindUnique.mockResolvedValue({ startDate: new Date('2026-01-01'), endDate: new Date('2026-02-28') });
      mockScheduleActivityFindMany.mockResolvedValue([]);
      mockBudgetLineFindMany.mockResolvedValue([]);
      mockCostTransactionFindMany.mockResolvedValue([]);
      mockPurchaseOrderFindMany.mockResolvedValue([]);
      mockSubcontractFindMany.mockResolvedValue([]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/cost/cashflow')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.months).toBeDefined();
    });
  });

  // ─── Schedule performance ───
  describe('Schedule performance route', () => {
    it('GET /projects/:id/schedule/performance', async () => {
      mockProjectFindUnique.mockResolvedValue({ startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10') });
      mockScheduleBaselineFindFirst.mockResolvedValue(null);
      mockScheduleActivityFindMany.mockResolvedValue([]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/schedule/performance')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  // ─── Safety performance ───
  describe('Safety performance route', () => {
    it('GET /projects/:id/safety/performance', async () => {
      mockProjectFindUnique.mockResolvedValue({ trirTarget: 3.0, startDate: null, endDate: null });
      mockRiskItemCount.mockResolvedValue(0);
      mockAttendanceFindMany.mockResolvedValue([]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/safety/performance')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.trirTarget).toBeDefined();
    });
  });

  // ─── Crew status ───
  describe('Crew status route', () => {
    it('GET /projects/:id/crew/status', async () => {
      mockScheduleActivityFindMany.mockResolvedValue([{ id: 'act-1', isCritical: true }]);
      mockAttendanceFindUnique.mockResolvedValue({ workerCount: 1, hours: 8 });
      mockEquipmentFindMany.mockResolvedValue([
        { id: 'eq-1', status: 'active', dailyRate: 500, totalHours: 0 },
      ]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/crew/status')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.plannedCrewToday).toBe(1);
      expect(res.body.confirmedPresent).toBe(1);
      expect(res.body.gapStatus).toBeDefined();
    });
  });

  describe('Attendance entry route', () => {
    it('GET /projects/:id/resource/attendance/today returns the day\'s record', async () => {
      mockAttendanceFindUnique.mockResolvedValue({
        workerCount: 12,
        hours: 96,
        presentCount: 10,
        absentCount: 2,
        lateCount: 1,
        notes: 'Two subs sick',
        affectedActivities: ['act-1'],
      });
      const res = await request(app)
        .get('/api/v1/projects/proj-1/resource/attendance/today')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.presentCount).toBe(10);
      expect(res.body.notes).toBe('Two subs sick');
    });

    it('GET /projects/:id/resource/attendance/today returns null when no record', async () => {
      mockAttendanceFindUnique.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/resource/attendance/today')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('POST /projects/:id/resource/attendance creates a new record', async () => {
      mockAttendanceFindUnique.mockResolvedValue(null);
      mockAttendanceCreate.mockResolvedValue({
        id: 'att-new',
        workerCount: 8,
        hours: 64,
        presentCount: 8,
      });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/resource/attendance')
        .set(authHeader('project_manager'))
        .send({
          workerCount: 8,
          hours: 64,
          presentCount: 8,
          notes: 'Full crew',
        });
      expect(res.status).toBe(201);
      expect(mockAttendanceCreate).toHaveBeenCalled();
      expect(res.body.id).toBe('att-new');
    });

    it('POST /projects/:id/resource/attendance upserts an existing record for the same date', async () => {
      mockAttendanceFindUnique.mockResolvedValue({ id: 'att-existing', workerCount: 5, hours: 40 });
      mockAttendanceUpdate.mockResolvedValue({ id: 'att-existing', workerCount: 9, hours: 72 });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/resource/attendance')
        .set(authHeader('project_manager'))
        .send({
          workerCount: 9,
          hours: 72,
          presentCount: 9,
          absentCount: 1,
          lateCount: 0,
        });
      expect(res.status).toBe(201);
      expect(mockAttendanceUpdate).toHaveBeenCalled();
      expect(mockAttendanceCreate).not.toHaveBeenCalled();
      expect(res.body.id).toBe('att-existing');
    });

    it('POST /projects/:id/resource/attendance returns 400 when workerCount is missing', async () => {
      const res = await request(app)
        .post('/api/v1/projects/proj-1/resource/attendance')
        .set(authHeader('project_manager'))
        .send({ hours: 8 });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/workerCount/);
    });

    it('POST /projects/:id/resource/attendance returns 403 for field_crew role', async () => {
      const res = await request(app)
        .post('/api/v1/projects/proj-1/resource/attendance')
        .set(authHeader('field_crew'))
        .send({ workerCount: 8, hours: 64 });
      expect(res.status).toBe(403);
    });
  });

  // ─── Meetings ───
  describe('Meeting routes', () => {
    it('GET /projects/:id/communications/meetings', async () => {
      mockMeetingFindMany.mockResolvedValue([{ id: 'mtg-1', title: 'OAC Meeting' }]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/communications/meetings')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('POST /projects/:id/communications/meetings', async () => {
      mockMeetingCreate.mockResolvedValue({ id: 'mtg-1', title: 'OAC Meeting' });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/communications/meetings')
        .set(authHeader())
        .send({
          title: 'OAC Meeting',
          meetingDate: '2026-06-15T13:00:00.000Z',
          createdBy: 'user-1',
        });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('OAC Meeting');
    });

    it('GET /projects/:id/communications/meetings/:mtgId', async () => {
      mockMeetingFindUnique.mockResolvedValue({ id: 'mtg-1', projectId: 'proj-1', title: 'OAC' });
      const res = await request(app)
        .get('/api/v1/projects/proj-1/communications/meetings/mtg-1')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('mtg-1');
    });

    it('PUT /projects/:id/communications/meetings/:mtgId', async () => {
      mockMeetingFindUnique.mockResolvedValue({ id: 'mtg-1', projectId: 'proj-1' });
      mockMeetingUpdate.mockResolvedValue({ id: 'mtg-1', title: 'Updated' });
      const res = await request(app)
        .put('/api/v1/projects/proj-1/communications/meetings/mtg-1')
        .set(authHeader())
        .send({ title: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
    });

    it('DELETE /projects/:id/communications/meetings/:mtgId', async () => {
      mockMeetingFindUnique.mockResolvedValue({ id: 'mtg-1', projectId: 'proj-1' });
      mockMeetingDelete.mockResolvedValue({ id: 'mtg-1' });
      const res = await request(app)
        .delete('/api/v1/projects/proj-1/communications/meetings/mtg-1')
        .set(authHeader());
      expect(res.status).toBe(204);
    });

    it('PATCH /projects/:id/communications/meetings/:mtgId/action-items/:idx', async () => {
      mockMeetingFindUnique.mockResolvedValue({
        id: 'mtg-1',
        projectId: 'proj-1',
        actionItems: [
          { description: 'Item 1', status: 'open' },
          { description: 'Item 2', status: 'open' },
        ],
      });
      mockMeetingUpdate.mockResolvedValue({
        id: 'mtg-1',
        actionItems: [
          { description: 'Item 1', status: 'closed' },
          { description: 'Item 2', status: 'open' },
        ],
      });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/communications/meetings/mtg-1/action-items/0')
        .set(authHeader())
        .send({ status: 'closed' });
      expect(res.status).toBe(200);
    });
  });

  describe('Equipment status routes', () => {
    it('POST /projects/:id/resource/equipment creates a new equipment row', async () => {
      mockEquipmentFindUnique.mockResolvedValue(null);
      mockEquipmentCreate.mockResolvedValue({ id: 'eq-new', externalId: 'EQ-101', name: 'CAT 320' });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/resource/equipment')
        .set(authHeader('project_manager'))
        .send({ externalId: 'EQ-101', name: 'CAT 320', type: 'Excavator' });
      expect(res.status).toBe(201);
      expect(mockEquipmentCreate).toHaveBeenCalled();
      expect(res.body.id).toBe('eq-new');
    });

    it('POST /projects/:id/resource/equipment returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/v1/projects/proj-1/resource/equipment')
        .set(authHeader('project_manager'))
        .send({ externalId: 'EQ-101' });
      expect(res.status).toBe(400);
    });

    it('POST /projects/:id/resource/equipment/status-log logs status and updates equipment', async () => {
      mockEquipmentUpdate.mockResolvedValue({ id: 'eq-1' });
      mockEquipmentStatusLogCreate.mockResolvedValue({
        id: 'log-1',
        equipmentId: 'eq-1',
        status: 'active',
        hours: 8,
      });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/resource/equipment/status-log')
        .set(authHeader('superintendent'))
        .send({ equipmentId: 'eq-1', status: 'active', hours: 8, notes: 'Worked all day' });
      expect(res.status).toBe(201);
      expect(mockEquipmentUpdate).toHaveBeenCalled();
      expect(mockEquipmentStatusLogCreate).toHaveBeenCalled();
    });

    it('POST /projects/:id/resource/equipment/status-log returns 400 when equipmentId is missing', async () => {
      const res = await request(app)
        .post('/api/v1/projects/proj-1/resource/equipment/status-log')
        .set(authHeader('superintendent'))
        .send({ status: 'active' });
      expect(res.status).toBe(400);
    });

    it('GET /projects/:id/resource/equipment/status-log returns recent logs', async () => {
      mockEquipmentStatusLogFindMany.mockResolvedValue([
        {
          id: 'log-1',
          equipmentId: 'eq-1',
          date: '2026-06-07',
          status: 'active',
          hours: 8,
          equipment: { id: 'eq-1', externalId: 'EQ-101', name: 'CAT 320' },
        },
      ]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/resource/equipment/status-log')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].equipment.name).toBe('CAT 320');
    });

    it('POST /projects/:id/resource/equipment/status-log returns 403 for field_crew role', async () => {
      const res = await request(app)
        .post('/api/v1/projects/proj-1/resource/equipment/status-log')
        .set(authHeader('field_crew'))
        .send({ equipmentId: 'eq-1', status: 'active' });
      expect(res.status).toBe(403);
    });
  });

  // ─── Agents ───
  describe('Agent routes', () => {
    it('GET /projects/:id/agents/copilot', async () => {
      const res = await request(app)
        .get('/api/v1/projects/proj-1/agents/copilot')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('alerts');
      expect(res.body).toHaveProperty('scenarios');
      expect(res.body).toHaveProperty('compoundFlags');
      expect(res.body).toHaveProperty('lastAnalyzedAt');
    });

    it('GET /projects/:id/agents/coach', async () => {
      const res = await request(app)
        .get('/api/v1/projects/proj-1/agents/coach')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tips');
      expect(res.body).toHaveProperty('onboarding');
      expect(res.body).toHaveProperty('nudges');
    });

    it('GET /projects/:id/agents/reporter', async () => {
      const res = await request(app)
        .get('/api/v1/projects/proj-1/agents/reporter')
        .set(authHeader('project_manager'));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('execSummary');
      expect(res.body).toHaveProperty('sections');
      expect(res.body).toHaveProperty('generatedAt');
    });

    it('GET /projects/:id/agents/standards', async () => {
      const res = await request(app)
        .get('/api/v1/projects/proj-1/agents/standards')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('overallStatus');
      expect(res.body).toHaveProperty('checks');
      expect(res.body).toHaveProperty('notices');
    });

    it('GET /projects/:id/agents/intelligence', async () => {
      const res = await request(app)
        .get('/api/v1/projects/proj-1/agents/intelligence')
        .set(authHeader('project_manager'));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('estimateValidations');
      expect(res.body).toHaveProperty('patternRisks');
      expect(res.body).toHaveProperty('overallConfidence');
    });

    it('GET /projects/:id/agents/brief', async () => {
      const res = await request(app)
        .get('/api/v1/projects/proj-1/agents/brief')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('generatedAt');
      expect(res.body).toHaveProperty('copilot');
      expect(res.body).toHaveProperty('coach');
      expect(res.body).toHaveProperty('standards');
      expect(res.body.copilot).toHaveProperty('alertCount');
      expect(res.body.coach).toHaveProperty('tipCount');
      expect(res.body.standards).toHaveProperty('overallStatus');
    });

    it('GET /projects/:id/agents/morning-brief returns a brief (fallback when no API key)', async () => {
      // No API key is set in the test env, so this hits the fallback path
      // deterministically — the response shape is the same either way.
      const res = await request(app)
        .get('/api/v1/projects/proj-1/agents/morning-brief')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('generatedAt');
      expect(res.body).toHaveProperty('source');
      expect(res.body).toHaveProperty('headline');
      expect(res.body).toHaveProperty('sections');
      expect(res.body).toHaveProperty('meta');
      // source must be one of the two allowed values
      expect(['ai', 'fallback']).toContain(res.body.source);
      // meta.failureCode is set when fallback (DISABLED is the expected code here)
      expect(res.body.meta).toHaveProperty('failureCode');
      // headline is non-empty
      expect(res.body.headline.length).toBeGreaterThan(0);
    });

    it('GET /projects/:id/agents/morning-brief?mode=fallback forces fallback', async () => {
      const res = await request(app)
        .get('/api/v1/projects/proj-1/agents/morning-brief?mode=fallback')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.source).toBe('fallback');
    });

    it('GET /projects/:id/agents/morning-brief/usage returns call count and cost', async () => {
      // Empty log returns zeros
      const res = await request(app)
        .get('/api/v1/projects/proj-1/agents/morning-brief/usage')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('calls');
      expect(res.body).toHaveProperty('costUsd');
      expect(typeof res.body.calls).toBe('number');
      expect(typeof res.body.costUsd).toBe('number');
    });
  });

  describe('schedule what-if', () => {
    beforeEach(() => {
      // Provide project + activities for the what-if CPM to work on
      mockProjectFindUnique.mockResolvedValue({
        id: 'proj-1',
        startDate: new Date('2026-01-05T00:00:00.000Z'),
        name: 'Test Project',
      });
      mockScheduleActivityFindMany.mockResolvedValue([
        {
          id: 'a',
          name: 'A',
          startDate: new Date('2026-01-05T00:00:00.000Z'),
          endDate: new Date('2026-01-10T00:00:00.000Z'),
          duration: 5,
          predecessors: [],
          successors: [],
        },
      ]);
    });

    it('GET /projects/:id/schedule/whatif returns impact analysis', async () => {
      const res = await request(app)
        .get('/api/v1/projects/proj-1/schedule/whatif?activityId=a&delayDays=2&delayType=start_delay')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('original_completion');
      expect(res.body).toHaveProperty('new_completion');
      expect(res.body).toHaveProperty('days_impact');
      expect(res.body).toHaveProperty('critical_path_changed');
      expect(res.body).toHaveProperty('newly_critical_activities');
      expect(res.body).toHaveProperty('affected_activities');
      expect(res.body).toHaveProperty('ld_exposure_days');
      expect(res.body).toHaveProperty('summary');
    });

    it('GET /projects/:id/schedule/whatif rejects invalid delayDays', async () => {
      const res = await request(app)
        .get('/api/v1/projects/proj-1/schedule/whatif?activityId=a&delayDays=0&delayType=start_delay')
        .set(authHeader());
      expect(res.status).toBe(400);
    });

    it('GET /projects/:id/schedule/whatif rejects invalid delayType', async () => {
      const res = await request(app)
        .get('/api/v1/projects/proj-1/schedule/whatif?activityId=a&delayDays=2&delayType=bogus')
        .set(authHeader());
      expect(res.status).toBe(400);
    });

    it('GET /projects/:id/schedule/whatif rejects missing activityId', async () => {
      const res = await request(app)
        .get('/api/v1/projects/proj-1/schedule/whatif?delayDays=2&delayType=start_delay')
        .set(authHeader());
      expect(res.status).toBe(400);
    });
  });

  describe('equipment registry', () => {
    it('GET /projects/:id/resource/equipment-registry returns enriched list', async () => {
      mockEquipmentFindMany.mockResolvedValue([
        {
          id: 'eq-1',
          externalId: 'EQ-0001',
          name: 'CAT 320',
          type: 'Excavator',
          status: 'active',
          dailyRate: { toNumber: () => 850 },
          isOwned: false,
          totalHours: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          calDueDate: null,
          lastUsageDate: new Date(),
        },
      ]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/resource/equipment-registry')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('CAT 320');
    });

    it('POST /projects/:id/resource/equipment-registry creates equipment', async () => {
      mockEquipmentCreate.mockResolvedValue({ id: 'eq-new', name: 'New Pump' });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/resource/equipment-registry')
        .set(authHeader())
        .send({ name: 'New Pump', type: 'Pump Truck', dailyRate: 450, isOwned: false });
      expect(res.status).toBe(201);
      expect(mockEquipmentCreate).toHaveBeenCalled();
    });

    it('POST rejects when name or dailyRate is missing', async () => {
      const res = await request(app)
        .post('/api/v1/projects/proj-1/resource/equipment-registry')
        .set(authHeader())
        .send({ type: 'Pump Truck' });
      expect(res.status).toBe(400);
    });

    it('GET /projects/:id/resource/equipment-registry/:equipId returns single equipment', async () => {
      mockEquipmentFindUnique.mockResolvedValue({ id: 'eq-1', name: 'CAT 320' });
      const res = await request(app)
        .get('/api/v1/projects/proj-1/resource/equipment-registry/eq-1')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('CAT 320');
    });

    it('GET 404s when equipment not found', async () => {
      mockEquipmentFindUnique.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/resource/equipment-registry/nope')
        .set(authHeader());
      expect(res.status).toBe(404);
    });

    it('PATCH /projects/:id/resource/equipment-registry/:equipId updates equipment', async () => {
      mockEquipmentUpdate.mockResolvedValue({ id: 'eq-1', name: 'New Name' });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/resource/equipment-registry/eq-1')
        .set(authHeader())
        .send({ name: 'New Name', status: 'idle' });
      expect(res.status).toBe(200);
      expect(mockEquipmentUpdate).toHaveBeenCalled();
    });

    it('GET /projects/:id/resource/equipment-registry/:equipId/history returns history', async () => {
      mockEquipmentStatusLogFindMany.mockResolvedValue([
        { id: 'log-1', status: 'active', date: new Date() },
      ]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/resource/equipment-registry/eq-1/history')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('WBS routes', () => {
    beforeEach(() => {
      // WBS feature gate middleware does a project lookup; make sure both
      // shape fields the gate and the service use are present.
      mockProjectFindUnique.mockResolvedValue({ id: 'proj-1', orgId: 'org-1', structureType: 'wbs' });
    });
    it('GET /projects/:id/wbs/ returns the tree', async () => {
      mockWorkBreakdownItemFindMany.mockResolvedValueOnce([
        { id: 'a', code: '01', name: 'Engineering', parentId: null, level: 1, structureType: 'wbs' },
      ]);
      mockScheduleActivityFindMany.mockResolvedValueOnce([]);
      mockBudgetLineFindMany.mockResolvedValueOnce([]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/wbs/')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /projects/:id/wbs/ creates a WBS element', async () => {
      mockProjectFindUnique.mockResolvedValue({ id: 'proj-1', orgId: 'org-1', structureType: 'wbs' });
      mockWorkBreakdownItemCreate.mockResolvedValue({ id: 'w-new', code: '01.01' });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/wbs/')
        .set(authHeader())
        .send({ code: '01.01', name: 'Detailed Design' });
      expect(res.status).toBe(201);
      expect(mockWorkBreakdownItemCreate).toHaveBeenCalled();
    });

    it('POST 400s when code or name missing', async () => {
      const res = await request(app)
        .post('/api/v1/projects/proj-1/wbs/')
        .set(authHeader())
        .send({ code: '01' });
      expect(res.status).toBe(400);
    });

    it('PATCH /projects/:id/wbs/:wbsId updates name', async () => {
      mockWorkBreakdownItemFindUnique.mockResolvedValue({ id: 'w1', code: '01' });
      mockScheduleActivityCount = jest.fn().mockResolvedValue(0);
      mockWorkBreakdownItemUpdate.mockResolvedValue({ id: 'w1', name: 'New' });
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/wbs/w1')
        .set(authHeader())
        .send({ name: 'New' });
      expect(res.status).toBe(200);
    });

    it('PATCH 400s when code change would break activity links', async () => {
      mockWorkBreakdownItemFindUnique.mockResolvedValue({ id: 'w1', code: '01' });
      // Need to inject a count mock
      const original = mockScheduleActivityCount;
      mockScheduleActivityCount = jest.fn().mockResolvedValue(2);
      const res = await request(app)
        .patch('/api/v1/projects/proj-1/wbs/w1')
        .set(authHeader())
        .send({ code: '99' });
      expect(res.status).toBe(400);
      mockScheduleActivityCount = original;
    });

    it('DELETE /projects/:id/wbs/:wbsId returns 400 with blockers when linked', async () => {
      mockWorkBreakdownItemFindUnique.mockResolvedValue({ id: 'w1', projectId: 'proj-1', code: '01' });
      const original = mockScheduleActivityCount;
      mockScheduleActivityCount = jest.fn().mockResolvedValue(3);
      const res = await request(app)
        .delete('/api/v1/projects/proj-1/wbs/w1')
        .set(authHeader());
      expect(res.status).toBe(400);
      expect(res.body.blockers.activityCount).toBe(3);
      mockScheduleActivityCount = original;
    });

    it('GET /projects/:id/wbs/crosswalk returns the crosswalk', async () => {
      mockWbsCostCodeCrosswalkFindMany.mockResolvedValue([]);
      const res = await request(app)
        .get('/api/v1/projects/proj-1/wbs/crosswalk')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('POST /projects/:id/wbs/crosswalk creates a mapping', async () => {
      mockWbsCostCodeCrosswalkCreate.mockResolvedValue({ id: 'c1' });
      const res = await request(app)
        .post('/api/v1/projects/proj-1/wbs/crosswalk')
        .set(authHeader())
        .send({ gcItemId: 'g1', subItemId: 's1' });
      expect(res.status).toBe(201);
    });
  });
});
