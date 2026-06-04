import {
  calculateEvm,
  calculateProjectEvm,
  recalculateVarianceFlag,
  createBudgetLine,
  getBudgetLineById,
  getBudgetLinesByProject,
  updateBudgetLine,
  deleteBudgetLine,
  createCostTransaction,
  getCostTransactionsByProject,
  getCostTransactionsByBudgetLine,
  updateBudgetLineCommitted,
  updateBudgetLineIncurred,
  setBudgetLinePercentComplete,
} from './cost.service';
import { getEvmStatusColor } from '../constants/evm';
import { getPrismaClient, setPrismaClient } from '../lib/prisma';
import { PrismaClient } from '@prisma/client';

describe('cost.service', () => {
  describe('calculateEvm', () => {
    it('calculates correctly for normal case', () => {
      const result = calculateEvm(100_000, 0.5, 40_000);
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
      const result = calculateEvm(0, 0.5, 10_000);
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
      const result = calculateEvm(100_000, 1.0, 90_000);
      expect(result.bcwp).toBe(100_000);
      expect(result.spi).toBe(1.0);
      expect(result.cpi).toBeCloseTo(1.1111, 4);
      expect(result.eac).toBeCloseTo(90_000, 0);
      expect(result.vac).toBeCloseTo(10_000, 0);
    });

    it('handles cost overrun edge case (cpi < 1)', () => {
      const result = calculateEvm(100_000, 0.5, 60_000);
      expect(result.cpi).toBeCloseTo(0.8333, 4);
      expect(result.eac).toBeCloseTo(120_000, 0);
      expect(result.vac).toBeCloseTo(-20_000, 0);
      expect(result.tcpi).toBeCloseTo(1.25, 2);
    });

    it('handles division by zero for spi when bcws is 0', () => {
      const result = calculateEvm(0, 0, 0);
      expect(result.spi).toBe(0);
      expect(result.cpi).toBe(0);
      expect(result.eac).toBe(0);
      expect(result.tcpi).toBe(0);
    });

    it('handles division by zero for cpi when acwp is 0', () => {
      const result = calculateEvm(100_000, 0.5, 0);
      expect(result.cpi).toBe(0);
      expect(result.eac).toBe(0);
    });

    it('handles division by zero for tcpi when budget equals acwp', () => {
      const result = calculateEvm(100_000, 0.5, 100_000);
      expect(result.tcpi).toBe(0);
    });
  });

  describe('recalculateVarianceFlag', () => {
    it('returns green when incurred is within budget and no threshold', () => {
      const flag = recalculateVarianceFlag({
        budgetAmount: 100_000,
        incurredAmount: 80_000,
        varianceThreshold: null,
      });
      expect(flag).toBe('green');
    });

    it('returns red when incurred exceeds budget and no threshold', () => {
      const flag = recalculateVarianceFlag({
        budgetAmount: 100_000,
        incurredAmount: 110_000,
        varianceThreshold: null,
      });
      expect(flag).toBe('red');
    });

    it('returns amber when incurred exceeds budget but within threshold', () => {
      const flag = recalculateVarianceFlag({
        budgetAmount: 100_000,
        incurredAmount: 105_000,
        varianceThreshold: 0.1,
      });
      expect(flag).toBe('amber');
    });

    it('returns red when incurred exceeds budget plus threshold', () => {
      const flag = recalculateVarianceFlag({
        budgetAmount: 100_000,
        incurredAmount: 120_000,
        varianceThreshold: 0.1,
      });
      expect(flag).toBe('red');
    });

    it('returns green when incurred is below budget with threshold set', () => {
      const flag = recalculateVarianceFlag({
        budgetAmount: 100_000,
        incurredAmount: 90_000,
        varianceThreshold: 0.1,
      });
      expect(flag).toBe('green');
    });
  });

  describe('getEvmStatusColor', () => {
    it('returns green for spi >= 0.9', () => {
      expect(getEvmStatusColor('spi', 1.0)).toBe('green');
      expect(getEvmStatusColor('spi', 0.95)).toBe('green');
    });

    it('returns amber for spi between 0.8 and 0.9', () => {
      expect(getEvmStatusColor('spi', 0.85)).toBe('amber');
    });

    it('returns red for spi < 0.8', () => {
      expect(getEvmStatusColor('spi', 0.75)).toBe('red');
    });

    it('returns green for cpi >= 0.9', () => {
      expect(getEvmStatusColor('cpi', 1.0)).toBe('green');
      expect(getEvmStatusColor('cpi', 0.95)).toBe('green');
    });

    it('returns amber for cpi between 0.8 and 0.9', () => {
      expect(getEvmStatusColor('cpi', 0.85)).toBe('amber');
    });

    it('returns red for cpi < 0.8', () => {
      expect(getEvmStatusColor('cpi', 0.75)).toBe('red');
    });
  });

  describe('calculateProjectEvm', () => {
    const mockBudgetLineFindMany = jest.fn();

    const mockPrisma = {
      budgetLine: {
        findMany: mockBudgetLineFindMany,
      },
    } as unknown as PrismaClient;

    beforeEach(() => {
      jest.clearAllMocks();
      setPrismaClient(mockPrisma);
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

      const result = await calculateProjectEvm('proj-1');

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

      const result = await calculateProjectEvm('proj-1');

      expect(result.totalBudget).toBe(0);
      expect(result.totalBcwp).toBe(0);
      expect(result.totalAcwp).toBe(0);
      expect(result.evm.bcws).toBe(0);
      expect(result.lineResults).toHaveLength(0);
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
    } as unknown as PrismaClient;

    beforeEach(() => {
      jest.clearAllMocks();
      setPrismaClient(mockPrisma);
    });

    it('creates a budget line', async () => {
      mockBudgetLineCreate.mockResolvedValue({
        id: 'line-1',
        projectId: 'proj-1',
        name: 'Labor',
        budgetAmount: 100_000,
      });

      const result = await createBudgetLine({
        projectId: 'proj-1',
        name: 'Labor',
        budgetAmount: 100_000,
      });

      expect(mockBudgetLineCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'proj-1',
            name: 'Labor',
            budgetAmount: 100_000,
            varianceFlag: 'green',
          }),
        })
      );
      expect(result.id).toBe('line-1');
    });

    it('gets a budget line by id with transactions', async () => {
      mockBudgetLineFindUnique.mockResolvedValue({
        id: 'line-1',
        name: 'Labor',
        costTransactions: [],
      });

      const result = await getBudgetLineById('line-1');
      expect(mockBudgetLineFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'line-1' },
          include: { costTransactions: true },
        })
      );
      expect(result?.name).toBe('Labor');
    });

    it('gets budget lines by project', async () => {
      mockBudgetLineFindMany.mockResolvedValue([
        { id: 'line-1', name: 'Labor' },
      ]);

      const result = await getBudgetLinesByProject('proj-1');
      expect(mockBudgetLineFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'proj-1' },
          include: { costTransactions: true },
        })
      );
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

      const result = await updateBudgetLine('line-1', {
        name: 'Updated Labor',
        budgetAmount: 80_000,
      });

      expect(mockBudgetLineUpdate).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('Updated Labor');
    });

    it('throws when updating a non-existent budget line', async () => {
      mockBudgetLineFindUnique.mockResolvedValue(null);
      await expect(
        updateBudgetLine('line-1', { name: 'Updated' })
      ).rejects.toThrow('Budget line not found');
    });

    it('deletes a budget line', async () => {
      mockBudgetLineDelete.mockResolvedValue({ id: 'line-1' });
      const result = await deleteBudgetLine('line-1');
      expect(mockBudgetLineDelete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'line-1' } })
      );
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
    } as unknown as PrismaClient;

    beforeEach(() => {
      jest.clearAllMocks();
      setPrismaClient(mockPrisma);
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

      const result = await createCostTransaction({
        projectId: 'proj-1',
        budgetLineId: 'line-1',
        type: 'committed',
        source: 'po',
        amount: 20_000,
        transactionDate: new Date('2026-01-15'),
      });

      expect(mockCostTransactionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'committed',
            amount: 20_000,
          }),
        })
      );
      expect(mockBudgetLineUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'line-1' },
          data: expect.objectContaining({ committedAmount: 30_000 }),
        })
      );
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

      const result = await createCostTransaction({
        projectId: 'proj-1',
        budgetLineId: 'line-1',
        type: 'incurred',
        source: 'invoice',
        amount: 50_000,
        transactionDate: new Date('2026-01-15'),
      });

      expect(mockCostTransactionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'incurred',
            amount: 50_000,
          }),
        })
      );
      expect(mockBudgetLineUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'line-1' },
          data: expect.objectContaining({ incurredAmount: 55_000 }),
        })
      );
      expect(result.type).toBe('incurred');
    });

    it('throws when creating a transaction for non-existent budget line', async () => {
      mockBudgetLineFindUnique.mockResolvedValue(null);
      await expect(
        createCostTransaction({
          projectId: 'proj-1',
          budgetLineId: 'line-1',
          type: 'committed',
          source: 'po',
          amount: 20_000,
          transactionDate: new Date('2026-01-15'),
        })
      ).rejects.toThrow('Budget line not found');
    });

    it('gets transactions by project', async () => {
      mockCostTransactionFindMany.mockResolvedValue([
        { id: 'tx-1', projectId: 'proj-1' },
      ]);
      const result = await getCostTransactionsByProject('proj-1');
      expect(mockCostTransactionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'proj-1' },
          orderBy: { transactionDate: 'desc' },
        })
      );
      expect(result).toHaveLength(1);
    });

    it('gets transactions by budget line', async () => {
      mockCostTransactionFindMany.mockResolvedValue([
        { id: 'tx-1', budgetLineId: 'line-1' },
      ]);
      const result = await getCostTransactionsByBudgetLine('line-1');
      expect(mockCostTransactionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { budgetLineId: 'line-1' },
          orderBy: { transactionDate: 'desc' },
        })
      );
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
    } as unknown as PrismaClient;

    beforeEach(() => {
      jest.clearAllMocks();
      setPrismaClient(mockPrisma);
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

      await updateBudgetLineCommitted('line-1', 20_000);
      expect(mockBudgetLineUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'line-1' },
          data: { committedAmount: 30_000 },
        })
      );
    });

    it('throws if budget line not found', async () => {
      mockBudgetLineFindUnique.mockResolvedValue(null);
      await expect(updateBudgetLineCommitted('line-1', 20_000)).rejects.toThrow(
        'Budget line not found'
      );
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
    } as unknown as PrismaClient;

    beforeEach(() => {
      jest.clearAllMocks();
      setPrismaClient(mockPrisma);
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

      await updateBudgetLineIncurred('line-1', 30_000);
      expect(mockBudgetLineUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'line-1' },
          data: expect.objectContaining({
            incurredAmount: 110_000,
            varianceFlag: 'red',
          }),
        })
      );
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
    } as unknown as PrismaClient;

    beforeEach(() => {
      jest.clearAllMocks();
      setPrismaClient(mockPrisma);
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

      await setBudgetLinePercentComplete('line-1', 1.5);
      expect(mockBudgetLineUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'line-1' },
          data: expect.objectContaining({ percentComplete: 1 }),
        })
      );
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

      await setBudgetLinePercentComplete('line-1', -0.5);
      expect(mockBudgetLineUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'line-1' },
          data: expect.objectContaining({ percentComplete: 0 }),
        })
      );
    });
  });
});
