/**
 * notifications.routes.ts — /api/v1/notifications
 * ============================================================================
 * Sprint 8 Task 6. Surface for the notification inbox:
 *   GET    /                list notifications for the caller
 *   GET    /unread-count    count of unread notifications (bell badge)
 *   PATCH  /:id/read        mark one notification as read
 *   POST   /mark-all-read   mark every unread notification as read
 *
 * The dev-token path returns userId 'dev-user' for everything. The
 * V1 dev experience is "show me my notifications" — the `dev-user`
 * bucket is fine for that.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/express-auth';
import { asyncHandler } from '../lib/async-handler';
import { mapServiceErrorToApiError } from '../lib/error-handler';
import {
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  NotificationNotFoundError,
} from '../services/notifications.service';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.uid || 'dev-user';
    const unreadOnly = req.query.unread === 'true';
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const rows = await listNotifications({ userId, unreadOnly, limit, cursor });
    res.json({ notifications: rows, nextCursor: rows.length === limit ? rows[rows.length - 1].id : null });
  })
);

router.get(
  '/unread-count',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.uid || 'dev-user';
    const count = await countUnreadNotifications(userId);
    res.json({ count });
  })
);

router.patch(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.uid || 'dev-user';
    try {
      const row = await markNotificationRead(req.params.id, userId);
      res.json(row);
    } catch (err: any) {
      if (err instanceof NotificationNotFoundError) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found' } });
        return;
      }
      throw mapServiceErrorToApiError(err);
    }
  })
);

router.post(
  '/mark-all-read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.uid || 'dev-user';
    const result = await markAllNotificationsRead(userId);
    res.json(result);
  })
);

export default router;
