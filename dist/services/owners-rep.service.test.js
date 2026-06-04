"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../lib/prisma");
const owners_rep_service_1 = require("./owners-rep.service");
const dashboard_service_1 = require("./dashboard.service");
const integration_service_1 = require("./integration.service");
const roles_1 = require("../constants/roles");
jest.mock('./dashboard.service', () => ({
    getSafetyTileStatus: jest.fn(),
    getScheduleTileStatus: jest.fn(),
    getMaterialsTileStatus: jest.fn(),
    getClientIssuesTileStatus: jest.fn(),
    getFieldIssuesTileStatus: jest.fn(),
}));
jest.mock('./integration.service', () => ({
    getIssuesByType: jest.fn(),
}));
const mockScheduleActivityFindMany = jest.fn();
const mockRfiFindMany = jest.fn();
const mockSubmittalFindMany = jest.fn();
const mockProjectFindUnique = jest.fn();
const mockPrisma = {
    scheduleActivity: {
        findMany: mockScheduleActivityFindMany,
    },
    rfi: {
        findMany: mockRfiFindMany,
    },
    submittal: {
        findMany: mockSubmittalFindMany,
    },
    project: {
        findUnique: mockProjectFindUnique,
    },
};
beforeEach(() => {
    jest.clearAllMocks();
    (0, prisma_1.setPrismaClient)(mockPrisma);
});
describe('owners-rep.service', () => {
    describe('getOwnersRepDashboard', () => {
        beforeEach(() => {
            dashboard_service_1.getSafetyTileStatus.mockReturnValue({
                name: 'Safety',
                status: 'green',
                summary: '0 incidents',
                count: 0,
            });
            dashboard_service_1.getScheduleTileStatus.mockReturnValue({
                name: 'Schedule',
                status: 'green',
                summary: 'On track',
                count: 0,
            });
            dashboard_service_1.getMaterialsTileStatus.mockResolvedValue({
                name: 'Materials',
                status: 'green',
                summary: 'All received',
                count: 0,
            });
            dashboard_service_1.getClientIssuesTileStatus.mockResolvedValue({
                name: 'Client Issues',
                status: 'green',
                summary: '0 issues',
                count: 0,
            });
            dashboard_service_1.getFieldIssuesTileStatus.mockResolvedValue({
                name: 'Field Issues',
                status: 'green',
                summary: '0 issues',
                count: 0,
            });
        });
        it('returns dashboard with 5 tiles excluding cost', async () => {
            mockScheduleActivityFindMany.mockResolvedValue([
                { id: 'a1', name: 'Act 1', status: 'in_progress', isCritical: true, totalFloat: 2 },
            ]);
            const result = await (0, owners_rep_service_1.getOwnersRepDashboard)('proj-1', { incidents: 0, openObservations: 0 });
            expect(result.projectId).toBe('proj-1');
            expect(result.tiles.safety).toBeDefined();
            expect(result.tiles.schedule).toBeDefined();
            expect(result.tiles.materials).toBeDefined();
            expect(result.tiles.clientIssues).toBeDefined();
            expect(result.tiles.fieldIssues).toBeDefined();
            expect(result.tiles.cost).toBeUndefined();
            expect(result.generatedAt).toBeInstanceOf(Date);
        });
        it('passes schedule activities to getScheduleTileStatus', async () => {
            const activities = [
                { id: 'a1', name: 'Act 1', status: 'in_progress', isCritical: true, totalFloat: 2 },
            ];
            mockScheduleActivityFindMany.mockResolvedValue(activities);
            await (0, owners_rep_service_1.getOwnersRepDashboard)('proj-1', { incidents: 0, openObservations: 0 });
            expect(dashboard_service_1.getScheduleTileStatus).toHaveBeenCalledWith(activities);
        });
    });
    describe('getOwnersRepIssues', () => {
        it('returns only client_issue types sorted by priority desc then createdAt desc', async () => {
            const issues = [
                { id: 'i1', type: 'client_issue', priority: 'medium', createdAt: new Date('2026-06-01'), status: 'open', issueNumber: 'ISS-2026-0001', source: 'manual', title: 'T1', description: 'D1', createdBy: 'u1', updatedAt: new Date() },
                { id: 'i2', type: 'client_issue', priority: 'high', createdAt: new Date('2026-06-02'), status: 'open', issueNumber: 'ISS-2026-0002', source: 'manual', title: 'T2', description: 'D2', createdBy: 'u1', updatedAt: new Date() },
                { id: 'i3', type: 'client_issue', priority: 'low', createdAt: new Date('2026-06-03'), status: 'open', issueNumber: 'ISS-2026-0003', source: 'manual', title: 'T3', description: 'D3', createdBy: 'u1', updatedAt: new Date() },
                { id: 'i4', type: 'client_issue', priority: 'high', createdAt: new Date('2026-06-01'), status: 'open', issueNumber: 'ISS-2026-0004', source: 'manual', title: 'T4', description: 'D4', createdBy: 'u1', updatedAt: new Date() },
            ];
            integration_service_1.getIssuesByType.mockResolvedValue(issues);
            const result = await (0, owners_rep_service_1.getOwnersRepIssues)('proj-1');
            expect(integration_service_1.getIssuesByType).toHaveBeenCalledWith('proj-1', 'client_issue');
            expect(result.map((i) => i.id)).toEqual(['i2', 'i4', 'i1', 'i3']);
        });
    });
    describe('getOwnersRepRfiStatus', () => {
        it('returns correct counts and recent list', async () => {
            const now = new Date();
            const sixteenDaysAgo = new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000);
            const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
            const rfis = [
                { id: 'r1', rfiNumber: 'RFI-2026-0001', subject: 'S1', status: 'draft', submittedAt: null, createdAt: now, description: 'D1', submittedBy: 'u1', updatedAt: now },
                { id: 'r2', rfiNumber: 'RFI-2026-0002', subject: 'S2', status: 'submitted', submittedAt: now, createdAt: now, description: 'D2', submittedBy: 'u1', updatedAt: now },
                { id: 'r3', rfiNumber: 'RFI-2026-0003', subject: 'S3', status: 'under_review', submittedAt: sixteenDaysAgo, createdAt: now, description: 'D3', submittedBy: 'u1', updatedAt: now },
                { id: 'r4', rfiNumber: 'RFI-2026-0004', subject: 'S4', status: 'answered', submittedAt: tenDaysAgo, createdAt: now, description: 'D4', submittedBy: 'u1', updatedAt: now },
                { id: 'r5', rfiNumber: 'RFI-2026-0005', subject: 'S5', status: 'closed', submittedAt: sixteenDaysAgo, createdAt: now, description: 'D5', submittedBy: 'u1', updatedAt: now },
            ];
            mockRfiFindMany.mockResolvedValue(rfis);
            const result = await (0, owners_rep_service_1.getOwnersRepRfiStatus)('proj-1');
            expect(result.projectId).toBe('proj-1');
            expect(result.totalRfis).toBe(5);
            expect(result.openRfis).toBe(2); // submitted + under_review
            expect(result.answeredRfis).toBe(1);
            expect(result.closedRfis).toBe(1);
            expect(result.overdueRfis).toBe(1); // r3 is under_review and 16 days old
            expect(result.recentRfis).toHaveLength(5);
            expect(result.recentRfis[0].rfiNumber).toBe('RFI-2026-0001');
        });
        it('counts overdue only for submitted/under_review with submittedAt past 14 days', async () => {
            const now = new Date();
            const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
            const rfis = [
                { id: 'r1', rfiNumber: 'RFI-2026-0001', subject: 'S1', status: 'submitted', submittedAt: fifteenDaysAgo, createdAt: now, description: 'D1', submittedBy: 'u1', updatedAt: now },
            ];
            mockRfiFindMany.mockResolvedValue(rfis);
            const result = await (0, owners_rep_service_1.getOwnersRepRfiStatus)('proj-1');
            expect(result.overdueRfis).toBe(1);
        });
        it('does not count answered or closed as overdue even if old', async () => {
            const now = new Date();
            const sixteenDaysAgo = new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000);
            const rfis = [
                { id: 'r1', rfiNumber: 'RFI-2026-0001', subject: 'S1', status: 'answered', submittedAt: sixteenDaysAgo, createdAt: now, description: 'D1', submittedBy: 'u1', updatedAt: now },
                { id: 'r2', rfiNumber: 'RFI-2026-0002', subject: 'S2', status: 'closed', submittedAt: sixteenDaysAgo, createdAt: now, description: 'D2', submittedBy: 'u1', updatedAt: now },
            ];
            mockRfiFindMany.mockResolvedValue(rfis);
            const result = await (0, owners_rep_service_1.getOwnersRepRfiStatus)('proj-1');
            expect(result.overdueRfis).toBe(0);
        });
        it('does not count draft as open or overdue', async () => {
            const now = new Date();
            const rfis = [
                { id: 'r1', rfiNumber: 'RFI-2026-0001', subject: 'S1', status: 'draft', submittedAt: null, createdAt: now, description: 'D1', submittedBy: 'u1', updatedAt: now },
            ];
            mockRfiFindMany.mockResolvedValue(rfis);
            const result = await (0, owners_rep_service_1.getOwnersRepRfiStatus)('proj-1');
            expect(result.openRfis).toBe(0);
            expect(result.overdueRfis).toBe(0);
        });
    });
    describe('getOwnersRepSubmittalStatus', () => {
        it('returns correct counts and recent list', async () => {
            const now = new Date();
            const submittals = [
                { id: 's1', submittalNumber: 'SUB-2026-0001', title: 'T1', status: 'pending', submittedAt: null, createdAt: now, description: 'D1', submittedBy: 'u1', updatedAt: now },
                { id: 's2', submittalNumber: 'SUB-2026-0002', title: 'T2', status: 'submitted', submittedAt: now, createdAt: now, description: 'D2', submittedBy: 'u1', updatedAt: now },
                { id: 's3', submittalNumber: 'SUB-2026-0003', title: 'T3', status: 'approved', submittedAt: now, createdAt: now, description: 'D3', submittedBy: 'u1', updatedAt: now },
                { id: 's4', submittalNumber: 'SUB-2026-0004', title: 'T4', status: 'rejected', submittedAt: now, createdAt: now, description: 'D4', submittedBy: 'u1', updatedAt: now },
                { id: 's5', submittalNumber: 'SUB-2026-0005', title: 'T5', status: 'under_review', submittedAt: now, createdAt: now, description: 'D5', submittedBy: 'u1', updatedAt: now },
            ];
            mockSubmittalFindMany.mockResolvedValue(submittals);
            const result = await (0, owners_rep_service_1.getOwnersRepSubmittalStatus)('proj-1');
            expect(result.projectId).toBe('proj-1');
            expect(result.totalSubmittals).toBe(5);
            expect(result.pendingSubmittals).toBe(1);
            expect(result.approvedSubmittals).toBe(1);
            expect(result.rejectedSubmittals).toBe(1);
            expect(result.underReviewSubmittals).toBe(1);
            expect(result.recentSubmittals).toHaveLength(5);
        });
    });
    describe('canAccessOwnersRepPortal', () => {
        it('returns true for owners_rep role', () => {
            expect((0, owners_rep_service_1.canAccessOwnersRepPortal)(roles_1.ROLES.OWNERS_REP)).toBe(true);
        });
        it('returns false for all other roles', () => {
            const otherRoles = [
                roles_1.ROLES.OWNER_ADMIN,
                roles_1.ROLES.PROJECT_MANAGER,
                roles_1.ROLES.SUPERINTENDENT,
                roles_1.ROLES.SUPERVISOR,
                roles_1.ROLES.FIELD_CREW,
                roles_1.ROLES.SUBCONTRACTOR_PM,
                roles_1.ROLES.SUBCONTRACTOR_SUPER,
                roles_1.ROLES.ACCOUNTANT_AP,
            ];
            for (const role of otherRoles) {
                expect((0, owners_rep_service_1.canAccessOwnersRepPortal)(role)).toBe(false);
            }
        });
    });
    describe('getOwnersRepProjectSummary', () => {
        beforeEach(() => {
            dashboard_service_1.getSafetyTileStatus.mockReturnValue({
                name: 'Safety',
                status: 'green',
                summary: '0 incidents',
                count: 0,
            });
            dashboard_service_1.getScheduleTileStatus.mockReturnValue({
                name: 'Schedule',
                status: 'green',
                summary: 'On track',
                count: 0,
            });
            dashboard_service_1.getMaterialsTileStatus.mockResolvedValue({
                name: 'Materials',
                status: 'green',
                summary: 'All received',
                count: 0,
            });
            dashboard_service_1.getClientIssuesTileStatus.mockResolvedValue({
                name: 'Client Issues',
                status: 'green',
                summary: '0 issues',
                count: 0,
            });
            dashboard_service_1.getFieldIssuesTileStatus.mockResolvedValue({
                name: 'Field Issues',
                status: 'green',
                summary: '0 issues',
                count: 0,
            });
            integration_service_1.getIssuesByType.mockResolvedValue([
                { id: 'i1', type: 'client_issue', status: 'open', priority: 'high', createdAt: new Date(), issueNumber: 'ISS-2026-0001', source: 'manual', title: 'T1', description: 'D1', createdBy: 'u1', updatedAt: new Date() },
                { id: 'i2', type: 'client_issue', status: 'closed', priority: 'medium', createdAt: new Date(), issueNumber: 'ISS-2026-0002', source: 'manual', title: 'T2', description: 'D2', createdBy: 'u1', updatedAt: new Date() },
            ]);
        });
        it('aggregates all data into a single summary', async () => {
            mockScheduleActivityFindMany.mockResolvedValue([]);
            mockProjectFindUnique.mockResolvedValue({ name: 'Test Project' });
            const now = new Date();
            mockRfiFindMany.mockResolvedValue([
                { id: 'r1', rfiNumber: 'RFI-2026-0001', subject: 'S1', status: 'submitted', submittedAt: now, createdAt: now, description: 'D1', submittedBy: 'u1', updatedAt: now },
            ]);
            mockSubmittalFindMany.mockResolvedValue([
                { id: 's1', submittalNumber: 'SUB-2026-0001', title: 'T1', status: 'approved', submittedAt: now, createdAt: now, description: 'D1', submittedBy: 'u1', updatedAt: now },
            ]);
            const result = await (0, owners_rep_service_1.getOwnersRepProjectSummary)('proj-1', { incidents: 0, openObservations: 0 });
            expect(result.projectId).toBe('proj-1');
            expect(result.projectName).toBe('Test Project');
            expect(result.dashboard).toBeDefined();
            expect(result.issues.total).toBe(2);
            expect(result.issues.open).toBe(1);
            expect(result.issues.highPriority).toBe(1);
            expect(result.rfiStatus.totalRfis).toBe(1);
            expect(result.submittalStatus.totalSubmittals).toBe(1);
        });
        it('throws when project not found', async () => {
            mockProjectFindUnique.mockResolvedValue(null);
            await expect((0, owners_rep_service_1.getOwnersRepProjectSummary)('bad-id', { incidents: 0, openObservations: 0 })).rejects.toThrow('Project not found');
        });
    });
});
//# sourceMappingURL=owners-rep.service.test.js.map