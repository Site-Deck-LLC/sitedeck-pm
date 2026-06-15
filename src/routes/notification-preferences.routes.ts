/**
 * notification-preferences.routes.ts — /api/v1/notifications/preferences
 * ============================================================================
 * Sprint 12 Task 8. Per-user delivery preferences. Auth-gated.
 *
 *   GET   /me            get the caller's preferences (creates with
 *                        defaults if none exist)
 *   PATCH /me            update one or more fields
 *
 * Returns 200 on success. Returns 400 if `quietStart`/`quietEnd` aren't
 * valid "HH:MM" strings (we don't want to silently accept "9pm").
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/express-auth';
import { asyncHandler } from '../lib/async-handler';
import {
  getPreferences,
  updatePreferences,
  type KindOverrideMap,
} from '../services/notification-preferences.service';

const router = Router();

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.uid || 'dev-user';
    const prefs = await getPreferences(userId);
    res.json(prefs);
  })
);

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.uid || 'dev-user';
    const body = req.body || {};

    // Validate quiet hours if provided. The PATCH should never silently
    // accept malformed strings — that produces confusing "I set 9pm
    // but my push still fired at 9pm" bug reports.
    if (body.quietStart !== undefined && !isValidHhMm(body.quietStart)) {
      res.status(400).json({
        error: { code: 'INVALID_QUIET_START', message: 'quietStart must be "HH:MM" 24h or empty' },
      });
      return;
    }
    if (body.quietEnd !== undefined && !isValidHhMm(body.quietEnd)) {
      res.status(400).json({
        error: { code: 'INVALID_QUIET_END', message: 'quietEnd must be "HH:MM" 24h or empty' },
      });
      return;
    }

    const kindOverrides =
      body.kindOverrides === null
        ? null
        : sanitizeKindOverrides(body.kindOverrides);

    const updated = await updatePreferences(userId, {
      emailEnabled: typeof body.emailEnabled === 'boolean' ? body.emailEnabled : undefined,
      pushEnabled: typeof body.pushEnabled === 'boolean' ? body.pushEnabled : undefined,
      digestEnabled: typeof body.digestEnabled === 'boolean' ? body.digestEnabled : undefined,
      quietStart: typeof body.quietStart === 'string' ? body.quietStart : undefined,
      quietEnd: typeof body.quietEnd === 'string' ? body.quietEnd : undefined,
      kindOverrides: kindOverrides === undefined ? undefined : (kindOverrides as KindOverrideMap | null),
    });
    res.json(updated);
  })
);

export default router;

function isValidHhMm(s: any): boolean {
  if (typeof s !== 'string') return false;
  if (s === '') return true;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/**
 * Strip unknown keys + non-boolean/null values from the override map.
 * The kind keys are not enumerated here so future kinds (added to
 * notifications.service.ts) flow through without a service update.
 */
function sanitizeKindOverrides(input: any): KindOverrideMap {
  if (typeof input !== 'object' || input === null) return {};
  const out: KindOverrideMap = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof k !== 'string' || k.length === 0 || k.length > 64) continue;
    if (typeof v !== 'object' || v === null) continue;
    const entry: { email?: boolean | null; push?: boolean | null } = {};
    if (typeof (v as any).email === 'boolean' || (v as any).email === null) {
      entry.email = (v as any).email;
    }
    if (typeof (v as any).push === 'boolean' || (v as any).push === null) {
      entry.push = (v as any).push;
    }
    if (entry.email !== undefined || entry.push !== undefined) {
      out[k as keyof KindOverrideMap] = entry;
    }
  }
  return out;
}
