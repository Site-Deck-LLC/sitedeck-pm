import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import {
  handleTaskCompleted,
  handleMaterialReceived,
  handleLaborHoursLogged,
  handleEquipmentUsageLogged,
  handleSafetyIncident,
  handleFieldIssueLogged,
  handleScheduleChangeRequested,
  sendActivityReady,
  sendMaterialNeeded,
  sendRfiStatusUpdated,
  sendSubmittalStatusUpdated,
  sendScheduleChangeDecided,
} from './webhook.service';

jest.mock('./activity.service', () => ({
  markActivityComplete: jest.fn(),
}));

jest.mock('./procurement.service', () => ({
  recordMaterialDelivery: jest.fn(),
}));

jest.mock('./cost.service', () => ({
  createCostTransaction: jest.fn(),
}));

jest.mock('./risk.service', () => ({
  autoCreateRiskFromSafetyIncident: jest.fn(),
}));

jest.mock('./integration.service', () => ({
  createIssue: jest.fn(),
}));

jest.mock('./change-request.service', () => ({
  createChangeRequest: jest.fn(),
}));

jest.mock('./resource.service', () => ({
  upsertEquipment: jest.fn(),
  recordEquipmentUsage: jest.fn(),
}));

import { markActivityComplete } from './activity.service';
import { recordMaterialDelivery } from './procurement.service';
import { createCostTransaction } from './cost.service';
import { autoCreateRiskFromSafetyIncident } from './risk.service';
import { createIssue } from './integration.service';
import { createChangeRequest } from './change-request.service';
import { upsertEquipment, recordEquipmentUsage } from './resource.service';

const mockWebhooksLogCreate = jest.fn();
const mockWebhooksLogFindFirst = jest.fn();

const mockPrisma = {
  webhooksLog: {
    create: mockWebhooksLogCreate,
    findFirst: mockWebhooksLogFindFirst,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.clearAllMocks();
  setPrismaClient(mockPrisma);
});

describe('webhook.service', () => {
  describe('handleTaskCompleted', () => {
    it('marks activity complete and logs event', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      (markActivityComplete as jest.Mock).mockResolvedValue({ id: 'act-1' });
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleTaskCompleted({
        project_id: 'proj-1',
        activity_id: 'act-1',
        completed_by: 'user-1',
        completed_at: '2026-06-01T00:00:00Z',
        notes: 'Done',
      });

      expect(markActivityComplete).toHaveBeenCalledWith('act-1', 'user-1', expect.any(Date));
      expect(mockWebhooksLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'task-completed',
            direction: 'inbound',
            status: 'processed',
          }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('is idempotent — skips duplicate event', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue({ id: 'log-prev' });
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleTaskCompleted({
        project_id: 'proj-1',
        activity_id: 'act-1',
        eventId: 'evt-1',
      });

      expect(markActivityComplete).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Duplicate event ignored');
    });

    it('returns failure when activity_id is missing', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleTaskCompleted({
        project_id: 'proj-1',
      });

      expect(markActivityComplete).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.message).toBe('Missing activity_id');
    });

    it('catches errors and returns failure without throwing', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      (markActivityComplete as jest.Mock).mockRejectedValue(new Error('DB error'));
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleTaskCompleted({
        project_id: 'proj-1',
        activity_id: 'act-1',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('DB error');
    });
  });

  describe('handleMaterialReceived', () => {
    it('records material delivery and logs event', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      (recordMaterialDelivery as jest.Mock).mockResolvedValue({ id: 'del-1' });
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleMaterialReceived({
        project_id: 'proj-1',
        po_id: 'po-1',
        line_items_received: [{ line_item_id: 'li-1', quantity_received: 10 }],
        receiver_id: 'user-1',
        received_at: '2026-06-01T00:00:00Z',
        referenceId: 'ref-1',
      });

      expect(recordMaterialDelivery).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          poId: 'po-1',
          lineItemId: 'li-1',
          quantityReceived: 10,
          receivedBy: 'user-1',
          deliveryReference: 'ref-1',
        })
      );
      expect(result.success).toBe(true);
    });

    it('is idempotent — skips duplicate event', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue({ id: 'log-prev' });

      const result = await handleMaterialReceived({
        project_id: 'proj-1',
        po_id: 'po-1',
        eventId: 'evt-1',
      });

      expect(recordMaterialDelivery).not.toHaveBeenCalled();
      expect(result.message).toBe('Duplicate event ignored');
    });

    it('returns failure when required fields are missing', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleMaterialReceived({
        project_id: 'proj-1',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Missing po_id or line_items_received');
    });
  });

  describe('handleLaborHoursLogged', () => {
    it('creates cost transaction and logs event', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      (createCostTransaction as jest.Mock).mockResolvedValue({ id: 'tx-1' });
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleLaborHoursLogged({
        project_id: 'proj-1',
        cost_code: 'bl-1',
        hours: 8,
        date: '2026-06-01',
        eventId: 'evt-1',
      });

      expect(createCostTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          budgetLineId: 'bl-1',
          type: 'incurred',
          source: 'labor_webhook',
          amount: 8,
        })
      );
      expect(result.success).toBe(true);
    });

    it('is idempotent — skips duplicate event', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue({ id: 'log-prev' });

      const result = await handleLaborHoursLogged({
        project_id: 'proj-1',
        cost_code: 'bl-1',
        hours: 8,
        eventId: 'evt-1',
      });

      expect(createCostTransaction).not.toHaveBeenCalled();
      expect(result.message).toBe('Duplicate event ignored');
    });

    it('returns failure when required fields are missing', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleLaborHoursLogged({
        project_id: 'proj-1',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Missing cost_code or hours');
    });
  });

  describe('handleEquipmentUsageLogged', () => {
    it('creates cost transaction, updates equipment registry, and logs event', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      (createCostTransaction as jest.Mock).mockResolvedValue({ id: 'tx-1' });
      (upsertEquipment as jest.Mock).mockResolvedValue({ id: 'eq-1' });
      (recordEquipmentUsage as jest.Mock).mockResolvedValue({ id: 'eq-1', totalHours: 4 });
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleEquipmentUsageLogged({
        project_id: 'proj-1',
        equipment_id: 'eq-1',
        hours_on_site: 4,
        date: '2026-06-01',
        eventId: 'evt-1',
      });

      expect(createCostTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          budgetLineId: 'eq-1',
          type: 'incurred',
          source: 'equipment_webhook',
          amount: 4,
        })
      );
      expect(upsertEquipment).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          externalId: 'eq-1',
        })
      );
      expect(recordEquipmentUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          externalId: 'eq-1',
          hours: 4,
        })
      );
      expect(result.success).toBe(true);
    });

    it('is idempotent — skips duplicate event', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue({ id: 'log-prev' });

      const result = await handleEquipmentUsageLogged({
        project_id: 'proj-1',
        equipment_id: 'eq-1',
        hours_on_site: 4,
        eventId: 'evt-1',
      });

      expect(createCostTransaction).not.toHaveBeenCalled();
      expect(upsertEquipment).not.toHaveBeenCalled();
      expect(recordEquipmentUsage).not.toHaveBeenCalled();
      expect(result.message).toBe('Duplicate event ignored');
    });

    it('returns failure when required fields are missing', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleEquipmentUsageLogged({
        project_id: 'proj-1',
      });

      expect(createCostTransaction).not.toHaveBeenCalled();
      expect(upsertEquipment).not.toHaveBeenCalled();
      expect(recordEquipmentUsage).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.message).toBe('Missing equipment_id or hours_on_site');
    });
  });

  describe('handleSafetyIncident', () => {
    it('creates risk from safety incident and logs event', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      (autoCreateRiskFromSafetyIncident as jest.Mock).mockResolvedValue({ id: 'risk-1' });
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleSafetyIncident({
        project_id: 'proj-1',
        incident_type: 'near_miss',
        severity: 2,
        recordable: false,
        description: 'Near miss at gate',
        eventId: 'evt-1',
      });

      expect(autoCreateRiskFromSafetyIncident).toHaveBeenCalledWith(
        'proj-1',
        expect.objectContaining({
          incidentType: 'near_miss',
          severity: 2,
          recordable: false,
          description: 'Near miss at gate',
        }),
        'evt-1'
      );
      expect(result.success).toBe(true);
    });

    it('is idempotent — skips duplicate event', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue({ id: 'log-prev' });

      const result = await handleSafetyIncident({
        project_id: 'proj-1',
        incident_type: 'near_miss',
        severity: 2,
        eventId: 'evt-1',
      });

      expect(autoCreateRiskFromSafetyIncident).not.toHaveBeenCalled();
      expect(result.message).toBe('Duplicate event ignored');
    });

    it('returns failure when required fields are missing', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleSafetyIncident({
        project_id: 'proj-1',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Missing required fields');
    });
  });

  describe('handleFieldIssueLogged', () => {
    it('creates issue and logs event', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      (createIssue as jest.Mock).mockResolvedValue({ id: 'issue-1' });
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleFieldIssueLogged({
        project_id: 'proj-1',
        description: 'Broken conduit',
        reporter_id: 'user-1',
        activity_id: 'act-1',
        eventId: 'evt-1',
      });

      expect(createIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          type: 'field_issue',
          source: 'pro_webhook',
          description: 'Broken conduit',
          activityId: 'act-1',
          createdBy: 'user-1',
        })
      );
      expect(result.success).toBe(true);
    });

    it('is idempotent — skips duplicate event', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue({ id: 'log-prev' });

      const result = await handleFieldIssueLogged({
        project_id: 'proj-1',
        description: 'Broken conduit',
        eventId: 'evt-1',
      });

      expect(createIssue).not.toHaveBeenCalled();
      expect(result.message).toBe('Duplicate event ignored');
    });

    it('returns failure when required fields are missing', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleFieldIssueLogged({
        project_id: 'proj-1',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Missing project_id or description');
    });
  });

  describe('handleScheduleChangeRequested', () => {
    it('creates change request and logs event', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      (createChangeRequest as jest.Mock).mockResolvedValue({ id: 'cr-1' });
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleScheduleChangeRequested({
        project_id: 'proj-1',
        activity_id: 'act-1',
        reason_code: 'weather_delay',
        proposed_dates: { start_date: '2026-06-10', end_date: '2026-06-15' },
        impact_description: 'Rain delay',
        requested_by: 'super-1',
        eventId: 'evt-1',
      });

      expect(createChangeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          activityId: 'act-1',
          reasonCode: 'weather_delay',
          requestedBy: 'super-1',
          impactDescription: 'Rain delay',
        })
      );
      expect(result.success).toBe(true);
    });

    it('is idempotent — skips duplicate event', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue({ id: 'log-prev' });

      const result = await handleScheduleChangeRequested({
        project_id: 'proj-1',
        activity_id: 'act-1',
        reason_code: 'weather_delay',
        eventId: 'evt-1',
      });

      expect(createChangeRequest).not.toHaveBeenCalled();
      expect(result.message).toBe('Duplicate event ignored');
    });

    it('returns failure when required fields are missing', async () => {
      mockWebhooksLogFindFirst.mockResolvedValue(null);
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await handleScheduleChangeRequested({
        project_id: 'proj-1',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Missing required fields');
    });
  });

  describe('outbound stubs', () => {
    it('sendActivityReady logs outbound event', async () => {
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await sendActivityReady('proj-1', 'act-1');
      expect(mockWebhooksLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'activity-ready',
            direction: 'outbound',
            status: 'pending',
          }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('sendMaterialNeeded logs outbound event', async () => {
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await sendMaterialNeeded('proj-1', 'po-1', 'Steel beams', 100, new Date('2026-06-10'), 'act-1');
      expect(mockWebhooksLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'material-needed',
            direction: 'outbound',
            status: 'pending',
          }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('sendRfiStatusUpdated logs outbound event', async () => {
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await sendRfiStatusUpdated('proj-1', 'RFI-2026-0001', 'answered', 'See spec section 4.2', 'act-1');
      expect(mockWebhooksLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'rfi-status-updated',
            direction: 'outbound',
            status: 'pending',
          }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('sendSubmittalStatusUpdated logs outbound event', async () => {
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await sendSubmittalStatusUpdated('proj-1', 'sub-1', 'approved', 'act-2');
      expect(mockWebhooksLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'submittal-status-updated',
            direction: 'outbound',
            status: 'pending',
          }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('sendScheduleChangeDecided logs outbound event', async () => {
      mockWebhooksLogCreate.mockResolvedValue({ id: 'log-1' });

      const result = await sendScheduleChangeDecided('proj-1', 'cr-1', 'approved', 'Approved with note', {
        startDate: new Date('2026-06-10'),
        endDate: new Date('2026-06-15'),
      });
      expect(mockWebhooksLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'schedule-change-decided',
            direction: 'outbound',
            status: 'pending',
          }),
        })
      );
      expect(result.success).toBe(true);
    });
  });
});
