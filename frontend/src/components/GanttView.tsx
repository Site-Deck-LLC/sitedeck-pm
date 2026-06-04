import { useEffect, useState } from 'react';
import { getScheduleActivities } from '../api';
import { COLORS, FONTS, SHADOWS, BORDERS } from '../styles/design-system';

interface Activity {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  duration: number;
  percentComplete: number;
  status: string;
  isMilestone: boolean;
  isCritical: boolean;
}

export function GanttView({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await getScheduleActivities(projectId);
        const sorted = data.sort((a: Activity, b: Activity) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );
        setActivities(sorted);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  return (
    <div style={pageStyle}>
      <nav style={navStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={backButtonStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}>
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Dashboard
          </button>
          <span style={{ color: COLORS.white, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium }}>
            Schedule Gantt
          </span>
        </div>
      </nav>

      <div style={contentStyle}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: COLORS.textSecondary }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${COLORS.gray200}`, borderTop: `3px solid ${COLORS.orange}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            Loading schedule...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ color: COLORS.red, fontWeight: FONTS.weight.semibold, marginBottom: 16, fontSize: FONTS.size.md }}>{error}</div>
            <p style={{ color: COLORS.textSecondary, marginBottom: 20 }}>Your session may have expired or the token is no longer valid.</p>
            <button onClick={onBack} style={{
              padding: '10px 20px',
              borderRadius: BORDERS.radius.md,
              border: 'none',
              background: COLORS.orange,
              color: COLORS.white,
              fontSize: FONTS.size.md,
              fontWeight: FONTS.weight.semibold,
              cursor: 'pointer',
            }}>
              ← Back to Dashboard
            </button>
          </div>
        ) : (
          <GanttContent activities={activities} />
        )}
      </div>
    </div>
  );
}

function GanttContent({ activities }: { activities: Activity[] }) {
  const allDates = activities.flatMap(a => [new Date(a.startDate), new Date(a.endDate)]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const months: Date[] = [];
  let current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (current <= maxDate) {
    months.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }

  const dayWidth = Math.max(2, Math.min(6, 1200 / totalDays));
  const rowHeight = 40;

  return (
    <div style={ganttCardStyle}>
      <div style={timelineHeaderStyle}>
        <div style={{ width: 280, flexShrink: 0, padding: '12px 16px', borderRight: `1px solid ${COLORS.gray200}`, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
          Activity
        </div>
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          {months.map((month, i) => {
            const offsetDays = Math.ceil((month.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: offsetDays * dayWidth,
                  top: 0,
                  bottom: 0,
                  padding: '12px 8px',
                  borderLeft: `1px solid ${COLORS.gray200}`,
                  fontSize: FONTS.size.xs,
                  fontWeight: FONTS.weight.semibold,
                  color: COLORS.textSecondary,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
        {activities.map((act) => {
          const startOffset = Math.ceil((new Date(act.startDate).getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
          const duration = Math.max(1, act.duration || 1);
          const barWidth = duration * dayWidth;
          const barLeft = startOffset * dayWidth;

          const statusColor = act.status === 'complete'
            ? COLORS.green
            : act.status === 'in_progress'
            ? COLORS.orange
            : act.isCritical
            ? COLORS.red
            : COLORS.gray300;

          return (
            <div key={act.id} style={rowStyle}>
              <div style={nameColumnStyle}>
                <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, color: COLORS.textPrimary }}>
                  {act.name}
                </div>
                <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
                  {act.startDate.slice(0, 10)} → {act.endDate.slice(0, 10)} · {act.duration}d
                </div>
                {act.isCritical && (
                  <span style={{ fontSize: FONTS.size.xs, color: COLORS.red, fontWeight: FONTS.weight.semibold }}>
                    CRITICAL
                  </span>
                )}
              </div>

              <div style={{ position: 'relative', flex: 1, height: rowHeight }}>
                {months.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: i * 30 * dayWidth,
                      top: 0,
                      bottom: 0,
                      width: 1,
                      background: COLORS.gray100,
                    }}
                  />
                ))}

                <div
                  style={{
                    position: 'absolute',
                    left: barLeft,
                    top: 8,
                    width: Math.max(barWidth, 4),
                    height: 24,
                    borderRadius: 4,
                    background: statusColor,
                    opacity: act.status === 'not_started' ? 0.6 : 1,
                    cursor: 'pointer',
                    transition: 'opacity 0.15s',
                  }}
                  title={`${act.name}: ${act.startDate.slice(0, 10)} → ${act.endDate.slice(0, 10)} (${Math.round((act.percentComplete || 0) * 100)}%)`}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${(act.percentComplete || 0) * 100}%`,
                      borderRadius: '4px 0 0 4px',
                      background: 'rgba(255,255,255,0.35)',
                    }}
                  />
                  {act.isMilestone && (
                    <div
                      style={{
                        position: 'absolute',
                        right: -6,
                        top: -2,
                        width: 12,
                        height: 12,
                        background: COLORS.navy,
                        transform: 'rotate(45deg)',
                        border: `2px solid ${COLORS.white}`,
                      }}
                    />
                  )}
                </div>

                {(act.percentComplete || 0) > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      left: barLeft + barWidth + 6,
                      top: 10,
                      fontSize: FONTS.size.xs,
                      color: COLORS.textSecondary,
                      fontWeight: FONTS.weight.medium,
                    }}
                  >
                    {Math.round((act.percentComplete || 0) * 100)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: COLORS.offWhite,
  fontFamily: FONTS.family,
};

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 24px',
  background: COLORS.navy,
  color: COLORS.white,
  borderBottom: `1px solid ${COLORS.navyLight}`,
};

const backButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '6px 12px',
  borderRadius: BORDERS.radius.sm,
  border: `1px solid ${COLORS.navyLight}`,
  background: 'transparent',
  color: COLORS.white,
  fontSize: FONTS.size.sm,
  cursor: 'pointer',
};

const contentStyle: React.CSSProperties = {
  maxWidth: 1400,
  margin: '0 auto',
  padding: 24,
};

const ganttCardStyle: React.CSSProperties = {
  background: COLORS.white,
  borderRadius: BORDERS.radius.lg,
  border: `1px solid ${COLORS.gray200}`,
  boxShadow: SHADOWS.md,
  overflow: 'hidden',
};

const timelineHeaderStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: `2px solid ${COLORS.gray200}`,
  background: COLORS.offWhite,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: `1px solid ${COLORS.gray100}`,
  minHeight: 48,
  alignItems: 'center',
};

const nameColumnStyle: React.CSSProperties = {
  width: 280,
  flexShrink: 0,
  padding: '8px 16px',
  borderRight: `1px solid ${COLORS.gray200}`,
};
