/**
 * notifications.service.ts — Per-user notification inbox
 * ============================================================================
 * Sprint 8 Task 6. A thin service that the rest of the app calls when
 * a notification-worthy event happens (RFI assigned to user X, Issue
 * assigned to user X, Schedule change request requires my approval,
 * etc.). The service writes a row to the `notifications` table;
 * `GET /api/v1/notifications` reads it back.
 *
 * Standalone degradation: notification writes are best-effort. If the
 * `notifications` table is missing or the write fails, the calling
 * route must not 500 — that would mean a perfectly valid RFI
 * assignment (e.g.) got rejected because the bell isn't ready. The
 * `safe*` helpers below swallow errors and log a warning.
 * ============================================================================
 */

import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma';

export type NotificationKind =
  | 'rfi_assigned'
  | 'rfi_answered'
  | 'issue_assigned'
  | 'schedule_change_request'
  | 'co_approved'
  | 'co_rejected'
  | 'drawing_ifc_released'
  | 'schedule_risk'
  | 'system';

export interface CreateNotificationInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
}

export interface NotificationRow {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

/**
 * Write a notification row. Throws on failure — callers that need
 * best-effort delivery should use `createNotificationSafe`.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationRow> {
  const prisma = getPrismaClient();
  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      payload: input.payload
        ? (input.payload as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });
  return toRow(row);
}

/**
 * Best-effort variant: if the table is missing or the write throws,
 * the failure is logged and swallowed. The caller (an RFI route, an
 * Issue route, a schedule change-request route) continues as if
 * the notification was delivered. The V1 spec calls for never
 * blocking core features on the bell.
 */
export async function createNotificationSafe(
  input: CreateNotificationInput
): Promise<void> {
  try {
    await createNotification(input);
  } catch (err: any) {
    console.warn(
      `[notifications] failed to deliver to user=${input.userId} kind=${input.kind}: ${err?.message || err}`
    );
  }
}

export interface ListNotificationsOptions {
  userId: string;
  unreadOnly?: boolean;
  limit?: number;
  cursor?: string; // createdAt of the last row in the previous page
}

/**
 * List notifications for a user, newest first. Cursor pagination
 * by `createdAt` keeps the query stable as rows are inserted.
 */
export async function listNotifications(
  opts: ListNotificationsOptions
): Promise<NotificationRow[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.notification.findMany({
    where: {
      userId: opts.userId,
      ...(opts.unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: opts.limit ?? 50,
    ...(opts.cursor
      ? { cursor: { id: opts.cursor }, skip: 1 }
      : {}),
  });
  return rows.map(toRow);
}

/**
 * Count unread notifications for a user. Used by the bell icon to
 * render the badge. Returns 0 on error so the bell never shows a
 * broken state.
 */
export async function countUnreadNotifications(userId: string): Promise<number> {
  try {
    const prisma = getPrismaClient();
    return await prisma.notification.count({
      where: { userId, read: false },
    });
  } catch {
    return 0;
  }
}

/**
 * Mark a single notification as read. Throws `not_found` when the
 * row doesn't exist or doesn't belong to the caller. We don't
 * silently swallow the not-found case — the frontend may have
 * stale state and a 404 is the right signal.
 */
export class NotificationNotFoundError extends Error {
  constructor() {
    super('Notification not found');
  }
}

export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<NotificationRow> {
  const prisma = getPrismaClient();
  try {
    const row = await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() },
    });
    if (row.userId !== userId) {
      throw new NotificationNotFoundError();
    }
    return toRow(row);
  } catch (err: any) {
    if (err?.code === 'P2025') {
      throw new NotificationNotFoundError();
    }
    throw err;
  }
}

/**
 * Mark all unread notifications for the user as read. Used when
 * the user opens the bell and clicks "Mark all read".
 */
export async function markAllNotificationsRead(userId: string): Promise<{ updated: number }> {
  const prisma = getPrismaClient();
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
  return { updated: result.count };
}

// ─── helpers ─────────────────────────────────────────────────────────

function toRow(row: {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string | null;
  payload: unknown;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}): NotificationRow {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    title: row.title,
    body: row.body,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    read: row.read,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

// Test-only helper — clear the test database's notifications.
export function __resetNotificationsForTests() {
  // No in-process state to clear. Provided for symmetry with
  // other services' test helpers.
}
