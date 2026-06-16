import { useEffect, useState } from 'react';
import {
  getActivity,
  getActivityRelationships,
  patchActivity,
  getWhatIf,
} from '../api';
import { canEditSchedule } from '../auth';
import { COLORS, FONTS, SHADOWS, BORDERS } from '../styles/design-system';

interface Activity {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  duration: number;
  percentComplete: number;
  status: string;
  isMilestone: boolean;
  isCritical: boolean;
  wbsItemId: string | null;
  wbsCode: string | null;
  wbsName: string | null;
  totalFloat: number | null;
  freeFloat: number | null;
  baselineStart?: string | null;
  baselineEnd?: string | null;
}

interface Rel {
  id: string;
  relationshipType: string;
  lagDays: number;
  predecessor?: { id: string; name: string };
  successor?: { id: string; name: string };
}

interface Props {
  projectId: string;
  activityId: string | null;
  onClose: () => void;
  onNavigate: (activityId: string) => void;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  not_started: { bg: COLORS.gray200, fg: COLORS.textPrimary, label: 'Not Started' },
  in_progress: { bg: COLORS.orange, fg: COLORS.white, label: 'In Progress' },
  completed: { bg: COLORS.green, fg: COLORS.white, label: 'Completed' },
  on_hold: { bg: COLORS.amber, fg: COLORS.white, label: 'On Hold' },
  delayed: { bg: COLORS.red, fg: COLORS.white, label: 'Delayed' },
};

function fmt(d?: string | null) {
  if (!d) return '—';
  try {
    return d.slice(0, 10);
  } catch {
    return '—';
  }
}

export function ActivityDetailDrawer({ projectId, activityId, onClose, onNavigate }: Props) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [preds, setPreds] = useState<Rel[]>([]);
  const [succs, setSuccs] = useState<Rel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // What-If state
  const [whatIfDays, setWhatIfDays] = useState<number>(7);
  const [whatIfType, setWhatIfType] = useState<'start_delay' | 'duration_extension'>('start_delay');
  const [whatIfResult, setWhatIfResult] = useState<any | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [whatIfError, setWhatIfError] = useState('');

  // Load activity and relationships when activityId changes
  useEffect(() => {
    if (!activityId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setActivity(null);
    setPreds([]);
    setSuccs([]);
    setNotesDraft('');
    setSavedAt(null);

    Promise.all([getActivity(projectId, activityId), getActivityRelationships(projectId, activityId)])
      .then(([act, rels]) => {
        if (cancelled) return;
        setActivity(act);
        setPreds(rels.predecessors || []);
        setSuccs(rels.successors || []);
        setNotesDraft(act.description || '');
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, activityId]);

  // Escape to close
  useEffect(() => {
    if (!activityId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activityId, onClose]);

  if (!activityId) return null;

  const statusInfo = activity ? STATUS_COLORS[activity.status] || STATUS_COLORS.not_started : null;
  const canEdit = canEditSchedule();

  const saveNotes = async () => {
    if (!activity) return;
    setSavingNotes(true);
    try {
      await patchActivity(projectId, activity.id, { description: notesDraft });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingNotes(false);
    }
  };

  const runWhatIfAnalysis = async () => {
    if (!activity) return;
    setWhatIfLoading(true);
    setWhatIfError('');
    setWhatIfResult(null);
    try {
      const result = await getWhatIf(projectId, activity.id, whatIfDays, whatIfType);
      setWhatIfResult(result);
    } catch (e: any) {
      setWhatIfError(e.message);
    } finally {
      setWhatIfLoading(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(27, 42, 74, 0.35)',
          zIndex: 1000,
        }}
      />
      {/* Drawer */}
      <div
        role="dialog"
        aria-label="Activity details"
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
        {/* Header */}
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
                  background: statusInfo?.bg,
                  color: statusInfo?.fg,
                  fontWeight: FONTS.weight.bold,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {statusInfo?.label}
              </span>
              {activity?.isCritical && (
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
                  Critical
                </span>
              )}
              {activity?.isMilestone && (
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: COLORS.orange,
                    color: COLORS.white,
                    fontWeight: FONTS.weight.bold,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Milestone
                </span>
              )}
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
              {activity?.name || (loading ? 'Loading…' : 'Activity')}
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

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading && <SectionMessage>Loading activity details…</SectionMessage>}
          {error && <SectionMessage tone="error">{error}</SectionMessage>}

          {activity && (
            <>
              {/* Section 1 — Schedule */}
              <Section title="Schedule">
                <Field label="Start" value={fmt(activity.startDate)} />
                <Field label="End" value={fmt(activity.endDate)} />
                <Field label="Duration" value={`${activity.duration} day${activity.duration !== 1 ? 's' : ''}`} />
                <Field
                  label="% Complete"
                  value={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          width: 80,
                          height: 6,
                          borderRadius: 3,
                          background: COLORS.gray200,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${(activity.percentComplete || 0) * 100}%`,
                            height: '100%',
                            background:
                              activity.percentComplete >= 1
                                ? COLORS.green
                                : activity.percentComplete > 0
                                ? COLORS.orange
                                : COLORS.gray300,
                          }}
                        />
                      </div>
                      <span>{Math.round((activity.percentComplete || 0) * 100)}%</span>
                    </div>
                  }
                />

                {/* Baseline variance */}
                {(activity.baselineStart || activity.baselineEnd) && (
                  <>
                    <div
                      style={{
                        fontSize: FONTS.size.xs,
                        fontWeight: FONTS.weight.semibold,
                        color: COLORS.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginTop: 12,
                        marginBottom: 4,
                      }}
                    >
                      Baseline
                    </div>
                    <Field label="Start" value={fmt(activity.baselineStart)} />
                    <Field label="End" value={fmt(activity.baselineEnd)} />
                    {activity.startDate &&
                      activity.baselineStart &&
                      fmt(activity.startDate) !== fmt(activity.baselineStart) && (
                        <div
                          style={{
                            fontSize: FONTS.size.xs,
                            color: COLORS.amber,
                            marginTop: 4,
                          }}
                        >
                          Start shifted{' '}
                          {daysBetween(activity.baselineStart, activity.startDate)} day(s)
                        </div>
                      )}
                  </>
                )}

                {/* Float */}
                <div
                  style={{
                    fontSize: FONTS.size.xs,
                    fontWeight: FONTS.weight.semibold,
                    color: COLORS.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginTop: 12,
                    marginBottom: 4,
                  }}
                >
                  Float
                </div>
                <Field
                  label="Total float"
                  value={
                    <span
                      style={{
                        color:
                          (activity.totalFloat ?? 0) <= 0 ? COLORS.red : COLORS.textMuted,
                        fontWeight: FONTS.weight.semibold,
                      }}
                    >
                      {activity.totalFloat ?? 0} day{(activity.totalFloat ?? 0) !== 1 ? 's' : ''}
                    </span>
                  }
                />
                <Field
                  label="Free float"
                  value={
                    <span
                      style={{
                        color:
                          (activity.freeFloat ?? 0) <= 0 ? COLORS.red : COLORS.textMuted,
                      }}
                    >
                      {activity.freeFloat ?? 0} day{(activity.freeFloat ?? 0) !== 1 ? 's' : ''}
                    </span>
                  }
                />
              </Section>

              {/* Section 2 — Predecessors */}
              <Section title={`Predecessors (${preds.length})`}>
                {preds.length === 0 ? (
                  <Empty>No predecessors</Empty>
                ) : (
                  preds.map((r) => (
                    <RelRow
                      key={r.id}
                      name={r.predecessor?.name || 'Unknown'}
                      relType={r.relationshipType}
                      lag={r.lagDays}
                      onClick={() => r.predecessor && onNavigate(r.predecessor.id)}
                    />
                  ))
                )}
              </Section>

              {/* Section 3 — Successors */}
              <Section title={`Successors (${succs.length})`}>
                {succs.length === 0 ? (
                  <Empty>No successors</Empty>
                ) : (
                  succs.map((r) => (
                    <RelRow
                      key={r.id}
                      name={r.successor?.name || 'Unknown'}
                      relType={r.relationshipType}
                      lag={r.lagDays}
                      onClick={() => r.successor && onNavigate(r.successor.id)}
                    />
                  ))
                )}
              </Section>

              {/* Section 4 — WBS */}
              <Section title="WBS">
                <Field label="Code" value={activity.wbsCode || '—'} />
                <Field label="Name" value={activity.wbsName || '—'} />
              </Section>

              {/* Section 5 — Notes */}
              <Section title="Notes">
                {canEdit ? (
                  <>
                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      rows={4}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <button
                        onClick={saveNotes}
                        disabled={savingNotes}
                        style={{
                          background: COLORS.orange,
                          color: COLORS.white,
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: BORDERS.radius.sm,
                          fontSize: FONTS.size.sm,
                          fontWeight: FONTS.weight.semibold,
                          cursor: savingNotes ? 'wait' : 'pointer',
                          opacity: savingNotes ? 0.6 : 1,
                        }}
                      >
                        {savingNotes ? 'Saving…' : 'Save'}
                      </button>
                      {savedAt && (
                        <span style={{ fontSize: FONTS.size.xs, color: COLORS.green }}>
                          Saved at {savedAt}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      fontSize: FONTS.size.sm,
                      color: COLORS.textSecondary,
                      padding: 8,
                      background: COLORS.gray100,
                      borderRadius: BORDERS.radius.sm,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {activity.description || 'No notes.'}
                  </div>
                )}
              </Section>

              {/* Section 6 — What-If Analysis */}
              <Section title="What-If Analysis">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <label style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>Days:</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={whatIfDays}
                    onChange={(e) => setWhatIfDays(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
                    style={{
                      width: 70,
                      padding: '4px 8px',
                      border: `1px solid ${COLORS.gray200}`,
                      borderRadius: BORDERS.radius.sm,
                      fontSize: FONTS.size.sm,
                      fontFamily: FONTS.family,
                    }}
                  />
                  <div style={{ display: 'flex', borderRadius: BORDERS.radius.sm, overflow: 'hidden', border: `1px solid ${COLORS.gray200}` }}>
                    <button
                      onClick={() => setWhatIfType('start_delay')}
                      style={{
                        padding: '4px 10px',
                        fontSize: FONTS.size.xs,
                        fontWeight: FONTS.weight.semibold,
                        border: 'none',
                        background: whatIfType === 'start_delay' ? COLORS.navy : COLORS.white,
                        color: whatIfType === 'start_delay' ? COLORS.white : COLORS.textSecondary,
                        cursor: 'pointer',
                      }}
                    >
                      Start Delay
                    </button>
                    <button
                      onClick={() => setWhatIfType('duration_extension')}
                      style={{
                        padding: '4px 10px',
                        fontSize: FONTS.size.xs,
                        fontWeight: FONTS.weight.semibold,
                        border: 'none',
                        background: whatIfType === 'duration_extension' ? COLORS.navy : COLORS.white,
                        color: whatIfType === 'duration_extension' ? COLORS.white : COLORS.textSecondary,
                        cursor: 'pointer',
                      }}
                    >
                      Duration Ext.
                    </button>
                  </div>
                  <button
                    onClick={runWhatIfAnalysis}
                    disabled={whatIfLoading}
                    style={{
                      background: COLORS.orange,
                      color: COLORS.white,
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: BORDERS.radius.sm,
                      fontSize: FONTS.size.sm,
                      fontWeight: FONTS.weight.semibold,
                      cursor: whatIfLoading ? 'wait' : 'pointer',
                      opacity: whatIfLoading ? 0.6 : 1,
                      marginLeft: 'auto',
                    }}
                  >
                    {whatIfLoading ? 'Running…' : 'Run Analysis'}
                  </button>
                </div>
                {whatIfError && (
                  <div style={{ padding: 8, background: '#FEE2E2', color: '#991B1B', borderRadius: BORDERS.radius.sm, fontSize: FONTS.size.xs }}>
                    {whatIfError}
                  </div>
                )}
                {whatIfResult && (
                  <WhatIfResults result={whatIfResult} />
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FONTS.size.sm }}>
      <span style={{ color: COLORS.textSecondary }}>{label}</span>
      <span style={{ color: COLORS.textPrimary, fontWeight: FONTS.weight.medium }}>{value}</span>
    </div>
  );
}

function RelRow({
  name,
  relType,
  lag,
  onClick,
}: {
  name: string;
  relType: string;
  lag: number;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 8px',
        borderRadius: BORDERS.radius.sm,
        background: COLORS.gray100,
        cursor: 'pointer',
        fontSize: FONTS.size.sm,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.gray200)}
      onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.gray100)}
    >
      <span style={{ color: COLORS.textPrimary, fontWeight: FONTS.weight.medium }}>{name}</span>
      <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>
        {relType} {lag > 0 ? `+${lag}d` : lag < 0 ? `${lag}d` : ''}
      </span>
    </div>
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

function SectionMessage({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
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

function daysBetween(a: string, b: string) {
  try {
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    return Math.round((db - da) / (24 * 60 * 60 * 1000));
  } catch {
    return 0;
  }
}

function WhatIfResults({ result }: { result: any }) {
  const [expanded, setExpanded] = useState(false);
  const impact = result.days_impact || 0;
  let bannerBg = '#DCFCE7'; // green
  let bannerFg = '#166534';
  let label = 'No completion impact';
  if (impact > 0 && impact <= 7) {
    bannerBg = '#FEF3C7';
    bannerFg = '#92400E';
    label = `${impact}-day impact`;
  } else if (impact > 7) {
    bannerBg = '#FEE2E2';
    bannerFg = '#991B1B';
    label = `${impact}-day impact — significant LD exposure`;
  }
  const origDate = (result.original_completion || '').slice(0, 10);
  const newDate = (result.new_completion || '').slice(0, 10);
  const newly = result.newly_critical_activities || [];
  const affected = result.affected_activities || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          padding: 10,
          background: bannerBg,
          color: bannerFg,
          borderRadius: BORDERS.radius.sm,
          fontSize: FONTS.size.sm,
          fontWeight: FONTS.weight.semibold,
        }}
      >
        {label}
      </div>
      {impact > 0 && (
        <div style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary }}>
          Completion: {origDate} → {newDate} <span style={{ color: bannerFg, fontWeight: FONTS.weight.semibold }}>(+{impact} days)</span>
        </div>
      )}
      <div style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary }}>
        LD Exposure: <span style={{ fontWeight: FONTS.weight.semibold }}>{result.ld_exposure_days} days</span>
      </div>
      {newly.length > 0 && (
        <div style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary }}>
          Newly critical: <span style={{ color: COLORS.red, fontWeight: FONTS.weight.semibold }}>{newly.map((n: any) => n.name).join(', ')}</span>
        </div>
      )}
      {affected.length > 1 && (
        <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.orange,
              fontSize: FONTS.size.xs,
              cursor: 'pointer',
              padding: 0,
              fontWeight: FONTS.weight.semibold,
            }}
          >
            {affected.length} affected activities {expanded ? '▾' : '▸'}
          </button>
          {expanded && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {affected.map((a: any) => (
                <div key={a.id} style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, paddingLeft: 8 }}>
                  {a.name}: {a.original_end.slice(0, 10)} → {a.new_end.slice(0, 10)} ({a.days_shifted > 0 ? '+' : ''}{a.days_shifted}d)
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary, padding: 8, background: COLORS.gray100, borderRadius: BORDERS.radius.sm }}>
        {result.summary}
      </div>
      <button
        disabled
        title="Scenario planning — coming soon"
        style={{
          background: COLORS.gray200,
          color: COLORS.textSecondary,
          border: 'none',
          padding: '6px 14px',
          borderRadius: BORDERS.radius.sm,
          fontSize: FONTS.size.xs,
          fontWeight: FONTS.weight.semibold,
          cursor: 'not-allowed',
          alignSelf: 'flex-start',
        }}
      >
        Save as Scenario
      </button>
    </div>
  );
}
