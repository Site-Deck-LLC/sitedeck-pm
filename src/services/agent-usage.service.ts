/**
 * Agent API Usage Log Service
 * ============================================================================
 * Persists every Anthropic API call to the `api_usage_log` table for:
 *   - Cost reconciliation (match against Anthropic's invoice)
 *   - Rate-limit and spend-guard audit trail
 *   - Debugging prompt issues without leaking prompt content
 *   - Detecting abuse (one user hammering the endpoint)
 *
 * What we DO NOT log: prompt content, response content, or the API key.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { AgentEndpoint } from '../constants/agent-limits';

export interface ApiUsageInput {
  projectId: string;
  userId: string;
  endpoint: AgentEndpoint;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  success: boolean;
  failureCode?: string;
}

export async function logApiUsage(input: ApiUsageInput): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.apiUsageLog.create({
    data: {
      projectId: input.projectId,
      userId: input.userId,
      endpoint: input.endpoint,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      costUsd: input.costUsd,
      success: input.success,
      failureCode: input.failureCode || null,
      calledAt: new Date(),
    },
  });
}

/**
 * Get today's successful call count for a (user, project, endpoint). Used
 * for the rate limit display in the UI (not enforcement — that's in the
 * client). Returns 0 when the table is empty.
 */
export async function getTodayUsageFor(
  projectId: string,
  userId: string,
  endpoint?: AgentEndpoint
): Promise<{ calls: number; costUsd: number }> {
  const prisma = getPrismaClient();
  const since = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const rows = await prisma.apiUsageLog.findMany({
    where: {
      projectId,
      userId,
      success: true,
      calledAt: { gte: since },
      ...(endpoint ? { endpoint } : {}),
    },
    select: { costUsd: true },
  });
  return {
    calls: rows.length,
    costUsd: rows.reduce((sum, r) => sum + (r.costUsd || 0), 0),
  };
}
