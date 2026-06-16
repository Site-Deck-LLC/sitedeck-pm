import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import {
  createRiskItem,
  getRiskItemById,
  getRiskItemsByProject,
  getOpenRisksByProject,
  updateRiskItem,
  closeRiskItem,
  acceptRiskItem,
  mitigateRiskItem,
  getRiskMatrix,
  getRiskDashboardStatus,
  autoCreateRiskFromSafetyIncident,
} from './risk.service';

const mockRiskItemCreate = jest.fn();
const mockRiskItemFindUnique = jest.fn();
const mockRiskItemFindMany = jest.fn();
const mockRiskItemFindFirst = jest.fn();
const mockRiskItemUpdate = jest.fn();

const mockPrisma = {
  riskItem: {
    create: mockRiskItemCreate,
    findUnique: mockRiskItemFindUnique,
    findMany: mockRiskItemFindMany,
    findFirst: mockRiskItemFindFirst,
    update: mockRiskItemUpdate,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.clearAllMocks();
  setPrismaClient(mockPrisma);
});

describe('risk.service', () => {
  describe('createRiskItem', () => {
    it('creates a risk item with auto-calculated score', async () => {
      const created = {
        id: 'risk-1',
        projectId: 'proj-1',
        description: 'Concrete supply delay',
        category: 'schedule',
        probability: 'medium',
        impact: 'high',
        score: 6,
        owner: 'pm-1',
        status: 'open',
        source: 'manual',
      };
      mockRiskItemCreate.mockResolvedValue(created);

      const result = await createRiskItem({
        projectId: 'proj-1',
        description: 'Concrete supply delay',
        category: 'schedule',
        probability: 'medium',
        impact: 'high',
        owner: 'pm-1',
      });

      expect(mockRiskItemCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          description: 'Concrete supply delay',
          category: 'schedule',
          probability: 'medium',
          impact: 'high',
          score: 6,
          owner: 'pm-1',
          status: 'open',
          source: 'manual',
        }),
      });
      expect(result.score).toBe(6);
    });

    it('creates a low/low risk with score 1', async () => {
      const created = {
        id: 'risk-2',
        projectId: 'proj-1',
        description: 'Minor paperwork delay',
        category: 'other',
        probability: 'low',
        impact: 'low',
        score: 1,
        owner: 'pm-1',
        status: 'open',
        source: 'manual',
      };
      mockRiskItemCreate.mockResolvedValue(created);

      const result = await createRiskItem({
        projectId: 'proj-1',
        description: 'Minor paperwork delay',
        category: 'other',
        probability: 'low',
        impact: 'low',
        owner: 'pm-1',
      });

      expect(result.score).toBe(1);
    });

    it('creates a high/high risk with score 9', async () => {
      const created = {
        id: 'risk-3',
        projectId: 'proj-1',
        description: 'Severe weather shutdown',
        category: 'safety',
        probability: 'high',
        impact: 'high',
        score: 9,
        owner: 'pm-1',
        status: 'open',
        source: 'manual',
      };
      mockRiskItemCreate.mockResolvedValue(created);

      const result = await createRiskItem({
        projectId: 'proj-1',
        description: 'Severe weather shutdown',
        category: 'safety',
        probability: 'high',
        impact: 'high',
        owner: 'pm-1',
      });

      expect(result.score).toBe(9);
    });
  });

  describe('getRiskItemById', () => {
    it('returns a risk item with project', async () => {
      const risk = { id: 'risk-1', description: 'Test' };
      mockRiskItemFindUnique.mockResolvedValue(risk);

      const result = await getRiskItemById('risk-1');
      expect(mockRiskItemFindUnique).toHaveBeenCalledWith({
        where: { id: 'risk-1' },
        include: { project: true },
      });
      expect(result).toEqual(risk);
    });
  });

  describe('getRiskItemsByProject', () => {
    it('returns all risks ordered by createdAt desc', async () => {
      const risks = [
        { id: 'risk-2', createdAt: new Date('2026-06-02') },
        { id: 'risk-1', createdAt: new Date('2026-06-01') },
      ];
      mockRiskItemFindMany.mockResolvedValue(risks);

      const result = await getRiskItemsByProject('proj-1');
      expect(mockRiskItemFindMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(risks);
    });
  });

  describe('getOpenRisksByProject', () => {
    it('returns only open risks ordered by score desc', async () => {
      const risks = [{ id: 'risk-1', score: 9, status: 'open' }];
      mockRiskItemFindMany.mockResolvedValue(risks);

      const result = await getOpenRisksByProject('proj-1');
      expect(mockRiskItemFindMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', status: 'open' },
        orderBy: { score: 'desc' },
      });
      expect(result).toEqual(risks);
    });
  });

  describe('updateRiskItem', () => {
    it('updates a risk item and recalculates score when probability changes', async () => {
      const existing = {
        id: 'risk-1',
        probability: 'low',
        impact: 'low',
        score: 1,
      };
      const updated = {
        id: 'risk-1',
        probability: 'high',
        impact: 'low',
        score: 3,
      };
      mockRiskItemFindUnique.mockResolvedValue(existing);
      mockRiskItemUpdate.mockResolvedValue(updated);

      const result = await updateRiskItem('risk-1', { probability: 'high' });
      expect(mockRiskItemUpdate).toHaveBeenCalledWith({
        where: { id: 'risk-1' },
        data: expect.objectContaining({
          probability: 'high',
          score: 3,
        }),
      });
      expect(result.score).toBe(3);
    });

    it('recalculates score when impact changes', async () => {
      const existing = {
        id: 'risk-1',
        probability: 'medium',
        impact: 'low',
        score: 2,
      };
      const updated = {
        id: 'risk-1',
        probability: 'medium',
        impact: 'high',
        score: 6,
      };
      mockRiskItemFindUnique.mockResolvedValue(existing);
      mockRiskItemUpdate.mockResolvedValue(updated);

      const result = await updateRiskItem('risk-1', { impact: 'high' });
      expect(mockRiskItemUpdate).toHaveBeenCalledWith({
        where: { id: 'risk-1' },
        data: expect.objectContaining({
          impact: 'high',
          score: 6,
        }),
      });
      expect(result.score).toBe(6);
    });

    it('throws when updating non-existent risk item', async () => {
      mockRiskItemFindUnique.mockResolvedValue(null);
      await expect(updateRiskItem('risk-1', { description: 'Updated' })).rejects.toThrow(
        'Risk item not found'
      );
    });
  });

  describe('closeRiskItem', () => {
    it('sets status to closed and appends notes', async () => {
      const existing = {
        id: 'risk-1',
        status: 'open',
        mitigationPlan: 'Plan A',
      };
      mockRiskItemFindUnique.mockResolvedValue(existing);
      mockRiskItemUpdate.mockResolvedValue({ ...existing, status: 'closed', mitigationPlan: 'Plan A\nClose notes: resolved' });

      const result = await closeRiskItem('risk-1', 'resolved');
      expect(mockRiskItemUpdate).toHaveBeenCalledWith({
        where: { id: 'risk-1' },
        data: {
          status: 'closed',
          mitigationPlan: 'Plan A\nClose notes: resolved',
        },
      });
      expect(result.status).toBe('closed');
    });

    it('throws when closing non-existent risk item', async () => {
      mockRiskItemFindUnique.mockResolvedValue(null);
      await expect(closeRiskItem('risk-1')).rejects.toThrow('Risk item not found');
    });
  });

  describe('acceptRiskItem', () => {
    it('sets status to accepted', async () => {
      const existing = { id: 'risk-1', status: 'open', mitigationPlan: null };
      mockRiskItemFindUnique.mockResolvedValue(existing);
      mockRiskItemUpdate.mockResolvedValue({ ...existing, status: 'accepted' });

      const result = await acceptRiskItem('risk-1');
      expect(mockRiskItemUpdate).toHaveBeenCalledWith({
        where: { id: 'risk-1' },
        data: {
          status: 'accepted',
          mitigationPlan: null,
        },
      });
      expect(result.status).toBe('accepted');
    });

    it('throws when accepting non-existent risk item', async () => {
      mockRiskItemFindUnique.mockResolvedValue(null);
      await expect(acceptRiskItem('risk-1')).rejects.toThrow('Risk item not found');
    });
  });

  describe('mitigateRiskItem', () => {
    it('sets status to mitigated and updates plan', async () => {
      const existing = { id: 'risk-1', status: 'open' };
      mockRiskItemFindUnique.mockResolvedValue(existing);
      mockRiskItemUpdate.mockResolvedValue({ ...existing, status: 'mitigated', mitigationPlan: 'New plan' });

      const result = await mitigateRiskItem('risk-1', 'New plan');
      expect(mockRiskItemUpdate).toHaveBeenCalledWith({
        where: { id: 'risk-1' },
        data: {
          status: 'mitigated',
          mitigationPlan: 'New plan',
        },
      });
      expect(result.status).toBe('mitigated');
    });

    it('throws when mitigating non-existent risk item', async () => {
      mockRiskItemFindUnique.mockResolvedValue(null);
      await expect(mitigateRiskItem('risk-1', 'Plan')).rejects.toThrow('Risk item not found');
    });
  });

  describe('getRiskMatrix', () => {
    it('returns all 9 cells with correct scores and colors', async () => {
      mockRiskItemFindMany.mockResolvedValue([]);

      const result = await getRiskMatrix('proj-1');
      expect(result.cells).toHaveLength(9);
      expect(result.cells.map((c) => c.score)).toEqual([
        1, 2, 3,
        2, 4, 6,
        3, 6, 9,
      ]);
      expect(result.cells.map((c) => c.color)).toEqual([
        'green', 'green', 'green',
        'green', 'amber', 'amber',
        'green', 'amber', 'red',
      ]);
    });

    it('populates cells with matching risks', async () => {
      const risks = [
        { id: 'r1', probability: 'low', impact: 'low', description: 'A', owner: 'o1', status: 'open' },
        { id: 'r2', probability: 'high', impact: 'high', description: 'B', owner: 'o2', status: 'open' },
      ];
      mockRiskItemFindMany.mockResolvedValue(risks);

      const result = await getRiskMatrix('proj-1');
      const lowLow = result.cells.find((c) => c.probability === 'low' && c.impact === 'low');
      const highHigh = result.cells.find((c) => c.probability === 'high' && c.impact === 'high');

      expect(lowLow?.risks).toHaveLength(1);
      expect(lowLow?.risks[0].id).toBe('r1');
      expect(highHigh?.risks).toHaveLength(1);
      expect(highHigh?.risks[0].id).toBe('r2');
    });

    it('returns highRisks for score >= 7', async () => {
      const risks = [
        { id: 'r1', probability: 'high', impact: 'high', description: 'A', owner: 'o1', status: 'open', score: 9 },
        { id: 'r2', probability: 'medium', impact: 'high', description: 'B', owner: 'o2', status: 'open', score: 6 },
      ];
      mockRiskItemFindMany.mockResolvedValue(risks);

      const result = await getRiskMatrix('proj-1');
      expect(result.highRisks).toHaveLength(1);
      expect(result.highRisks[0].id).toBe('r1');
    });

    it('returns totalOpen count', async () => {
      const risks = [
        { id: 'r1', probability: 'low', impact: 'low', description: 'A', owner: 'o1', status: 'open', score: 1 },
        { id: 'r2', probability: 'low', impact: 'low', description: 'B', owner: 'o2', status: 'closed', score: 1 },
      ];
      mockRiskItemFindMany.mockResolvedValue(risks);

      const result = await getRiskMatrix('proj-1');
      expect(result.totalOpen).toBe(1);
    });
  });

  describe('getRiskDashboardStatus', () => {
    it('returns green when no open risks', async () => {
      mockRiskItemFindMany.mockResolvedValue([]);
      const result = await getRiskDashboardStatus('proj-1');
      expect(result.status).toBe('green');
      expect(result.count).toBe(0);
    });

    it('returns green when only low-risk items are open', async () => {
      mockRiskItemFindMany.mockResolvedValue([
        { id: 'r1', score: 1, status: 'open' },
        { id: 'r2', score: 3, status: 'open' },
      ]);
      const result = await getRiskDashboardStatus('proj-1');
      expect(result.status).toBe('green');
      expect(result.count).toBe(2);
    });

    it('returns amber when medium risks exist and no high risks', async () => {
      mockRiskItemFindMany.mockResolvedValue([
        { id: 'r1', score: 4, status: 'open' },
        { id: 'r2', score: 6, status: 'open' },
      ]);
      const result = await getRiskDashboardStatus('proj-1');
      expect(result.status).toBe('amber');
      expect(result.count).toBe(2);
    });

    it('returns red when high risks exist', async () => {
      mockRiskItemFindMany.mockResolvedValue([
        { id: 'r1', score: 7, status: 'open' },
        { id: 'r2', score: 9, status: 'open' },
      ]);
      const result = await getRiskDashboardStatus('proj-1');
      expect(result.status).toBe('red');
      expect(result.count).toBe(2);
    });

    it('returns red when high and medium risks both exist', async () => {
      mockRiskItemFindMany.mockResolvedValue([
        { id: 'r1', score: 7, status: 'open' },
        { id: 'r2', score: 5, status: 'open' },
      ]);
      const result = await getRiskDashboardStatus('proj-1');
      expect(result.status).toBe('red');
    });
  });

  describe('autoCreateRiskFromSafetyIncident', () => {
    it('creates a risk from safety incident with low severity', async () => {
      mockRiskItemFindFirst.mockResolvedValue(null);
      const created = { id: 'risk-s1', score: 1 };
      mockRiskItemCreate.mockResolvedValue(created);

      const result = await autoCreateRiskFromSafetyIncident('proj-1', {
        incidentType: 'near_miss',
        severity: 1,
        recordable: false,
        description: 'Near miss at gate',
      }, 'inc-001');

      expect(mockRiskItemCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          probability: 'low',
          impact: 'low',
          score: 1,
          category: 'safety',
          source: 'safety_incident_webhook',
          incidentReference: 'inc-001',
          recordable: false,
        }),
      });
      expect(result.score).toBe(1);
    });

    it('creates a risk with medium severity', async () => {
      mockRiskItemFindFirst.mockResolvedValue(null);
      const created = { id: 'risk-s2', score: 4 };
      mockRiskItemCreate.mockResolvedValue(created);

      const result = await autoCreateRiskFromSafetyIncident('proj-1', {
        incidentType: 'minor_injury',
        severity: 3,
        recordable: false,
        description: 'Cut hand',
      }, 'inc-002');

      expect(mockRiskItemCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          probability: 'medium',
          impact: 'medium',
          score: 4,
          recordable: false,
        }),
      });
      expect(result.score).toBe(4);
    });

    it('creates a risk with high severity', async () => {
      mockRiskItemFindFirst.mockResolvedValue(null);
      const created = { id: 'risk-s3', score: 9 };
      mockRiskItemCreate.mockResolvedValue(created);

      const result = await autoCreateRiskFromSafetyIncident('proj-1', {
        incidentType: 'serious_injury',
        severity: 5,
        recordable: true,
        description: 'Fall from height',
      }, 'inc-003');

      expect(mockRiskItemCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          probability: 'high',
          impact: 'high',
          score: 9,
          recordable: true,
        }),
      });
      expect(result.score).toBe(9);
    });

    it('is idempotent — does not create duplicate for same incident reference', async () => {
      const existing = { id: 'risk-s1', incidentReference: 'inc-001' };
      mockRiskItemFindFirst.mockResolvedValue(existing);

      const result = await autoCreateRiskFromSafetyIncident('proj-1', {
        incidentType: 'near_miss',
        severity: 1,
        recordable: false,
        description: 'Near miss at gate',
      }, 'inc-001');

      expect(mockRiskItemCreate).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });

    it('bumps impact to minimum medium when recordable is true for low severity', async () => {
      mockRiskItemFindFirst.mockResolvedValue(null);
      const created = { id: 'risk-s4', score: 2 };
      mockRiskItemCreate.mockResolvedValue(created);

      const result = await autoCreateRiskFromSafetyIncident('proj-1', {
        incidentType: 'recordable_near_miss',
        severity: 2,
        recordable: true,
        description: 'Recordable near miss',
      }, 'inc-004');

      expect(mockRiskItemCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          probability: 'low',
          impact: 'medium',
          score: 2,
          recordable: true,
        }),
      });
      expect(result.score).toBe(2);
    });

    it('does not bump impact when already medium or high and recordable', async () => {
      mockRiskItemFindFirst.mockResolvedValue(null);
      const created = { id: 'risk-s5', score: 4 };
      mockRiskItemCreate.mockResolvedValue(created);

      const result = await autoCreateRiskFromSafetyIncident('proj-1', {
        incidentType: 'recordable_minor',
        severity: 3,
        recordable: true,
        description: 'Recordable minor injury',
      }, 'inc-005');

      expect(mockRiskItemCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          probability: 'medium',
          impact: 'medium',
          score: 4,
          recordable: true,
        }),
      });
      expect(result.score).toBe(4);
    });
  });
});
