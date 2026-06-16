import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import {
  handleBenchmarkWebhook,
  verifyBenchmarkSignature,
  logInboundWebhookEvent,
} from '../services/benchmark-inbound.service';

const router = Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const bodyRaw = JSON.stringify(req.body);
    const signature = req.headers['x-benchmark-signature'] as string | undefined;

    if (!verifyBenchmarkSignature(bodyRaw, signature)) {
      const payload = req.body || {};
      const event = payload.event || 'benchmark.unknown';
      // STANDALONE RULE: never return non-200 on inbound webhook processing failure.
      // Signature verification failure is logged and acknowledged with 200.
      await logInboundWebhookEvent(event, 'inbound', payload, 'failed').catch(() => {
        // Logging failure must not break the webhook response.
      });
      res.status(200).json({
        success: false,
        action: 'ignored',
        details: 'Invalid or missing signature',
      });
      return;
    }

    const result = await handleBenchmarkWebhook(req.body || {});
    res.status(200).json({ success: result.action !== 'failed', ...result });
  })
);

export default router;
