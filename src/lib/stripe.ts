import Stripe from 'stripe';

type StripeClient = InstanceType<typeof Stripe>;

let stripeInstance: StripeClient | null = null;

export function getStripeClient(): StripeClient {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(key, { apiVersion: '2026-05-27.dahlia' });
  }
  return stripeInstance;
}

export function setStripeClient(instance: StripeClient): void {
  stripeInstance = instance;
}
