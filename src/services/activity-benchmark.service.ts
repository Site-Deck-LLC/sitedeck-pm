/**
 * Activity ↔ Benchmark Link Service
 * ============================================================================
 * Sprint 13: link a PM ScheduleActivity to a Benchmark DFOW.
 * Fires outbound webhook to Benchmark on first link (idempotent).
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { createHmac } from 'crypto';

export interface LinkActivityPayload {
  event: 'project.activity.linked';
  projectId: string;
  activityId: string;
  activityName: string;
  dfowId: string;
}

function signHmac(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

async function sendActivityLinkedWebhook(payload: LinkActivityPayload): Promise<void> {
  const url = process.env.PM_BENCHMARK_ACTIVITY_URL || process.env.PM_BENCHMARK_WEBHOOK_URL;
  if (!url) {
    return;
  }
  const secret = process.env.PM_BENCHMARK_WEBHOOK_SECRET;
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-PM-Event': payload.event,
  };
  if (secret) {
    const sig = signHmac(secret, body);
    headers['x-sitedeck-signature'] = sig;
    headers['X-PM-Signature'] = sig;
  }

  try {
    const res = await fetch(url, { method: 'POST', headers, body });
    if (!res.ok) {
      console.warn('[activity-benchmark] webhook returned HTTP', res.status);
    }
  } catch (err: any) {
    console.warn('[activity-benchmark] webhook send failed:', err?.message || err);
  }
}

export async function linkActivityToBenchmark(activityId: string, dfowId: string) {
  const prisma = getPrismaClient();
  const activity = await prisma.scheduleActivity.findUnique({
    where: { id: activityId },
  });
  if (!activity) {
    throw new Error('Activity not found');
  }

  // Idempotent: if already linked to the same dfowId, return as-is
  if (activity.linkedBenchmarkDfowId === dfowId) {
    return activity;
  }

  const updated = await prisma.scheduleActivity.update({
    where: { id: activityId },
    data: { linkedBenchmarkDfowId: dfowId },
  });

  // Fire webhook to Benchmark (fire-and-forget)
  const payload: LinkActivityPayload = {
    event: 'project.activity.linked',
    projectId: activity.projectId,
    activityId: activity.id,
    activityName: activity.name,
    dfowId,
  };
  // Schedule outside request lifecycle
  setImmediate(() => {
    sendActivityLinkedWebhook(payload).catch(() => {
      // Silently ignore — standalone rule
    });
  });

  return updated;
}
