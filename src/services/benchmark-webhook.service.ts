/**
 * Benchmark Webhook Outbound
 * ============================================================================
 * Sprint 8: when a project is created in PM, fire a `project.created`
 * webhook to the URL configured by `PM_BENCHMARK_WEBHOOK_URL` (the
 * Benchmark agent's collection endpoint at
 * https://benchmark.sitedeck.pro/api/v1/webhooks/pm).
 *
 * Contract (Benchmark side, see /app/dist/routes/webhook.routes.js in the
 * benchmark container):
 *   POST /api/v1/webhooks/pm
 *   Header: x-sitedeck-signature: sha256=<hmac(secret, body)>
 *   Body: { event, projectId, projectName, projectType,
 *           contractValue, startDate, endDate,
 *           clientName, contractorName }
 *
 * Retry 3x with exponential backoff on failure. Never blocks the project
 * creation response. Fire-and-forget — if the Benchmark receiver is down,
 * PM keeps working.
 *
 * Out of scope this sprint: replay queue, dead letter table. Those become
 * important when the Benchmark pipeline is productionized.
 * ============================================================================
 */

import { createHmac } from 'crypto';

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 2000, 8000]; // 0.5s, 2s, 8s
// Test override: in jest, replace with a 0ms backoff so the test suite
// finishes in seconds rather than tens of seconds. Set via
// process.env.PM_BENCHMARK_WEBHOOK_TEST_BACKOFF = '0' (or any truthy).
function getBackoffMs(): number[] {
  if (process.env.PM_BENCHMARK_WEBHOOK_TEST_BACKOFF) return [0, 0, 0];
  return BACKOFF_MS;
}

/**
 * The exact shape Benchmark expects. Field names are not negotiable —
 * changing them silently breaks idempotency (Benchmark identifies
 * already-seen projects by `projectId`).
 */
export interface BenchmarkProjectCreatedEvent {
  event: 'project.created';
  projectId: string;
  projectName: string;
  projectType: string | null;
  contractValue: number | null;
  startDate: string | null;
  endDate: string | null;
  clientName: string | null;
  contractorName: string | null;
  // PM-only fields, kept on the wire for traceability but unused by
  // Benchmark's handler.
  orgId: string;
  emittedAt: string;
}

export function buildProjectCreatedEvent(
  orgId: string,
  project: {
    id: string;
    name: string;
    structureType: string;
    startDate: Date | string | null;
    endDate: Date | string | null;
    city: string | null;
    state: string | null;
    createdAt: Date | string;
    contractValue?: number | null;
    clientName?: string | null;
    contractorName?: string | null;
  }
): BenchmarkProjectCreatedEvent {
  return {
    event: 'project.created',
    projectId: project.id,
    projectName: project.name,
    projectType: project.structureType,
    contractValue: project.contractValue ?? null,
    startDate: toIso(project.startDate),
    endDate: toIso(project.endDate),
    clientName: project.clientName ?? null,
    contractorName: project.contractorName ?? null,
    orgId,
    emittedAt: new Date().toISOString(),
  };
}

/**
 * Fire the webhook asynchronously. Returns immediately. Failures are
 * logged at `console.warn` so a deploy without the env var never
 * throws and never spams an error log when Benchmark is offline.
 */
export function emitProjectCreated(event: BenchmarkProjectCreatedEvent): void {
  const url = process.env.PM_BENCHMARK_WEBHOOK_URL;
  if (!url) {
    // Not configured — silent no-op.
    return;
  }
  // Schedule outside the request lifecycle.
  setImmediate(() => {
    sendWithRetry(url, event).catch((err) => {
      console.warn('[benchmark-webhook] final failure:', err?.message || err);
    });
  });
}

async function sendWithRetry(url: string, event: BenchmarkProjectCreatedEvent): Promise<void> {
  const body = JSON.stringify(event);
  const secret = process.env.PM_BENCHMARK_WEBHOOK_SECRET;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-PM-Event': event.event,
        'X-PM-Attempt': String(attempt + 1),
      };
      if (secret) {
        // Benchmark's handler reads `x-sitedeck-signature` (verified in
        // /app/dist/routes/webhook.routes.js). Keep `X-PM-Signature` too
        // for any future in-house receiver that follows the older name.
        const sig = signHmac(secret, body);
        headers['x-sitedeck-signature'] = sig;
        headers['X-PM-Signature'] = sig;
      }
      const res = await fetch(url, { method: 'POST', headers, body });
      if (res.ok) {
        return; // success
      }
      lastErr = new Error(`HTTP ${res.status} from benchmark webhook`);
    } catch (e: any) {
      lastErr = e;
    }
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, getBackoffMs()[attempt]));
    }
  }
  throw lastErr || new Error('benchmark webhook failed');
}

export function signHmac(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  // If it's already an ISO string, pass through. If it's something else, best effort.
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/* ------------------------------------------------------------------
 * Sprint 14: additional outbound event builders
 * ------------------------------------------------------------------ */

export interface ActivityReadyForInspectionEvent {
  event: 'pm.activity.ready_for_inspection';
  projectId: string;
  activityId: string;
  activityName: string;
  emittedAt: string;
}

export function buildActivityReadyForInspectionEvent(
  projectId: string,
  activityId: string,
  activityName: string
): ActivityReadyForInspectionEvent {
  return {
    event: 'pm.activity.ready_for_inspection',
    projectId,
    activityId,
    activityName,
    emittedAt: new Date().toISOString(),
  };
}

export function emitActivityReadyForInspection(event: ActivityReadyForInspectionEvent): void {
  const url = process.env.PM_BENCHMARK_WEBHOOK_URL;
  if (!url) return;
  setImmediate(() => {
    sendEvent(url, event).catch((err) => {
      console.warn('[benchmark-webhook] emitActivityReadyForInspection failed:', err?.message || err);
    });
  });
}

export interface ReworkCompleteEvent {
  event: 'pm.rework.complete';
  projectId: string;
  dfowId: string | null;
  unitReference: string | null;
  reworkTaskId: string | null;
  emittedAt: string;
}

export function buildReworkCompleteEvent(
  projectId: string,
  dfowId: string | null,
  unitReference: string | null,
  reworkTaskId: string | null
): ReworkCompleteEvent {
  return {
    event: 'pm.rework.complete',
    projectId,
    dfowId,
    unitReference,
    reworkTaskId,
    emittedAt: new Date().toISOString(),
  };
}

export function emitReworkComplete(event: ReworkCompleteEvent): void {
  const url = process.env.PM_BENCHMARK_WEBHOOK_URL;
  if (!url) return;
  setImmediate(() => {
    sendEvent(url, event).catch((err) => {
      console.warn('[benchmark-webhook] emitReworkComplete failed:', err?.message || err);
    });
  });
}

async function sendEvent(url: string, event: any): Promise<void> {
  const body = JSON.stringify(event);
  const secret = process.env.PM_BENCHMARK_WEBHOOK_SECRET;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-PM-Event': event.event,
  };
  if (secret) {
    const sig = signHmac(secret, body);
    headers['x-sitedeck-signature'] = sig;
    headers['X-PM-Signature'] = sig;
  }
  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) throw new Error(`HTTP ${res.status} from benchmark webhook`);
}
