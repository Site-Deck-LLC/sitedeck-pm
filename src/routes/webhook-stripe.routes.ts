import { Router } from 'express';
import { getStripeClient } from '../lib/stripe';
import * as billingService from '../services/billing.service';

const router = Router();

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    res.status(500).json({ error: { code: 'WEBHOOK_SECRET_MISSING', message: 'Stripe webhook secret not configured' } });
    return;
  }

  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(req.body, sig, secret);
  } catch (err: any) {
    res.status(400).json({ error: { code: 'WEBHOOK_SIGNATURE_INVALID', message: err.message } });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await billingService.handleCheckoutCompleted(event.data.object);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const subId = invoice.subscription;
        if (subId) {
          await billingService.handleSubscriptionUpdated({
            id: subId,
            customer: invoice.customer,
            status: 'active',
            items: { data: [] },
            current_period_end: invoice.period_end,
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        await billingService.handleSubscriptionUpdated(event.data.object);
        break;
      }
      case 'customer.subscription.deleted': {
        await billingService.handleSubscriptionDeleted(event.data.object);
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Stripe webhook handler error:', err);
    res.status(500).json({ error: { code: 'WEBHOOK_HANDLER_ERROR', message: err.message } });
  }
});

export default router;
