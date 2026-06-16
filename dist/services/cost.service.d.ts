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
export interface EvmForecasts {
    projectId: string;
    bac: number;
    ev: number;
    ac: number;
    pv: number;
    cpi: number;
    spi: number;
    tcpi: number;
    tcpiFlag: 'tight' | 'on_pace' | 'cushion' | 'unknown';
    eac_cpi: number;
    eac_spi: number;
    eac_replan: number;
    vac: number;
    daysElapsed: number;
    daysRemaining: number;
    forecastCompleteDate: string | null;
    baselineCompleteDate: string | null;
    completeDateDeltaDays: number | null;
    confidenceRange: {
        optimistic: number;
        mostLikely: number;
        pessimistic: number;
    };
}
export declare function calculateForecasts(projectId: string): Promise<EvmForecasts>;
export declare function updateBudgetLineCommitted(budgetLineId: string, amount: number): Promise<void>;
export declare function updateBudgetLineIncurred(budgetLineId: string, amount: number): Promise<void>;
export declare function setBudgetLinePercentComplete(budgetLineId: string, percent: number): Promise<void>;
export interface RecalculateBaselineResult {
    projectId: string;
    previousTotalBudget: number;
    newTotalBudget: number;
    addedAmount: number;
    source: 'proportional_distribution' | 'change_order_catchall' | 'no_budget_lines';
    affectedBudgetLineIds: string[];
}
/**
 * Recalculate a project's cost baseline by folding an approved change order
 * into the existing budget lines.
 *
 * Strategy:
 *   - If the project has zero budget lines, create a single "Change Orders"
 *     catch-all line and add the full amount to it.
 *   - If the project has one or more budget lines, distribute the addition
 *     proportionally to current budget amounts. This preserves the
 *     original cost-code allocation ratios.
 *
 * BAC (Budget at Completion) is the sum of all budget lines. After this
 * call, BAC = previous BAC + amount. EVM calculations that read budget
 * lines will see the new BAC on the next call to calculateProjectEvm.
 *
 * This is the V1 approach to EVM re-flow on CO approval: the budget is
 * bumped; schedule impact (hours) is not yet integrated into the schedule
 * module's baseline (a future task).
 */
export declare function recalculateBaseline(projectId: string, amount: number): Promise<RecalculateBaselineResult>;
export declare function createBudgetLine(data: CreateBudgetLineInput): Promise<{
    id: string;
    createdAt: Date;
    name: string;
    projectId: string;
    wbsItemId: string | null;
    costCode: string | null;
    budgetAmount: Prisma.Decimal;
    committedAmount: Prisma.Decimal;
    incurredAmount: Prisma.Decimal;
    forecastAmount: Prisma.Decimal | null;
    percentComplete: number;
    varianceThreshold: number | null;
    varianceFlag: string | null;
    updatedAt: Date;
}>;
export declare function getBudgetLineById(id: string): Promise<({
    costTransactions: {
        id: string;
        createdAt: Date;
        projectId: string;
        source: string;
        type: string;
        amount: Prisma.Decimal;
        description: string | null;
        transactionDate: Date;
        referenceId: string | null;
        budgetLineId: string;
    }[];
} & {
    id: string;
    createdAt: Date;
    name: string;
    projectId: string;
    wbsItemId: string | null;
    costCode: string | null;
    budgetAmount: Prisma.Decimal;
    committedAmount: Prisma.Decimal;
    incurredAmount: Prisma.Decimal;
    forecastAmount: Prisma.Decimal | null;
    percentComplete: number;
    varianceThreshold: number | null;
    varianceFlag: string | null;
    updatedAt: Date;
}) | null>;
export declare function getBudgetLinesByProject(projectId: string): Promise<({
    costTransactions: {
        id: string;
        createdAt: Date;
        projectId: string;
        source: string;
        type: string;
        amount: Prisma.Decimal;
        description: string | null;
        transactionDate: Date;
        referenceId: string | null;
        budgetLineId: string;
    }[];
} & {
    id: string;
    createdAt: Date;
    name: string;
    projectId: string;
    wbsItemId: string | null;
    costCode: string | null;
    budgetAmount: Prisma.Decimal;
    committedAmount: Prisma.Decimal;
    incurredAmount: Prisma.Decimal;
    forecastAmount: Prisma.Decimal | null;
    percentComplete: number;
    varianceThreshold: number | null;
    varianceFlag: string | null;
    updatedAt: Date;
})[]>;
export declare function updateBudgetLine(id: string, data: UpdateBudgetLineInput): Promise<{
    id: string;
    createdAt: Date;
    name: string;
    projectId: string;
    wbsItemId: string | null;
    costCode: string | null;
    budgetAmount: Prisma.Decimal;
    committedAmount: Prisma.Decimal;
    incurredAmount: Prisma.Decimal;
    forecastAmount: Prisma.Decimal | null;
    percentComplete: number;
    varianceThreshold: number | null;
    varianceFlag: string | null;
    updatedAt: Date;
}>;
export declare function deleteBudgetLine(id: string): Promise<{
    id: string;
    createdAt: Date;
    name: string;
    projectId: string;
    wbsItemId: string | null;
    costCode: string | null;
    budgetAmount: Prisma.Decimal;
    committedAmount: Prisma.Decimal;
    incurredAmount: Prisma.Decimal;
    forecastAmount: Prisma.Decimal | null;
    percentComplete: number;
    varianceThreshold: number | null;
    varianceFlag: string | null;
    updatedAt: Date;
}>;
export declare function createCostTransaction(data: CreateCostTransactionInput): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    source: string;
    type: string;
    amount: Prisma.Decimal;
    description: string | null;
    transactionDate: Date;
    referenceId: string | null;
    budgetLineId: string;
}>;
export declare function getCostTransactionsByProject(projectId: string): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    source: string;
    type: string;
    amount: Prisma.Decimal;
    description: string | null;
    transactionDate: Date;
    referenceId: string | null;
    budgetLineId: string;
}[]>;
export declare function getCostTransactionsByBudgetLine(budgetLineId: string): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    source: string;
    type: string;
    amount: Prisma.Decimal;
    description: string | null;
    transactionDate: Date;
    referenceId: string | null;
    budgetLineId: string;
}[]>;
export interface CashFlowMonth {
    year: number;
    month: number;
    monthLabel: string;
    plannedSpend: number;
    actualSpend: number;
    earnedValue: number;
    committed: number;
}
export declare function getCashFlow(projectId: string): Promise<{
    projectId: string;
    months: CashFlowMonth[];
}>;
//# sourceMappingURL=cost.service.d.ts.map