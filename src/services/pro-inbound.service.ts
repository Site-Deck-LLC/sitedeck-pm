/**
 * Pro Inbound Webhook Handler
 * ============================================================================
 * Receives events from SiteDeck Pro Firebase Functions. All handlers are
 * idempotent, fire-and-forget safe, and never throw back to the HTTP layer.
 * Unknown events are logged and acknowledged with 200.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import {
  createNotificationSafe,
} from './notifications.service';
import {
  sendPushNotification,
} from './push-notification.service';
import {
  getUserClaims,
  setUserProjectClaims,
} from './auth.service';
import type { Role } from '../constants/roles';

export interface ProWebhookPayload {
  event?: string;
  eventId?: string;
  referenceId?: string;
  projectId?: string;
  pmProjectId?: string;
  pmActivityId?: string;
  taskId?: string;
  status?: string;
  percentComplete?: number;
  dfowId?: string;
  unitReference?: string;
  ncrId?: string;
  ncrNumber?: string;
  description?: string;
  holdPointId?: string;
  uid?: string;
  email?: string;
  name?: string;
  orgId?: string;
  role?: string;
  projectIds?: string[];
  severity?: string;
  occurredAt?: string;
  [key: string]: unknown;
}

const PRO_EVENTS = {
  WORK_COMPLETE: 'pro.work.complete',
  REWORK_COMPLETE: 'pro.rework.complete',
  DAILY_REPORT_SUBMITTED: 'pro.daily_report_submitted',
  SAFETY_INCIDENT: 'pro.safety_incident',
  USER_APPROVED: 'pro.user.approved',
} as const;

/**
 * Verify X-Service-Token against PRO_SERVICE_TOKEN.
 */
export function verifyProServiceToken(token: string | undefined): boolean {
  const expected = process.env.PRO_SERVICE_TOKEN;
  if (!expected) {
    return process.env.NODE_ENV !== 'production';
  }
  if (!token) return false;
  // Timing-safe comparison not strictly needed for opaque tokens,
  // but good practice.
  if (token.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
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

async function logInboundWebhookEvent(
  event: string,
  payload: Record<string, unknown>,
  status: string
) {
  const prisma = getPrismaClient();
  return prisma.webhooksLog.create({
    data: {
      event,
      direction: 'inbound',
      payload: payload as unknown as Prisma.InputJsonValue,
      status,
    },
  });
}

export interface ProWebhookResult {
  action: string;
  details?: string;
}

/**
 * Main dispatch. Never throws; every path returns 200 to Pro.
 */
export async function handleProWebhook(
  payload: ProWebhookPayload
): Promise<ProWebhookResult> {
  const event = payload.event || 'pro.unknown';

  try {
    if (await isDuplicateEvent(event, payload as Record<string, unknown>)) {
      await logInboundWebhookEvent(event, payload as Record<string, unknown>, 'duplicate');
      return { action: 'duplicate', details: 'Event already processed' };
    }

    switch (event) {
      case PRO_EVENTS.WORK_COMPLETE:
        return await handleWorkComplete(payload);
      case PRO_EVENTS.REWORK_COMPLETE:
        return await handleReworkComplete(payload);
      case PRO_EVENTS.DAILY_REPORT_SUBMITTED:
        return await handleDailyReportSubmitted(payload);
      case PRO_EVENTS.SAFETY_INCIDENT:
        return await handleSafetyIncident(payload);
      case PRO_EVENTS.USER_APPROVED:
        return await handleUserApproved(payload);
      default:
        await logInboundWebhookEvent(event, payload as Record<string, unknown>, 'processed');
        return { action: 'logged_only', details: `Unknown event: ${event}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logInboundWebhookEvent(event, payload as Record<string, unknown>, 'failed');
    return { action: 'failed', details: message };
  }
}

/* ------------------------------------------------------------------
 * Individual handlers
 * ------------------------------------------------------------------ */

async function handleWorkComplete(payload: ProWebhookPayload): Promise<ProWebhookResult> {
  const projectId = payload.pmProjectId || payload.projectId;
  const activityId = payload.pmActivityId;

  if (!projectId || !activityId) {
    await logInboundWebhookEvent(PRO_EVENTS.WORK_COMPLETE, payload as Record<string, unknown>, 'ignored');
    return { action: 'ignored', details: 'Missing projectId or pmActivityId' };
  }

  const prisma = getPrismaClient();

  // Update activity status to complete (Pro's work_complete maps to PM's complete)
  const activity = await prisma.scheduleActivity.findUnique({
    where: { id: activityId },
  });

  if (!activity) {
    await logInboundWebhookEvent(PRO_EVENTS.WORK_COMPLETE, payload as Record<string, unknown>, 'ignored');
    return { action: 'ignored', details: `Activity ${activityId} not found` };
  }

  await prisma.scheduleActivity.update({
    where: { id: activityId },
    data: { status: 'complete' },
  });

  // Fire pm.activity.ready_for_inspection to Benchmark (fire-and-forget)
  setImmediate(() => {
    const { buildActivityReadyForInspectionEvent, emitActivityReadyForInspection } =
      require('./benchmark-webhook.service');
    emitActivityReadyForInspection(
      buildActivityReadyForInspectionEvent(projectId, activityId, activity.name)
    );
  });

  await logInboundWebhookEvent(PRO_EVENTS.WORK_COMPLETE, payload as Record<string, unknown>, 'processed');
  return { action: 'activity_updated', details: `Activity ${activityId} marked complete, Benchmark notified` };
}

async function handleReworkComplete(payload: ProWebhookPayload): Promise<ProWebhookResult> {
  const projectId = payload.pmProjectId || payload.projectId;
  const ncrId = payload.ncrId;
  const dfowId = payload.dfowId;

  if (!projectId) {
    await logInboundWebhookEvent(PRO_EVENTS.REWORK_COMPLETE, payload as Record<string, unknown>, 'ignored');
    return { action: 'ignored', details: 'Missing projectId' };
  }

  const prisma = getPrismaClient();

  // Find matching ReworkTask by ncrId or dfowId
  const where: any = { projectId };
  if (ncrId) where.ncrId = ncrId;
  else if (dfowId) where.dfowId = dfowId;
  else {
    await logInboundWebhookEvent(PRO_EVENTS.REWORK_COMPLETE, payload as Record<string, unknown>, 'ignored');
    return { action: 'ignored', details: 'Missing ncrId or dfowId' };
  }

  const task = await prisma.reworkTask.findFirst({ where });

  if (task) {
    await prisma.reworkTask.update({
      where: { id: task.id },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
  }

  // Fire pm.rework.complete to Benchmark (fire-and-forget)
  setImmediate(() => {
    const { buildReworkCompleteEvent, emitReworkComplete } =
      require('./benchmark-webhook.service');
    emitReworkComplete(
      buildReworkCompleteEvent(projectId, dfowId || null, payload.unitReference || null, task?.id || null)
    );
  });

  await logInboundWebhookEvent(PRO_EVENTS.REWORK_COMPLETE, payload as Record<string, unknown>, 'processed');
  return {
    action: 'rework_task_resolved',
    details: task ? `ReworkTask ${task.id} resolved, Benchmark notified` : 'No matching ReworkTask, Benchmark notified',
  };
}

async function handleDailyReportSubmitted(payload: ProWebhookPayload): Promise<ProWebhookResult> {
  const projectId = payload.pmProjectId || payload.projectId;
  const activityId = payload.pmActivityId;
  const percentComplete = payload.percentComplete;

  if (!projectId) {
    await logInboundWebhookEvent(PRO_EVENTS.DAILY_REPORT_SUBMITTED, payload as Record<string, unknown>, 'ignored');
    return { action: 'ignored', details: 'Missing projectId' };
  }

  const prisma = getPrismaClient();

  if (activityId && typeof percentComplete === 'number') {
    await prisma.scheduleActivity.update({
      where: { id: activityId },
      data: { percentComplete: Math.min(100, Math.max(0, percentComplete)) },
    });
  }

  // TODO: flag schedule risk if activity is behind baseline
  // This requires baseline comparison; simplified for Sprint 14.
  // The daily_report_submitted event primarily updates % complete.

  await logInboundWebhookEvent(PRO_EVENTS.DAILY_REPORT_SUBMITTED, payload as Record<string, unknown>, 'processed');
  return { action: 'activity_updated', details: 'Percent complete updated' };
}

async function handleSafetyIncident(payload: ProWebhookPayload): Promise<ProWebhookResult> {
  const projectId = payload.pmProjectId || payload.projectId;
  if (!projectId) {
    await logInboundWebhookEvent(PRO_EVENTS.SAFETY_INCIDENT, payload as Record<string, unknown>, 'ignored');
    return { action: 'ignored', details: 'Missing projectId' };
  }

  const prisma = getPrismaClient();

  // Compound risk detection: create a risk item
  const severity = (payload.severity || 'medium') as string;
  const severityScore: Record<string, number> = { low: 1, medium: 2, high: 4, critical: 6 };
  const impactScore = severityScore[severity.toLowerCase()] || 2;
  const probabilityScore = 4; // incident already happened
  const score = impactScore * probabilityScore;

  await prisma.riskItem.create({
    data: {
      projectId,
      description: payload.description || 'Safety incident reported from Pro',
      category: 'safety',
      probability: 'certain',
      impact: severity,
      score,
      owner: 'system',
      status: 'open',
      source: 'pro',
      incidentReference: payload.referenceId || null,
    },
  });

  // Notify project manager via FCM
  // Find project managers for this project
  const projectManagers = await prisma.projectMember.findMany({
    where: { projectId, role: 'project_manager' },
  });

  for (const pm of projectManagers) {
    await createNotificationSafe({
      userId: pm.userId,
      kind: 'schedule_risk',
      title: 'Safety incident reported',
      body: payload.description || 'A safety incident was reported from the field.',
      payload: { projectId, severity, source: 'pro' },
    });
    // Best-effort FCM push
    setImmediate(() => {
      sendPushNotification({
        userId: pm.userId,
        title: 'Safety Incident',
        body: payload.description || 'A safety incident was reported from the field.',
        actionUrl: `/projects/${projectId}/risk`,
      }).catch(() => {
        // FCM failures are swallowed
      });
    });
  }

  await logInboundWebhookEvent(PRO_EVENTS.SAFETY_INCIDENT, payload as Record<string, unknown>, 'processed');
  return { action: 'risk_created', details: `Risk item created (score ${score}), PMs notified` };
}

async function handleUserApproved(payload: ProWebhookPayload): Promise<ProWebhookResult> {
  const uid = payload.uid;
  const email = payload.email;
  const orgId = payload.orgId;
  const role = payload.role;
  const projectIds = payload.projectIds || [];

  if (!uid || !email || !orgId) {
    await logInboundWebhookEvent(PRO_EVENTS.USER_APPROVED, payload as Record<string, unknown>, 'ignored');
    return { action: 'ignored', details: 'Missing uid, email, or orgId' };
  }

  const prisma = getPrismaClient();
  const pmRole = mapProRole(role) as Role;

  // Upsert organization membership
  const existingOrgMember = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId, userId: uid } },
  });
  if (existingOrgMember) {
    await prisma.organizationMember.update({
      where: { id: existingOrgMember.id },
      data: {
        email,
        displayName: payload.name || email.split('@')[0],
        role: pmRole,
        status: 'active',
      },
    });
  } else {
    await prisma.organizationMember.create({
      data: {
        orgId,
        userId: uid,
        email,
        displayName: payload.name || email.split('@')[0],
        role: pmRole,
        status: 'active',
        invitedBy: 'pro-webhook',
      },
    });
  }

  // Upsert project memberships
  for (const projectId of projectIds) {
    const existingMember = await prisma.projectMember.findFirst({
      where: { projectId, userId: uid },
    });
    if (!existingMember) {
      await prisma.projectMember.create({
        data: {
          projectId,
          userId: uid,
          email,
          displayName: payload.name || email.split('@')[0],
          role: pmRole,
          addedBy: 'pro-webhook',
          status: 'active',
        },
      });
    }
  }

  // Set Firebase custom claims
  const currentClaims = await getUserClaims(uid);
  const mergedProjectIds = Array.from(new Set([...(currentClaims?.projectIds || []), ...projectIds]));
  try {
    await setUserProjectClaims(uid, {
      role: pmRole,
      orgId,
      projectIds: mergedProjectIds,
    });
  } catch (err) {
    console.warn('[pro-inbound] setUserProjectClaims failed:', err);
  }

  // Fire auth.user.approved to Benchmark (fire-and-forget)
  setImmediate(() => {
    emitAuthUserApproved(uid, email, payload.name || null, orgId, pmRole, projectIds).catch((err) => {
      console.warn('[pro-inbound] emitAuthUserApproved failed:', err?.message || err);
    });
  });

  await logInboundWebhookEvent(PRO_EVENTS.USER_APPROVED, payload as Record<string, unknown>, 'processed');
  return { action: 'user_upserted', details: `User ${uid} upserted in PM, claims set` };
}

function mapProRole(proRole?: string): string {
  const r = (proRole || '').toLowerCase();
  if (r === 'admin') return 'project_manager';
  if (r === 'project_manager') return 'project_manager';
  if (r === 'superintendent') return 'superintendent';
  if (r === 'supervisor') return 'supervisor';
  if (r === 'field_crew') return 'field_crew';
  return 'field_crew';
}

/* ------------------------------------------------------------------
 * Outbound emitters to Benchmark
 * ------------------------------------------------------------------ */

async function emitAuthUserApproved(
  uid: string,
  email: string,
  name: string | null,
  orgId: string,
  role: string,
  projectIds: string[]
): Promise<void> {
  const url = process.env.PM_BENCHMARK_WEBHOOK_URL;
  if (!url) return;

  // Import signHmac directly to avoid circular deps
  const { createHmac } = await import('crypto');
  function sign(secret: string, body: string): string {
    return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  }

  const event = {
    event: 'auth.user.approved',
    uid,
    email,
    name,
    orgId,
    role,
    projectIds,
    emittedAt: new Date().toISOString(),
  };

  const body = JSON.stringify(event);
  const secret = process.env.PM_BENCHMARK_WEBHOOK_SECRET;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-PM-Event': event.event,
  };
  if (secret) {
    const sig = sign(secret, body);
    headers['x-sitedeck-signature'] = sig;
    headers['X-PM-Signature'] = sig;
  }

  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) throw new Error(`HTTP ${res.status} from benchmark webhook`);
}
