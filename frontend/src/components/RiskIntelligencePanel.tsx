/**
 * RiskIntelligencePanel.tsx — Sprint 11 Task 7
 * ============================================================================
 * Surfaces compound risks (multi-signal cascades) with clickable
 * linked items. Quick-action buttons pre-fill forms for the
 * common responses. History tab shows previously-resolved
 * cascades so PMs can learn from past patterns.
 *
 * Per CLAUDE.md: 404-routes for non-admins. This view is for any
 * authenticated user on the project. The compound-risk detector
 * itself is rule-based and lives in risk-intelligence.service.ts.
 * ============================================================================
 */

import { useEffect, useState, useCallback } from 'react';
import { fetchApi } from '../api';
import { COLORS, FONTS, SHADOWS, BORDERS } from '../styles/design-system';

type Link = { kind: 'activity' | 'rfi' | 'submittal' | 'changeOrder' | 'risk'; id: string; label: string };
type CompoundRisk = {
  id: string;
  label: string;
  severity: 'warning' | 'critical';
  whyItMatters: string;
  links: Link[];
};

type HistoryEntry = {
  id: string;
  projectId: string;
  ruleTriggered: string;
  description: string;
  linkedItems: any;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: string | null;
};

const KIND_TO_VIEW: Record<Link['kind'], (projectId: string, id: string) => string> = {
  activity: (_p, id) => `?view=gantt&activityId=${id}`,
  rfi: (_p, id) => `?view=rfi&rfiId=${id}`,
  submittal: (_p, id) => `?view=submittal&submittalId=${id}`,
  changeOrder: (_p, id) => `?view=change-order&coId=${id}`,
  risk: (_p, id) => `?view=risk&riskId=${id}`,
};

const KIND_LABEL: Record<Link['kind'], string> = {
  activity: 'View Activity',
  rfi: 'View RFI',
  submittal: 'View Submittal',
  changeOrder: 'View Change Order',
  risk: 'View Risk',
};

function viewHref(projectId: string, link: Link): string {
  return KIND_TO_VIEW[link.kind]?.(projectId, link.id) || '#';
}

function quickActionFor(compound: CompoundRisk): { label: string; view: string } | null {
  const id = compound.id;
  if (id === 'schedule-cost-overrun' || id === 'overdue-rfis-with-schedule-slip') {
    return { label: 'Schedule Change Request', view: '?view=schedule-change-request' };
  }
  if (id.startsWith('overdue-rfis') || id === 'overdue-rfis-with-cost-overrun') {
    return { label: 'Draft Follow-Up', view: '?view=rfi-followup-draft' };
  }
  if (id === 'materials-with-schedule-slip') {
    return { label: 'Contact Supplier', view: '?view=rfi-draft-supplier' };
  }
  return null;
}

export function RiskIntelligencePanel({ projectId, onNavigate }: { projectId: string; onNavigate?: (view: string) => void }) {
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [active, setActive] = useState<CompoundRisk[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [snap, hist] = await Promise.all([
        fetchApi<{ compoundRisks: CompoundRisk[] }>(`/api/v1/projects/${projectId}/risk-intelligence`),
        fetchApi<HistoryEntry[]>(`/api/v1/projects/${projectId}/risk-intelligence/history`),
      ]);
      setActive(snap.compoundRisks || []);
      setHistory(hist || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function resolveRisk(riskId: string, resolution: string) {
    try {
      await fetchApi(`/api/v1/projects/${projectId}/risk-intelligence/history/${riskId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolution }),
      });
      await load();
    } catch (err: any) {
      alert(`Failed to resolve: ${err.message}`);
    }
  }

  if (loading) {
    return <div style={{ padding: 16, color: COLORS.textMuted, fontSize: FONTS.size.sm }}>Loading risk intelligence…</div>;
  }
  if (error) {
    return <div style={{ padding: 16, color: COLORS.red, fontSize: FONTS.size.sm }}>{error}</div>;
  }

  return (
    <div style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, border: `1px solid ${COLORS.gray200}`, boxShadow: SHADOWS.sm, overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.gray200}` }}>
        {[
          { v: 'active', label: `Active (${active.length})` },
          { v: 'history', label: `History (${history.length})` },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v as any)}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: tab === t.v ? `2px solid ${COLORS.orange}` : '2px solid transparent',
              color: tab === t.v ? COLORS.textPrimary : COLORS.textSecondary,
              fontSize: FONTS.size.sm,
              fontWeight: FONTS.weight.semibold,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'active' && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.length === 0 ? (
            <p style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm, margin: 0, textAlign: 'center', padding: 12 }}>
              No compound risks detected. Project health is clear.
            </p>
          ) : (
            active.map((c) => {
              const action = quickActionFor(c);
              return (
                <div key={c.id} style={{ borderLeft: `3px solid ${c.severity === 'critical' ? COLORS.red : COLORS.amber}`, background: COLORS.offWhite, padding: 12, borderRadius: BORDERS.radius.sm }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ background: c.severity === 'critical' ? COLORS.red : COLORS.amber, color: COLORS.white, padding: '2px 8px', borderRadius: 10, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold }}>{c.severity.toUpperCase()}</span>
                    <strong style={{ color: COLORS.textPrimary, fontSize: FONTS.size.sm }}>{c.label}</strong>
                  </div>
                  <p style={{ color: COLORS.textSecondary, fontSize: FONTS.size.xs, margin: '0 0 8px' }}>{c.whyItMatters}</p>
                  {c.links.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {c.links.map((l, i) => (
                        <button
                          key={i}
                          onClick={() => onNavigate?.(viewHref(projectId, l))}
                          style={{ padding: '4px 10px', fontSize: FONTS.size.xs, borderRadius: BORDERS.radius.sm, border: `1px solid ${COLORS.gray200}`, background: COLORS.white, color: COLORS.navy, cursor: 'pointer' }}
                        >
                          {KIND_LABEL[l.kind]} → {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {action && (
                    <button
                      onClick={() => onNavigate?.(action.view)}
                      style={{ padding: '6px 12px', fontSize: FONTS.size.xs, borderRadius: BORDERS.radius.sm, border: 'none', background: COLORS.orange, color: COLORS.white, fontWeight: FONTS.weight.semibold, cursor: 'pointer' }}
                    >
                      {action.label}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'history' && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {history.length === 0 ? (
            <p style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm, margin: 0, textAlign: 'center', padding: 12 }}>
              No past compound risks recorded.
            </p>
          ) : (
            history.map((h) => (
              <div key={h.id} style={{ padding: 10, borderBottom: `1px solid ${COLORS.gray100}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: COLORS.textPrimary, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold }}>{h.description}</div>
                  <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs, marginTop: 2 }}>
                    {new Date(h.detectedAt).toLocaleString()}
                    {h.resolvedAt && ` — resolved ${new Date(h.resolvedAt).toLocaleString()}`}
                  </div>
                  {h.resolution && <div style={{ color: COLORS.textSecondary, fontSize: FONTS.size.xs, marginTop: 4 }}>Resolved by: {h.resolution}</div>}
                </div>
                {!h.resolvedAt && (
                  <button
                    onClick={() => {
                      const r = prompt('How was this resolved?');
                      if (r) resolveRisk(h.id, r);
                    }}
                    style={{ padding: '4px 10px', fontSize: FONTS.size.xs, borderRadius: BORDERS.radius.sm, border: 'none', background: COLORS.green, color: COLORS.white, fontWeight: FONTS.weight.semibold, cursor: 'pointer', flexShrink: 0 }}
                  >
                    Mark Resolved
                  </button>
                )}
                {h.resolvedAt && <span style={{ color: COLORS.green, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold }}>✓</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
