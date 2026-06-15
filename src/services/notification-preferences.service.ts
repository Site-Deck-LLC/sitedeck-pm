/**
 * notification-preferences.service.ts — Per-user delivery preferences
 * ============================================================================
 * Sprint 12 Task 8. Lets each user decide which notification kinds
 * land in their inbox (always), email, or push. The in-app channel is
 * always on — the bell is a core product surface. Email and push are
 * opt-in per kind, with global toggles for "all email off" / "all push
 * off" / "send me a daily digest instead of live pushes".
 *
 * The service does NOT itself deliver notifications; it answers
 * `shouldDeliver(userId, kind, channel)` so callers (the existing
 * RFI/Issue/CO/Drawing services) can decide whether to fan out.
 * Backward compatibility: callers that don't check preferences still
 * get the in-app row. They only get extra fan-out when they ask
 * `shouldDeliver(...)` and respect the answer.
 *
 * Defaults (applied on first read for a user with no row):
 *   - emailEnabled = true
 *   - pushEnabled  = false
 *   - digestEnabled = false
 *   - Per-kind: email on for transactional kinds
 *     (co_approved, co_rejected, drawing_ifc_released, rfi_assigned,
 *     rfi_answered, issue_assigned). Push on for the same set.
 *     Schedule/safety/system kinds: off by default.
 * ============================================================================
 */

import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma';
import type { NotificationKind } from './notifications.service';

export type DeliveryChannel = 'inapp' | 'email' | 'push';

/**
 * Per-kind channel override. Absent key falls back to defaults.
 * Values are booleans; null/undefined = "use default for this channel".
 */
export type KindOverrideMap = Partial<Record<NotificationKind, {
  email?: boolean | null;
  push?: boolean | null;
}>>;

export interface NotificationPreferencesRow {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  digestEnabled: boolean;
  quietStart: string; // "HH:MM" 24h, or '' for no quiet hours
  quietEnd: string;
  kindOverrides: KindOverrideMap;
  updatedAt: string;
  createdAt: string;
}

// Transactional kinds default-on for email + push. Schedule/safety/
// system default off — too noisy for most users.
const TRANSACTIONAL_KINDS: ReadonlyArray<NotificationKind> = [
  'co_approved',
  'co_rejected',
  'drawing_ifc_released',
  'rfi_assigned',
  'rfi_answered',
  'issue_assigned',
];

function defaultEmailOnForKind(kind: NotificationKind): boolean {
  return TRANSACTIONAL_KINDS.includes(kind);
}

function defaultPushOnForKind(kind: NotificationKind): boolean {
  // Push is more intrusive. Match transactional kinds but skip RFI
  // answers (the answerer is usually the assigned party, who'll
  // already see it in-app within minutes).
  return kind === 'co_approved'
    || kind === 'co_rejected'
    || kind === 'drawing_ifc_released'
    || kind === 'issue_assigned';
}

/**
 * Returns the user's preference row, creating one with defaults if
 * the user has never saved a preference. Always returns a value.
 */
export async function getOrCreatePreferences(
  userId: string
): Promise<NotificationPreferencesRow> {
  const prisma = getPrismaClient();
  let row = await prisma.notificationPreferences.findUnique({
    where: { userId },
  });
  if (!row) {
    row = await prisma.notificationPreferences.create({
      data: {
        userId,
        emailEnabled: true,
        pushEnabled: false,
        digestEnabled: false,
        quietStart: '',
        quietEnd: '',
        kindOverrides: Prisma.JsonNull,
      },
    });
  }
  return toRow(row);
}

export async function getPreferences(
  userId: string
): Promise<NotificationPreferencesRow> {
  return getOrCreatePreferences(userId);
}

export interface UpdatePreferencesInput {
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  digestEnabled?: boolean;
  quietStart?: string;
  quietEnd?: string;
  kindOverrides?: KindOverrideMap | null;
}

export async function updatePreferences(
  userId: string,
  input: UpdatePreferencesInput
): Promise<NotificationPreferencesRow> {
  const prisma = getPrismaClient();
  // Ensure the row exists so the update doesn't 404 for first-time users.
  await getOrCreatePreferences(userId);
  const data: Prisma.NotificationPreferencesUpdateInput = {};
  if (typeof input.emailEnabled === 'boolean') data.emailEnabled = input.emailEnabled;
  if (typeof input.pushEnabled === 'boolean') data.pushEnabled = input.pushEnabled;
  if (typeof input.digestEnabled === 'boolean') data.digestEnabled = input.digestEnabled;
  if (typeof input.quietStart === 'string') data.quietStart = input.quietStart;
  if (typeof input.quietEnd === 'string') data.quietEnd = input.quietEnd;
  if (input.kindOverrides !== undefined) {
    data.kindOverrides =
      input.kindOverrides === null
        ? Prisma.JsonNull
        : (input.kindOverrides as Prisma.InputJsonValue);
  }
  const row = await prisma.notificationPreferences.update({
    where: { userId },
    data,
  });
  return toRow(row);
}

/**
 * Should this notification be delivered to the given channel?
 * Callers (RFI/Issue/CO/Drawing services) gate their email/push
 * fan-out on this. In-app delivery is unaffected — that's a
 * separate code path that always writes the row.
 */
export function shouldDeliver(
  prefs: NotificationPreferencesRow,
  kind: NotificationKind,
  channel: DeliveryChannel
): boolean {
  if (channel === 'inapp') return true; // bell is always on
  const overrides = prefs.kindOverrides?.[kind];
  if (channel === 'email') {
    if (!prefs.emailEnabled) return false;
    if (overrides && overrides.email !== undefined && overrides.email !== null) {
      return overrides.email;
    }
    return defaultEmailOnForKind(kind);
  }
  // channel === 'push'
  if (!prefs.pushEnabled) return false;
  if (overrides && overrides.push !== undefined && overrides.push !== null) {
    return overrides.push;
  }
  return defaultPushOnForKind(kind);
}

/**
 * Is the current time inside the user's quiet hours window?
 * Returns false when quiet hours are disabled (empty string).
 * Crosses midnight if quietStart > quietEnd (e.g. 22:00 → 07:00).
 */
export function isInQuietHours(
  prefs: NotificationPreferencesRow,
  now: Date = new Date()
): boolean {
  if (!prefs.quietStart || !prefs.quietEnd) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = parseHhMm(prefs.quietStart);
  const end = parseHhMm(prefs.quietEnd);
  if (start === null || end === null) return false;
  if (start === end) return false;
  if (start < end) {
    return minutes >= start && minutes < end;
  }
  // Crosses midnight (e.g. 22:00 → 07:00): quiet when minutes >= start
  // OR minutes < end.
  return minutes >= start || minutes < end;
}

function parseHhMm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

// ─── helpers ─────────────────────────────────────────────────────────

function toRow(row: {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  digestEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  kindOverrides: unknown;
  updatedAt: Date;
  createdAt: Date;
}): NotificationPreferencesRow {
  return {
    userId: row.userId,
    emailEnabled: row.emailEnabled,
    pushEnabled: row.pushEnabled,
    digestEnabled: row.digestEnabled,
    quietStart: row.quietStart,
    quietEnd: row.quietEnd,
    kindOverrides: (row.kindOverrides as KindOverrideMap | null) ?? {},
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
