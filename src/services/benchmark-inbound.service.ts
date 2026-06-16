/**
 * Benchmark Inbound Webhook Handler
 * ============================================================================
 * Receives events from SiteDeck Benchmark and surfaces them as ReworkTasks
 * in PM. All handlers are idempotent, fire-and-forget safe, and never throw
 * back to the HTTP layer. Unknown events are logged and acknowledged with 200.
 * ============================================================================
 */

import { createHmac } from 'crypto';
import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import {
  createReworkTask,
  updateReworkTaskStatus,
  ReworkTaskSource,
  ReworkTaskPriority,
} from './rework-task.service';

export interface BenchmarkWebhookPayload {
  event?: string;
  eventId?: string;
  referenceId?: string;
  projectId?: string;
  dfowId?: string;
  inspectionId?: string;
  inspectionRecordId?: string;
  result?: 'passed' | 'failed';
  status?: string;
  ncrId?: string;
  internalNumber?: string;
  description?: string;
  severity?: string;
  holdPointId?: string;
  reportDate?: string;
  qcpId?: string;
  [key: string]: unknown;
}

const BENCHMARK_EVENTS = {
  NCR_OPENED: 'benchmark.ncr.opened',
  NCR_CLOSED: 'benchmark.ncr.closed',
  INSPECTION_COMPLETED: 'benchmark.inspection.completed',
  HOLD_POINT_RELEASED: 'benchmark.hold_point.released',
  DAILY_REPORT_POSTED: 'benchmark.daily_report.posted',
  QCP_EXPORTED: 'benchmark.qcp.exported',
} as const;

/**
 * Verify HMAC-SHA256 signature from Benchmark.
 * If no secret is configured in non-production, allow the request through
 * (matches Benchmark's own verifySignature behaviour).
 */
export function verifyBenchmarkSignature(bodyRaw: string, signature: string | undefined): boolean {
  const secret = process.env.BENCHMARK_WEBHOOK_SECRET || process.env.PM_BENCHMARK_WEBHOOK_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  if (!signature) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(bodyRaw).digest('hex');
  try {
    return timingSafeEqual(expected, signature);
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function logInboundWebhookEvent(
  event: string,
  direction: 'inbound' | 'outbound',
  payload: Record<string, unknown>,
  status: string,
  retryCount = 0
) {
  const prisma = getPrismaClient();
  return prisma.webhooksLog.create({
    data: {
      event,
      direction,
      payload: payload as unknown as Prisma.InputJsonValue,
      status,
      retryCount,
    },
  });
}

async function isDuplicateEvent(event: string, payload: Record<string, unknown>): Promise<boolean> {
  const prisma = getPrismaClient();
  const eventId = payload.eventId as string | undefined;
  const referenceId = payload.referenceId as string | undefined;

  if (!eventId && !referenceId) {
    return false;
  }

  const existing = await prisma.webhooksLog.findFirst({
    where: {
      event,
      direction: 'inbound',
      OR: [
        ...(eventId
          ? [
              {
                payload: {
                  path: ['eventId'],
                  equals: eventId,
                } as Record<string, unknown>,
              },
            ]
          : []),
        ...(referenceId
          ? [
              {
                payload: {
                  path: ['referenceId'],
                  equals: referenceId,
                } as Record<string, unknown>,
              },
            ]
          : []),
      ],
    },
  });

  return Boolean(existing);
}

export interface BenchmarkWebhookResult {
  action: string;
  taskId?: string;
  details?: string;
}

/**
 * Main dispatch. Never throws; every path returns 200 to Benchmark.
 */
export async function handleBenchmarkWebhook(
  payload: BenchmarkWebhookPayload
): Promise<BenchmarkWebhookResult> {
  const event = payload.event || 'benchmark.unknown';

  try {
    if (await isDuplicateEvent(event, payload as Record<string, unknown>)) {
      await logInboundWebhookEvent(event, 'inbound', payload as Record<string, unknown>, 'duplicate');
      return { action: 'duplicate', details: 'Event already processed' };
    }

    switch (event) {
      case BENCHMARK_EVENTS.NCR_OPENED:
        return await handleNcrOpened(payload);
      case BENCHMARK_EVENTS.NCR_CLOSED:
        return await handleNcrClosed(payload);
      case BENCHMARK_EVENTS.INSPECTION_COMPLETED:
        return await handleInspectionCompleted(payload);
      case BENCHMARK_EVENTS.HOLD_POINT_RELEASED:
        return await handleHoldPointReleased(payload);
      case BENCHMARK_EVENTS.DAILY_REPORT_POSTED:
        return await handleDailyReportPosted(payload);
      case BENCHMARK_EVENTS.QCP_EXPORTED:
        return await handleQcpExported(payload);
      default:
        await logInboundWebhookEvent(event, 'inbound', payload as Record<string, unknown>, 'processed');
        return { action: 'logged_only', details: `Unknown event: ${event}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logInboundWebhookEvent(event, 'inbound', payload as Record<string, unknown>, 'failed');
    return { action: 'failed', details: message };
  }
}

function parsePriority(severity?: string): ReworkTaskPriority {
  if (!severity) return 'medium';
  const s = severity.toLowerCase();
  if (s.includes('critical')) return 'critical';
  if (s.includes('high')) return 'high';
  if (s.includes('low')) return 'low';
  return 'medium';
}

async function handleNcrOpened(payload: BenchmarkWebhookPayload): Promise<BenchmarkWebhookResult> {
  const projectId = payload.projectId;
  if (!projectId) {
    await logInboundWebhookEvent(
      BENCHMARK_EVENTS.NCR_OPENED,
      'inbound',
      payload as Record<string, unknown>,
      'ignored'
    );
    return { action: 'ignored', details: 'Missing projectId' };
  }

  const title = payload.internalNumber
    ? `NCR ${payload.internalNumber}`
    : payload.description
      ? `NCR: ${payload.description.slice(0, 80)}`
      : `NCR opened: ${payload.ncrId || 'unknown'}`;

  const task = await createReworkTask({
    projectId,
    dfowId: payload.dfowId || null,
    ncrId: payload.ncrId || null,
    source: 'ncr' as ReworkTaskSource,
    sourceEventId: (payload.eventId as string) || (payload.referenceId as string) || null,
    title,
    description: payload.description || null,
    status: 'open',
    priority: parsePriority(payload.severity),
    createdBy: 'benchmark-webhook',
  });

  await logInboundWebhookEvent(
    BENCHMARK_EVENTS.NCR_OPENED,
    'inbound',
    payload as Record<string, unknown>,
    'processed'
  );

  return { action: 'rework_task_created', taskId: task.id, details: `ReworkTask ${task.id} created from NCR` };
}

async function handleNcrClosed(payload: BenchmarkWebhookPayload): Promise<BenchmarkWebhookResult> {
  const projectId = payload.projectId;
  const ncrId = payload.ncrId;

  if (!projectId || !ncrId) {
    await logInboundWebhookEvent(
      BENCHMARK_EVENTS.NCR_CLOSED,
      'inbound',
      payload as Record<string, unknown>,
      'ignored'
    );
    return { action: 'ignored', details: 'Missing projectId or ncrId' };
  }

  const prisma = getPrismaClient();
  const existing = await prisma.reworkTask.findFirst({
    where: { projectId, ncrId },
  });

  if (!existing) {
    await logInboundWebhookEvent(
      BENCHMARK_EVENTS.NCR_CLOSED,
      'inbound',
      payload as Record<string, unknown>,
      'processed'
    );
    return { action: 'logged_only', details: `No matching ReworkTask for ncrId=${ncrId}` };
  }

  const updated = await updateReworkTaskStatus(existing.id, 'resolved', 'benchmark-webhook');

  await logInboundWebhookEvent(
    BENCHMARK_EVENTS.NCR_CLOSED,
    'inbound',
    payload as Record<string, unknown>,
    'processed'
  );

  return {
    action: 'rework_task_resolved',
    taskId: updated.id,
    details: `ReworkTask ${updated.id} marked resolved`,
  };
}

async function handleInspectionCompleted(
  payload: BenchmarkWebhookPayload
): Promise<BenchmarkWebhookResult> {
  const projectId = payload.projectId;
  if (!projectId) {
    await logInboundWebhookEvent(
      BENCHMARK_EVENTS.INSPECTION_COMPLETED,
      'inbound',
      payload as Record<string, unknown>,
      'ignored'
    );
    return { action: 'ignored', details: 'Missing projectId' };
  }

  const failed = payload.result === 'failed' || payload.status === 'failed';
  if (!failed) {
    await logInboundWebhookEvent(
      BENCHMARK_EVENTS.INSPECTION_COMPLETED,
      'inbound',
      payload as Record<string, unknown>,
      'processed'
    );
    return { action: 'logged_only', details: `Inspection ${payload.result || payload.status || 'completed'} — no rework needed` };
  }

  const title = payload.description
    ? `Inspection failed: ${payload.description.slice(0, 80)}`
    : `Inspection failed: ${payload.inspectionId || payload.inspectionRecordId || 'unknown'}`;

  const task = await createReworkTask({
    projectId,
    dfowId: payload.dfowId || null,
    inspectionRecordId: payload.inspectionRecordId || payload.inspectionId || null,
    source: 'inspection' as ReworkTaskSource,
    sourceEventId: (payload.eventId as string) || (payload.referenceId as string) || null,
    title,
    description: payload.description || null,
    status: 'open',
    priority: 'high',
    createdBy: 'benchmark-webhook',
  });

  await logInboundWebhookEvent(
    BENCHMARK_EVENTS.INSPECTION_COMPLETED,
    'inbound',
    payload as Record<string, unknown>,
    'processed'
  );

  return {
    action: 'rework_task_created',
    taskId: task.id,
    details: `ReworkTask ${task.id} created from failed inspection`,
  };
}

async function handleHoldPointReleased(payload: BenchmarkWebhookPayload): Promise<BenchmarkWebhookResult> {
  if (!payload.projectId) {
    await logInboundWebhookEvent(
      BENCHMARK_EVENTS.HOLD_POINT_RELEASED,
      'inbound',
      payload as Record<string, unknown>,
      'ignored'
    );
    return { action: 'ignored', details: 'Missing projectId' };
  }

  await logInboundWebhookEvent(
    BENCHMARK_EVENTS.HOLD_POINT_RELEASED,
    'inbound',
    payload as Record<string, unknown>,
    'processed'
  );

  return { action: 'logged', details: 'Hold point release logged' };
}

async function handleDailyReportPosted(payload: BenchmarkWebhookPayload): Promise<BenchmarkWebhookResult> {
  if (!payload.projectId) {
    await logInboundWebhookEvent(
      BENCHMARK_EVENTS.DAILY_REPORT_POSTED,
      'inbound',
      payload as Record<string, unknown>,
      'ignored'
    );
    return { action: 'ignored', details: 'Missing projectId' };
  }

  await logInboundWebhookEvent(
    BENCHMARK_EVENTS.DAILY_REPORT_POSTED,
    'inbound',
    payload as Record<string, unknown>,
    'processed'
  );

  return { action: 'logged', details: 'Daily report logged' };
}

async function handleQcpExported(payload: BenchmarkWebhookPayload): Promise<BenchmarkWebhookResult> {
  if (!payload.projectId) {
    await logInboundWebhookEvent(
      BENCHMARK_EVENTS.QCP_EXPORTED,
      'inbound',
      payload as Record<string, unknown>,
      'ignored'
    );
    return { action: 'ignored', details: 'Missing projectId' };
  }

  await logInboundWebhookEvent(
    BENCHMARK_EVENTS.QCP_EXPORTED,
    'inbound',
    payload as Record<string, unknown>,
    'processed'
  );

  return { action: 'logged', details: 'QCP export logged' };
}
