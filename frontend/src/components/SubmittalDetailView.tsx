import { useEffect, useState } from 'react';
import { COLORS, FONTS, BORDERS } from '../styles/design-system';
import { canEditSchedule } from '../auth';
import { getSubmittalPdfUrl } from '../api';

interface Submittal {
  id: string;
  submittalNumber: string;
  title: string;
  description: string | null;
  status: string;
  specSection: string | null;
  requiredDate: string | null;
  submittedBy: string;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewComments: string | null;
  holdOnActivityId: string | null;
  statusHistory: Array<{ status: string; changedBy: string; changedAt: string }> | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  projectId: string;
  submittalId: string;
  token: string;
  apiBase: string;
  onBack: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: COLORS.gray300, fg: COLORS.textPrimary, label: 'Pending' },
  submitted: { bg: COLORS.navy, fg: COLORS.white, label: 'Submitted' },
  under_review: { bg: COLORS.amber, fg: COLORS.white, label: 'Under Review' },
  approved: { bg: COLORS.green, fg: COLORS.white, label: 'Approved' },
  rejected: { bg: COLORS.red, fg: COLORS.white, label: 'Rejected' },
  revision_required: { bg: COLORS.orange, fg: COLORS.white, label: 'Revision Required' },
};

const REVIEW_DECISIONS = [
  { value: 'approved', label: 'Approve' },
  { value: 'rejected', label: 'Reject' },
  { value: 'revision_required', label: 'Request Revision' },
];

function fmt(d?: string | null) {
  if (!d) return '—';
  try {
    return d.slice(0, 10);
  } catch {
    return '—';
  }
}

export function SubmittalDetailView({ projectId, submittalId, token, apiBase, onBack }: Props) {
  const [submittal, setSubmittal] = useState<Submittal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingReview, setEditingReview] = useState(false);
  const [reviewer, setReviewer] = useState('');
  const [decision, setDecision] = useState('approved');
  const [reviewComments, setReviewComments] = useState('');
  const [activityName, setActivityName] = useState<string | null>(null);
  const canEdit = canEditSchedule();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${apiBase}/api/v1/projects/${projectId}/communications/submittals/${submittalId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      const data: Submittal = await res.json();
      setSubmittal(data);
      setReviewer(data.reviewedBy || '');

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
  }, [projectId, submittalId]);

  const submit = async (body: any) => {
    setSaving(true);
    try {
      const res = await fetch(
        `${apiBase}/api/v1/projects/${projectId}/communications/submittals/${submittalId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setSubmittal(updated);
      setReviewer(updated.reviewedBy || '');
      setEditingReview(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = () => {
    // Binary download; see RfiDetailView for the design rationale.
    const url = getSubmittalPdfUrl(projectId, submittalId);
    window.open(url, '_blank', 'noopener');
  };

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', color: COLORS.textSecondary }}>
        Loading submittal…
      </div>
    );
  }

  if (error || !submittal) {
    return (
      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        <button onClick={onBack} style={backButtonStyle}>← Back</button>
        <div style={{ marginTop: 16, color: COLORS.red, fontSize: FONTS.size.sm }}>{error || 'Submittal not found'}</div>
      </div>
    );
  }

  const statusInfo = STATUS_COLORS[submittal.status] || STATUS_COLORS.pending;
  const daysUntilRequired = submittal.requiredDate
    ? Math.round((new Date(submittal.requiredDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;
  const overdueRequired =
    daysUntilRequired !== null && daysUntilRequired < 0 && submittal.status !== 'approved';

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', fontFamily: FONTS.family }}>
      <button onClick={onBack} style={backButtonStyle}>← Back</button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, fontFamily: 'monospace' }}>{submittal.submittalNumber}</span>
            <span style={pillStyle(statusInfo.bg, statusInfo.fg)}>{statusInfo.label}</span>
            {submittal.specSection && (
              <span style={pillStyle(COLORS.navyLight, COLORS.white)}>📋 {submittal.specSection}</span>
            )}
            {daysUntilRequired !== null && (
              <span
                style={pillStyle(
                  daysUntilRequired < 7 || overdueRequired ? COLORS.red : COLORS.gray300,
                  daysUntilRequired < 7 || overdueRequired ? COLORS.white : COLORS.textPrimary
                )}
              >
                {overdueRequired
                  ? `${Math.abs(daysUntilRequired)}d overdue`
                  : daysUntilRequired === 0
                  ? 'due today'
                  : `${daysUntilRequired}d left`}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: 0, lineHeight: 1.3 }}>
            {submittal.title}
          </h1>
        </div>
      </div>

      <Section title="Submittal Info">
        {submittal.description && <Field label="Description" value={<MultiLine text={submittal.description} />} />}
        <Field label="Spec section" value={submittal.specSection || '—'} />
        <Field label="Submitted by" value={submittal.submittedBy} />
        <Field label="Submitted date" value={fmt(submittal.submittedAt)} />
        <Field label="Required by" value={
          <span style={{ color: overdueRequired ? COLORS.red : COLORS.textPrimary }}>
            {fmt(submittal.requiredDate)}
            {overdueRequired ? ' (overdue)' : ''}
          </span>
        } />
        {submittal.holdOnActivityId && (
          <Field
            label="Linked activity"
            value={activityName || `Activity ${submittal.holdOnActivityId.slice(0, 8)}`}
          />
        )}
      </Section>

      <Section title="Review">
        {submittal.reviewedAt ? (
          <>
            <Field label="Reviewer" value={submittal.reviewedBy || '—'} />
            <Field label="Review date" value={fmt(submittal.reviewedAt)} />
            {submittal.reviewComments && (
              <Field label="Review comments" value={<MultiLine text={submittal.reviewComments} />} />
            )}
          </>
        ) : (
          <div style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, fontStyle: 'italic' }}>Not yet reviewed</div>
        )}

        {editingReview && canEdit ? (
          <div style={{ marginTop: 8, padding: 12, background: COLORS.gray100, borderRadius: BORDERS.radius.md }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>Reviewer name</span>
              <input
                type="text"
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                style={{
                  border: `1px solid ${COLORS.gray200}`,
                  borderRadius: BORDERS.radius.sm,
                  padding: '6px 8px',
                  fontSize: FONTS.size.sm,
                  fontFamily: FONTS.family,
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>Decision</span>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                style={{
                  border: `1px solid ${COLORS.gray200}`,
                  borderRadius: BORDERS.radius.sm,
                  padding: '6px 8px',
                  fontSize: FONTS.size.sm,
                  fontFamily: FONTS.family,
                  background: COLORS.white,
                }}
              >
                {REVIEW_DECISIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>Comments</span>
              <textarea
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                rows={3}
                style={{
                  border: `1px solid ${COLORS.gray200}`,
                  borderRadius: BORDERS.radius.sm,
                  padding: 8,
                  fontSize: FONTS.size.sm,
                  fontFamily: FONTS.family,
                  resize: 'vertical',
                }}
              />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() =>
                  submit({
                    action: 'review',
                    decision,
                    reviewedBy: reviewer || 'unknown',
                    reviewComments,
                  })
                }
                disabled={saving}
                style={primaryButtonStyle(saving)}
              >
                {saving ? 'Saving…' : 'Save Review'}
              </button>
              <button onClick={() => setEditingReview(false)} style={secondaryButtonStyle}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Section>

      <Section title={`Status History (${(submittal.statusHistory || []).length})`}>
        {(submittal.statusHistory || []).length === 0 ? (
          <div style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, fontStyle: 'italic' }}>No status changes yet</div>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: FONTS.size.sm, color: COLORS.textPrimary }}>
            {(submittal.statusHistory || []).map((h, i) => (
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

      {canEdit ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {submittal.status === 'pending' && (
            <button onClick={() => submit({ action: 'submit' })} disabled={saving} style={primaryButtonStyle(saving)}>
              Mark as Submitted
            </button>
          )}
          {submittal.status !== 'approved' && (
            <button onClick={() => setEditingReview((e) => !e)} style={secondaryButtonStyle}>
              {editingReview ? 'Cancel' : 'Log Review Result'}
            </button>
          )}
          <button onClick={exportPdf} style={secondaryButtonStyle}>Export Submittal Log PDF</button>
        </div>
      ) : null}
    </div>
  );
}

function pillStyle(bg: string, fg: string): React.CSSProperties {
  return {
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 12,
    background: bg,
    color: fg,
    fontWeight: FONTS.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
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
