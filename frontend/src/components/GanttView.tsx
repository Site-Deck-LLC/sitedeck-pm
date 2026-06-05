import { useEffect, useState, useMemo } from 'react';
import { getScheduleActivities, getScheduleBaselines } from '../api';
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
  wbsCategory: string | null;
  totalFloat: number | null;
  freeFloat: number | null;
}

interface BaselineActivity {
  id?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  duration?: number;
}

interface Baseline {
  id: string;
  name: string;
  baselineDate: string;
  activities: BaselineActivity[];
  locked: boolean;
}

type ViewMode = 'graph' | 'table';

const NAME_COL_W = 280;
const ROW_H = 44;
const GROUP_HEADER_H = 40;
const HEADER_H = 48;
const MIN_DAY_W = 2;
const MAX_DAY_W = 8;

export function GanttView({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [acts, bls] = await Promise.all([
          getScheduleActivities(projectId),
          getScheduleBaselines(projectId),
        ]);
        setActivities(acts);
        setBaselines(bls || []);
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
            Schedule
          </span>
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: COLORS.navyDark, borderRadius: BORDERS.radius.sm, padding: 2 }}>
          <button
            onClick={() => setViewMode('graph')}
            style={toggleButtonStyle(viewMode === 'graph')}
          >
            Graph
          </button>
          <button
            onClick={() => setViewMode('table')}
            style={toggleButtonStyle(viewMode === 'table')}
          >
            Table
          </button>
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
        ) : viewMode === 'graph' ? (
          <GanttChart activities={activities} baselines={baselines} />
        ) : (
          <TableView activities={activities} />
        )}
      </div>
    </div>
  );
}

// ── Gantt Chart ──

function GanttChart({ activities, baselines }: { activities: Activity[]; baselines: Baseline[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Latest baseline for comparison
  const latestBaseline = useMemo(() => {
    if (!baselines.length) return null;
    const sorted = [...baselines].sort((a, b) => new Date(b.baselineDate).getTime() - new Date(a.baselineDate).getTime());
    return sorted[0];
  }, [baselines]);

  const baselineMap = useMemo(() => {
    const map = new Map<string, BaselineActivity>();
    if (latestBaseline?.activities) {
      for (const a of latestBaseline.activities) {
        if (a.id || a.name) {
          map.set(a.id || a.name!, a);
        }
      }
    }
    return map;
  }, [latestBaseline]);

  // Group by WBS category
  const groups = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of activities) {
      const cat = a.wbsCategory || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(a);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [activities]);

  // Timeline bounds
  const { minDate, maxDate, totalDays, dayWidth } = useMemo(() => {
    if (!activities.length) {
      const now = new Date();
      return { minDate: now, maxDate: now, totalDays: 1, dayWidth: MAX_DAY_W };
    }
    const dates = activities.flatMap(a => [new Date(a.startDate), new Date(a.endDate)]);
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    const days = Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const dw = Math.max(MIN_DAY_W, Math.min(MAX_DAY_W, 1200 / days));
    return { minDate: min, maxDate: max, totalDays: days, dayWidth: dw };
  }, [activities]);

  const todayOffset = useMemo(() => {
    const now = new Date();
    if (now < minDate) return -1;
    return Math.ceil((now.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
  }, [minDate]);

  // Month markers
  const months = useMemo(() => {
    const list: Date[] = [];
    const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) {
      list.push(new Date(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
    return list;
  }, [minDate, maxDate]);

  const timelineWidth = totalDays * dayWidth;

  function toggleGroup(cat: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function getBarColor(act: Activity): string {
    if (act.isCritical) return COLORS.red;
    if (act.status === 'complete') return COLORS.green;
    if (act.status === 'in_progress') return COLORS.orange;
    if (act.status === 'delayed') return COLORS.red;
    return COLORS.gray300;
  }

  function getBarLeft(act: Activity): number {
    return Math.ceil((new Date(act.startDate).getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth;
  }

  function getBarWidth(act: Activity): number {
    return Math.max(2, act.duration * dayWidth);
  }

  return (
    <div style={chartCardStyle}>
      {/* Header row */}
      <div style={{ display: 'flex', borderBottom: `2px solid ${COLORS.gray200}`, background: COLORS.offWhite }}>
        <div style={{ width: NAME_COL_W, flexShrink: 0, padding: '14px 16px', fontWeight: FONTS.weight.bold, fontSize: FONTS.size.sm, color: COLORS.textPrimary, borderRight: `1px solid ${COLORS.gray200}` }}>
          Activity
        </div>
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden', height: HEADER_H }}>
          <div style={{ position: 'relative', width: timelineWidth, height: '100%' }}>
            {months.map((m, i) => {
              const left = Math.ceil((m.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left,
                    top: 0,
                    bottom: 0,
                    padding: '14px 8px',
                    borderLeft: `1px solid ${COLORS.gray200}`,
                    fontSize: FONTS.size.xs,
                    fontWeight: FONTS.weight.semibold,
                    color: COLORS.textSecondary,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </div>
              );
            })}
            {/* Today marker in header */}
            {todayOffset >= 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: todayOffset * dayWidth,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: COLORS.orange,
                  zIndex: 2,
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 2,
                  left: -14,
                  background: COLORS.orange,
                  color: COLORS.white,
                  fontSize: FONTS.size.xs,
                  fontWeight: FONTS.weight.bold,
                  padding: '1px 4px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                }}>
                  TODAY
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
        {groups.map(([category, acts]) => {
          const isCollapsed = collapsed.has(category);
          return (
            <div key={category}>
              {/* Group header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  height: GROUP_HEADER_H,
                  background: COLORS.gray100,
                  borderBottom: `1px solid ${COLORS.gray200}`,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => toggleGroup(category)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 8, transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                  <path d="M4 2L9 7L4 12" stroke={COLORS.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
                  {category}
                </span>
                <span style={{ marginLeft: 8, fontSize: FONTS.size.xs, color: COLORS.textMuted, fontWeight: FONTS.weight.medium }}>
                  {acts.length} activities
                </span>
              </div>

              {!isCollapsed && acts.map((act) => {
                const barLeft = getBarLeft(act);
                const barWidth = getBarWidth(act);
                const color = getBarColor(act);
                const baselineAct = baselineMap.get(act.id) || baselineMap.get(act.name);
                const hasBaseline = baselineAct && baselineAct.startDate && baselineAct.endDate;
                const baselineLeft = hasBaseline
                  ? Math.ceil((new Date(baselineAct!.startDate!).getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth
                  : 0;
                const baselineWidth = hasBaseline
                  ? Math.max(2, (baselineAct!.duration || Math.ceil((new Date(baselineAct!.endDate!).getTime() - new Date(baselineAct!.startDate!).getTime()) / (1000 * 60 * 60 * 24))) * dayWidth)
                  : 0;
                const baselineDiffers = hasBaseline && (Math.abs(baselineLeft - barLeft) > 2 || Math.abs(baselineWidth - barWidth) > 2);

                return (
                  <div key={act.id} style={{ display: 'flex', borderBottom: `1px solid ${COLORS.gray100}`, minHeight: ROW_H, alignItems: 'center' }}>
                    {/* Name column */}
                    <div style={{ width: NAME_COL_W, flexShrink: 0, padding: '8px 16px', borderRight: `1px solid ${COLORS.gray200}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, color: COLORS.textPrimary }}>
                          {act.name}
                        </span>
                        {act.isMilestone && (
                          <span style={{ fontSize: FONTS.size.xs, color: COLORS.orange, fontWeight: FONTS.weight.semibold }}>M</span>
                        )}
                        {act.isCritical && (
                          <span style={{ fontSize: FONTS.size.xs, color: COLORS.red, fontWeight: FONTS.weight.semibold }}>CP</span>
                        )}
                      </div>
                      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: 2 }}>
                        {act.startDate.slice(0, 10)} → {act.endDate.slice(0, 10)} · {act.duration}d
                      </div>
                    </div>

                    {/* Timeline column */}
                    <div style={{ position: 'relative', flex: 1, height: ROW_H, overflow: 'hidden' }}>
                      <div style={{ position: 'relative', width: timelineWidth, height: '100%' }}>
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

                        {/* Today line */}
                        {todayOffset >= 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: todayOffset * dayWidth,
                              top: 0,
                              bottom: 0,
                              width: 2,
                              background: COLORS.orange,
                              zIndex: 2,
                              opacity: 0.8,
                            }}
                          />
                        )}

                        {/* Baseline bar (thin line below actual) */}
                        {baselineDiffers && (
                          <div
                            style={{
                              position: 'absolute',
                              left: baselineLeft,
                              top: 28,
                              width: baselineWidth,
                              height: 3,
                              borderRadius: 2,
                              background: COLORS.textMuted,
                              opacity: 0.6,
                              zIndex: 1,
                            }}
                            title={`Baseline: ${baselineAct!.startDate!.slice(0, 10)} → ${baselineAct!.endDate!.slice(0, 10)}`}
                          />
                        )}

                        {/* Actual bar */}
                        <div
                          style={{
                            position: 'absolute',
                            left: barLeft,
                            top: 10,
                            width: Math.max(barWidth, 3),
                            height: act.isMilestone ? 20 : 18,
                            borderRadius: act.isMilestone ? '50%' : 4,
                            background: color,
                            opacity: act.status === 'not_started' ? 0.55 : 1,
                            cursor: 'pointer',
                            transition: 'opacity 0.15s',
                            zIndex: 2,
                          }}
                          title={`${act.name}: ${act.startDate.slice(0, 10)} → ${act.endDate.slice(0, 10)} (${Math.round(act.percentComplete * 100)}%)${act.isCritical ? ' — CRITICAL' : ''}`}
                        >
                          {/* Progress fill */}
                          {!act.isMilestone && act.percentComplete > 0 && (
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${act.percentComplete * 100}%`,
                                borderRadius: '4px 0 0 4px',
                                background: 'rgba(255,255,255,0.4)',
                              }}
                            />
                          )}
                          {/* Milestone diamond */}
                          {act.isMilestone && (
                            <div
                              style={{
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%) rotate(45deg)',
                                width: 14,
                                height: 14,
                                background: COLORS.navy,
                                border: `2px solid ${COLORS.white}`,
                              }}
                            />
                          )}
                        </div>

                        {/* Percent label */}
                        {act.percentComplete > 0 && !act.isMilestone && (
                          <span
                            style={{
                              position: 'absolute',
                              left: barLeft + barWidth + 5,
                              top: 11,
                              fontSize: FONTS.size.xs,
                              color: COLORS.textSecondary,
                              fontWeight: FONTS.weight.medium,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {Math.round(act.percentComplete * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '12px 16px', borderTop: `1px solid ${COLORS.gray200}`, background: COLORS.offWhite }}>
          <span style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold, color: COLORS.textSecondary, textTransform: 'uppercase' }}>Legend:</span>
          <LegendItem color={COLORS.green} label="Complete" />
          <LegendItem color={COLORS.orange} label="In Progress" />
          <LegendItem color={COLORS.red} label="Critical / Delayed" />
          <LegendItem color={COLORS.gray300} label="Not Started" />
          <LegendItem color={COLORS.textMuted} label="Baseline" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 2, height: 14, background: COLORS.orange }} />
            <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
      <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>{label}</span>
    </div>
  );
}

// ── Table View ──

function TableView({ activities }: { activities: Activity[] }) {
  return (
    <div style={tableCardStyle}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONTS.size.sm }}>
        <thead>
          <tr style={{ background: COLORS.offWhite, borderBottom: `2px solid ${COLORS.gray200}` }}>
            <th style={thStyle}>Activity</th>
            <th style={thStyle}>WBS</th>
            <th style={thStyle}>Start</th>
            <th style={thStyle}>End</th>
            <th style={thStyle}>Duration</th>
            <th style={thStyle}>% Complete</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Float</th>
            <th style={thStyle}>Critical</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act) => (
            <tr key={act.id} style={{ borderBottom: `1px solid ${COLORS.gray100}` }}>
              <td style={tdStyle}>
                <div style={{ fontWeight: FONTS.weight.medium, color: COLORS.textPrimary }}>{act.name}</div>
                {act.isMilestone && <span style={{ fontSize: FONTS.size.xs, color: COLORS.orange }}>Milestone</span>}
              </td>
              <td style={tdStyle}><span style={{ color: COLORS.textSecondary }}>{act.wbsCode || '—'}</span></td>
              <td style={tdStyle}>{act.startDate.slice(0, 10)}</td>
              <td style={tdStyle}>{act.endDate.slice(0, 10)}</td>
              <td style={tdStyle}>{act.duration}d</td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 60, height: 6, borderRadius: 3, background: COLORS.gray200 }}>
                    <div style={{ width: `${act.percentComplete * 100}%`, height: '100%', borderRadius: 3, background: act.percentComplete >= 1 ? COLORS.green : act.percentComplete > 0 ? COLORS.orange : COLORS.gray300 }} />
                  </div>
                  <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, fontWeight: FONTS.weight.medium }}>
                    {Math.round(act.percentComplete * 100)}%
                  </span>
                </div>
              </td>
              <td style={tdStyle}><StatusBadge status={act.status} /></td>
              <td style={tdStyle}><span style={{ color: COLORS.textSecondary }}>{act.totalFloat != null ? `${act.totalFloat.toFixed(1)}d` : '—'}</span></td>
              <td style={tdStyle}>{act.isCritical ? <span style={{ color: COLORS.red, fontWeight: FONTS.weight.semibold }}>Yes</span> : <span style={{ color: COLORS.textMuted }}>No</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    complete: { bg: COLORS.greenLight, color: COLORS.green, label: 'Complete' },
    in_progress: { bg: '#FFF3E0', color: COLORS.orange, label: 'In Progress' },
    delayed: { bg: COLORS.redLight, color: COLORS.red, label: 'Delayed' },
    not_started: { bg: COLORS.gray100, color: COLORS.textSecondary, label: 'Not Started' },
  };
  const c = config[status] || config.not_started;
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: '20px',
      fontSize: FONTS.size.xs,
      fontWeight: FONTS.weight.semibold,
      background: c.bg,
      color: c.color,
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
    }}>
      {c.label}
    </span>
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

function toggleButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '5px 14px',
    borderRadius: BORDERS.radius.sm,
    border: 'none',
    background: active ? COLORS.orange : 'transparent',
    color: COLORS.white,
    fontSize: FONTS.size.sm,
    fontWeight: active ? FONTS.weight.semibold : FONTS.weight.medium,
    cursor: 'pointer',
    transition: 'all 0.15s',
  };
}

const contentStyle: React.CSSProperties = {
  maxWidth: 1400,
  margin: '0 auto',
  padding: 24,
};

const chartCardStyle: React.CSSProperties = {
  background: COLORS.white,
  borderRadius: BORDERS.radius.lg,
  border: `1px solid ${COLORS.gray200}`,
  boxShadow: SHADOWS.md,
  overflow: 'hidden',
};

const tableCardStyle: React.CSSProperties = {
  background: COLORS.white,
  borderRadius: BORDERS.radius.lg,
  border: `1px solid ${COLORS.gray200}`,
  boxShadow: SHADOWS.md,
  overflow: 'auto',
};

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: FONTS.size.xs,
  fontWeight: FONTS.weight.semibold,
  color: COLORS.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: COLORS.textPrimary,
  verticalAlign: 'top',
};
