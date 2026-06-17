import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { handleProWebhook, verifyProServiceToken } from '../services/pro-inbound.service';

const router = Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const token = req.headers['x-service-token'] as string | undefined;

    if (!verifyProServiceToken(token)) {
      res.status(401).json({
        success: false,
        action: 'ignored',
        details: 'Invalid or missing service token',
      });
      return;
    }

    const result = await handleProWebhook(req.body || {});
    res.status(200).json({ success: result.action !== 'failed', ...result });
  })
);

export default router;
