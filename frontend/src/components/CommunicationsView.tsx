import { useEffect, useState } from 'react';
import { getRfis, getSubmittals, getSubmittalLogPdfUrl } from '../api';
import { COLORS, FONTS, SHADOWS, BORDERS } from '../styles/design-system';

type Tab = 'rfis' | 'submittals';

// ── RFI status badge colors ──
const RFI_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft:        { bg: '#F0F1F3', text: '#5A6072', border: '#C4C8D0' },
  submitted:    { bg: '#E0E7FF', text: '#1B2A4A', border: '#1B2A4A' },
  under_review: { bg: '#FEF3C7', text: '#B45309', border: '#F59E0B' },
  answered:     { bg: '#DCFCE7', text: '#166534', border: '#22C55E' },
  closed:       { bg: '#F0F1F3', text: '#5A6072', border: '#9CA3AF' },
};

// ── Submittal status badge colors ──
const SUBMITTAL_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending:            { bg: '#F0F1F3', text: '#5A6072', border: '#C4C8D0' },
  submitted:          { bg: '#E0E7FF', text: '#1B2A4A', border: '#1B2A4A' },
  under_review:       { bg: '#FEF3C7', text: '#B45309', border: '#F59E0B' },
  approved:           { bg: '#DCFCE7', text: '#166534', border: '#22C55E' },
  rejected:           { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
  revision_required:  { bg: '#FFF7ED', text: '#9A3412', border: '#E8720C' },
};

const RFI_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  answered: 'Answered',
  closed: 'Closed',
};

const SUBMITTAL_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  revision_required: 'Revision Required',
};

type SortKey = 'status' | 'days' | 'ball' | 'number';

function daysBetween(from: string | null | undefined, to: string | null | undefined): number {
  if (!from) return 0;
  const a = new Date(from);
  const b = to ? new Date(to) : new Date('2026-06-07');
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function StatusBadge({ status, type }: { status: string; type: 'rfi' | 'submittal' }) {
  const palette = type === 'rfi' ? RFI_STATUS_COLORS : SUBMITTAL_STATUS_COLORS;
  const labels = type === 'rfi' ? RFI_STATUS_LABELS : SUBMITTAL_STATUS_LABELS;
  const c = palette[status] || { bg: COLORS.gray100, text: COLORS.textSecondary, border: COLORS.gray300 };
  const isClosed = status === 'closed' || status === 'approved' || status === 'rejected';
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: '12px',
      fontSize: FONTS.size.xs,
      fontWeight: FONTS.weight.semibold,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      textDecoration: isClosed ? 'line-through' : 'none',
    }}>
      {labels[status] || status}
    </span>
  );
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? COLORS.navyLight : COLORS.white,
        color: active ? COLORS.white : COLORS.textSecondary,
        border: `1px solid ${active ? COLORS.navy : COLORS.gray200}`,
        padding: '6px 12px',
        borderRadius: BORDERS.radius.sm,
        fontSize: FONTS.size.xs,
        fontWeight: FONTS.weight.semibold,
        cursor: 'pointer',
      }}
    >
      {label} {active ? (direction === 'asc' ? '↑' : '↓') : ''}
    </button>
  );
}

export function CommunicationsView({ projectId, onBack, onOpenRfi, onOpenSubmittal }: { projectId: string; onBack: () => void; onOpenRfi?: (id: string) => void; onOpenSubmittal?: (id: string) => void }) {
  const [tab, setTab] = useState<Tab>('rfis');
  const [rfis, setRfis] = useState<any[]>([]);
  const [submittals, setSubmittals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    async function load() {
      try {
        const [r, s] = await Promise.all([getRfis(projectId), getSubmittals(projectId)]);
        setRfis(Array.isArray(r) ? r : r?.items || r?.data || []);
        setSubmittals(Array.isArray(s) ? s : s?.items || s?.data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  function sortItems(items: any[]): any[] {
    const sorted = [...items].sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === 'status') {
        av = a.status || '';
        bv = b.status || '';
      } else if (sortKey === 'days') {
        av = daysBetween(a.submittedAt || a.createdAt, null);
        bv = daysBetween(b.submittedAt || b.createdAt, null);
      } else if (sortKey === 'ball') {
        av = a.assignedTo || a.reviewedBy || '';
        bv = b.assignedTo || b.reviewedBy || '';
      } else {
        av = a.rfiNumber || a.submittalNumber || '';
        bv = b.rfiNumber || b.submittalNumber || '';
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const items = tab === 'rfis' ? sortItems(rfis) : sortItems(submittals);
  const isRfi = tab === 'rfis';

  return (
    <div style={{ minHeight: '100vh', background: COLORS.gray100 }}>
      <nav style={{
        background: COLORS.navy,
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: SHADOWS.sm,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', color: COLORS.white,
            fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, cursor: 'pointer',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}>
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Dashboard
          </button>
          <span style={{ color: COLORS.white, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium }}>
            Communications — RFIs & Submittals
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setTab('rfis')}
            style={{
              background: tab === 'rfis' ? COLORS.orange : 'transparent',
              color: COLORS.white,
              border: `1px solid ${tab === 'rfis' ? COLORS.orange : 'rgba(255,255,255,0.3)'}`,
              padding: '6px 14px',
              borderRadius: BORDERS.radius.sm,
              fontSize: FONTS.size.xs,
              fontWeight: FONTS.weight.semibold,
              cursor: 'pointer',
            }}
          >
            RFIs ({rfis.length})
          </button>
          <button
            onClick={() => setTab('submittals')}
            style={{
              background: tab === 'submittals' ? COLORS.orange : 'transparent',
              color: COLORS.white,
              border: `1px solid ${tab === 'submittals' ? COLORS.orange : 'rgba(255,255,255,0.3)'}`,
              padding: '6px 14px',
              borderRadius: BORDERS.radius.sm,
              fontSize: FONTS.size.xs,
              fontWeight: FONTS.weight.semibold,
              cursor: 'pointer',
            }}
          >
            Submittals ({submittals.length})
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        {/* Sort bar */}
        <div style={{
          background: COLORS.white,
          padding: 12,
          borderRadius: BORDERS.radius.md,
          boxShadow: SHADOWS.sm,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold, color: COLORS.textSecondary, marginRight: 4 }}>
            SORT BY:
          </span>
          <SortButton label="Status" active={sortKey === 'status'} direction={sortDir} onClick={() => toggleSort('status')} />
          <SortButton label="Days Open" active={sortKey === 'days'} direction={sortDir} onClick={() => toggleSort('days')} />
          <SortButton label="Ball in Court" active={sortKey === 'ball'} direction={sortDir} onClick={() => toggleSort('ball')} />
          <SortButton label="Number" active={sortKey === 'number'} direction={sortDir} onClick={() => toggleSort('number')} />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: COLORS.textSecondary }}>
            Loading communications…
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: COLORS.red }}>{error}</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: COLORS.textMuted }}>
            No {isRfi ? 'RFIs' : 'submittals'} on this project yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item, i) => {
              const openDays = daysBetween(item.submittedAt || item.createdAt, null);
              const requiredDate = item.requiredDate ? new Date(item.requiredDate) : null;
              const today = new Date('2026-06-07');
              const daysUntilRequired = requiredDate
                ? Math.ceil((requiredDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                : null;
              const ball = item.assignedTo || item.reviewedBy;
              const isOverdue = isRfi
                ? daysUntilRequired !== null && daysUntilRequired < 0 && item.status !== 'closed'
                : daysUntilRequired !== null && daysUntilRequired < 0 && item.status !== 'approved' && item.status !== 'rejected';
              const isUrgent = isRfi
                ? daysUntilRequired !== null && daysUntilRequired >= 0 && daysUntilRequired < 7 && item.status !== 'closed'
                : daysUntilRequired !== null && daysUntilRequired >= 0 && daysUntilRequired < 7 && item.status !== 'approved' && item.status !== 'rejected';

              return (
                <div
                  key={item.id || i}
                  onClick={() => {
                    if (isRfi && onOpenRfi) onOpenRfi(item.id);
                    if (!isRfi && onOpenSubmittal) onOpenSubmittal(item.id);
                  }}
                  style={{
                    background: COLORS.white,
                    borderRadius: BORDERS.radius.md,
                    border: `1px solid ${COLORS.gray200}`,
                    borderLeft: `4px solid ${
                      isOverdue ? COLORS.red :
                      isUrgent ? COLORS.orange :
                      isRfi ? COLORS.navy :
                      COLORS.amber
                    }`,
                    padding: 16,
                    boxShadow: SHADOWS.sm,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: FONTS.size.xs,
                          fontWeight: FONTS.weight.bold,
                          color: COLORS.textMuted,
                          fontFamily: 'monospace',
                        }}>
                          {item.rfiNumber || item.submittalNumber}
                        </span>
                        <StatusBadge status={item.status} type={isRfi ? 'rfi' : 'submittal'} />
                      </div>
                      <div style={{ fontSize: FONTS.size.md, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, marginBottom: 4 }}>
                        {item.subject || item.title}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, lineHeight: 1.4 }}>
                          {item.description.length > 160 ? item.description.slice(0, 160) + '…' : item.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 16,
                    fontSize: FONTS.size.xs,
                    color: COLORS.textSecondary,
                    paddingTop: 8,
                    borderTop: `1px solid ${COLORS.gray100}`,
                  }}>
                    {openDays > 0 && (
                      <span>
                        <strong style={{ color: openDays > 14 ? COLORS.red : COLORS.textPrimary }}>
                          {openDays} day{openDays !== 1 ? 's' : ''} open
                        </strong>
                      </span>
                    )}
                    {ball && (
                      <span>
                        ⚾ <strong>Ball in court:</strong> {ball}
                      </span>
                    )}
                    {requiredDate && (
                      <span>
                        <strong>Required:</strong> {requiredDate.toISOString().slice(0, 10)}
                        {daysUntilRequired !== null && daysUntilRequired >= 0 && daysUntilRequired < 7 && (
                          <span style={{
                            marginLeft: 6,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: COLORS.redLight,
                            color: COLORS.red,
                            fontSize: 10,
                            fontWeight: FONTS.weight.bold,
                          }}>
                            {daysUntilRequired === 0 ? 'Due today' : `${daysUntilRequired}d left`}
                          </span>
                        )}
                        {isOverdue && (
                          <span style={{
                            marginLeft: 6,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: COLORS.redLight,
                            color: COLORS.red,
                            fontSize: 10,
                            fontWeight: FONTS.weight.bold,
                          }}>
                            {Math.abs(daysUntilRequired!)}d overdue
                          </span>
                        )}
                      </span>
                    )}
                    {item.holdOnActivityId && (
                      <span>🔗 Linked to activity</span>
                    )}
                    {item.specSection && (
                      <span>📋 Spec {item.specSection}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer summary */}
        {!loading && items.length > 0 && (
          <div style={{
            marginTop: 24,
            padding: 12,
            background: COLORS.gray100,
            borderRadius: BORDERS.radius.md,
            fontSize: FONTS.size.xs,
            color: COLORS.textSecondary,
            textAlign: 'center',
          }}>
            Showing {items.length} {isRfi ? 'RFI' : 'submittal'}{items.length !== 1 ? 's' : ''}
            {' • '}
            Export to PDF: <button
              onClick={() => {
                if (!isRfi) {
                  // Submittal log PDF: full multi-page report of all submittals.
                  const url = getSubmittalLogPdfUrl(projectId);
                  window.open(url, '_blank', 'noopener');
                } else {
                  // The RFI log endpoint is not built in V1; the existing
                  // detail-view Export PDF button is the per-RFI path.
                  alert('Generate RFI log PDF: use the Export PDF button on an individual RFI for now.');
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: COLORS.navy,
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: FONTS.size.xs,
                padding: 0,
              }}
            >
              Generate {isRfi ? 'RFI' : 'Submittal'} Log PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
