import { getPrismaClient } from '../lib/prisma';
import { getStripeClient } from '../lib/stripe';
import { BillingAccount } from '@prisma/client';

export interface PlanConfig {
  tier: 'starter' | 'professional' | 'enterprise';
  projectLimit: number;
  modules: string[];
}

const PLANS: Record<string, PlanConfig> = {
  starter: {
    tier: 'starter',
    projectLimit: 3,
    modules: ['schedule', 'cost', 'dashboard', 'scope'],
  },
  professional: {
    tier: 'professional',
    projectLimit: Infinity,
    modules: ['*'],
  },
  enterprise: {
    tier: 'enterprise',
    projectLimit: Infinity,
    modules: ['*'],
  },
};

export async function getPlanConfig(tier: string): Promise<PlanConfig | null> {
  return PLANS[tier] || null;
}

export async function createBillingAccount(
  orgId: string,
  email: string
): Promise<BillingAccount> {
  const prisma = getPrismaClient();
  const stripe = getStripeClient();

  const customer = await stripe.customers.create({
    email,
    metadata: { orgId },
  });

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  return prisma.billingAccount.create({
    data: {
      orgId,
      stripeCustomerId: customer.id,
      planTier: 'starter',
      status: 'trialing',
      projectLimit: PLANS.starter.projectLimit,
      currentPeriodEnd: trialEnd,
    },
  });
}

export async function getBillingAccountByOrgId(
  orgId: string
): Promise<BillingAccount | null> {
  const prisma = getPrismaClient();
  return prisma.billingAccount.findUnique({ where: { orgId } });
}

export async function createCheckoutSession(
  orgId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) {
  const prisma = getPrismaClient();
  const stripe = getStripeClient();

  const account = await prisma.billingAccount.findUnique({ where: { orgId } });
  if (!account) {
    throw new Error('Billing account not found');
  }

  const session = await stripe.checkout.sessions.create({
    customer: account.stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { orgId },
    },
  });

  return session;
}

export async function getSubscriptionStatus(orgId: string) {
  const prisma = getPrismaClient();
  const account = await prisma.billingAccount.findUnique({ where: { orgId } });
  if (!account) {
    return null;
  }

  const plan = PLANS[account.planTier];
  const projectCount = await prisma.project.count({ where: { orgId } });

  return {
    orgId: account.orgId,
    status: account.status,
    planTier: account.planTier,
    projectLimit: plan?.projectLimit ?? 3,
    projectCount,
    currentPeriodEnd: account.currentPeriodEnd,
    stripeSubscriptionId: account.stripeSubscriptionId,
  };
}

export async function canCreateProject(orgId: string): Promise<boolean> {
  const prisma = getPrismaClient();
  const account = await prisma.billingAccount.findUnique({ where: { orgId } });

  if (!account) {
    return false;
  }

  if (account.status !== 'active' && account.status !== 'trialing') {
    return false;
  }

  const plan = PLANS[account.planTier];
  if (!plan) {
    return false;
  }

  if (plan.projectLimit === Infinity) {
    return true;
  }

  const projectCount = await prisma.project.count({ where: { orgId } });
  return projectCount < plan.projectLimit;
}

export async function isModuleAllowed(
  orgId: string,
  module: string
): Promise<boolean> {
  const account = await getBillingAccountByOrgId(orgId);
  if (!account) {
    return false;
  }

  if (account.status !== 'active' && account.status !== 'trialing') {
    return false;
  }

  const plan = PLANS[account.planTier];
  if (!plan) {
    return false;
  }

  if (plan.modules.includes('*')) {
    return true;
  }

  return plan.modules.includes(module.toLowerCase());
}

export async function handleCheckoutCompleted(session: any) {
  const prisma = getPrismaClient();
  const stripe = getStripeClient();

  const orgId = session.metadata?.orgId || session.subscription_data?.metadata?.orgId;
  if (!orgId) {
    throw new Error('Missing orgId in checkout session metadata');
  }

  const subscriptionId = session.subscription as string;
  const subResponse = await stripe.subscriptions.retrieve(subscriptionId);
  const subscription = subResponse as any;

  const planTier = mapPriceToTier(subscription.items.data[0]?.price.id);

  await prisma.billingAccount.update({
    where: { orgId },
    data: {
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      planTier,
      projectLimit: PLANS[planTier]?.projectLimit ?? 3,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });
}

export async function handleSubscriptionUpdated(subscription: any) {
  const prisma = getPrismaClient();
  const stripe = getStripeClient();

  const customer = await stripe.customers.retrieve(subscription.customer as string);
  const orgId =
    (customer as any).metadata?.orgId || subscription.metadata?.orgId;

  if (!orgId) {
    throw new Error('Missing orgId in subscription metadata');
  }

  const planTier = mapPriceToTier(subscription.items.data[0]?.price.id);

  await prisma.billingAccount.update({
    where: { orgId },
    data: {
      status: subscription.status,
      planTier,
      projectLimit: PLANS[planTier]?.projectLimit ?? 3,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });
}

export async function handleSubscriptionDeleted(subscription: any) {
  const prisma = getPrismaClient();
  const stripe = getStripeClient();

  const customer = await stripe.customers.retrieve(subscription.customer as string);
  const orgId =
    (customer as any).metadata?.orgId || subscription.metadata?.orgId;

  if (!orgId) {
    throw new Error('Missing orgId in subscription metadata');
  }

  await prisma.billingAccount.update({
    where: { orgId },
    data: {
      status: 'canceled',
      stripeSubscriptionId: null,
      projectLimit: 0,
    },
  });
}

function mapPriceToTier(priceId: string | undefined): string {
  const prices: Record<string, string> = {
    [process.env.STRIPE_PRICE_STARTER || '']: 'starter',
    [process.env.STRIPE_PRICE_PROFESSIONAL || '']: 'professional',
    [process.env.STRIPE_PRICE_ENTERPRISE || '']: 'enterprise',
  };

  return prices[priceId || ''] || 'starter';
}
