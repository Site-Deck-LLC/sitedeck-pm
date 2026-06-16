import { useEffect, useState, useMemo } from 'react';
import { COLORS, FONTS, BORDERS, SHADOWS } from '../styles/design-system';
import { getAttendanceToday, getScheduleActivities, postAttendance } from '../api';
import { canEditSchedule } from '../auth';

interface Props {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateBounds(target: Date, start?: string | null, end?: string | null): boolean {
  if (!start || !end) return false;
  const s = new Date(start);
  const e = new Date(end);
  return s.getTime() <= target.getTime() && e.getTime() >= target.getTime();
}

export function AttendanceEntryModal({ projectId, onClose, onSaved }: Props) {
  const canEdit = canEditSchedule();
  const [date, setDate] = useState<string>(todayIso());
  const [planned, setPlanned] = useState<number>(0);
  const [present, setPresent] = useState<number>(0);
  const [absent, setAbsent] = useState<number>(0);
  const [late, setLate] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [affected, setAffected] = useState<string[]>([]);
  const [activities, setActivities] = useState<Array<{ id: string; name: string; startDate: string | null; endDate: string | null; status: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Compute planned from schedule (active activities on the chosen date)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [actRes, attRes] = await Promise.all([
          getScheduleActivities(projectId).catch(() => []),
          getAttendanceToday(projectId, date).catch(() => null),
        ]);
        if (cancelled) return;
        const acts = (Array.isArray(actRes) ? actRes : actRes?.items || actRes?.data || []) as any[];
        const target = new Date(date);
        const todays = acts
          .filter((a: any) => a.status !== 'complete' && dateBounds(target, a.startDate, a.endDate))
          .map((a: any) => ({ id: a.id, name: a.name, startDate: a.startDate, endDate: a.endDate, status: a.status }));
        setActivities(todays);
        setPlanned(todays.length);

        if (attRes) {
          setPresent(attRes.presentCount ?? attRes.workerCount ?? 0);
          setAbsent(attRes.absentCount ?? 0);
          setLate(attRes.lateCount ?? 0);
          setNotes(attRes.notes ?? '');
          setAffected(Array.isArray(attRes.affectedActivities) ? attRes.affectedActivities : []);
        } else {
          setPresent(0);
          setAbsent(todays.length);
          setLate(0);
          setNotes('');
          setAffected([]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId, date]);

  // Auto-calc absent when present changes
  useEffect(() => {
    if (planned > 0) {
      setAbsent(Math.max(0, planned - present));
    }
  }, [present, planned]);

  const today = useMemo(() => todayIso(), []);
  const isToday = date === today;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await postAttendance(projectId, {
        date,
        workerCount: present,
        hours: present * 8, // V1 heuristic: 8 hours per present worker per day
        presentCount: present,
        absentCount: absent,
        lateCount: late,
        notes: notes || undefined,
        affectedActivities: affected,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  // Escape key closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(27, 42, 74, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
    >
      <div style={{
        background: COLORS.white,
        borderRadius: BORDERS.radius.lg,
        boxShadow: SHADOWS.lg,
        width: '100%',
        maxWidth: 560,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${COLORS.gray200}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
              Log Attendance
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
              {isToday ? "Today's" : 'Date-specific'} crew count and details
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: COLORS.textMuted,
              fontSize: 22,
              cursor: 'pointer',
              padding: 0,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: COLORS.textSecondary, padding: 24 }}>Loading…</div>
          ) : (
            <>
              <label style={fieldLabelStyle}>
                <span style={labelTextStyle}>Date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ ...fieldLabelStyle, marginBottom: 0 }}>
                  <span style={labelTextStyle}>Planned (from schedule)</span>
                  <div style={{
                    ...inputStyle,
                    background: COLORS.gray100,
                    color: COLORS.textSecondary,
                    fontWeight: FONTS.weight.semibold,
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    {planned} crew
                  </div>
                  <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>
                    Based on {activities.length} active activit{activities.length === 1 ? 'y' : 'ies'} on this date
                  </div>
                </div>

                <label style={{ ...fieldLabelStyle, marginBottom: 0 }}>
                  <span style={labelTextStyle}>Present</span>
                  <input
                    type="number"
                    min={0}
                    max={planned || 999}
                    value={present}
                    onChange={(e) => setPresent(Math.max(0, Number(e.target.value) || 0))}
                    style={inputStyle}
                    disabled={!canEdit}
                  />
                </label>

                <label style={{ ...fieldLabelStyle, marginBottom: 0 }}>
                  <span style={labelTextStyle}>Absent (auto)</span>
                  <div style={{
                    ...inputStyle,
                    background: COLORS.gray100,
                    color: absent > 0 ? COLORS.red : COLORS.textSecondary,
                    fontWeight: FONTS.weight.semibold,
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    {absent} crew
                  </div>
                </label>

                <label style={{ ...fieldLabelStyle, marginBottom: 0 }}>
                  <span style={labelTextStyle}>Late</span>
                  <input
                    type="number"
                    min={0}
                    max={planned || 999}
                    value={late}
                    onChange={(e) => setLate(Math.max(0, Number(e.target.value) || 0))}
                    style={inputStyle}
                    disabled={!canEdit}
                  />
                </label>
              </div>

              <label style={fieldLabelStyle}>
                <span style={labelTextStyle}>Notes (optional)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Two electricians called out sick; one arrived at 9:15"
                  style={{ ...inputStyle, resize: 'vertical' }}
                  disabled={!canEdit}
                />
              </label>

              {activities.length > 0 && (
                <div style={fieldLabelStyle}>
                  <span style={labelTextStyle}>Affected Activities</span>
                  <div style={{
                    border: `1px solid ${COLORS.gray200}`,
                    borderRadius: BORDERS.radius.sm,
                    padding: 8,
                    maxHeight: 180,
                    overflowY: 'auto',
                  }}>
                    {activities.map((a) => {
                      const checked = affected.includes(a.id);
                      return (
                        <label
                          key={a.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 0',
                            fontSize: FONTS.size.sm,
                            color: COLORS.textPrimary,
                            cursor: canEdit ? 'pointer' : 'default',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAffected([...affected, a.id]);
                              } else {
                                setAffected(affected.filter((id) => id !== a.id));
                              }
                            }}
                            disabled={!canEdit}
                          />
                          <span>{a.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>
                    Selected: {affected.length}
                  </div>
                </div>
              )}

              {activities.length === 0 && (
                <div style={{
                  fontSize: FONTS.size.xs,
                  color: COLORS.textMuted,
                  fontStyle: 'italic',
                  padding: 8,
                  background: COLORS.gray100,
                  borderRadius: BORDERS.radius.sm,
                }}>
                  No activities scheduled on this date. Planned crew shows 0; you can still log present/late counts for sub crews (e.g. supervision, deliveries).
                </div>
              )}

              {error && (
                <div style={{
                  marginTop: 12,
                  padding: 8,
                  background: '#FEE2E2',
                  color: '#991B1B',
                  borderRadius: BORDERS.radius.sm,
                  fontSize: FONTS.size.xs,
                }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{
          padding: 16,
          borderTop: `1px solid ${COLORS.gray200}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
        }}>
          <button onClick={onClose} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !canEdit || loading}
            style={primaryButtonStyle(saving || !canEdit || loading)}
          >
            {saving ? 'Saving…' : 'Save Attendance'}
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 12,
};

const labelTextStyle: React.CSSProperties = {
  fontSize: FONTS.size.xs,
  fontWeight: FONTS.weight.semibold,
  color: COLORS.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const inputStyle: React.CSSProperties = {
  border: `1px solid ${COLORS.gray200}`,
  borderRadius: BORDERS.radius.sm,
  padding: '8px 10px',
  fontSize: FONTS.size.sm,
  fontFamily: FONTS.family,
  color: COLORS.textPrimary,
  background: COLORS.white,
  boxSizing: 'border-box',
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
