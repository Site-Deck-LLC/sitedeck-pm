/**
 * Push Notification Routes (FCM)
 * ============================================================================
 * Sprint 9 Task 3. Per-user FCM token registration. Tokens are
 * upserted per (userId, platform) so the same user can have
 * a web, iOS, and Android token at once.
 *
 *   POST   /api/v1/users/fcm-token
 *   DELETE /api/v1/users/fcm-token/:platform
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/express-auth';
import { asyncHandler } from '../lib/async-handler';
import * as push from '../services/push-notification.service';

const router = Router();

router.post(
  '/fcm-token',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token, platform } = req.body || {};
    if (!token || !platform) {
      res.status(400).json({ error: 'token and platform are required' });
      return;
    }
    if (!['web', 'ios', 'android'].includes(platform)) {
      res.status(400).json({ error: 'platform must be web, ios, or android' });
      return;
    }
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const result = await push.saveFcmToken({
      userId,
      token,
      platform,
    });
    res.json(result);
  })
);

router.delete(
  '/fcm-token/:platform',
  requireAuth,
  asyncHandler(async (req, res) => {
    const platform = req.params.platform as push.FcmPlatform;
    if (!['web', 'ios', 'android'].includes(platform)) {
      res.status(400).json({ error: 'platform must be web, ios, or android' });
      return;
    }
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const result = await push.removeFcmToken(userId, platform);
    res.json(result);
  })
);

export default router;
