/**
 * Push Notification Service (FCM)
 * ============================================================================
 * Sprint 9 Task 3. Wire Firebase Cloud Messaging for real-time push
 * notifications. V1: critical alerts only. The system calls
 * `sendPushNotification(userId, ...)` after writing a row to the
 * `notifications` table; if the user has any FCM tokens registered,
 * each token gets a separate send. Invalid tokens (404 from FCM)
 * are removed from the DB so the next call doesn't re-fail.
 *
 * Standalone degradation: this service NEVER throws. If firebase-admin
 * is missing, no tokens are registered, or FCM returns 5xx, the
 * notification write still succeeds; the push is the cherry on top.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { getPreferences, shouldDeliver } from './notification-preferences.service';

let firebaseAdmin: any = null;
function getFirebaseAdmin() {
  if (firebaseAdmin !== null) return firebaseAdmin;
  try {
    // Lazy require so a missing firebase-admin doesn't crash boot
    // in environments that never send push (dev / CI).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    firebaseAdmin = require('firebase-admin');
    if (firebaseAdmin.apps && firebaseAdmin.apps.length === 0) {
      try {
        firebaseAdmin.initializeApp({});
      } catch {
        // already initialized or no creds
      }
    }
  } catch {
    firebaseAdmin = false;
  }
  return firebaseAdmin || null;
}

export type FcmPlatform = 'web' | 'ios' | 'android';

export interface SaveFcmTokenInput {
  userId: string;
  token: string;
  platform: FcmPlatform;
}

export async function saveFcmToken(input: SaveFcmTokenInput): Promise<{ id: string }> {
  const prisma = getPrismaClient();
  const existing = await prisma.fcmToken.findUnique({
    where: { userId_platform: { userId: input.userId, platform: input.platform } },
  });
  if (existing) {
    await prisma.fcmToken.update({
      where: { id: existing.id },
      data: { token: input.token, updatedAt: new Date() },
    });
    return { id: existing.id };
  }
  const created = await prisma.fcmToken.create({
    data: {
      userId: input.userId,
      token: input.token,
      platform: input.platform,
    },
  });
  return { id: created.id };
}

export async function removeFcmToken(userId: string, platform: FcmPlatform): Promise<{ removed: boolean }> {
  const prisma = getPrismaClient();
  const existing = await prisma.fcmToken.findUnique({
    where: { userId_platform: { userId, platform } },
  });
  if (!existing) return { removed: false };
  await prisma.fcmToken.delete({ where: { id: existing.id } });
  return { removed: true };
}

export interface SendPushInput {
  userId: string;
  title: string;
  body?: string;
  data?: Record<string, string>;
  actionUrl?: string;
  kind?: import('./notifications.service').NotificationKind;
}

export interface SendPushResult {
  attempted: number;
  sent: number;
  failed: number;
  staleTokensRemoved: number;
  noTokens: boolean;
}

/**
 * Fire-and-forget push to every FCM token registered for a user.
 * Always returns a SendPushResult; never throws.
 */
export async function sendPushNotification(input: SendPushInput): Promise<SendPushResult> {
  const result: SendPushResult = { attempted: 0, sent: 0, failed: 0, staleTokensRemoved: 0, noTokens: true };

  // Sprint 14: respect notification preferences before sending push
  try {
    const prefs = await getPreferences(input.userId);
    const kind = input.kind || 'system';
    if (!shouldDeliver(prefs, kind, 'push')) {
      return result;
    }
  } catch {
    // If preferences lookup fails, continue with best-effort send
  }

  let tokens: { id: string; token: string; platform: string }[] = [];
  try {
    const prisma = getPrismaClient();
    tokens = await prisma.fcmToken.findMany({ where: { userId: input.userId } });
  } catch (err) {
    console.warn('[push] token lookup failed:', (err as any)?.message);
    return result;
  }
  if (tokens.length === 0) return result;
  result.noTokens = false;
  result.attempted = tokens.length;

  const admin = getFirebaseAdmin();
  if (!admin?.messaging) {
    // firebase-admin not installed / not configured
    return result;
  }

  const data: Record<string, string> = { ...(input.data || {}) };
  if (input.actionUrl) data.actionUrl = input.actionUrl;

  for (const t of tokens) {
    try {
      await admin.messaging().send({
        token: t.token,
        notification: { title: input.title, body: input.body },
        data,
        webpush: {
          notification: { icon: '/favicon.ico' },
        },
      });
      result.sent += 1;
    } catch (err: any) {
      result.failed += 1;
      const code = err?.code || err?.errorInfo?.code || '';
      // Stale token: 404 / registration-token-not-registered / invalid-registration-token
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        /not.?registered|invalid.?registration|404/i.test(err?.message || '')
      ) {
        try {
          await getPrismaClient().fcmToken.delete({ where: { id: t.id } });
          result.staleTokensRemoved += 1;
        } catch {
          // best-effort
        }
      }
    }
  }
  return result;
}

export interface SendToProjectMembersInput {
  projectId: string;
  title: string;
  body?: string;
  data?: Record<string, string>;
  actionUrl?: string;
  excludeUserId?: string;
}

/**
 * Best-effort fan-out to every project member. V1: we don't yet
 * have a project_members query path in V1; we read what we can
 * from notifications + FCM tokens. The current implementation
 * sends to anyone with a registered FCM token, which is the
 * fire-and-forget V1 behavior. A real membership table is built
 * in Sprint 10 Task 6.
 */
export async function sendToProjectMembers(
  input: SendToProjectMembersInput
): Promise<{ sent: number; failed: number }> {
  let userIds: string[] = [];
  try {
    const prisma = getPrismaClient();
    const rows = await prisma.fcmToken.findMany({
      distinct: ['userId'],
      select: { userId: true },
    });
    userIds = Array.from(new Set(rows.map((r) => r.userId))).filter((id) => id !== input.excludeUserId);
  } catch {
    return { sent: 0, failed: 0 };
  }
  let sent = 0;
  let failed = 0;
  for (const userId of userIds) {
    const r = await sendPushNotification({
      userId,
      title: input.title,
      body: input.body,
      data: input.data,
      actionUrl: input.actionUrl,
    });
    sent += r.sent;
    failed += r.failed;
  }
  return { sent, failed };
}
