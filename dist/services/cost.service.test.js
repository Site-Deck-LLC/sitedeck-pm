"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const cost_service_1 = require("./cost.service");
const evm_1 = require("../constants/evm");
const prisma_1 = require("../lib/prisma");
describe('cost.service', () => {
    describe('calculateEvm', () => {
        it('calculates correctly for normal case', () => {
            const result = (0, cost_service_1.calculateEvm)(100_000, 0.5, 40_000);
            expect(result.bcws).toBe(100_000);
            expect(result.bcwp).toBe(50_000);
            expect(result.acwp).toBe(40_000);
            expect(result.sv).toBe(-50_000);
            expect(result.cv).toBe(10_000);
            expect(result.spi).toBe(0.5);
            expect(result.cpi).toBe(1.25);
            expect(result.eac).toBe(80_000);
            expect(result.vac).toBe(20_000);
            expect(result.tcpi).toBeCloseTo(0.8333, 4);
        });
        it('handles zero budget edge case gracefully', () => {
            const result = (0, cost_service_1.calculateEvm)(0, 0.5, 10_000);
            expect(result.bcws).toBe(0);
            expect(result.bcwp).toBe(0);
            expect(result.acwp).toBe(10_000);
            expect(result.sv).toBe(0);
            expect(result.cv).toBe(-10_000);
            expect(result.spi).toBe(0);
            expect(result.cpi).toBe(0);
            expect(result.eac).toBe(0);
            expect(result.vac).toBe(0);
            expect(result.tcpi).toBe(0);
            expect(Object.is(result.tcpi, 0)).toBe(true);
        });
        it('handles 100% complete edge case', () => {
            const result = (0, cost_service_1.calculateEvm)(100_000, 1.0, 90_000);
            expect(result.bcwp).toBe(100_000);
            expect(result.spi).toBe(1.0);
            expect(result.cpi).toBeCloseTo(1.1111, 4);
            expect(result.eac).toBeCloseTo(90_000, 0);
            expect(result.vac).toBeCloseTo(10_000, 0);
        });
        it('handles cost overrun edge case (cpi < 1)', () => {
            const result = (0, cost_service_1.calculateEvm)(100_000, 0.5, 60_000);
            expect(result.cpi).toBeCloseTo(0.8333, 4);
            expect(result.eac).toBeCloseTo(120_000, 0);
            expect(result.vac).toBeCloseTo(-20_000, 0);
            expect(result.tcpi).toBeCloseTo(1.25, 2);
        });
        it('handles division by zero for spi when bcws is 0', () => {
            const result = (0, cost_service_1.calculateEvm)(0, 0, 0);
            expect(result.spi).toBe(0);
            expect(result.cpi).toBe(0);
            expect(result.eac).toBe(0);
            expect(result.tcpi).toBe(0);
        });
        it('handles division by zero for cpi when acwp is 0', () => {
            const result = (0, cost_service_1.calculateEvm)(100_000, 0.5, 0);
            expect(result.cpi).toBe(0);
            expect(result.eac).toBe(0);
        });
        it('handles division by zero for tcpi when budget equals acwp', () => {
            const result = (0, cost_service_1.calculateEvm)(100_000, 0.5, 100_000);
            expect(result.tcpi).toBe(0);
        });
    });
    describe('recalculateVarianceFlag', () => {
        it('returns green when incurred is within budget and no threshold', () => {
            const flag = (0, cost_service_1.recalculateVarianceFlag)({
                budgetAmount: 100_000,
                incurredAmount: 80_000,
                varianceThreshold: null,
            });
            expect(flag).toBe('green');
        });
        it('returns red when incurred exceeds budget and no threshold', () => {
            const flag = (0, cost_service_1.recalculateVarianceFlag)({
                budgetAmount: 100_000,
                incurredAmount: 110_000,
                varianceThreshold: null,
            });
            expect(flag).toBe('red');
        });
        it('returns amber when incurred exceeds budget but within threshold', () => {
            const flag = (0, cost_service_1.recalculateVarianceFlag)({
                budgetAmount: 100_000,
                incurredAmount: 105_000,
                varianceThreshold: 0.1,
            });
            expect(flag).toBe('amber');
        });
        it('returns red when incurred exceeds budget plus threshold', () => {
            const flag = (0, cost_service_1.recalculateVarianceFlag)({
                budgetAmount: 100_000,
                incurredAmount: 120_000,
                varianceThreshold: 0.1,
            });
            expect(flag).toBe('red');
        });
        it('returns green when incurred is below budget with threshold set', () => {
            const flag = (0, cost_service_1.recalculateVarianceFlag)({
                budgetAmount: 100_000,
                incurredAmount: 90_000,
                varianceThreshold: 0.1,
            });
            expect(flag).toBe('green');
        });
    });
    describe('getEvmStatusColor', () => {
        it('returns green for spi >= 0.9', () => {
            expect((0, evm_1.getEvmStatusColor)('spi', 1.0)).toBe('green');
            expect((0, evm_1.getEvmStatusColor)('spi', 0.95)).toBe('green');
        });
        it('returns amber for spi between 0.8 and 0.9', () => {
            expect((0, evm_1.getEvmStatusColor)('spi', 0.85)).toBe('amber');
        });
        it('returns red for spi < 0.8', () => {
            expect((0, evm_1.getEvmStatusColor)('spi', 0.75)).toBe('red');
        });
        it('returns green for cpi >= 0.9', () => {
            expect((0, evm_1.getEvmStatusColor)('cpi', 1.0)).toBe('green');
            expect((0, evm_1.getEvmStatusColor)('cpi', 0.95)).toBe('green');
        });
        it('returns amber for cpi between 0.8 and 0.9', () => {
            expect((0, evm_1.getEvmStatusColor)('cpi', 0.85)).toBe('amber');
        });
        it('returns red for cpi < 0.8', () => {
            expect((0, evm_1.getEvmStatusColor)('cpi', 0.75)).toBe('red');
        });
    });
    describe('calculateProjectEvm', () => {
        const mockBudgetLineFindMany = jest.fn();
        const mockPrisma = {
            budgetLine: {
                findMany: mockBudgetLineFindMany,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('aggregates EVM across all budget lines', async () => {
            mockBudgetLineFindMany.mockResolvedValue([
                {
                    id: 'line-1',
                    name: 'Labor',
                    budgetAmount: 100_000,
                    incurredAmount: 40_000,
                    percentComplete: 0.5,
                    varianceFlag: 'green',
                },
                {
                    id: 'line-2',
                    name: 'Materials',
                    budgetAmount: 50_000,
                    incurredAmount: 30_000,
                    percentComplete: 0.6,
                    varianceFlag: 'green',
                },
            ]);
            const result = await (0, cost_service_1.calculateProjectEvm)('proj-1');
            expect(result.projectId).toBe('proj-1');
            expect(result.totalBudget).toBe(150_000);
            expect(result.totalBcwp).toBe(80_000);
            expect(result.totalAcwp).toBe(70_000);
            expect(result.evm.bcws).toBe(150_000);
            expect(result.evm.bcwp).toBe(80_000);
            expect(result.evm.acwp).toBe(70_000);
            expect(result.lineResults).toHaveLength(2);
            expect(result.lineResults[0].evm.bcwp).toBe(50_000);
            expect(result.lineResults[1].evm.bcwp).toBe(30_000);
        });
        it('returns zero totals when no budget lines exist', async () => {
            mockBudgetLineFindMany.mockResolvedValue([]);
            const result = await (0, cost_service_1.calculateProjectEvm)('proj-1');
            expect(result.totalBudget).toBe(0);
            expect(result.totalBcwp).toBe(0);
            expect(result.totalAcwp).toBe(0);
            expect(result.evm.bcws).toBe(0);
            expect(result.lineResults).toHaveLength(0);
        });
    });
    describe('calculateForecasts', () => {
        const mockProjectFindUnique = jest.fn();
        const mockBudgetLineFindMany = jest.fn();
        const mockPrisma = {
            project: { findUnique: mockProjectFindUnique },
            budgetLine: { findMany: mockBudgetLineFindMany },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('returns TCPI in the tight band when remaining work is much more than remaining budget', async () => {
            // BAC=100, EV=10, AC=80 → remaining work 90, remaining budget 20 → TCPI = 90/20 = 4.5
            mockProjectFindUnique.mockResolvedValue({
                id: 'p1',
                startDate: new Date('2026-01-01'),
                endDate: new Date('2027-01-01'),
            });
            mockBudgetLineFindMany.mockResolvedValue([
                {
                    id: 'l1',
                    name: 'Labor',
                    budgetAmount: 100,
                    incurredAmount: 80,
                    percentComplete: 0.1, // BCWP = 10
                    varianceFlag: 'red',
                },
            ]);
            const f = await (0, cost_service_1.calculateForecasts)('p1');
            expect(f.tcpi).toBeCloseTo(4.5, 1);
            expect(f.tcpiFlag).toBe('tight');
        });
        it('returns TCPI in the cushion band when well ahead of budget', async () => {
            // BAC=100, EV=80, AC=50 → remaining work 20, remaining budget 50 → TCPI = 0.4
            mockProjectFindUnique.mockResolvedValue({
                id: 'p1',
                startDate: new Date('2026-01-01'),
                endDate: new Date('2027-01-01'),
            });
            mockBudgetLineFindMany.mockResolvedValue([
                {
                    id: 'l1',
                    name: 'Labor',
                    budgetAmount: 100,
                    incurredAmount: 50,
                    percentComplete: 0.8, // BCWP = 80
                    varianceFlag: 'green',
                },
            ]);
            const f = await (0, cost_service_1.calculateForecasts)('p1');
            expect(f.tcpi).toBeCloseTo(0.4, 1);
            expect(f.tcpiFlag).toBe('cushion');
        });
        it('EAC_CPI = BAC / CPI when CPI is below 1', async () => {
            // BAC=100, EV=40, AC=50 → CPI = 0.8 → EAC_CPI = 125
            mockProjectFindUnique.mockResolvedValue({
                id: 'p1',
                startDate: new Date('2026-01-01'),
                endDate: new Date('2027-01-01'),
            });
            mockBudgetLineFindMany.mockResolvedValue([
                {
                    id: 'l1',
                    name: 'Labor',
                    budgetAmount: 100,
                    incurredAmount: 50,
                    percentComplete: 0.4,
                    varianceFlag: 'amber',
                },
            ]);
            const f = await (0, cost_service_1.calculateForecasts)('p1');
            expect(f.cpi).toBeCloseTo(0.8, 1);
            expect(f.eac_cpi).toBeCloseTo(125, 1);
            expect(f.vac).toBeCloseTo(-25, 1); // over budget by 25
        });
        it('confidence range = replan/CPI/SPI in that order', async () => {
            mockProjectFindUnique.mockResolvedValue({
                id: 'p1',
                startDate: new Date('2026-01-01'),
                endDate: new Date('2027-01-01'),
            });
            mockBudgetLineFindMany.mockResolvedValue([
                {
                    id: 'l1',
                    name: 'L',
                    budgetAmount: 100,
                    incurredAmount: 50,
                    percentComplete: 0.4,
                    varianceFlag: 'amber',
                },
            ]);
            const f = await (0, cost_service_1.calculateForecasts)('p1');
            expect(f.confidenceRange.optimistic).toBe(f.eac_replan);
            expect(f.confidenceRange.mostLikely).toBe(f.eac_cpi);
            expect(f.confidenceRange.pessimistic).toBe(f.eac_spi);
        });
    });
    describe('budget line CRUD', () => {
        const mockBudgetLineCreate = jest.fn();
        const mockBudgetLineFindUnique = jest.fn();
        const mockBudgetLineFindMany = jest.fn();
        const mockBudgetLineUpdate = jest.fn();
        const mockBudgetLineDelete = jest.fn();
        const mockPrisma = {
            budgetLine: {
                create: mockBudgetLineCreate,
                findUnique: mockBudgetLineFindUnique,
                findMany: mockBudgetLineFindMany,
                update: mockBudgetLineUpdate,
                delete: mockBudgetLineDelete,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('creates a budget line', async () => {
            mockBudgetLineCreate.mockResolvedValue({
                id: 'line-1',
                projectId: 'proj-1',
                name: 'Labor',
                budgetAmount: 100_000,
            });
            const result = await (0, cost_service_1.createBudgetLine)({
                projectId: 'proj-1',
                name: 'Labor',
                budgetAmount: 100_000,
            });
            expect(mockBudgetLineCreate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    projectId: 'proj-1',
                    name: 'Labor',
                    budgetAmount: 100_000,
                    varianceFlag: 'green',
                }),
            }));
            expect(result.id).toBe('line-1');
        });
        it('gets a budget line by id with transactions', async () => {
            mockBudgetLineFindUnique.mockResolvedValue({
                id: 'line-1',
                name: 'Labor',
                costTransactions: [],
            });
            const result = await (0, cost_service_1.getBudgetLineById)('line-1');
            expect(mockBudgetLineFindUnique).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'line-1' },
                include: { costTransactions: true },
            }));
            expect(result?.name).toBe('Labor');
        });
        it('gets budget lines by project', async () => {
            mockBudgetLineFindMany.mockResolvedValue([
                { id: 'line-1', name: 'Labor' },
            ]);
            const result = await (0, cost_service_1.getBudgetLinesByProject)('proj-1');
            expect(mockBudgetLineFindMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { projectId: 'proj-1' },
                include: { costTransactions: true },
            }));
            expect(result).toHaveLength(1);
        });
        it('updates a budget line and recalculates flag', async () => {
            mockBudgetLineFindUnique.mockResolvedValue({
                id: 'line-1',
                name: 'Labor',
                budgetAmount: 100_000,
                incurredAmount: 50_000,
                varianceThreshold: null,
                varianceFlag: 'green',
            });
            mockBudgetLineUpdate.mockResolvedValue({
                id: 'line-1',
                name: 'Updated Labor',
                budgetAmount: 80_000,
                incurredAmount: 50_000,
                varianceThreshold: null,
                varianceFlag: 'green',
            });
            const result = await (0, cost_service_1.updateBudgetLine)('line-1', {
                name: 'Updated Labor',
                budgetAmount: 80_000,
            });
            expect(mockBudgetLineUpdate).toHaveBeenCalledTimes(1);
            expect(result.name).toBe('Updated Labor');
        });
        it('throws when updating a non-existent budget line', async () => {
            mockBudgetLineFindUnique.mockResolvedValue(null);
            await expect((0, cost_service_1.updateBudgetLine)('line-1', { name: 'Updated' })).rejects.toThrow('Budget line not found');
        });
        it('deletes a budget line', async () => {
            mockBudgetLineDelete.mockResolvedValue({ id: 'line-1' });
            const result = await (0, cost_service_1.deleteBudgetLine)('line-1');
            expect(mockBudgetLineDelete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'line-1' } }));
            expect(result.id).toBe('line-1');
        });
    });
    describe('cost transaction operations', () => {
        const mockBudgetLineFindUnique = jest.fn();
        const mockBudgetLineUpdate = jest.fn();
        const mockCostTransactionCreate = jest.fn();
        const mockCostTransactionFindMany = jest.fn();
        const mockPrisma = {
            budgetLine: {
                findUnique: mockBudgetLineFindUnique,
                update: mockBudgetLineUpdate,
            },
            costTransaction: {
                create: mockCostTransactionCreate,
                findMany: mockCostTransactionFindMany,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('creates a committed transaction and updates committed amount', async () => {
            mockBudgetLineFindUnique
                .mockResolvedValueOnce({
                id: 'line-1',
                committedAmount: 10_000,
                incurredAmount: 5_000,
                budgetAmount: 100_000,
                varianceThreshold: null,
                varianceFlag: 'green',
            })
                .mockResolvedValueOnce({
                id: 'line-1',
                committedAmount: 10_000,
                incurredAmount: 5_000,
                budgetAmount: 100_000,
                varianceThreshold: null,
                varianceFlag: 'green',
            });
            mockCostTransactionCreate.mockResolvedValue({
                id: 'tx-1',
                budgetLineId: 'line-1',
                type: 'committed',
                amount: 20_000,
            });
            mockBudgetLineUpdate.mockResolvedValue({
                id: 'line-1',
                committedAmount: 30_000,
            });
            const result = await (0, cost_service_1.createCostTransaction)({
                projectId: 'proj-1',
                budgetLineId: 'line-1',
                type: 'committed',
                source: 'po',
                amount: 20_000,
                transactionDate: new Date('2026-01-15'),
            });
            expect(mockCostTransactionCreate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    type: 'committed',
                    amount: 20_000,
                }),
            }));
            expect(mockBudgetLineUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'line-1' },
                data: expect.objectContaining({ committedAmount: 30_000 }),
            }));
            expect(result.type).toBe('committed');
        });
        it('creates an incurred transaction and updates incurred amount with flag', async () => {
            mockBudgetLineFindUnique
                .mockResolvedValueOnce({
                id: 'line-1',
                committedAmount: 10_000,
                incurredAmount: 5_000,
                budgetAmount: 100_000,
                varianceThreshold: null,
                varianceFlag: 'green',
            })
                .mockResolvedValueOnce({
                id: 'line-1',
                committedAmount: 10_000,
                incurredAmount: 5_000,
                budgetAmount: 100_000,
                varianceThreshold: null,
                varianceFlag: 'green',
            });
            mockCostTransactionCreate.mockResolvedValue({
                id: 'tx-1',
                budgetLineId: 'line-1',
                type: 'incurred',
                amount: 50_000,
            });
            mockBudgetLineUpdate.mockResolvedValue({
                id: 'line-1',
                incurredAmount: 55_000,
                varianceFlag: 'green',
            });
            const result = await (0, cost_service_1.createCostTransaction)({
                projectId: 'proj-1',
                budgetLineId: 'line-1',
                type: 'incurred',
                source: 'invoice',
                amount: 50_000,
                transactionDate: new Date('2026-01-15'),
            });
            expect(mockCostTransactionCreate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    type: 'incurred',
                    amount: 50_000,
                }),
            }));
            expect(mockBudgetLineUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'line-1' },
                data: expect.objectContaining({ incurredAmount: 55_000 }),
            }));
            expect(result.type).toBe('incurred');
        });
        it('throws when creating a transaction for non-existent budget line', async () => {
            mockBudgetLineFindUnique.mockResolvedValue(null);
            await expect((0, cost_service_1.createCostTransaction)({
                projectId: 'proj-1',
                budgetLineId: 'line-1',
                type: 'committed',
                source: 'po',
                amount: 20_000,
                transactionDate: new Date('2026-01-15'),
            })).rejects.toThrow('Budget line not found');
        });
        it('gets transactions by project', async () => {
            mockCostTransactionFindMany.mockResolvedValue([
                { id: 'tx-1', projectId: 'proj-1' },
            ]);
            const result = await (0, cost_service_1.getCostTransactionsByProject)('proj-1');
            expect(mockCostTransactionFindMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { projectId: 'proj-1' },
                orderBy: { transactionDate: 'desc' },
            }));
            expect(result).toHaveLength(1);
        });
        it('gets transactions by budget line', async () => {
            mockCostTransactionFindMany.mockResolvedValue([
                { id: 'tx-1', budgetLineId: 'line-1' },
            ]);
            const result = await (0, cost_service_1.getCostTransactionsByBudgetLine)('line-1');
            expect(mockCostTransactionFindMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { budgetLineId: 'line-1' },
                orderBy: { transactionDate: 'desc' },
            }));
            expect(result).toHaveLength(1);
        });
    });
    describe('updateBudgetLineCommitted', () => {
        const mockBudgetLineFindUnique = jest.fn();
        const mockBudgetLineUpdate = jest.fn();
        const mockPrisma = {
            budgetLine: {
                findUnique: mockBudgetLineFindUnique,
                update: mockBudgetLineUpdate,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('adds to committed amount', async () => {
            mockBudgetLineFindUnique.mockResolvedValue({
                id: 'line-1',
                committedAmount: 10_000,
            });
            mockBudgetLineUpdate.mockResolvedValue({
                id: 'line-1',
                committedAmount: 30_000,
            });
            await (0, cost_service_1.updateBudgetLineCommitted)('line-1', 20_000);
            expect(mockBudgetLineUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'line-1' },
                data: { committedAmount: 30_000 },
            }));
        });
        it('throws if budget line not found', async () => {
            mockBudgetLineFindUnique.mockResolvedValue(null);
            await expect((0, cost_service_1.updateBudgetLineCommitted)('line-1', 20_000)).rejects.toThrow('Budget line not found');
        });
    });
    describe('updateBudgetLineIncurred', () => {
        const mockBudgetLineFindUnique = jest.fn();
        const mockBudgetLineUpdate = jest.fn();
        const mockPrisma = {
            budgetLine: {
                findUnique: mockBudgetLineFindUnique,
                update: mockBudgetLineUpdate,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('adds to incurred amount and recalculates flag', async () => {
            mockBudgetLineFindUnique.mockResolvedValue({
                id: 'line-1',
                incurredAmount: 80_000,
                budgetAmount: 100_000,
                varianceThreshold: null,
                varianceFlag: 'green',
            });
            mockBudgetLineUpdate.mockResolvedValue({
                id: 'line-1',
                incurredAmount: 110_000,
                varianceFlag: 'red',
            });
            await (0, cost_service_1.updateBudgetLineIncurred)('line-1', 30_000);
            expect(mockBudgetLineUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'line-1' },
                data: expect.objectContaining({
                    incurredAmount: 110_000,
                    varianceFlag: 'red',
                }),
            }));
        });
    });
    describe('setBudgetLinePercentComplete', () => {
        const mockBudgetLineFindUnique = jest.fn();
        const mockBudgetLineUpdate = jest.fn();
        const mockPrisma = {
            budgetLine: {
                findUnique: mockBudgetLineFindUnique,
                update: mockBudgetLineUpdate,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('clamps percent complete between 0 and 1', async () => {
            mockBudgetLineFindUnique.mockResolvedValue({
                id: 'line-1',
                budgetAmount: 100_000,
                incurredAmount: 50_000,
                varianceThreshold: null,
                varianceFlag: 'green',
            });
            mockBudgetLineUpdate.mockResolvedValue({
                id: 'line-1',
                percentComplete: 1,
            });
            await (0, cost_service_1.setBudgetLinePercentComplete)('line-1', 1.5);
            expect(mockBudgetLineUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'line-1' },
                data: expect.objectContaining({ percentComplete: 1 }),
            }));
        });
        it('sets percent complete to 0 for negative input', async () => {
            mockBudgetLineFindUnique.mockResolvedValue({
                id: 'line-1',
                budgetAmount: 100_000,
                incurredAmount: 50_000,
                varianceThreshold: null,
                varianceFlag: 'green',
            });
            mockBudgetLineUpdate.mockResolvedValue({
                id: 'line-1',
                percentComplete: 0,
            });
            await (0, cost_service_1.setBudgetLinePercentComplete)('line-1', -0.5);
            expect(mockBudgetLineUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'line-1' },
                data: expect.objectContaining({ percentComplete: 0 }),
            }));
        });
    });
    describe('getCashFlow', () => {
        const mockProjectFindUnique = jest.fn();
        const mockScheduleActivityFindMany = jest.fn();
        const mockBudgetLineFindMany = jest.fn();
        const mockCostTransactionFindMany = jest.fn();
        const mockPurchaseOrderFindMany = jest.fn();
        const mockSubcontractFindMany = jest.fn();
        const mockPrismaCashFlow = {
            project: {
                findUnique: mockProjectFindUnique,
            },
            scheduleActivity: {
                findMany: mockScheduleActivityFindMany,
            },
            budgetLine: {
                findMany: mockBudgetLineFindMany,
            },
            costTransaction: {
                findMany: mockCostTransactionFindMany,
            },
            purchaseOrder: {
                findMany: mockPurchaseOrderFindMany,
            },
            subcontract: {
                findMany: mockSubcontractFindMany,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrismaCashFlow);
        });
        it('throws when project not found', async () => {
            mockProjectFindUnique.mockResolvedValue(null);
            await expect((0, cost_service_1.getCashFlow)('proj-1')).rejects.toThrow('Project not found');
        });
        it('returns empty months when project has no data', async () => {
            const start = new Date('2026-01-01');
            const end = new Date('2026-01-31');
            mockProjectFindUnique.mockResolvedValue({ startDate: start, endDate: end });
            mockScheduleActivityFindMany.mockResolvedValue([]);
            mockBudgetLineFindMany.mockResolvedValue([]);
            mockCostTransactionFindMany.mockResolvedValue([]);
            mockPurchaseOrderFindMany.mockResolvedValue([]);
            mockSubcontractFindMany.mockResolvedValue([]);
            const result = await (0, cost_service_1.getCashFlow)('proj-1');
            expect(result.projectId).toBe('proj-1');
            expect(result.months).toHaveLength(1);
            expect(result.months[0]).toMatchObject({
                year: 2026,
                month: 1,
                plannedSpend: 0,
                actualSpend: 0,
                earnedValue: 0,
                committed: 0,
            });
        });
        it('distributes planned spend across activity months', async () => {
            const start = new Date('2026-01-01');
            const end = new Date('2026-02-28');
            mockProjectFindUnique.mockResolvedValue({ startDate: start, endDate: end });
            mockScheduleActivityFindMany.mockResolvedValue([
                { wbsItemId: 'wbs-1', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), duration: 30 },
            ]);
            mockBudgetLineFindMany.mockResolvedValue([
                { wbsItemId: 'wbs-1', budgetAmount: 30_000, percentComplete: 0 },
            ]);
            mockCostTransactionFindMany.mockResolvedValue([]);
            mockPurchaseOrderFindMany.mockResolvedValue([]);
            mockSubcontractFindMany.mockResolvedValue([]);
            const result = await (0, cost_service_1.getCashFlow)('proj-1');
            const jan = result.months.find((m) => m.month === 1);
            expect(jan.plannedSpend).toBeGreaterThan(0);
        });
        it('groups actual spend by transaction month', async () => {
            const start = new Date('2026-01-01');
            const end = new Date('2026-02-28');
            mockProjectFindUnique.mockResolvedValue({ startDate: start, endDate: end });
            mockScheduleActivityFindMany.mockResolvedValue([]);
            mockBudgetLineFindMany.mockResolvedValue([]);
            mockCostTransactionFindMany.mockResolvedValue([
                { amount: 10_000, transactionDate: new Date('2026-01-15') },
                { amount: 5_000, transactionDate: new Date('2026-01-20') },
                { amount: 8_000, transactionDate: new Date('2026-02-10') },
            ]);
            mockPurchaseOrderFindMany.mockResolvedValue([]);
            mockSubcontractFindMany.mockResolvedValue([]);
            const result = await (0, cost_service_1.getCashFlow)('proj-1');
            const jan = result.months.find((m) => m.month === 1);
            const feb = result.months.find((m) => m.month === 2);
            expect(jan.actualSpend).toBe(15_000);
            expect(feb.actualSpend).toBe(8_000);
        });
        it('distributes earned value across transaction months when transactions exist', async () => {
            const start = new Date('2026-01-01');
            const end = new Date('2026-02-28');
            mockProjectFindUnique.mockResolvedValue({ startDate: start, endDate: end });
            mockScheduleActivityFindMany.mockResolvedValue([]);
            mockBudgetLineFindMany.mockResolvedValue([
                { wbsItemId: 'wbs-1', budgetAmount: 100_000, percentComplete: 0.5 },
            ]);
            mockCostTransactionFindMany.mockResolvedValue([
                { amount: 20_000, transactionDate: new Date('2026-01-15') },
                { amount: 30_000, transactionDate: new Date('2026-02-10') },
            ]);
            mockPurchaseOrderFindMany.mockResolvedValue([]);
            mockSubcontractFindMany.mockResolvedValue([]);
            const result = await (0, cost_service_1.getCashFlow)('proj-1');
            const jan = result.months.find((m) => m.month === 1);
            const feb = result.months.find((m) => m.month === 2);
            // total BCWP = 50_000; split 20k:30k = 40%:60%
            expect(jan.earnedValue).toBe(20_000);
            expect(feb.earnedValue).toBe(30_000);
        });
        it('groups committed amounts by creation month', async () => {
            const start = new Date('2026-01-01');
            const end = new Date('2026-02-28');
            mockProjectFindUnique.mockResolvedValue({ startDate: start, endDate: end });
            mockScheduleActivityFindMany.mockResolvedValue([]);
            mockBudgetLineFindMany.mockResolvedValue([]);
            mockCostTransactionFindMany.mockResolvedValue([]);
            mockPurchaseOrderFindMany.mockResolvedValue([
                { totalAmount: 25_000, createdAt: new Date('2026-01-05') },
            ]);
            mockSubcontractFindMany.mockResolvedValue([
                { contractAmount: 40_000, createdAt: new Date('2026-02-01') },
            ]);
            const result = await (0, cost_service_1.getCashFlow)('proj-1');
            const jan = result.months.find((m) => m.month === 1);
            const feb = result.months.find((m) => m.month === 2);
            expect(jan.committed).toBe(25_000);
            expect(feb.committed).toBe(40_000);
        });
    });
    describe('recalculateBaseline', () => {
        const mockBudgetLineFindMany = jest.fn();
        const mockBudgetLineUpdate = jest.fn();
        const mockBudgetLineCreate = jest.fn();
        const mockTransaction = jest.fn();
        const mockPrisma = {
            budgetLine: {
                findMany: mockBudgetLineFindMany,
                update: mockBudgetLineUpdate,
                create: mockBudgetLineCreate,
            },
            $transaction: mockTransaction,
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('distributes a CO addition proportionally across existing lines', async () => {
            mockBudgetLineFindMany.mockResolvedValue([
                { id: 'bl-1', budgetAmount: { toNumber: () => 60000 } },
                { id: 'bl-2', budgetAmount: { toNumber: () => 40000 } },
            ]);
            mockTransaction.mockResolvedValue([{}, {}]);
            const { recalculateBaseline } = await Promise.resolve().then(() => __importStar(require('./cost.service')));
            const result = await recalculateBaseline('proj-1', 5000);
            expect(result.previousTotalBudget).toBe(100000);
            expect(result.newTotalBudget).toBe(105000);
            expect(result.addedAmount).toBe(5000);
            expect(result.source).toBe('proportional_distribution');
            expect(result.affectedBudgetLineIds).toEqual(expect.arrayContaining(['bl-1', 'bl-2']));
            // The transaction is the array of update operations
            expect(mockTransaction).toHaveBeenCalled();
            const txArg = mockTransaction.mock.calls[0][0];
            expect(Array.isArray(txArg)).toBe(true);
            expect(txArg).toHaveLength(2);
        });
        it('creates a Change Orders catch-all line when project has no budget lines', async () => {
            mockBudgetLineFindMany.mockResolvedValue([]);
            mockBudgetLineCreate.mockResolvedValue({ id: 'bl-new', name: 'Change Orders' });
            const { recalculateBaseline } = await Promise.resolve().then(() => __importStar(require('./cost.service')));
            const result = await recalculateBaseline('proj-1', 12000);
            expect(result.source).toBe('change_order_catchall');
            expect(result.previousTotalBudget).toBe(0);
            expect(result.newTotalBudget).toBe(12000);
            expect(result.affectedBudgetLineIds).toEqual(['bl-new']);
            expect(mockBudgetLineCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    projectId: 'proj-1',
                    name: 'Change Orders',
                    costCode: 'CHG-ORD',
                }),
            });
            expect(mockTransaction).not.toHaveBeenCalled();
        });
        it('is a no-op when the amount is 0', async () => {
            mockBudgetLineFindMany.mockResolvedValue([
                { id: 'bl-1', budgetAmount: { toNumber: () => 100000 } },
            ]);
            const { recalculateBaseline } = await Promise.resolve().then(() => __importStar(require('./cost.service')));
            const result = await recalculateBaseline('proj-1', 0);
            expect(result.addedAmount).toBe(0);
            expect(result.affectedBudgetLineIds).toEqual([]);
            expect(mockTransaction).not.toHaveBeenCalled();
            expect(mockBudgetLineUpdate).not.toHaveBeenCalled();
            expect(mockBudgetLineCreate).not.toHaveBeenCalled();
        });
        it('rejects negative amounts', async () => {
            const { recalculateBaseline } = await Promise.resolve().then(() => __importStar(require('./cost.service')));
            await expect(recalculateBaseline('proj-1', -100)).rejects.toThrow(/non-negative/);
        });
        it('rejects non-finite amounts', async () => {
            const { recalculateBaseline } = await Promise.resolve().then(() => __importStar(require('./cost.service')));
            await expect(recalculateBaseline('proj-1', NaN)).rejects.toThrow(/non-negative/);
            await expect(recalculateBaseline('proj-1', Infinity)).rejects.toThrow(/non-negative/);
        });
        it('handles rounding by assigning the remainder to the largest line', async () => {
            // Budgets that don't divide evenly: 33.33 + 33.33 + 33.34 = 100.
            // Adding 7.00 with 0.01-cent precision: 33.33 → 2.33, 33.33 → 2.33,
            // 33.34 → 2.34. Sum 7.00 — exact.
            mockBudgetLineFindMany.mockResolvedValue([
                { id: 'bl-1', budgetAmount: { toNumber: () => 33.33 } },
                { id: 'bl-2', budgetAmount: { toNumber: () => 33.33 } },
                { id: 'bl-3', budgetAmount: { toNumber: () => 33.34 } },
            ]);
            mockTransaction.mockResolvedValue([{}, {}, {}]);
            const { recalculateBaseline } = await Promise.resolve().then(() => __importStar(require('./cost.service')));
            const result = await recalculateBaseline('proj-1', 7.00);
            expect(result.previousTotalBudget).toBe(100);
            expect(result.newTotalBudget).toBe(107);
            // All three lines affected
            expect(result.affectedBudgetLineIds).toHaveLength(3);
        });
    });
});
//# sourceMappingURL=cost.service.test.js.map