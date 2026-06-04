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
        // Sort by start date
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

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center', padding: '80px 0', color: COLORS.textSecondary }}>
          Loading schedule...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center', padding: '80px 0', color: COLORS.red }}>{error}</div>
      </div>
    );
  }

  // Calculate timeline bounds
  const allDates = activities.flatMap(a => [new Date(a.startDate), new Date(a.endDate)]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Month markers
  const months: Date[] = [];
  let current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (current <= maxDate) {
    months.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }

  const dayWidth = Math.max(2, Math.min(6, 1200 / totalDays));
  const rowHeight = 40;

  return (
    <div style={pageStyle}>
      {/* Nav */}
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
        <span style={{ color: COLORS.gray400, fontSize: FONTS.size.sm }}>
          {activities.length} activities · {totalDays} days
        </span>
      </nav>

      <div style={contentStyle}>
        {/* Gantt Container */}
        <div style={ganttCardStyle}>
          {/* Timeline Header */}
          <div style={timelineHeaderStyle}>
            <div style={{ width: 280, flexShrink: 0, padding: '12px 16px', borderRight: `1px solid ${COLORS.gray200}`, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
              Activity
            </div>
            <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
              {/* Month markers */}
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

          {/* Activity Rows */}
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
                  {/* Name column */}
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

                  {/* Bar column */}
                  <div style={{ position: 'relative', flex: 1, height: rowHeight }}>
                    {/* Grid lines */}
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

                    {/* Activity bar */}
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
                      {/* Progress fill */}
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
                      {/* Milestone diamond */}
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

                    {/* Percent label */}
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
      </div>
    </div>
  );
}

// ── Styles ──

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
