import { useEffect, useState } from 'react';
import { COLORS, FONTS, SHADOWS, BORDERS } from '../styles/design-system';
import { canEditIssues } from '../auth';

interface Issue {
  id: string;
  issueNumber: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  type: string;
  activityId: string | null;
  assignee: string | null;
  dueDate: string | null;
  resolvedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  notes: Array<{ id: string; text: string; author: string; createdAt: string }> | null;
}

interface Props {
  projectId: string;
  issueId: string | null;
  token: string;
  apiBase: string;
  onClose: () => void;
  onOpenActivity: (activityId: string) => void;
}

const PRIORITY_COLORS: Record<string, { bg: string; fg: string }> = {
  critical: { bg: COLORS.red, fg: COLORS.white },
  high: { bg: COLORS.orange, fg: COLORS.white },
  medium: { bg: COLORS.amber, fg: COLORS.white },
  low: { bg: COLORS.gray300, fg: COLORS.textPrimary },
};

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  open: { bg: COLORS.red, fg: COLORS.white, label: 'Open' },
  in_progress: { bg: COLORS.orange, fg: COLORS.white, label: 'In Progress' },
  resolved: { bg: COLORS.green, fg: COLORS.white, label: 'Resolved' },
  closed: { bg: COLORS.gray500, fg: COLORS.white, label: 'Closed' },
};

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITIES = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function fmt(d?: string | null) {
  if (!d) return '—';
  try {
    return d.slice(0, 10);
  } catch {
    return '—';
  }
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (24 * 60 * 60 * 1000));
}

export function IssueDetailDrawer({ projectId, issueId, token, apiBase, onClose, onOpenActivity }: Props) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('open');
  const [priority, setPriority] = useState('medium');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [noteText, setNoteText] = useState('');
  const [activityName, setActivityName] = useState<string | null>(null);

  const canEdit = canEditIssues();

  useEffect(() => {
    if (!issueId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setIssue(null);
    setNoteText('');

    fetch(`${apiBase}/api/v1/projects/${projectId}/integration/issues/${issueId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
          throw new Error(err.error?.message || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const i = data as Issue;
        setIssue(i);
        setStatus(i.status);
        setPriority(i.priority);
        setAssignee(i.assignee || '');
        setDueDate(i.dueDate ? i.dueDate.slice(0, 10) : '');
        setLoading(false);
        // Fetch activity name if linked
        if (i.activityId) {
          fetch(`${apiBase}/api/v1/projects/${projectId}/schedule/activities/${i.activityId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((a) => {
              if (a && a.name) setActivityName(a.name);
            })
            .catch(() => null);
        } else {
          setActivityName(null);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, issueId, token, apiBase]);

  useEffect(() => {
    if (!issueId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [issueId, onClose]);

  if (!issueId) return null;

  const save = async (extra?: { notesAppend?: string }) => {
    if (!issue) return;
    setSaving(true);
    try {
      const body: any = {
        status,
        priority,
        assignee: assignee || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        ...(extra || {}),
      };
      const res = await fetch(`${apiBase}/api/v1/projects/${projectId}/integration/issues/${issue.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setIssue(updated);
      if (extra?.notesAppend) setNoteText('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const appendNote = async () => {
    if (!noteText.trim()) return;
    await save({ notesAppend: noteText });
  };

  const priorityInfo = issue ? PRIORITY_COLORS[issue.priority] || PRIORITY_COLORS.medium : null;
  const statusInfo = issue ? STATUS_COLORS[issue.status] || STATUS_COLORS.open : null;
  const isOverdue = !!(issue?.dueDate && !issue?.resolvedAt && new Date(issue.dueDate) < new Date());
  const daysOpen = issue ? Math.max(0, daysBetween(issue.createdAt, new Date().toISOString())) : 0;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(27, 42, 74, 0.35)',
          zIndex: 1000,
        }}
      />
      <div
        role="dialog"
        aria-label="Issue details"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 480,
          maxWidth: '92vw',
          background: COLORS.white,
          zIndex: 1001,
          boxShadow: SHADOWS.xl,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: FONTS.family,
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: `1px solid ${COLORS.gray200}`,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            background: COLORS.gray100,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: priorityInfo?.bg,
                  color: priorityInfo?.fg,
                  fontWeight: FONTS.weight.bold,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {issue?.priority || '—'}
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: statusInfo?.bg,
                  color: statusInfo?.fg,
                  fontWeight: FONTS.weight.bold,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {statusInfo?.label}
              </span>
              {isOverdue && (
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: COLORS.red,
                    color: COLORS.white,
                    fontWeight: FONTS.weight.bold,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Overdue
                </span>
              )}
              <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>
                {issue?.issueNumber} · {daysOpen}d open
              </span>
            </div>
            <h2
              style={{
                fontSize: FONTS.size.lg,
                fontWeight: FONTS.weight.bold,
                color: COLORS.textPrimary,
                margin: 0,
                lineHeight: 1.3,
                wordBreak: 'break-word',
              }}
            >
              {issue?.title || (loading ? 'Loading…' : 'Issue')}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 24,
              lineHeight: 1,
              cursor: 'pointer',
              color: COLORS.textSecondary,
              padding: 0,
              width: 28,
              height: 28,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading && <Note>Loading issue details…</Note>}
          {error && <Note tone="error">{error}</Note>}

          {issue && (
            <>
              <Section title="Source">
                <ReadonlyField label="Type" value={issue.type.replace(/_/g, ' ')} />
                <ReadonlyField label="Source" value={issue.source.replace(/_/g, ' ')} />
                <ReadonlyField label="Description" value={issue.description} />
              </Section>

              <Section title="Linked Activity">
                {issue.activityId ? (
                  <div
                    onClick={() => issue.activityId && onOpenActivity(issue.activityId)}
                    style={{
                      padding: '6px 8px',
                      background: COLORS.gray100,
                      borderRadius: BORDERS.radius.sm,
                      cursor: 'pointer',
                      fontSize: FONTS.size.sm,
                      color: COLORS.navy,
                      textDecoration: 'underline',
                    }}
                  >
                    {activityName || `Activity ${issue.activityId.slice(0, 8)}`}
                  </div>
                ) : (
                  <Empty>No linked activity</Empty>
                )}
              </Section>

              <Section title="Assignment">
                <ReadonlyField label="Assignee" value={issue.assignee || 'Unassigned'} />
                <ReadonlyField
                  label="Due date"
                  value={
                    <span style={{ color: isOverdue ? COLORS.red : COLORS.textPrimary }}>
                      {fmt(issue.dueDate)}
                      {isOverdue ? ' (overdue)' : ''}
                    </span>
                  }
                />
              </Section>

              {canEdit ? (
                <Section title="Edit">
                  <Select label="Status" value={status} onChange={setStatus} options={STATUSES} />
                  <Select label="Priority" value={priority} onChange={setPriority} options={PRIORITIES} />
                  <Input label="Assignee" value={assignee} onChange={setAssignee} />
                  <Input label="Due date" value={dueDate} onChange={setDueDate} type="date" />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => save()}
                      disabled={saving}
                      style={{
                        background: COLORS.orange,
                        color: COLORS.white,
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: BORDERS.radius.sm,
                        fontSize: FONTS.size.sm,
                        fontWeight: FONTS.weight.semibold,
                        cursor: saving ? 'wait' : 'pointer',
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </Section>
              ) : null}

              <Section title="Notes">
                {(issue.notes || []).length === 0 ? (
                  <Empty>No notes yet</Empty>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                    {issue.notes!.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          padding: 8,
                          background: COLORS.gray100,
                          borderRadius: BORDERS.radius.sm,
                          fontSize: FONTS.size.sm,
                          color: COLORS.textPrimary,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: COLORS.textMuted,
                            marginBottom: 4,
                          }}
                        >
                          {n.author} · {fmt(n.createdAt)} {n.createdAt ? new Date(n.createdAt).toLocaleTimeString().slice(0, 5) : ''}
                        </div>
                        {n.text}
                      </div>
                    ))}
                  </div>
                )}
                {canEdit && (
                  <>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add a note…"
                      rows={2}
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
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button
                        onClick={appendNote}
                        disabled={saving || !noteText.trim()}
                        style={{
                          background: COLORS.navy,
                          color: COLORS.white,
                          border: 'none',
                          padding: '5px 12px',
                          borderRadius: BORDERS.radius.sm,
                          fontSize: FONTS.size.xs,
                          fontWeight: FONTS.weight.semibold,
                          cursor: saving || !noteText.trim() ? 'not-allowed' : 'pointer',
                          opacity: saving || !noteText.trim() ? 0.5 : 1,
                        }}
                      >
                        {saving ? 'Saving…' : 'Add note'}
                      </button>
                    </div>
                  </>
                )}
              </Section>

              <Section title="Audit Trail">
                <ReadonlyField label="Created by" value={issue.createdBy} />
                <ReadonlyField label="Created at" value={`${fmt(issue.createdAt)} ${new Date(issue.createdAt).toLocaleTimeString().slice(0, 5)}`} />
                <ReadonlyField label="Last updated" value={`${fmt(issue.updatedAt)} ${new Date(issue.updatedAt).toLocaleTimeString().slice(0, 5)}`} />
                {issue.resolvedAt && (
                  <ReadonlyField label="Resolved at" value={`${fmt(issue.resolvedAt)} ${new Date(issue.resolvedAt).toLocaleTimeString().slice(0, 5)}`} />
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
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

function ReadonlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FONTS.size.sm, gap: 12 }}>
      <span style={{ color: COLORS.textSecondary, flexShrink: 0 }}>{label}</span>
      <span style={{ color: COLORS.textPrimary, fontWeight: FONTS.weight.medium, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: `1px solid ${COLORS.gray200}`,
          borderRadius: BORDERS.radius.sm,
          padding: '6px 8px',
          fontSize: FONTS.size.sm,
          fontFamily: FONTS.family,
          color: COLORS.textPrimary,
          boxSizing: 'border-box',
        }}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: `1px solid ${COLORS.gray200}`,
          borderRadius: BORDERS.radius.sm,
          padding: '6px 8px',
          fontSize: FONTS.size.sm,
          fontFamily: FONTS.family,
          color: COLORS.textPrimary,
          background: COLORS.white,
          boxSizing: 'border-box',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: FONTS.size.xs,
        color: COLORS.textMuted,
        fontStyle: 'italic',
        padding: 4,
      }}
    >
      {children}
    </div>
  );
}

function Note({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
  return (
    <div
      style={{
        padding: 12,
        background: tone === 'error' ? COLORS.redLight : COLORS.gray100,
        color: tone === 'error' ? COLORS.red : COLORS.textSecondary,
        borderRadius: BORDERS.radius.md,
        fontSize: FONTS.size.sm,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}
