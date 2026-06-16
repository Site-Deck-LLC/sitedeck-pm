import { useEffect, useState } from 'react';
import { COLORS, FONTS, BORDERS } from '../styles/design-system';
import { canEditSchedule } from '../auth';
import { getRfiPdfUrl } from '../api';

interface Rfi {
  id: string;
  rfiNumber: string;
  subject: string;
  description: string;
  status: string;
  submittedBy: string;
  submittedAt: string | null;
  assignedTo: string | null;
  responseText: string | null;
  answeredAt: string | null;
  requiredDate: string | null;
  holdOnActivityId: string | null;
  sourceReference: string | null;
  ballInCourt: string | null;
  statusHistory: Array<{ status: string; changedBy: string; changedAt: string }> | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  projectId: string;
  rfiId: string;
  token: string;
  apiBase: string;
  onBack: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: COLORS.gray300, fg: COLORS.textPrimary, label: 'Draft' },
  submitted: { bg: COLORS.navy, fg: COLORS.white, label: 'Submitted' },
  under_review: { bg: COLORS.amber, fg: COLORS.white, label: 'Under Review' },
  answered: { bg: COLORS.green, fg: COLORS.white, label: 'Answered' },
  closed: { bg: COLORS.gray500, fg: COLORS.white, label: 'Closed' },
};

function fmt(d?: string | null) {
  if (!d) return '—';
  try {
    return d.slice(0, 10);
  } catch {
    return '—';
  }
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (24 * 60 * 60 * 1000));
}

export function RfiDetailView({ projectId, rfiId, token, apiBase, onBack }: Props) {
  const [rfi, setRfi] = useState<Rfi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [responseDraft, setResponseDraft] = useState('');
  const [editingResponse, setEditingResponse] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activityName, setActivityName] = useState<string | null>(null);
  const canEdit = canEditSchedule();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/api/v1/projects/${projectId}/communications/rfis/${rfiId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      const data: Rfi = await res.json();
      setRfi(data);
      setResponseDraft(data.responseText || '');

      if (data.holdOnActivityId) {
        const ar = await fetch(
          `${apiBase}/api/v1/projects/${projectId}/schedule/activities/${data.holdOnActivityId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (ar.ok) {
          const a = await ar.json();
          if (a && a.name) setActivityName(a.name);
        }
      } else {
        setActivityName(null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, rfiId]);

  const submit = async (body: any) => {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/projects/${projectId}/communications/rfis/${rfiId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setRfi(updated);
      setResponseDraft(updated.responseText || '');
      setEditingResponse(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = () => {
    // The PDF endpoint is a binary download. We navigate to it directly so the
    // browser handles Content-Disposition and the file is saved with the
    // server-supplied filename. The token is appended as a query param
    // (see getRfiPdfUrl) since Authorization headers are not viable for
    // <a href>-style downloads.
    const url = getRfiPdfUrl(projectId, rfiId);
    window.open(url, '_blank', 'noopener');
  };

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', color: COLORS.textSecondary }}>
        Loading RFI…
      </div>
    );
  }

  if (error || !rfi) {
    return (
      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        <button onClick={onBack} style={backButtonStyle}>← Back</button>
        <div style={{ marginTop: 16, color: COLORS.red, fontSize: FONTS.size.sm }}>{error || 'RFI not found'}</div>
      </div>
    );
  }

  const daysOpen = rfi.submittedAt
    ? Math.max(0, daysBetween(rfi.submittedAt, new Date().toISOString()))
    : 0;
  const overdueResponse = !!(rfi.requiredDate && rfi.status !== 'closed' && rfi.status !== 'answered' && new Date(rfi.requiredDate) < new Date());

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', fontFamily: FONTS.family }}>
      <button onClick={onBack} style={backButtonStyle}>← Back</button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, fontFamily: 'monospace' }}>{rfi.rfiNumber}</span>
            <StatusChip status={rfi.status} />
            {overdueResponse && (
              <span style={pillStyle(COLORS.red, COLORS.white)}>Overdue Response</span>
            )}
            {rfi.ballInCourt && (
              <span style={pillStyle(COLORS.amber, COLORS.white)}>⚾ {rfi.ballInCourt}</span>
            )}
            <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
              {daysOpen}d open
            </span>
          </div>
          <h1 style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: 0, lineHeight: 1.3 }}>
            {rfi.subject}
          </h1>
        </div>
      </div>

      {/* Section 1 — Request */}
      <Section title="Request">
        <Field label="Description" value={<MultiLine text={rfi.description} />} />
        <Field label="Source reference" value={rfi.sourceReference || '—'} />
        <Field label="Submitted by" value={rfi.submittedBy} />
        <Field label="Submitted date" value={fmt(rfi.submittedAt)} />
        <Field label="Response required by" value={
          <span style={{ color: overdueResponse ? COLORS.red : COLORS.textPrimary }}>
            {fmt(rfi.requiredDate)}
            {overdueResponse ? ' (overdue)' : ''}
          </span>
        } />
      </Section>

      {/* Section 2 — Response */}
      <Section title="Response">
        {rfi.status === 'closed' || !rfi.responseText ? (
          rfi.responseText ? (
            <MultiLine text={rfi.responseText} />
          ) : rfi.ballInCourt ? (
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, fontStyle: 'italic' }}>
              Awaiting response from {rfi.ballInCourt}
            </div>
          ) : (
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, fontStyle: 'italic' }}>
              No response yet
            </div>
          )
        ) : null}

        {editingResponse && canEdit ? (
          <div style={{ marginTop: 8 }}>
            <textarea
              value={responseDraft}
              onChange={(e) => setResponseDraft(e.target.value)}
              rows={5}
              style={{
                width: '100%',
                border: `1px solid ${COLORS.gray200}`,
                borderRadius: BORDERS.radius.sm,
                padding: 8,
                fontSize: FONTS.size.sm,
                fontFamily: FONTS.family,
                color: COLORS.textPrimary,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => submit({ action: 'answer', responseText: responseDraft })}
                disabled={saving || !responseDraft.trim()}
                style={primaryButtonStyle(saving || !responseDraft.trim())}
              >
                {saving ? 'Saving…' : 'Save Response'}
              </button>
              <button
                onClick={() => {
                  setEditingResponse(false);
                  setResponseDraft(rfi.responseText || '');
                }}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {rfi.answeredAt ? (
          <Field label="Responded date" value={fmt(rfi.answeredAt)} />
        ) : null}
        {rfi.assignedTo ? (
          <Field label="Responded by" value={rfi.assignedTo} />
        ) : null}
      </Section>

      {/* Section 3 — Status History */}
      <Section title={`Status History (${(rfi.statusHistory || []).length})`}>
        {(rfi.statusHistory || []).length === 0 ? (
          <div style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, fontStyle: 'italic' }}>No status changes yet</div>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: FONTS.size.sm, color: COLORS.textPrimary }}>
            {(rfi.statusHistory || []).map((h, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: FONTS.weight.semibold }}>{h.status}</span>
                <span style={{ color: COLORS.textMuted, marginLeft: 8 }}>
                  {fmt(h.changedAt)} {h.changedAt ? new Date(h.changedAt).toLocaleTimeString().slice(0, 5) : ''} · {h.changedBy}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* Section 4 — Linked Items */}
      <Section title="Linked Items">
        {rfi.holdOnActivityId ? (
          <Field
            label="Schedule activity"
            value={activityName || `Activity ${rfi.holdOnActivityId.slice(0, 8)}`}
          />
        ) : (
          <div style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, fontStyle: 'italic' }}>No linked items</div>
        )}
      </Section>

      {/* Action buttons */}
      {canEdit ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {rfi.status === 'draft' && (
            <button onClick={() => submit({ action: 'submit' })} disabled={saving} style={primaryButtonStyle(saving)}>
              Mark as Submitted
            </button>
          )}
          {rfi.status !== 'closed' && (
            <button onClick={() => setEditingResponse((e) => !e)} style={secondaryButtonStyle}>
              {editingResponse ? 'Cancel' : 'Log Response'}
            </button>
          )}
          {rfi.status !== 'closed' && (
            <button onClick={() => submit({ action: 'close' })} disabled={saving} style={secondaryButtonStyle}>
              Close RFI
            </button>
          )}
          <button onClick={exportPdf} style={secondaryButtonStyle}>Export PDF</button>
        </div>
      ) : null}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const info = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return (
    <span style={pillStyle(info.bg, info.fg, status === 'closed')}>{info.label}</span>
  );
}

function pillStyle(bg: string, fg: string, strike = false): React.CSSProperties {
  return {
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 12,
    background: bg,
    color: fg,
    fontWeight: FONTS.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textDecoration: strike ? 'line-through' : 'none',
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: FONTS.size.xs,
          fontWeight: FONTS.weight.bold,
          color: COLORS.navy,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 8,
          paddingBottom: 4,
          borderBottom: `1px solid ${COLORS.gray200}`,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FONTS.size.sm, gap: 12 }}>
      <span style={{ color: COLORS.textSecondary, flexShrink: 0 }}>{label}</span>
      <span style={{ color: COLORS.textPrimary, fontWeight: FONTS.weight.medium, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function MultiLine({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: FONTS.size.sm,
        color: COLORS.textPrimary,
        whiteSpace: 'pre-wrap',
        background: COLORS.gray100,
        padding: 8,
        borderRadius: BORDERS.radius.sm,
      }}
    >
      {text}
    </div>
  );
}

const backButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: COLORS.navy,
  fontSize: FONTS.size.sm,
  cursor: 'pointer',
  padding: 0,
  fontWeight: FONTS.weight.semibold,
};

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  background: COLORS.orange,
  color: COLORS.white,
  border: 'none',
  padding: '8px 16px',
  borderRadius: BORDERS.radius.sm,
  fontSize: FONTS.size.sm,
  fontWeight: FONTS.weight.semibold,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
});

const secondaryButtonStyle: React.CSSProperties = {
  background: COLORS.white,
  color: COLORS.navy,
  border: `1px solid ${COLORS.gray200}`,
  padding: '8px 16px',
  borderRadius: BORDERS.radius.sm,
  fontSize: FONTS.size.sm,
  fontWeight: FONTS.weight.semibold,
  cursor: 'pointer',
};
