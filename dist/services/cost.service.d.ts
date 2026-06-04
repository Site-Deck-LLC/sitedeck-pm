import { Prisma } from '@prisma/client';
export interface EvmResult {
    bcws: number;
    bcwp: number;
    acwp: number;
    sv: number;
    cv: number;
    spi: number;
    cpi: number;
    eac: number;
    vac: number;
    tcpi: number;
}
export interface CreateBudgetLineInput {
    projectId: string;
    wbsItemId?: string;
    costCode?: string;
    name: string;
    budgetAmount: number;
    varianceThreshold?: number;
}
export interface UpdateBudgetLineInput {
    name?: string;
    budgetAmount?: number;
    forecastAmount?: number | null;
    varianceThreshold?: number | null;
    wbsItemId?: string | null;
    costCode?: string | null;
}
export interface CreateCostTransactionInput {
    projectId: string;
    budgetLineId: string;
    type: 'committed' | 'incurred';
    source: string;
    amount: number;
    description?: string;
    transactionDate: Date;
    referenceId?: string;
}
export declare function calculateEvm(budgetAmount: number, percentComplete: number, incurredAmount: number): EvmResult;
export declare function recalculateVarianceFlag(budgetLine: {
    budgetAmount: Prisma.Decimal | number;
    incurredAmount: Prisma.Decimal | number;
    varianceThreshold: Prisma.Decimal | number | null;
}): string | null;
export declare function calculateProjectEvm(projectId: string): Promise<{
    projectId: string;
    totalBudget: number;
    totalBcwp: number;
    totalAcwp: number;
    evm: EvmResult;
    lineResults: {
        lineId: string;
        name: string;
        evm: EvmResult;
        flag: string | null;
    }[];
}>;
export declare function updateBudgetLineCommitted(budgetLineId: string, amount: number): Promise<void>;
export declare function updateBudgetLineIncurred(budgetLineId: string, amount: number): Promise<void>;
export declare function setBudgetLinePercentComplete(budgetLineId: string, percent: number): Promise<void>;
export declare function createBudgetLine(data: CreateBudgetLineInput): Promise<{
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    wbsItemId: string | null;
    percentComplete: number;
    costCode: string | null;
    budgetAmount: Prisma.Decimal;
    committedAmount: Prisma.Decimal;
    incurredAmount: Prisma.Decimal;
    forecastAmount: Prisma.Decimal | null;
    varianceThreshold: number | null;
    varianceFlag: string | null;
}>;
export declare function getBudgetLineById(id: string): Promise<({
    costTransactions: {
        id: string;
        createdAt: Date;
        projectId: string;
        description: string | null;
        type: string;
        source: string;
        amount: Prisma.Decimal;
        transactionDate: Date;
        referenceId: string | null;
        budgetLineId: string;
    }[];
} & {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    wbsItemId: string | null;
    percentComplete: number;
    costCode: string | null;
    budgetAmount: Prisma.Decimal;
    committedAmount: Prisma.Decimal;
    incurredAmount: Prisma.Decimal;
    forecastAmount: Prisma.Decimal | null;
    varianceThreshold: number | null;
    varianceFlag: string | null;
}) | null>;
export declare function getBudgetLinesByProject(projectId: string): Promise<({
    costTransactions: {
        id: string;
        createdAt: Date;
        projectId: string;
        description: string | null;
        type: string;
        source: string;
        amount: Prisma.Decimal;
        transactionDate: Date;
        referenceId: string | null;
        budgetLineId: string;
    }[];
} & {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    wbsItemId: string | null;
    percentComplete: number;
    costCode: string | null;
    budgetAmount: Prisma.Decimal;
    committedAmount: Prisma.Decimal;
    incurredAmount: Prisma.Decimal;
    forecastAmount: Prisma.Decimal | null;
    varianceThreshold: number | null;
    varianceFlag: string | null;
})[]>;
export declare function updateBudgetLine(id: string, data: UpdateBudgetLineInput): Promise<{
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    wbsItemId: string | null;
    percentComplete: number;
    costCode: string | null;
    budgetAmount: Prisma.Decimal;
    committedAmount: Prisma.Decimal;
    incurredAmount: Prisma.Decimal;
    forecastAmount: Prisma.Decimal | null;
    varianceThreshold: number | null;
    varianceFlag: string | null;
}>;
export declare function deleteBudgetLine(id: string): Promise<{
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    wbsItemId: string | null;
    percentComplete: number;
    costCode: string | null;
    budgetAmount: Prisma.Decimal;
    committedAmount: Prisma.Decimal;
    incurredAmount: Prisma.Decimal;
    forecastAmount: Prisma.Decimal | null;
    varianceThreshold: number | null;
    varianceFlag: string | null;
}>;
export declare function createCostTransaction(data: CreateCostTransactionInput): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    description: string | null;
    type: string;
    source: string;
    amount: Prisma.Decimal;
    transactionDate: Date;
    referenceId: string | null;
    budgetLineId: string;
}>;
export declare function getCostTransactionsByProject(projectId: string): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    description: string | null;
    type: string;
    source: string;
    amount: Prisma.Decimal;
    transactionDate: Date;
    referenceId: string | null;
    budgetLineId: string;
}[]>;
export declare function getCostTransactionsByBudgetLine(budgetLineId: string): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    description: string | null;
    type: string;
    source: string;
    amount: Prisma.Decimal;
    transactionDate: Date;
    referenceId: string | null;
    budgetLineId: string;
}[]>;
//# sourceMappingURL=cost.service.d.ts.map