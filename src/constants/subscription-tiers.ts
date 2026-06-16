/**
 * Subscription Tier Constants
 * ============================================================================
 * Centralized plan definitions. The runtime config (PLANS map) lives here so
 * services and middleware don't reach into billing.service.ts for the
 * canonical list of tiers, limits, and module gates.
 *
 * To add a new tier:
 *   1. Add a PlanTierId to the union.
 *   2. Add the entry to PLAN_LIST.
 *   3. Add the matching Stripe price id to STRIPE_PRICE_<NAME> env var.
 *
 * Module identifiers (the strings in `modules`) must match what code passes
 * to `requireModuleAccess()`. Convention is lowercase module name.
 * ============================================================================
 */

export type PlanTierId = 'starter' | 'professional' | 'enterprise';

export interface PlanDefinition {
  id: PlanTierId;
  displayName: string;
  /** Maximum number of projects this tier allows. `Infinity` = unlimited. */
  projectLimit: number;
  /** USD price per month, used for UI. Stripe is the source of truth. */
  priceUsdMonthly: number;
  /** Module identifiers this tier can access. `['*']` = all modules. */
  modules: string[];
  /** Feature flags this tier has access to. Empty = none. */
  features: string[];
}

export const PLAN_LIST: readonly PlanDefinition[] = [
  {
    id: 'starter',
    displayName: 'Starter',
    projectLimit: 3,
    priceUsdMonthly: 99,
    modules: ['schedule', 'cost', 'dashboard', 'scope'],
    features: [],
  },
  {
    id: 'professional',
    displayName: 'Professional',
    projectLimit: Infinity,
    priceUsdMonthly: 299,
    modules: ['*'],
    features: ['ai_morning_brief', 'wbs_builder', 'rfi_draft_agent', 'whatif_analysis'],
  },
  {
    id: 'enterprise',
    displayName: 'Enterprise',
    projectLimit: Infinity,
    priceUsdMonthly: 0, // Custom
    modules: ['*'],
    features: [
      'ai_morning_brief',
      'wbs_builder',
      'rfi_draft_agent',
      'whatif_analysis',
      'compliance_alerts',
      'sso',
      'audit_log',
    ],
  },
] as const;

const PLANS_BY_ID: Record<PlanTierId, PlanDefinition> = PLAN_LIST.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<PlanTierId, PlanDefinition>
);

export function getPlan(tier: string | null | undefined): PlanDefinition | null {
  if (!tier) return null;
  return (PLANS_BY_ID as Record<string, PlanDefinition>)[tier.toLowerCase()] || null;
}

export function isModuleInPlan(tier: string | null | undefined, moduleId: string): boolean {
  const plan = getPlan(tier);
  if (!plan) return false;
  if (plan.modules.includes('*')) return true;
  return plan.modules.includes(moduleId.toLowerCase());
}

export function isFeatureInPlan(tier: string | null | undefined, featureId: string): boolean {
  const plan = getPlan(tier);
  if (!plan) return false;
  return plan.features.includes(featureId);
}

/**
 * Stripe price id -> tier. Configured via env. Falls back to "starter" when
 * the price id is missing so an unconfigured deployment doesn't accidentally
 * promote users.
 */
export function tierForStripePrice(priceId: string | null | undefined): PlanTierId {
  if (!priceId) return 'starter';
  const prices: Record<string, PlanTierId> = {
    [process.env.STRIPE_PRICE_STARTER || '']: 'starter',
    [process.env.STRIPE_PRICE_PROFESSIONAL || '']: 'professional',
    [process.env.STRIPE_PRICE_ENTERPRISE || '']: 'enterprise',
  };
  return prices[priceId] || 'starter';
}
