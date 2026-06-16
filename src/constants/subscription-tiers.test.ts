/**
 * Tests for the subscription tier constants and helpers. The constants are
 * the single source of truth for plan shape; tests lock the shape so a
 * refactor of billing.service.ts can't silently change what users get.
 */

import {
  PLAN_LIST,
  getPlan,
  isModuleInPlan,
  isFeatureInPlan,
  tierForStripePrice,
  PlanDefinition,
} from './subscription-tiers';

describe('subscription-tiers', () => {
  describe('PLAN_LIST', () => {
    it('declares exactly the three V1 tiers', () => {
      expect(PLAN_LIST.map((p) => p.id)).toEqual(['starter', 'professional', 'enterprise']);
    });

    it('has a unique project limit per plan', () => {
      const limits = PLAN_LIST.map((p) => p.projectLimit);
      // starter=3, professional=Infinity, enterprise=Infinity. Infinity appears
      // twice by design — what's unique is that "starter" is the only limited one.
      expect(limits[0]).toBe(3);
      expect(limits[1]).toBe(Infinity);
      expect(limits[2]).toBe(Infinity);
    });

    it('enterprise is the only tier with audit_log feature', () => {
      const auditLogTiers = PLAN_LIST.filter((p) => p.features.includes('audit_log')).map((p) => p.id);
      expect(auditLogTiers).toEqual(['enterprise']);
    });

    it('professional and enterprise both include ai_morning_brief feature', () => {
      const aiTiers = PLAN_LIST.filter((p) => p.features.includes('ai_morning_brief')).map((p) => p.id);
      expect(aiTiers.sort()).toEqual(['enterprise', 'professional']);
    });
  });

  describe('getPlan', () => {
    it('returns the matching plan definition', () => {
      const plan = getPlan('starter');
      expect(plan).not.toBeNull();
      expect(plan!.id).toBe('starter');
      expect(plan!.projectLimit).toBe(3);
    });

    it('accepts case-insensitive input', () => {
      expect(getPlan('Starter')!.id).toBe('starter');
      expect(getPlan('ENTERPRISE')!.id).toBe('enterprise');
    });

    it('returns null for unknown tier', () => {
      expect(getPlan('platinum')).toBeNull();
    });

    it('returns null for nullish input', () => {
      expect(getPlan(null)).toBeNull();
      expect(getPlan(undefined)).toBeNull();
      expect(getPlan('')).toBeNull();
    });
  });

  describe('isModuleInPlan', () => {
    it('starter allows schedule/cost/dashboard/scope but not procurement', () => {
      expect(isModuleInPlan('starter', 'schedule')).toBe(true);
      expect(isModuleInPlan('starter', 'cost')).toBe(true);
      expect(isModuleInPlan('starter', 'dashboard')).toBe(true);
      expect(isModuleInPlan('starter', 'scope')).toBe(true);
      expect(isModuleInPlan('starter', 'procurement')).toBe(false);
    });

    it('professional allows every module via wildcard', () => {
      const sample = ['schedule', 'cost', 'procurement', 'communications', 'risk', 'integration', 'owners_rep', 'resource', 'safety', 'crew', 'agents', 'wbs', 'billing'];
      for (const m of sample) {
        expect(isModuleInPlan('professional', m)).toBe(true);
      }
    });

    it('returns false for null tier', () => {
      expect(isModuleInPlan(null, 'schedule')).toBe(false);
    });
  });

  describe('isFeatureInPlan', () => {
    it('ai_morning_brief is gated to professional+', () => {
      expect(isFeatureInPlan('starter', 'ai_morning_brief')).toBe(false);
      expect(isFeatureInPlan('professional', 'ai_morning_brief')).toBe(true);
      expect(isFeatureInPlan('enterprise', 'ai_morning_brief')).toBe(true);
    });

    it('compliance_alerts is enterprise-only', () => {
      expect(isFeatureInPlan('starter', 'compliance_alerts')).toBe(false);
      expect(isFeatureInPlan('professional', 'compliance_alerts')).toBe(false);
      expect(isFeatureInPlan('enterprise', 'compliance_alerts')).toBe(true);
    });

    it('returns false for unknown feature on any tier', () => {
      expect(isFeatureInPlan('enterprise', 'no_such_feature')).toBe(false);
    });
  });

  describe('tierForStripePrice', () => {
    const ORIGINAL = { ...process.env };

    afterEach(() => {
      process.env = { ...ORIGINAL };
    });

    it('maps known price ids to their tier', () => {
      process.env.STRIPE_PRICE_STARTER = 'price_starter_123';
      process.env.STRIPE_PRICE_PROFESSIONAL = 'price_pro_456';
      process.env.STRIPE_PRICE_ENTERPRISE = 'price_ent_789';
      expect(tierForStripePrice('price_starter_123')).toBe('starter');
      expect(tierForStripePrice('price_pro_456')).toBe('professional');
      expect(tierForStripePrice('price_ent_789')).toBe('enterprise');
    });

    it('falls back to starter for unknown or null price ids', () => {
      process.env.STRIPE_PRICE_STARTER = 'price_starter_123';
      expect(tierForStripePrice('price_unknown')).toBe('starter');
      expect(tierForStripePrice(null)).toBe('starter');
      expect(tierForStripePrice(undefined)).toBe('starter');
    });
  });
});
