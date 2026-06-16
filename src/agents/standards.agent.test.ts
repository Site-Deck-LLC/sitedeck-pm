/**
 * Tests for the standards compliance agent. Verifies the deterministic
 * rule engine — no Anthropic call, no flakiness.
 *
 * Coverage:
 *   - 404-style error when project is missing
 *   - OSHA 1926.501 (fall protection): pending when no hours, pass when
 *     TRIR is at/below 2.0, fail when above
 *   - OSHA 1903 (injury reporting): pending with reminder when incidents
 *     exist; pass when none
 *   - Notices array: 48h notice appears only when there are open RFIs
 *   - Overall status rollup: red on fail, amber on pending, green otherwise
 *   - Standards catalog exports the right ids
 *   - Unknown standard id → not_applicable
 */

import * as agent from './standards.agent';
import { getProjectById } from '../services/project.service';
import { getSafetyPerformance } from '../services/safety.service';
import { getRfiByProject, getSubmittalsByProject } from '../services/communications.service';
import { listStandards, getStandard } from '../constants/standards';

jest.mock('../services/project.service', () => ({
  getProjectById: jest.fn(),
}));
jest.mock('../services/safety.service', () => ({
  getSafetyPerformance: jest.fn(),
}));
jest.mock('../services/communications.service', () => ({
  getRfiByProject: jest.fn(),
  getSubmittalsByProject: jest.fn(),
}));

const mockGetProject = getProjectById as jest.Mock;
const mockGetSafety = getSafetyPerformance as jest.Mock;
const mockGetRfis = getRfiByProject as jest.Mock;
const mockGetSubmittals = getSubmittalsByProject as jest.Mock;

describe('standards.agent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runStandards', () => {
    it('throws when project is missing', async () => {
      mockGetProject.mockResolvedValue(null);
      await expect(agent.runStandards({ projectId: 'missing' })).rejects.toThrow(/not found/);
    });

    it('returns checks for every standard in the catalog by default', async () => {
      mockGetProject.mockResolvedValue({ id: 'p-1', name: 'P' });
      mockGetSafety.mockResolvedValue({
        trirActual: 0, trirTarget: 1.0, recordableIncidents: 0, totalHoursWorked: 100, status: 'green', series: [],
      });
      mockGetRfis.mockResolvedValue([]);
      mockGetSubmittals.mockResolvedValue([]);

      const result = await agent.runStandards({ projectId: 'p-1' });
      // The dispatch table covers 6 rules; the rest get "pending — no
      // implementation". Total count = catalog length.
      expect(result.checks.length).toBe(listStandards().length);
      // No fails; no red status.
      expect(result.overallStatus).not.toBe('red');
    });

    it('passes OSHA 1926.501 when TRIR is low', async () => {
      mockGetProject.mockResolvedValue({ id: 'p-1', name: 'P' });
      mockGetSafety.mockResolvedValue({
        trirActual: 0.5, trirTarget: 1.0, recordableIncidents: 1, totalHoursWorked: 1000, status: 'green', series: [],
      });
      mockGetRfis.mockResolvedValue([]);
      mockGetSubmittals.mockResolvedValue([]);

      const result = await agent.runStandards({ projectId: 'p-1', standardIds: ['OSHA_1926_501'] });
      const osha = result.checks.find((c) => c.standardId === 'OSHA_1926_501')!;
      expect(osha.status).toBe('pass');
      expect(osha.evidence).toContain('TRIR 0.5');
    });

    it('fails OSHA 1926.501 when TRIR is above 2.0', async () => {
      mockGetProject.mockResolvedValue({ id: 'p-1', name: 'P' });
      mockGetSafety.mockResolvedValue({
        trirActual: 2.5, trirTarget: 1.0, recordableIncidents: 5, totalHoursWorked: 1000, status: 'red', series: [],
      });
      mockGetRfis.mockResolvedValue([]);
      mockGetSubmittals.mockResolvedValue([]);

      const result = await agent.runStandards({ projectId: 'p-1', standardIds: ['OSHA_1926_501'] });
      const osha = result.checks.find((c) => c.standardId === 'OSHA_1926_501')!;
      expect(osha.status).toBe('fail');
      expect(osha.evidence).toContain('2.0 safety-action threshold');
    });

    it('marks OSHA 1926.501 pending when no hours have been logged', async () => {
      mockGetProject.mockResolvedValue({ id: 'p-1', name: 'P' });
      mockGetSafety.mockResolvedValue({
        trirActual: 0, trirTarget: 1.0, recordableIncidents: 0, totalHoursWorked: 0, status: 'green', series: [],
      });
      mockGetRfis.mockResolvedValue([]);
      mockGetSubmittals.mockResolvedValue([]);

      const result = await agent.runStandards({ projectId: 'p-1', standardIds: ['OSHA_1926_501'] });
      const osha = result.checks.find((c) => c.standardId === 'OSHA_1926_501')!;
      expect(osha.status).toBe('pending');
    });

    it('passes OSHA 1903 when there are no recordable incidents', async () => {
      mockGetProject.mockResolvedValue({ id: 'p-1', name: 'P' });
      mockGetSafety.mockResolvedValue({
        trirActual: 0, trirTarget: 1.0, recordableIncidents: 0, totalHoursWorked: 100, status: 'green', series: [],
      });
      mockGetRfis.mockResolvedValue([]);
      mockGetSubmittals.mockResolvedValue([]);

      const result = await agent.runStandards({ projectId: 'p-1', standardIds: ['OSHA_1903'] });
      const osha = result.checks.find((c) => c.standardId === 'OSHA_1903')!;
      expect(osha.status).toBe('pass');
    });

    it('marks OSHA 1903 pending with 8h/24h reminder when incidents exist', async () => {
      mockGetProject.mockResolvedValue({ id: 'p-1', name: 'P' });
      mockGetSafety.mockResolvedValue({
        trirActual: 0.5, trirTarget: 1.0, recordableIncidents: 2, totalHoursWorked: 1000, status: 'green', series: [],
      });
      mockGetRfis.mockResolvedValue([]);
      mockGetSubmittals.mockResolvedValue([]);

      const result = await agent.runStandards({ projectId: 'p-1', standardIds: ['OSHA_1903'] });
      const osha = result.checks.find((c) => c.standardId === 'OSHA_1903')!;
      expect(osha.status).toBe('pending');
      expect(osha.gapDescription).toMatch(/8h|24h/);
    });

    it('returns overallStatus=red when any check fails', async () => {
      mockGetProject.mockResolvedValue({ id: 'p-1', name: 'P' });
      mockGetSafety.mockResolvedValue({
        trirActual: 5.0, trirTarget: 1.0, recordableIncidents: 10, totalHoursWorked: 1000, status: 'red', series: [],
      });
      mockGetRfis.mockResolvedValue([]);
      mockGetSubmittals.mockResolvedValue([]);

      const result = await agent.runStandards({ projectId: 'p-1' });
      expect(result.overallStatus).toBe('red');
    });

    it('returns overallStatus=amber when checks are pending but none fail', async () => {
      mockGetProject.mockResolvedValue({ id: 'p-1', name: 'P' });
      mockGetSafety.mockResolvedValue({
        trirActual: 0, trirTarget: 1.0, recordableIncidents: 0, totalHoursWorked: 0, status: 'green', series: [],
      });
      mockGetRfis.mockResolvedValue([]);
      mockGetSubmittals.mockResolvedValue([]);

      const result = await agent.runStandards({ projectId: 'p-1' });
      expect(result.overallStatus).toBe('amber');
    });

    it('returns a 48-hour notice alert only when there are open RFIs', async () => {
      mockGetProject.mockResolvedValue({ id: 'p-1', name: 'P' });
      mockGetSafety.mockResolvedValue({
        trirActual: 0, trirTarget: 1.0, recordableIncidents: 0, totalHoursWorked: 100, status: 'green', series: [],
      });

      // No RFIs → no notice
      mockGetRfis.mockResolvedValue([]);
      mockGetSubmittals.mockResolvedValue([]);
      let result = await agent.runStandards({ projectId: 'p-1' });
      expect(result.notices.find((n) => n.noticeType.includes('48-Hour'))).toBeUndefined();

      // Open RFI → notice appears
      mockGetRfis.mockResolvedValue([{ id: 'r1', rfiNumber: 'RFI-1', subject: 'S', status: 'open', requiredDate: null }]);
      result = await agent.runStandards({ projectId: 'p-1' });
      const notice = result.notices.find((n) => n.noticeType.includes('48-Hour'));
      expect(notice).toBeDefined();
      expect(notice!.daysRemaining).toBe(2);
      expect(notice!.responsibleRole).toBe('project_manager');
    });

    it('returns not_applicable for unknown standard ids', async () => {
      mockGetProject.mockResolvedValue({ id: 'p-1', name: 'P' });
      mockGetSafety.mockResolvedValue({
        trirActual: 0, trirTarget: 1.0, recordableIncidents: 0, totalHoursWorked: 100, status: 'green', series: [],
      });
      mockGetRfis.mockResolvedValue([]);
      mockGetSubmittals.mockResolvedValue([]);

      const result = await agent.runStandards({ projectId: 'p-1', standardIds: ['NONEXISTENT'] });
      expect(result.checks[0].status).toBe('not_applicable');
      expect(result.checks[0].standardId).toBe('NONEXISTENT');
    });

    it('surfaces pending-with-gap checks for standards with no wired rule', async () => {
      mockGetProject.mockResolvedValue({ id: 'p-1', name: 'P' });
      mockGetSafety.mockResolvedValue({
        trirActual: 0, trirTarget: 1.0, recordableIncidents: 0, totalHoursWorked: 100, status: 'green', series: [],
      });
      mockGetRfis.mockResolvedValue([]);
      mockGetSubmittals.mockResolvedValue([]);

      const result = await agent.runStandards({ projectId: 'p-1', standardIds: ['NFPA_855'] });
      const nfpa = result.checks[0];
      expect(nfpa.status).toBe('pending');
      expect(nfpa.gapDescription).toMatch(/rule|implement/i);
    });

    it('returns asOfDate in YYYY-MM-DD format', async () => {
      mockGetProject.mockResolvedValue({ id: 'p-1', name: 'P' });
      mockGetSafety.mockResolvedValue({
        trirActual: 0, trirTarget: 1.0, recordableIncidents: 0, totalHoursWorked: 100, status: 'green', series: [],
      });
      mockGetRfis.mockResolvedValue([]);
      mockGetSubmittals.mockResolvedValue([]);

      const result = await agent.runStandards({ projectId: 'p-1' });
      expect(result.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('standards catalog', () => {
    it('contains all the V1 standards the agent supports', () => {
      const ids = listStandards().map((s) => s.id);
      expect(ids).toContain('OSHA_1926_501');
      expect(ids).toContain('OSHA_1903');
      expect(ids).toContain('NFPA_241');
      expect(ids).toContain('NFPA_855');
      expect(ids).toContain('NEC_706');
      expect(ids).toContain('CONTRACT_NOTICE_48H');
      expect(ids).toContain('PERMIT_BUILDING');
    });

    it('getStandard returns a real definition, not null, for known ids', () => {
      expect(getStandard('OSHA_1926_501')!.clause).toBe('29 CFR 1926.501(b)(1)');
    });

    it('getStandard returns null for unknown ids', () => {
      expect(getStandard('UNKNOWN')).toBeNull();
    });
  });
});
