/**
 * Billing Settings page
 * ============================================================================
 * Org-level billing: current plan, usage against limits, plan picker with
 * Stripe Checkout, and (for enterprise) a BYOK "Bring Your Own Key" panel
 * for Anthropic API key override.
 *
 * The page is read-only on subscription state — every plan change goes
 * through Stripe Checkout. We never edit billing in the DB directly.
 *
 * Plan tiers: starter / professional / enterprise (all defined in
 * `billing.service.ts`). Enterprise unlocks the BYOK panel.
 *
 * Source: /Volumes/Extra Storage/SiteDeckPM/frontend/src/components/BillingSettings.tsx
 */

import { useEffect, useState, useCallback } from 'react';
import { fetchApi } from '../api';

interface SubscriptionStatus {
  planTier: string;
  status: string;
  projectLimit: number;
  currentProjects: number;
  renewsAt?: string | null;
  cancelAt?: string | null;
}

interface PlanConfig {
  id: string;
  name: string;
  monthlyPrice: number;
  projectLimit: number;
  features: string[];
  stripePriceId: string;
}

interface Props {
  orgId?: string;
  onBack: () => void;
}

const COLORS = {
  navy: '#1B2A4A',
  orange: '#E8720C',
  green: '#22A06B',
  amber: '#F59E0B',
  red: '#C9372D',
  gray600: '#4B5563',
  gray200: '#E5E7EB',
  white: '#FFFFFF',
  bg: '#F8FAFC',
};

export function BillingSettings({ orgId: orgIdProp, onBack }: Props) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [byokKey, setByokKey] = useState('');
  const [byokSaving, setByokSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(orgIdProp || null);

  // Resolve orgId from the first project the PM can read, if not provided.
  useEffect(() => {
    if (orgId) return;
    (async () => {
      try {
        const projects = await fetchApi('/api/v1/projects');
        if (Array.isArray(projects) && projects.length > 0) {
          setOrgId(projects[0].orgId);
        }
      } catch {
        // ignore — error will surface on the status call too
      }
    })();
  }, [orgId]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        fetchApi(`/billing/status?orgId=${orgId}`),
        fetchApi('/billing/plans'),
      ]);
      setStatus(s);
      setPlans(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCheckout = async (plan: PlanConfig) => {
    setCheckingOut(plan.id);
    setError(null);
    try {
      const res = await fetchApi('/billing/checkout-session', {
        method: 'POST',
        body: JSON.stringify({
          orgId,
          priceId: plan.stripePriceId,
          successUrl: window.location.origin + '/?billing=success',
          cancelUrl: window.location.origin + '/?billing=cancel',
        }),
      });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        setError('No checkout URL returned');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCheckingOut(null);
    }
  };

  const handleSaveByok = async () => {
    setByokSaving(true);
    setError(null);
    try {
      await fetchApi('/billing/byok', {
        method: 'POST',
        body: JSON.stringify({ orgId, anthropicApiKey: byokKey }),
      });
      setByokKey('');
      setToast('API key saved');
      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setByokSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: COLORS.gray600 }}>Loading…</p>
      </div>
    );
  }

  const isEnterprise = status?.planTier === 'enterprise';
  const isActive = status?.status === 'active';

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.navy,
            cursor: 'pointer',
            fontSize: 16,
            marginRight: 16,
          }}
        >
          ← Back
        </button>
        <h1 style={{ flex: 1, color: COLORS.navy, margin: 0, fontSize: 24 }}>Billing</h1>
      </div>

      {error && (
        <div
          style={{
            background: '#FEE2E2',
            border: '1px solid #EF4444',
            color: '#991B1B',
            padding: 8,
            borderRadius: 4,
            marginBottom: 12,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {toast && (
        <div
          style={{
            background: '#DCFCE7',
            border: '1px solid #22A06B',
            color: '#166534',
            padding: 8,
            borderRadius: 4,
            marginBottom: 12,
            fontSize: 12,
          }}
        >
          {toast}
        </div>
      )}

      {/* Current plan */}
      {status && (
        <div
          style={{
            background: COLORS.white,
            border: `1px solid ${COLORS.gray200}`,
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: COLORS.gray600, fontSize: 12, fontWeight: 600 }}>CURRENT PLAN</div>
              <div style={{ color: COLORS.navy, fontSize: 22, fontWeight: 700, marginTop: 4, textTransform: 'capitalize' }}>
                {status.planTier}
              </div>
              <div
                style={{
                  display: 'inline-block',
                  marginTop: 6,
                  padding: '2px 10px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600,
                  background: isActive ? COLORS.green : COLORS.amber,
                  color: COLORS.white,
                  textTransform: 'uppercase',
                }}
              >
                {status.status}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: COLORS.gray600, fontSize: 12, fontWeight: 600 }}>PROJECTS</div>
              <div style={{ color: COLORS.navy, fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                {status.currentProjects} / {status.projectLimit >= 999999 ? '∞' : status.projectLimit}
              </div>
            </div>
          </div>
          {status.renewsAt && (
            <div style={{ color: COLORS.gray600, fontSize: 12, marginTop: 12 }}>
              Renews {new Date(status.renewsAt).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {/* Plan picker */}
      <h2 style={{ color: COLORS.navy, fontSize: 18, marginBottom: 12 }}>Plans</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {plans.map((p) => {
          const isCurrent = status?.planTier === p.id;
          return (
            <div
              key={p.id}
              style={{
                background: COLORS.white,
                border: `1px solid ${isCurrent ? COLORS.orange : COLORS.gray200}`,
                borderRadius: 8,
                padding: 16,
                position: 'relative',
              }}
            >
              {isCurrent && (
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: COLORS.orange,
                    color: COLORS.white,
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Current
                </div>
              )}
              <div style={{ color: COLORS.navy, fontWeight: 700, fontSize: 16 }}>{p.name}</div>
              <div style={{ color: COLORS.navy, fontSize: 22, fontWeight: 700, marginTop: 8 }}>
                ${p.monthlyPrice}
                <span style={{ color: COLORS.gray600, fontSize: 12, fontWeight: 400 }}>/mo</span>
              </div>
              <div style={{ color: COLORS.gray600, fontSize: 12, marginTop: 4 }}>
                {p.projectLimit >= 999999 ? 'Unlimited projects' : `${p.projectLimit} projects`}
              </div>
              <ul style={{ margin: '12px 0', padding: '0 0 0 16px', color: COLORS.gray600, fontSize: 12 }}>
                {p.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout(p)}
                disabled={isCurrent || checkingOut === p.id}
                style={{
                  width: '100%',
                  background: isCurrent ? COLORS.gray200 : COLORS.orange,
                  color: isCurrent ? COLORS.gray600 : COLORS.white,
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 4,
                  cursor: isCurrent ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {checkingOut === p.id ? 'Opening checkout…' : isCurrent ? 'Current plan' : 'Switch to this plan'}
              </button>
            </div>
          );
        })}
      </div>

      {/* BYOK — enterprise only */}
      {isEnterprise && (
        <div
          style={{
            background: COLORS.white,
            border: `1px solid ${COLORS.gray200}`,
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <h2 style={{ color: COLORS.navy, fontSize: 18, margin: '0 0 4px' }}>
            Bring Your Own Key
          </h2>
          <p style={{ color: COLORS.gray600, fontSize: 12, margin: '0 0 12px' }}>
            Enterprise customers can supply their own Anthropic API key. The key replaces the
            platform default for your org and bypasses the spend guard. Stored encrypted at rest.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              value={byokKey}
              onChange={(e) => setByokKey(e.target.value)}
              placeholder="sk-ant-…"
              style={{
                flex: 1,
                border: '1px solid #D1D5DB',
                borderRadius: 4,
                padding: 8,
                fontSize: 13,
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={handleSaveByok}
              disabled={!byokKey || byokSaving}
              style={{
                background: COLORS.navy,
                color: COLORS.white,
                border: 'none',
                padding: '8px 16px',
                borderRadius: 4,
                cursor: !byokKey || byokSaving ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
                opacity: !byokKey || byokSaving ? 0.6 : 1,
              }}
            >
              {byokSaving ? 'Saving…' : 'Save Key'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
