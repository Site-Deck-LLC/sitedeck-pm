import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { getScheduleActivities, getScheduleBaselines, getScheduleRelationships, sendActivityToBenchmark } from '../api';
import { SubSchedulePanel } from './SubSchedulePanel';
import { COLORS, FONTS, SHADOWS, BORDERS } from '../styles/design-system';
import { ScheduleImportDialog } from './ScheduleImportDialog';
import { ActivityDetailDrawer } from './ActivityDetailDrawer';

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
  linkedBenchmarkDfowId: string | null;
}

interface Relationship {
  id: string;
  predecessorId: string;
  successorId: string;
  relationshipType: string;
  lagDays: number;
  predecessor: { id: string; name: string };
  successor: { id: string; name: string };
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
type ZoomMode = 'week' | 'month' | 'quarter';

const NAME_COL_W = 280;
const ROW_H = 44;
const GROUP_HEADER_H = 40;
const HEADER_H = 48;

const ZOOM_DAY_WIDTH: Record<ZoomMode, number> = {
  week: 24,
  month: 6,
  quarter: 2,
};

export function GanttView({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [zoomMode, setZoomMode] = useState<ZoomMode>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [sendingBenchmarkId, setSendingBenchmarkId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [acts, rels, bls] = await Promise.all([
          getScheduleActivities(projectId),
          getScheduleRelationships(projectId).catch(() => []),
          getScheduleBaselines(projectId),
        ]);
        setActivities(acts);
        setRelationships(rels || []);
        setBaselines(bls || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSendToBenchmark(activityId: string, dfowId: string) {
    setSendingBenchmarkId(activityId);
    try {
      await sendActivityToBenchmark(projectId, activityId, dfowId);
      setActivities((prev) =>
        prev.map((a) => (a.id === activityId ? { ...a, linkedBenchmarkDfowId: dfowId } : a))
      );
      setToast({ message: 'Linked to Benchmark', tone: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to link', tone: 'error' });
    } finally {
      setSendingBenchmarkId(null);
    }
  }

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Zoom Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: COLORS.navyDark, borderRadius: BORDERS.radius.sm, padding: 2 }}>
            {(['week', 'month', 'quarter'] as ZoomMode[]).map((z) => (
              <button
                key={z}
                onClick={() => setZoomMode(z)}
                style={zoomButtonStyle(zoomMode === z)}
              >
                {z === 'week' ? 'Week' : z === 'month' ? 'Month' : 'Quarter'}
              </button>
            ))}
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

          {/* Import Button */}
          <button
            onClick={() => setShowImport(true)}
            style={{
              padding: '6px 14px',
              borderRadius: BORDERS.radius.sm,
              border: `1px solid ${COLORS.orange}`,
              background: 'transparent',
              color: COLORS.orange,
              fontSize: FONTS.size.sm,
              fontWeight: FONTS.weight.semibold,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 12V4M8 4L4 8M8 4L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Import
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
          <GanttChart
            activities={activities}
            baselines={baselines}
            relationships={relationships}
            zoomMode={zoomMode}
            onActivityClick={setSelectedActivityId}
            projectId={projectId}
            sendingBenchmarkId={sendingBenchmarkId}
            onSendToBenchmark={handleSendToBenchmark}
          />
        ) : (
          <TableView
            activities={activities}
            onActivityClick={setSelectedActivityId}
            projectId={projectId}
            sendingBenchmarkId={sendingBenchmarkId}
            onSendToBenchmark={handleSendToBenchmark}
          />
        )}
      </div>

      {showImport && (
        <ScheduleImportDialog
          projectId={projectId}
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false);
            async function reload() {
              try {
                setLoading(true);
                const [acts, rels, bls] = await Promise.all([
                  getScheduleActivities(projectId),
                  getScheduleRelationships(projectId).catch(() => []),
                  getScheduleBaselines(projectId),
                ]);
                setActivities(acts);
                setRelationships(rels || []);
                setBaselines(bls || []);
              } catch (err: any) {
                setError(err.message);
              } finally {
                setLoading(false);
              }
            }
            reload();
          }}
        />
      )}

      <ActivityDetailDrawer
        projectId={projectId}
        activityId={selectedActivityId}
        onClose={() => setSelectedActivityId(null)}
        onNavigate={(id) => setSelectedActivityId(id)}
      />
      <SubSchedulePanel projectId={projectId} />

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          onClick={() => setToast(null)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            maxWidth: 380,
            padding: '12px 16px',
            background: toast.tone === 'error' ? COLORS.red : COLORS.green,
            color: COLORS.white,
            borderRadius: BORDERS.radius.md,
            boxShadow: SHADOWS.lg,
            fontSize: FONTS.size.sm,
            fontWeight: FONTS.weight.medium,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16 }}>●</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

// ── Gantt Chart ──

function GanttChart({
  activities,
  baselines,
  relationships,
  zoomMode,
  onActivityClick,
  projectId,
  sendingBenchmarkId,
  onSendToBenchmark,
}: {
  activities: Activity[];
  baselines: Baseline[];
  relationships: Relationship[];
  zoomMode: ZoomMode;
  onActivityClick: (id: string) => void;
  projectId: string;
  sendingBenchmarkId: string | null;
  onSendToBenchmark: (activityId: string, dfowId: string) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayWidth = ZOOM_DAY_WIDTH[zoomMode];

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
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (!activities.length) {
      const now = new Date();
      return { minDate: now, maxDate: now, totalDays: 1 };
    }
    const dates = activities.flatMap(a => [new Date(a.startDate), new Date(a.endDate)]);
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    min.setHours(0, 0, 0, 0);
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    max.setHours(0, 0, 0, 0);
    const days = Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { minDate: min, maxDate: max, totalDays: days };
  }, [activities]);

  const todayOffset = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
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

  // Build a map of activity positions for dependency arrows
  const activityPositions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    let y = 0;
    for (const [category, acts] of groups) {
      y += GROUP_HEADER_H; // group header height
      if (collapsed.has(category)) continue;
      for (const act of acts) {
        const barLeft = Math.ceil((new Date(act.startDate).getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth;
        const barWidth = Math.max(2, act.duration * dayWidth);
        pos.set(act.id, {
          x: barLeft + barWidth,
          y: y + ROW_H / 2,
        });
        y += ROW_H;
      }
    }
    return pos;
  }, [groups, collapsed, minDate, dayWidth]);

  const getActivityEntryY = useCallback((actId: string) => {
    let y = 0;
    for (const [category, acts] of groups) {
      y += GROUP_HEADER_H;
      if (collapsed.has(category)) continue;
      for (const act of acts) {
        if (act.id === actId) {
          return y + ROW_H / 2;
        }
        y += ROW_H;
      }
    }
    return null;
  }, [groups, collapsed]);

  // Total height of all rows for SVG overlay
  const totalContentHeight = useMemo(() => {
    let h = 0;
    for (const [category, acts] of groups) {
      h += GROUP_HEADER_H;
      if (!collapsed.has(category)) {
        h += acts.length * ROW_H;
      }
    }
    return h;
  }, [groups, collapsed]);

  const getBarLeft = useCallback((act: Activity) => {
    return Math.ceil((new Date(act.startDate).getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth;
  }, [minDate, dayWidth]);

  const getBarWidth = useCallback((act: Activity) => {
    return Math.max(2, act.duration * dayWidth);
  }, [dayWidth]);

  function toggleGroup(cat: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function getBarColor(act: Activity): string {
    if (act.status === 'complete') return '#9CA3AF';
    if (act.status === 'in_progress' && !act.isCritical) return '#22C55E';
    if (act.status === 'in_progress' && act.isCritical) return '#F59E0B';
    if (act.status === 'delayed') return '#EF4444';
    if (act.isCritical) return '#EF4444';
    return COLORS.navy;
  }

  function getBarBorder(act: Activity): string | undefined {
    if (act.isCritical) return `3px solid #EF4444`;
    if (act.status === 'not_started') return `2px solid ${COLORS.navy}`;
    return undefined;
  }

  function getBarBackground(act: Activity): string {
    if (act.status === 'not_started') return 'transparent';
    return getBarColor(act);
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
      <div ref={scrollRef} style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto', position: 'relative' }}>
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
                const border = getBarBorder(act);
                const bg = getBarBackground(act);
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
                      <BenchmarkLinkRow
                        activity={act}
                        projectId={projectId}
                        sendingId={sendingBenchmarkId}
                        onSend={onSendToBenchmark}
                      />
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
                              background: COLORS.navy,
                              opacity: 0.6,
                              zIndex: 1,
                            }}
                            title={`Baseline: ${baselineAct!.startDate!.slice(0, 10)} → ${baselineAct!.endDate!.slice(0, 10)}`}
                          />
                        )}

                        {/* Actual bar or milestone diamond */}
                        {act.isMilestone ? (
                          <div
                            onClick={() => onActivityClick(act.id)}
                            style={{
                              position: 'absolute',
                              left: barLeft - 8,
                              top: 10,
                              width: 16,
                              height: 16,
                              transform: 'rotate(45deg)',
                              background: color,
                              border: `2px solid ${COLORS.white}`,
                              zIndex: 3,
                              cursor: 'pointer',
                            }}
                            title={`${act.name}: ${act.startDate.slice(0, 10)} (Milestone)`}
                          />
                        ) : (
                          <div
                            onClick={() => onActivityClick(act.id)}
                            style={{
                              position: 'absolute',
                              left: barLeft,
                              top: 10,
                              width: Math.max(barWidth, 3),
                              height: 18,
                              borderRadius: 4,
                              background: bg,
                              border: border,
                              opacity: act.status === 'not_started' ? 0.7 : 1,
                              cursor: 'pointer',
                              transition: 'opacity 0.15s',
                              zIndex: 2,
                            }}
                            title={`${act.name}: ${act.startDate.slice(0, 10)} → ${act.endDate.slice(0, 10)} (${Math.round(act.percentComplete * 100)}%)${act.isCritical ? ' — CRITICAL' : ''}`}
                          >
                            {/* Progress fill */}
                            {act.percentComplete > 0 && (
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
                          </div>
                        )}

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

        {/* Dependency arrows overlay (SVG) */}
        {relationships.length > 0 && (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: NAME_COL_W,
              width: timelineWidth,
              height: totalContentHeight,
              pointerEvents: 'none',
              zIndex: 4,
              overflow: 'visible',
            }}
          >
            {relationships.map((rel) => {
              const predPos = activityPositions.get(rel.predecessorId);
              const succY = getActivityEntryY(rel.successorId);
              if (!predPos || succY === null) return null;

              // Find successor start X
              const succAct = activities.find(a => a.id === rel.successorId);
              if (!succAct) return null;
              const succX = getBarLeft(succAct);

              const startX = predPos.x;
              const startY = predPos.y;
              const endX = succX;
              const endY = succY;

              // Draw curved path: right from predecessor end, then down/up, then left into successor start
              const midX = startX + 10;
              const path = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;

              return (
                <g key={rel.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke={COLORS.textMuted}
                    strokeWidth={1}
                    strokeDasharray={rel.relationshipType !== 'FS' ? '3 3' : undefined}
                  />
                  <polygon
                    points={`${endX},${endY} ${endX - 5},${endY - 3} ${endX - 5},${endY + 3}`}
                    fill={COLORS.textMuted}
                  />
                </g>
              );
            })}
          </svg>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '12px 16px', borderTop: `1px solid ${COLORS.gray200}`, background: COLORS.offWhite }}>
          <span style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold, color: COLORS.textSecondary, textTransform: 'uppercase' }}>Legend:</span>
          <LegendItem color="#9CA3AF" label="Complete" />
          <LegendItem color="#22C55E" label="On Track" />
          <LegendItem color="#F59E0B" label="Delayed" />
          <LegendItem color="#EF4444" label="Critical" />
          <LegendItem color={COLORS.navy} label="Not Started" />
          <LegendItem color={COLORS.navy} label="Baseline" />
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

function TableView({
  activities,
  onActivityClick,
  projectId,
  sendingBenchmarkId,
  onSendToBenchmark,
}: {
  activities: Activity[];
  onActivityClick: (id: string) => void;
  projectId: string;
  sendingBenchmarkId: string | null;
  onSendToBenchmark: (activityId: string, dfowId: string) => Promise<void>;
}) {
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
            <th style={thStyle}>Benchmark</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act) => (
            <tr
              key={act.id}
              onClick={() => onActivityClick(act.id)}
              style={{ borderBottom: `1px solid ${COLORS.gray100}`, cursor: 'pointer' }}
            >
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
              <td style={tdStyle}>
                <BenchmarkLinkRow activity={act} projectId={projectId} sendingId={sendingBenchmarkId} onSend={onSendToBenchmark} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BenchmarkLinkRow({
  activity,
  sendingId,
  onSend,
}: {
  activity: Activity;
  projectId: string;
  sendingId: string | null;
  onSend: (activityId: string, dfowId: string) => Promise<void>;
}) {
  const [dfowInput, setDfowInput] = useState('');
  const [showInput, setShowInput] = useState(false);

  if (activity.linkedBenchmarkDfowId) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 4,
          padding: '2px 8px',
          borderRadius: 4,
          background: 'rgba(34,160,107,0.1)',
          color: '#22A06B',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.3px',
          textTransform: 'uppercase',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Linked to Benchmark
      </span>
    );
  }

  if (showInput) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <input
          value={dfowInput}
          onChange={(e) => setDfowInput(e.target.value)}
          placeholder="DFOW ID"
          style={{
            width: 100,
            padding: '3px 6px',
            borderRadius: 4,
            border: `1px solid ${COLORS.gray200}`,
            fontSize: 11,
            outline: 'none',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && dfowInput.trim()) {
              onSend(activity.id, dfowInput.trim());
              setShowInput(false);
              setDfowInput('');
            }
            if (e.key === 'Escape') {
              setShowInput(false);
              setDfowInput('');
            }
          }}
          autoFocus
        />
        <button
          disabled={!dfowInput.trim() || sendingId === activity.id}
          onClick={() => {
            onSend(activity.id, dfowInput.trim());
            setShowInput(false);
            setDfowInput('');
          }}
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            border: 'none',
            background: COLORS.orange,
            color: COLORS.white,
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: !dfowInput.trim() || sendingId === activity.id ? 0.6 : 1,
          }}
        >
          {sendingId === activity.id ? 'Sending…' : 'Send'}
        </button>
        <button
          onClick={() => { setShowInput(false); setDfowInput(''); }}
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            border: `1px solid ${COLORS.gray200}`,
            background: COLORS.white,
            color: COLORS.textSecondary,
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      style={{
        marginTop: 4,
        padding: '2px 8px',
        borderRadius: 4,
        border: `1px solid ${COLORS.orange}`,
        background: 'transparent',
        color: COLORS.orange,
        fontSize: 10,
        fontWeight: 600,
        cursor: 'pointer',
        letterSpacing: '0.3px',
        textTransform: 'uppercase',
      }}
    >
      Send to Benchmark
    </button>
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

function zoomButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '5px 12px',
    borderRadius: BORDERS.radius.sm,
    border: 'none',
    background: active ? COLORS.orange : 'transparent',
    color: COLORS.white,
    fontSize: FONTS.size.xs,
    fontWeight: active ? FONTS.weight.semibold : FONTS.weight.medium,
    cursor: 'pointer',
    transition: 'all 0.15s',
    textTransform: 'capitalize',
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
  position: 'relative',
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
