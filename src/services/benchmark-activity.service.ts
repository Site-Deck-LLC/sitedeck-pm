/**
 * Benchmark Activity Feed Service
 * ============================================================================
 * Sprint 13: project detail page shows last 10 Benchmark events.
 * Reads from unified_change_log where changedBy = 'benchmark-webhook'.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';

export interface BenchmarkActivityEvent {
  id: string;
  type: string;
  description: string;
  timestamp: Date;
}

export async function getBenchmarkActivityForProject(
  projectId: string,
  limit = 10
): Promise<BenchmarkActivityEvent[]> {
  const prisma = getPrismaClient();
  const logs = await prisma.unifiedChangeLog.findMany({
    where: {
      projectId,
      changedBy: 'benchmark-webhook',
    },
    orderBy: { changedAt: 'desc' },
    take: limit,
  });

  return logs.map((log) => ({
    id: log.id,
    type: log.changeType,
    description: log.description,
    timestamp: log.changedAt,
  }));
}
