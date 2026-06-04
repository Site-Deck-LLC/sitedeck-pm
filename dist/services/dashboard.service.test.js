"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dashboard_service_1 = require("./dashboard.service");
const prisma_1 = require("../lib/prisma");
const cost_service_1 = require("./cost.service");
const procurement_service_1 = require("./procurement.service");
const integration_service_1 = require("./integration.service");
const resource_service_1 = require("./resource.service");
jest.mock('./cost.service', () => ({
    calculateProjectEvm: jest.fn(),
}));
jest.mock('./procurement.service', () => ({
    getMaterialsAlertStatus: jest.fn(),
}));
jest.mock('./integration.service', () => ({
    getIssuesByType: jest.fn(),
}));
jest.mock('./resource.service', () => ({
    getIdleEquipmentOnCriticalPath: jest.fn(),
}));
describe('dashboard.service', () => {
    describe('getSafetyTileStatus', () => {
        it('returns green when 0 incidents and 0 open observations', () => {
            const result = (0, dashboard_service_1.getSafetyTileStatus)({ incidents: 0, openObservations: 0 });
            expect(result.status).toBe('green');
            expect(result.summary).toBe('0 incidents, 0 open observations');
            expect(result.count).toBe(0);
        });
        it('returns amber when 0 incidents but 1+ open observations', () => {
            const result = (0, dashboard_service_1.getSafetyTileStatus)({ incidents: 0, openObservations: 3 });
            expect(result.status).toBe('amber');
            expect(result.summary).toBe('0 incidents, 3 open observations');
            expect(result.count).toBe(3);
        });
        it('returns red when 1+ incidents', () => {
            const result = (0, dashboard_service_1.getSafetyTileStatus)({ incidents: 2, openObservations: 1 });
            expect(result.status).toBe('red');
            expect(result.summary).toBe('2 incidents, 1 open observation');
            expect(result.count).toBe(3);
        });
    });
    describe('getScheduleTileStatus', () => {
        it('returns green when all activities on track', () => {
            const activities = [
                { id: '1', name: 'A', status: 'in_progress', isCritical: true, totalFloat: 5 },
                { id: '2', name: 'B', status: 'not_started', isCritical: false, totalFloat: 10 },
            ];
            const result = (0, dashboard_service_1.getScheduleTileStatus)(activities);
            expect(result.status).toBe('green');
            expect(result.summary).toBe('All activities on track');
        });
        it('returns red when critical activity is delayed', () => {
            const activities = [
                { id: '1', name: 'A', status: 'delayed', isCritical: true, totalFloat: 0 },
            ];
            const result = (0, dashboard_service_1.getScheduleTileStatus)(activities);
            expect(result.status).toBe('red');
            expect(result.summary).toContain('critical');
            expect(result.summary).toContain('delayed');
        });
        it('returns amber when critical activity has low float', () => {
            const activities = [
                { id: '1', name: 'A', status: 'in_progress', isCritical: true, totalFloat: 2 },
            ];
            const result = (0, dashboard_service_1.getScheduleTileStatus)(activities);
            expect(result.status).toBe('amber');
            expect(result.summary).toContain('low float');
        });
        it('returns amber when non-critical activity is delayed', () => {
            const activities = [
                { id: '1', name: 'A', status: 'delayed', isCritical: false, totalFloat: 10 },
            ];
            const result = (0, dashboard_service_1.getScheduleTileStatus)(activities);
            expect(result.status).toBe('amber');
            expect(result.summary).toContain('non-critical');
            expect(result.summary).toContain('delayed');
        });
        it('returns green for empty activities', () => {
            const result = (0, dashboard_service_1.getScheduleTileStatus)([]);
            expect(result.status).toBe('green');
            expect(result.summary).toBe('No activities scheduled');
        });
        it('returns amber when idle equipment on critical path', () => {
            const activities = [
                { id: '1', name: 'A', status: 'in_progress', isCritical: true, totalFloat: 5 },
            ];
            const result = (0, dashboard_service_1.getScheduleTileStatus)(activities, 2);
            expect(result.status).toBe('amber');
            expect(result.summary).toContain('idle equipment');
            expect(result.count).toBe(2);
        });
        it('returns amber for empty activities with idle equipment', () => {
            const result = (0, dashboard_service_1.getScheduleTileStatus)([], 1);
            expect(result.status).toBe('amber');
            expect(result.summary).toContain('idle equipment');
            expect(result.count).toBe(1);
        });
        it('ignores completed critical activities with zero float', () => {
            const activities = [
                { id: '1', name: 'A', status: 'complete', isCritical: true, totalFloat: 0 },
            ];
            const result = (0, dashboard_service_1.getScheduleTileStatus)(activities);
            expect(result.status).toBe('green');
        });
    });
    describe('getCostTileStatus', () => {
        it('returns green when CPI >= 1.0 and all lines green', () => {
            const evm = {
                bcws: 100_000,
                bcwp: 100_000,
                acwp: 90_000,
                sv: 0,
                cv: 10_000,
                spi: 1.0,
                cpi: 1.11,
                eac: 90_000,
                vac: 10_000,
                tcpi: 0,
            };
            const result = (0, dashboard_service_1.getCostTileStatus)(evm, ['green', 'green']);
            expect(result.status).toBe('green');
            expect(result.summary).toContain('on budget');
        });
        it('returns amber when CPI between 0.9 and 1.0', () => {
            const evm = {
                bcws: 100_000,
                bcwp: 90_000,
                acwp: 100_000,
                sv: -10_000,
                cv: -10_000,
                spi: 0.9,
                cpi: 0.9,
                eac: 111_111,
                vac: -11_111,
                tcpi: 0,
            };
            const result = (0, dashboard_service_1.getCostTileStatus)(evm, ['green']);
            expect(result.status).toBe('amber');
        });
        it('returns amber when 1+ budget line is amber', () => {
            const evm = {
                bcws: 100_000,
                bcwp: 100_000,
                acwp: 90_000,
                sv: 0,
                cv: 10_000,
                spi: 1.0,
                cpi: 1.11,
                eac: 90_000,
                vac: 10_000,
                tcpi: 0,
            };
            const result = (0, dashboard_service_1.getCostTileStatus)(evm, ['green', 'amber']);
            expect(result.status).toBe('amber');
        });
        it('returns red when CPI < 0.9', () => {
            const evm = {
                bcws: 100_000,
                bcwp: 50_000,
                acwp: 60_000,
                sv: -50_000,
                cv: -10_000,
                spi: 0.5,
                cpi: 0.83,
                eac: 120_000,
                vac: -20_000,
                tcpi: 0,
            };
            const result = (0, dashboard_service_1.getCostTileStatus)(evm, ['green']);
            expect(result.status).toBe('red');
        });
        it('returns red when 1+ budget line is red regardless of CPI', () => {
            const evm = {
                bcws: 100_000,
                bcwp: 100_000,
                acwp: 90_000,
                sv: 0,
                cv: 10_000,
                spi: 1.0,
                cpi: 1.11,
                eac: 90_000,
                vac: 10_000,
                tcpi: 0,
            };
            const result = (0, dashboard_service_1.getCostTileStatus)(evm, ['green', 'red']);
            expect(result.status).toBe('red');
        });
    });
    describe('materials tile', () => {
        it('returns green when procurement service reports green', async () => {
            procurement_service_1.getMaterialsAlertStatus.mockResolvedValue({
                status: 'green',
                summary: 'All required materials received and allocated for next 48 hours',
                count: 0,
            });
            const result = await (0, dashboard_service_1.getMaterialsTileStatus)('proj-1');
            expect(result.status).toBe('green');
            expect(result.summary).toBe('All required materials received and allocated for next 48 hours');
            expect(result.count).toBe(0);
        });
        it('returns amber when procurement service reports amber', async () => {
            procurement_service_1.getMaterialsAlertStatus.mockResolvedValue({
                status: 'amber',
                summary: '1 non-critical material requirement short for next 48 hours',
                count: 1,
            });
            const result = await (0, dashboard_service_1.getMaterialsTileStatus)('proj-1');
            expect(result.status).toBe('amber');
            expect(result.count).toBe(1);
        });
        it('returns red when procurement service reports red', async () => {
            procurement_service_1.getMaterialsAlertStatus.mockResolvedValue({
                status: 'red',
                summary: '1 critical path material requirement short for next 48 hours',
                count: 1,
            });
            const result = await (0, dashboard_service_1.getMaterialsTileStatus)('proj-1');
            expect(result.status).toBe('red');
            expect(result.count).toBe(1);
        });
        it('falls back to green placeholder on error', async () => {
            procurement_service_1.getMaterialsAlertStatus.mockRejectedValue(new Error('DB down'));
            const result = await (0, dashboard_service_1.getMaterialsTileStatus)('proj-1');
            expect(result.status).toBe('green');
            expect(result.summary).toBe('Procurement module pending');
            expect(result.count).toBe(0);
        });
    });
    describe('client issues tile', () => {
        it('returns green when 0 open client issues', async () => {
            integration_service_1.getIssuesByType.mockResolvedValue([]);
            const result = await (0, dashboard_service_1.getClientIssuesTileStatus)('proj-1');
            expect(result.status).toBe('green');
            expect(result.summary).toBe('0 open client issues');
            expect(result.count).toBe(0);
        });
        it('returns green when all client issues are closed or resolved', async () => {
            integration_service_1.getIssuesByType.mockResolvedValue([
                { id: 'i-1', status: 'closed', dueDate: null },
                { id: 'i-2', status: 'resolved', dueDate: null },
            ]);
            const result = await (0, dashboard_service_1.getClientIssuesTileStatus)('proj-1');
            expect(result.status).toBe('green');
            expect(result.summary).toBe('0 open client issues');
            expect(result.count).toBe(0);
        });
        it('returns amber when 1+ open client issues not past due', async () => {
            integration_service_1.getIssuesByType.mockResolvedValue([
                { id: 'i-1', status: 'open', dueDate: new Date('2026-12-31') },
            ]);
            const result = await (0, dashboard_service_1.getClientIssuesTileStatus)('proj-1');
            expect(result.status).toBe('amber');
            expect(result.summary).toBe('1 open client issue');
            expect(result.count).toBe(1);
        });
        it('returns amber when multiple open client issues not past due', async () => {
            integration_service_1.getIssuesByType.mockResolvedValue([
                { id: 'i-1', status: 'open', dueDate: new Date('2026-12-31') },
                { id: 'i-2', status: 'in_progress', dueDate: null },
            ]);
            const result = await (0, dashboard_service_1.getClientIssuesTileStatus)('proj-1');
            expect(result.status).toBe('amber');
            expect(result.summary).toBe('2 open client issues');
            expect(result.count).toBe(2);
        });
        it('returns red when 1+ open client issues past due', async () => {
            integration_service_1.getIssuesByType.mockResolvedValue([
                { id: 'i-1', status: 'open', dueDate: new Date('2026-01-01') },
            ]);
            const result = await (0, dashboard_service_1.getClientIssuesTileStatus)('proj-1');
            expect(result.status).toBe('red');
            expect(result.summary).toBe('1 open client issue past due');
            expect(result.count).toBe(1);
        });
        it('returns red when multiple open client issues past due', async () => {
            integration_service_1.getIssuesByType.mockResolvedValue([
                { id: 'i-1', status: 'open', dueDate: new Date('2026-01-01') },
                { id: 'i-2', status: 'in_progress', dueDate: new Date('2026-01-02') },
            ]);
            const result = await (0, dashboard_service_1.getClientIssuesTileStatus)('proj-1');
            expect(result.status).toBe('red');
            expect(result.summary).toBe('2 open client issues past due');
            expect(result.count).toBe(2);
        });
        it('returns red over amber when both past due and not past due exist', async () => {
            integration_service_1.getIssuesByType.mockResolvedValue([
                { id: 'i-1', status: 'open', dueDate: new Date('2026-12-31') },
                { id: 'i-2', status: 'open', dueDate: new Date('2026-01-01') },
            ]);
            const result = await (0, dashboard_service_1.getClientIssuesTileStatus)('proj-1');
            expect(result.status).toBe('red');
        });
    });
    describe('field issues tile', () => {
        it('returns green when 0 open field issues', async () => {
            integration_service_1.getIssuesByType.mockResolvedValue([]);
            const result = await (0, dashboard_service_1.getFieldIssuesTileStatus)('proj-1');
            expect(result.status).toBe('green');
            expect(result.summary).toBe('0 open field issues');
            expect(result.count).toBe(0);
        });
        it('returns green when all field issues are closed or resolved', async () => {
            integration_service_1.getIssuesByType.mockResolvedValue([
                { id: 'i-1', status: 'closed', dueDate: null },
                { id: 'i-2', status: 'resolved', dueDate: null },
            ]);
            const result = await (0, dashboard_service_1.getFieldIssuesTileStatus)('proj-1');
            expect(result.status).toBe('green');
            expect(result.summary).toBe('0 open field issues');
            expect(result.count).toBe(0);
        });
        it('returns amber when 1+ open field issues not past due', async () => {
            integration_service_1.getIssuesByType.mockResolvedValue([
                { id: 'i-1', status: 'open', dueDate: new Date('2026-12-31') },
            ]);
            const result = await (0, dashboard_service_1.getFieldIssuesTileStatus)('proj-1');
            expect(result.status).toBe('amber');
            expect(result.summary).toBe('1 open field issue');
            expect(result.count).toBe(1);
        });
        it('returns amber when multiple open field issues not past due', async () => {
            integration_service_1.getIssuesByType.mockResolvedValue([
                { id: 'i-1', status: 'open', dueDate: new Date('2026-12-31') },
                { id: 'i-2', status: 'in_progress', dueDate: null },
            ]);
            const result = await (0, dashboard_service_1.getFieldIssuesTileStatus)('proj-1');
            expect(result.status).toBe('amber');
            expect(result.summary).toBe('2 open field issues');
            expect(result.count).toBe(2);
        });
        it('returns red when 1+ open field issues past due', async () => {
            integration_service_1.getIssuesByType.mockResolvedValue([
                { id: 'i-1', status: 'open', dueDate: new Date('2026-01-01') },
            ]);
            const result = await (0, dashboard_service_1.getFieldIssuesTileStatus)('proj-1');
            expect(result.status).toBe('red');
            expect(result.summary).toBe('1 open field issue past due');
            expect(result.count).toBe(1);
        });
        it('returns red when multiple open field issues past due', async () => {
            integration_service_1.getIssuesByType.mockResolvedValue([
                { id: 'i-1', status: 'open', dueDate: new Date('2026-01-01') },
                { id: 'i-2', status: 'in_progress', dueDate: new Date('2026-01-02') },
            ]);
            const result = await (0, dashboard_service_1.getFieldIssuesTileStatus)('proj-1');
            expect(result.status).toBe('red');
            expect(result.summary).toBe('2 open field issues past due');
            expect(result.count).toBe(2);
        });
        it('returns red over amber when both past due and not past due exist', async () => {
            integration_service_1.getIssuesByType.mockResolvedValue([
                { id: 'i-1', status: 'open', dueDate: new Date('2026-12-31') },
                { id: 'i-2', status: 'open', dueDate: new Date('2026-01-01') },
            ]);
            const result = await (0, dashboard_service_1.getFieldIssuesTileStatus)('proj-1');
            expect(result.status).toBe('red');
        });
    });
    describe('getMorningDashboard', () => {
        const mockScheduleActivityFindMany = jest.fn();
        const mockPrisma = {
            scheduleActivity: {
                findMany: mockScheduleActivityFindMany,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
            resource_service_1.getIdleEquipmentOnCriticalPath.mockResolvedValue([]);
            cost_service_1.calculateProjectEvm.mockResolvedValue({
                projectId: 'proj-1',
                totalBudget: 100_000,
                totalBcwp: 80_000,
                totalAcwp: 70_000,
                evm: {
                    bcws: 100_000,
                    bcwp: 80_000,
                    acwp: 70_000,
                    sv: -20_000,
                    cv: 10_000,
                    spi: 0.8,
                    cpi: 1.14,
                    eac: 87_719,
                    vac: 12_281,
                    tcpi: 0,
                },
                lineResults: [
                    { lineId: 'line-1', name: 'Labor', evm: {}, flag: 'green' },
                    { lineId: 'line-2', name: 'Materials', evm: {}, flag: 'green' },
                ],
            });
            procurement_service_1.getMaterialsAlertStatus.mockResolvedValue({
                status: 'green',
                summary: 'All required materials received and allocated for next 48 hours',
                count: 0,
            });
            integration_service_1.getIssuesByType.mockResolvedValue([]);
        });
        it('aggregates all six tiles', async () => {
            mockScheduleActivityFindMany.mockResolvedValue([
                { id: 'act-1', name: 'Foundation', status: 'in_progress', isCritical: true, totalFloat: 2 },
            ]);
            const dashboard = await (0, dashboard_service_1.getMorningDashboard)('proj-1', { incidents: 0, openObservations: 0 });
            expect(dashboard.projectId).toBe('proj-1');
            expect(dashboard.tiles.safety.status).toBe('green');
            expect(dashboard.tiles.schedule.status).toBe('amber');
            expect(dashboard.tiles.cost.status).toBe('green');
            expect(dashboard.tiles.materials.status).toBe('green');
            expect(dashboard.tiles.clientIssues.status).toBe('green');
            expect(dashboard.tiles.fieldIssues.status).toBe('green');
            expect(dashboard.generatedAt).toBeInstanceOf(Date);
        });
        it('reflects red safety when incidents exist', async () => {
            mockScheduleActivityFindMany.mockResolvedValue([]);
            const dashboard = await (0, dashboard_service_1.getMorningDashboard)('proj-1', { incidents: 1, openObservations: 0 });
            expect(dashboard.tiles.safety.status).toBe('red');
        });
        it('reflects red schedule when critical delayed', async () => {
            mockScheduleActivityFindMany.mockResolvedValue([
                { id: 'act-1', name: 'Foundation', status: 'delayed', isCritical: true, totalFloat: 0 },
            ]);
            const dashboard = await (0, dashboard_service_1.getMorningDashboard)('proj-1', { incidents: 0, openObservations: 0 });
            expect(dashboard.tiles.schedule.status).toBe('red');
        });
        it('reflects amber schedule when idle equipment on critical path', async () => {
            mockScheduleActivityFindMany.mockResolvedValue([
                { id: 'act-1', name: 'Foundation', status: 'in_progress', isCritical: true, totalFloat: 5 },
            ]);
            resource_service_1.getIdleEquipmentOnCriticalPath.mockResolvedValue([
                {
                    equipmentId: 'eq-1',
                    externalId: 'pro-eq-1',
                    name: 'Excavator',
                    activityId: 'act-1',
                    activityName: 'Foundation',
                    daysIdle: 2,
                },
            ]);
            const dashboard = await (0, dashboard_service_1.getMorningDashboard)('proj-1', { incidents: 0, openObservations: 0 });
            expect(dashboard.tiles.schedule.status).toBe('amber');
            expect(dashboard.tiles.schedule.summary).toContain('idle equipment');
        });
        it('reflects red cost when CPI < 0.9', async () => {
            mockScheduleActivityFindMany.mockResolvedValue([]);
            cost_service_1.calculateProjectEvm.mockResolvedValue({
                projectId: 'proj-1',
                totalBudget: 100_000,
                totalBcwp: 50_000,
                totalAcwp: 70_000,
                evm: {
                    bcws: 100_000,
                    bcwp: 50_000,
                    acwp: 70_000,
                    sv: -50_000,
                    cv: -20_000,
                    spi: 0.5,
                    cpi: 0.71,
                    eac: 140_845,
                    vac: -40_845,
                    tcpi: 0,
                },
                lineResults: [
                    { lineId: 'line-1', name: 'Labor', evm: {}, flag: 'red' },
                ],
            });
            const dashboard = await (0, dashboard_service_1.getMorningDashboard)('proj-1', { incidents: 0, openObservations: 0 });
            expect(dashboard.tiles.cost.status).toBe('red');
        });
        it('reflects amber client issues when open client issues exist not past due', async () => {
            mockScheduleActivityFindMany.mockResolvedValue([]);
            integration_service_1.getIssuesByType.mockImplementation(async (projectId, type) => {
                if (type === 'client_issue') {
                    return [{ id: 'i-1', status: 'open', dueDate: new Date('2026-12-31') }];
                }
                return [];
            });
            const dashboard = await (0, dashboard_service_1.getMorningDashboard)('proj-1', { incidents: 0, openObservations: 0 });
            expect(dashboard.tiles.clientIssues.status).toBe('amber');
            expect(dashboard.tiles.clientIssues.count).toBe(1);
        });
        it('reflects red client issues when open client issues are past due', async () => {
            mockScheduleActivityFindMany.mockResolvedValue([]);
            integration_service_1.getIssuesByType.mockImplementation(async (projectId, type) => {
                if (type === 'client_issue') {
                    return [{ id: 'i-1', status: 'open', dueDate: new Date('2026-01-01') }];
                }
                return [];
            });
            const dashboard = await (0, dashboard_service_1.getMorningDashboard)('proj-1', { incidents: 0, openObservations: 0 });
            expect(dashboard.tiles.clientIssues.status).toBe('red');
            expect(dashboard.tiles.clientIssues.count).toBe(1);
        });
    });
});
//# sourceMappingURL=dashboard.service.test.js.map