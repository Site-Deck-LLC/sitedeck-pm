"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../lib/prisma");
const scope_service_1 = require("./scope.service");
const mockScopeStatementCreate = jest.fn();
const mockScopeStatementFindUnique = jest.fn();
const mockScopeStatementFindFirst = jest.fn();
const mockScopeStatementFindMany = jest.fn();
const mockChangeOrderCreate = jest.fn();
const mockChangeOrderFindUnique = jest.fn();
const mockChangeOrderFindMany = jest.fn();
const mockChangeOrderCount = jest.fn();
const mockChangeOrderUpdate = jest.fn();
const mockBudgetLineFindMany = jest.fn();
const mockBudgetLineUpdate = jest.fn();
const mockBudgetLineCreate = jest.fn();
const mockUnifiedChangeLogCreate = jest.fn();
const mockPrismaTransaction = jest.fn();
const mockPrisma = {
    scopeStatement: {
        create: mockScopeStatementCreate,
        findUnique: mockScopeStatementFindUnique,
        findFirst: mockScopeStatementFindFirst,
        findMany: mockScopeStatementFindMany,
    },
    changeOrder: {
        create: mockChangeOrderCreate,
        findUnique: mockChangeOrderFindUnique,
        findMany: mockChangeOrderFindMany,
        count: mockChangeOrderCount,
        update: mockChangeOrderUpdate,
    },
    budgetLine: {
        findMany: mockBudgetLineFindMany,
        update: mockBudgetLineUpdate,
        create: mockBudgetLineCreate,
    },
    unifiedChangeLog: {
        create: mockUnifiedChangeLogCreate,
    },
    $transaction: mockPrismaTransaction,
};
beforeEach(() => {
    jest.clearAllMocks();
    (0, prisma_1.setPrismaClient)(mockPrisma);
});
describe('scope.service', () => {
    describe('scope statements', () => {
        it('creates a scope statement with version 1', async () => {
            const created = {
                id: 'ss-1',
                projectId: 'proj-1',
                content: 'Initial scope',
                version: 1,
                createdBy: 'user-1',
            };
            mockScopeStatementCreate.mockResolvedValue(created);
            const result = await (0, scope_service_1.createScopeStatement)('proj-1', 'Initial scope', 'user-1');
            expect(mockScopeStatementCreate).toHaveBeenCalledWith({
                data: {
                    projectId: 'proj-1',
                    content: 'Initial scope',
                    version: 1,
                    createdBy: 'user-1',
                },
            });
            expect(result).toEqual(created);
        });
        it('creates a new version on update (append-only)', async () => {
            const existing = {
                id: 'ss-1',
                projectId: 'proj-1',
                content: 'Initial scope',
                version: 1,
                createdBy: 'user-1',
            };
            const newVersion = {
                id: 'ss-2',
                projectId: 'proj-1',
                content: 'Updated scope',
                version: 2,
                createdBy: 'user-2',
            };
            mockScopeStatementFindUnique.mockResolvedValue(existing);
            mockScopeStatementCreate.mockResolvedValue(newVersion);
            const result = await (0, scope_service_1.updateScopeStatement)('ss-1', 'Updated scope', 'user-2');
            expect(mockScopeStatementFindUnique).toHaveBeenCalledWith({
                where: { id: 'ss-1' },
            });
            expect(mockScopeStatementCreate).toHaveBeenCalledWith({
                data: {
                    projectId: 'proj-1',
                    content: 'Updated scope',
                    version: 2,
                    createdBy: 'user-2',
                },
            });
            expect(result).toEqual(newVersion);
        });
        it('throws when updating non-existent scope statement', async () => {
            mockScopeStatementFindUnique.mockResolvedValue(null);
            await expect((0, scope_service_1.updateScopeStatement)('ss-1', 'Updated', 'user-1')).rejects.toThrow('Scope statement not found');
        });
        it('returns all scope statements ordered by version desc', async () => {
            const statements = [
                { id: 'ss-2', version: 2 },
                { id: 'ss-1', version: 1 },
            ];
            mockScopeStatementFindMany.mockResolvedValue(statements);
            const result = await (0, scope_service_1.getScopeStatementsByProject)('proj-1');
            expect(mockScopeStatementFindMany).toHaveBeenCalledWith({
                where: { projectId: 'proj-1' },
                orderBy: { version: 'desc' },
            });
            expect(result).toEqual(statements);
        });
        it('returns the latest scope statement', async () => {
            const latest = { id: 'ss-2', version: 2 };
            mockScopeStatementFindFirst.mockResolvedValue(latest);
            const result = await (0, scope_service_1.getLatestScopeStatement)('proj-1');
            expect(mockScopeStatementFindFirst).toHaveBeenCalledWith({
                where: { projectId: 'proj-1' },
                orderBy: { version: 'desc' },
            });
            expect(result).toEqual(latest);
        });
        it('returns null when no scope statements exist', async () => {
            mockScopeStatementFindFirst.mockResolvedValue(null);
            const result = await (0, scope_service_1.getLatestScopeStatement)('proj-1');
            expect(result).toBeNull();
        });
        it('returns a scope statement by id', async () => {
            const statement = { id: 'ss-1', version: 1 };
            mockScopeStatementFindUnique.mockResolvedValue(statement);
            const result = await (0, scope_service_1.getScopeStatementById)('ss-1');
            expect(mockScopeStatementFindUnique).toHaveBeenCalledWith({
                where: { id: 'ss-1' },
            });
            expect(result).toEqual(statement);
        });
    });
    describe('change orders', () => {
        it('creates a change order with auto-numbered coNumber', async () => {
            mockChangeOrderCount.mockResolvedValue(2);
            const created = {
                id: 'co-1',
                coNumber: `CO-${new Date().getFullYear()}-0003`,
                projectId: 'proj-1',
                date: new Date('2026-06-01'),
                description: 'Extra concrete',
                status: 'pending',
            };
            mockChangeOrderCreate.mockResolvedValue(created);
            const result = await (0, scope_service_1.createChangeOrder)({
                projectId: 'proj-1',
                date: new Date('2026-06-01'),
                description: 'Extra concrete',
            });
            expect(mockChangeOrderCount).toHaveBeenCalledWith({
                where: { projectId: 'proj-1' },
            });
            expect(mockChangeOrderCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    coNumber: `CO-${new Date().getFullYear()}-0003`,
                    date: new Date('2026-06-01'),
                    description: 'Extra concrete',
                    status: 'pending',
                }),
            });
            expect(result.coNumber).toBe(`CO-${new Date().getFullYear()}-0003`);
        });
        it('creates a change order with optional fields', async () => {
            mockChangeOrderCount.mockResolvedValue(0);
            const created = {
                id: 'co-1',
                coNumber: `CO-${new Date().getFullYear()}-0001`,
                projectId: 'proj-1',
                date: new Date('2026-06-01'),
                description: 'Extra concrete',
                status: 'pending',
                dollarValue: 5000,
                scheduleImpact: 3,
                affectedActivityIds: ['act-1', 'act-2'],
            };
            mockChangeOrderCreate.mockResolvedValue(created);
            const result = await (0, scope_service_1.createChangeOrder)({
                projectId: 'proj-1',
                date: new Date('2026-06-01'),
                description: 'Extra concrete',
                dollarValue: 5000,
                scheduleImpact: 3,
                affectedActivityIds: ['act-1', 'act-2'],
            });
            expect(mockChangeOrderCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    dollarValue: expect.anything(),
                    scheduleImpact: 3,
                    affectedActivityIds: ['act-1', 'act-2'],
                }),
            });
            expect(result).toEqual(created);
        });
        it('returns change order by id with project', async () => {
            const co = { id: 'co-1', coNumber: 'CO-2026-0001' };
            mockChangeOrderFindUnique.mockResolvedValue(co);
            const result = await (0, scope_service_1.getChangeOrderById)('co-1');
            expect(mockChangeOrderFindUnique).toHaveBeenCalledWith({
                where: { id: 'co-1' },
                include: { project: true },
            });
            expect(result).toEqual(co);
        });
        it('returns change orders ordered by date desc', async () => {
            const cos = [
                { id: 'co-2', date: new Date('2026-06-02') },
                { id: 'co-1', date: new Date('2026-06-01') },
            ];
            mockChangeOrderFindMany.mockResolvedValue(cos);
            const result = await (0, scope_service_1.getChangeOrdersByProject)('proj-1');
            expect(mockChangeOrderFindMany).toHaveBeenCalledWith({
                where: { projectId: 'proj-1' },
                orderBy: { date: 'desc' },
            });
            expect(result).toEqual(cos);
        });
        it('approves a change order', async () => {
            const co = { id: 'co-1', coNumber: 'CO-1', projectId: 'proj-1', status: 'pending', dollarValue: null };
            mockChangeOrderFindUnique.mockResolvedValue(co);
            mockChangeOrderUpdate.mockResolvedValue({ ...co, status: 'approved', approver: 'pm-1', approvedAt: new Date() });
            mockBudgetLineFindMany.mockResolvedValue([]);
            const result = await (0, scope_service_1.approveChangeOrder)('co-1', 'pm-1');
            expect(mockChangeOrderUpdate).toHaveBeenCalledWith({
                where: { id: 'co-1' },
                data: {
                    status: 'approved',
                    approver: 'pm-1',
                    approvedAt: expect.any(Date),
                },
            });
            // The approve flow now returns { changeOrder, baseline }
            expect(result.changeOrder.status).toBe('approved');
            expect(result.baseline).toBeDefined();
            expect(result.baseline.addedAmount).toBe(0);
        });
        it('rejects a change order', async () => {
            const co = { id: 'co-1', status: 'pending' };
            mockChangeOrderFindUnique.mockResolvedValue(co);
            mockChangeOrderUpdate.mockResolvedValue({ ...co, status: 'rejected', approver: 'pm-1', approvedAt: new Date() });
            const result = await (0, scope_service_1.rejectChangeOrder)('co-1', 'pm-1');
            expect(mockChangeOrderUpdate).toHaveBeenCalledWith({
                where: { id: 'co-1' },
                data: {
                    status: 'rejected',
                    approver: 'pm-1',
                    approvedAt: expect.any(Date),
                },
            });
            expect(result.status).toBe('rejected');
        });
        it('throws when approving non-existent change order', async () => {
            mockChangeOrderFindUnique.mockResolvedValue(null);
            await expect((0, scope_service_1.approveChangeOrder)('co-1', 'pm-1')).rejects.toThrow('Change order not found');
        });
        it('throws when rejecting non-existent change order', async () => {
            mockChangeOrderFindUnique.mockResolvedValue(null);
            await expect((0, scope_service_1.rejectChangeOrder)('co-1', 'pm-1')).rejects.toThrow('Change order not found');
        });
        it('submits a pending change order', async () => {
            mockChangeOrderFindUnique.mockResolvedValue({ id: 'co-1', status: 'pending' });
            mockChangeOrderUpdate.mockResolvedValue({ id: 'co-1', status: 'submitted' });
            const result = await (0, scope_service_1.submitChangeOrder)('co-1');
            expect(result.status).toBe('submitted');
        });
        it('throws when submitting non-existent change order', async () => {
            mockChangeOrderFindUnique.mockResolvedValue(null);
            await expect((0, scope_service_1.submitChangeOrder)('co-1')).rejects.toThrow('Change order not found');
        });
        it('updates a change order description and dollar value', async () => {
            mockChangeOrderUpdate.mockResolvedValue({
                id: 'co-1',
                description: 'Updated',
                dollarValue: 5000,
            });
            const result = await (0, scope_service_1.updateChangeOrder)('co-1', {
                description: 'Updated',
                dollarValue: 5000,
            });
            expect(result.description).toBe('Updated');
            expect(mockChangeOrderUpdate).toHaveBeenCalled();
        });
        it('returns PDF data for a change order', async () => {
            const co = {
                id: 'co-1',
                coNumber: 'CO-2026-0001',
                date: new Date('2026-06-01'),
                description: 'Extra concrete',
                status: 'approved',
                dollarValue: { toNumber: () => 5000 },
                scheduleImpact: 3,
                approver: 'pm-1',
                project: { name: 'Test Project' },
            };
            mockChangeOrderFindUnique.mockResolvedValue(co);
            const result = await (0, scope_service_1.getChangeOrderPdfData)('co-1');
            expect(mockChangeOrderFindUnique).toHaveBeenCalledWith({
                where: { id: 'co-1' },
                include: { project: true },
            });
            expect(result).toEqual({
                coNumber: 'CO-2026-0001',
                date: new Date('2026-06-01'),
                description: 'Extra concrete',
                status: 'approved',
                dollarValue: 5000,
                scheduleImpact: 3,
                approver: 'pm-1',
                projectName: 'Test Project',
            });
        });
        it('throws when PDF data requested for non-existent change order', async () => {
            mockChangeOrderFindUnique.mockResolvedValue(null);
            await expect((0, scope_service_1.getChangeOrderPdfData)('co-1')).rejects.toThrow('Change order not found');
        });
        it('stores affected activity ids and retains them through approval', async () => {
            mockChangeOrderCount.mockResolvedValue(0);
            const created = {
                id: 'co-1',
                coNumber: `CO-${new Date().getFullYear()}-0001`,
                projectId: 'proj-1',
                date: new Date('2026-06-01'),
                description: 'Scope addition',
                status: 'pending',
                scheduleImpact: 5,
                affectedActivityIds: ['act-1', 'act-2'],
            };
            mockChangeOrderCreate.mockResolvedValue(created);
            const createResult = await (0, scope_service_1.createChangeOrder)({
                projectId: 'proj-1',
                date: new Date('2026-06-01'),
                description: 'Scope addition',
                scheduleImpact: 5,
                affectedActivityIds: ['act-1', 'act-2'],
            });
            expect(createResult.affectedActivityIds).toEqual(['act-1', 'act-2']);
            mockChangeOrderFindUnique.mockResolvedValue(createResult);
            mockChangeOrderUpdate.mockResolvedValue({
                ...createResult,
                status: 'approved',
                approver: 'pm-1',
                approvedAt: new Date(),
            });
            const approveResult = await (0, scope_service_1.approveChangeOrder)('co-1', 'pm-1');
            expect(approveResult.changeOrder.status).toBe('approved');
            expect(approveResult.changeOrder.affectedActivityIds).toEqual(['act-1', 'act-2']);
        });
    });
});
//# sourceMappingURL=scope.service.test.js.map