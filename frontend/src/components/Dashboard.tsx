import { useEffect, useState } from 'react';
import { canEditSchedule } from '../auth';
import { fetchApi } from '../api';
import {
  getDashboard,
  getProjects,
  getCashFlow,
  getSchedulePerformance,
  getSafetyPerformance,
  getCrewStatus,
  getAgentBrief,
} from '../api';
import { COLORS, STATUS_COLORS, SHADOWS, FONTS, BORDERS } from '../styles/design-system';
import { Gauge } from './Gauge';
import { CashFlowChart } from './CashFlowChart';
import { SchedulePerformanceChart } from './SchedulePerformanceChart';
import { SafetyPerformancePanel } from './SafetyPerformancePanel';
import { CrewPanel } from './CrewPanel';
import { AttendanceEntryModal } from './AttendanceEntryModal';
import { EquipmentStatusModal } from './EquipmentStatusModal';
import { MeetingsView } from './MeetingsView';
import { CommunicationsView } from './CommunicationsView';
import { EquipmentPage } from './EquipmentPage';
import { WbsBuilder } from './WbsBuilder';
import { IssueDetailDrawer } from './IssueDetailDrawer';
import { RfiDetailView } from './RfiDetailView';
import { SubmittalDetailView } from './SubmittalDetailView';
import { ChangeOrderDetailView } from './ChangeOrderDetailView';
import { RiskIntelligencePanel } from './RiskIntelligencePanel';
import { ForecastCard } from './ForecastCard';
import { ProjectSidebar, type ProjectNavItem } from './ProjectSidebar';
import type { ConnectedProductsState } from './ConnectedProducts';
import type { SidebarUser } from './Sidebar';

interface Tile {
  name: string;
  status: 'green' | 'amber' | 'red';
  summary: string;
  count: number;
}

interface DashboardData {
  tiles: Record<string, Tile>;
  projectValue: number | null;
  crew: { speciality: number; general: number; equipment: number; equipmentActive: number; equipmentIdle: number; dailyBurnRate: number };
  upcoming: {
    nextMilestone: { name: string; daysLeft: number; taskValue: number } | null;
    nextCheckpoint: { name: string; daysLeft: number; taskCount: number } | null;
    nextDraw: { name: string; daysLeft: number; drawValue: number } | null;
  };
  performance: {
    cpi: number;
    spi: number;
    costVariance: number;
    scheduleVariance: number;
  };
  communications: {
    rfis: { id: string; number: string; recordId: string; subject: string; status: string; date: string }[];
    fieldIssues: { id: string; recordId: string; title: string; status: string; priority: string; date: string }[];
  };
  changeOrders: {
    approved: number;
    pending: number;
    approvedCost: number;
    approvedSchedule: number;
    pendingCost: number;
    pendingSchedule: number;
    recentIds: Array<{ id: string; coNumber: string; description: string; status: string; dollarValue: number }>;
  };
  metrics: {
    plannedDays: number;
    plannedEffort: number;
    completedPct: number;
  };
}

interface Brief {
  generatedAt: string;
  copilot: { alertCount: number; compoundFlagCount: number; topAlerts: any[] };
  coach: { tipCount: number; nextStep: { label: string; link: string } | null };
  standards: { overallStatus: 'green' | 'amber' | 'red'; checkCount: number; noticeCount: number; upcomingNotices: any[] };
}

// ─── SVG Icons ───
const Icons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  schedule: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="M7 16l4-6 4 3 4-5" />
    </svg>
  ),
  rfi: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  chat: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  report: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
    </svg>
  ),
  gear: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  bell: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  apps: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  help: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  user: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  dollar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  clock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  mic: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  wallet: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M16 12h.01" />
    </svg>
  ),
  trending: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  alertTriangle: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

// ─── Status Tile (hero weight) ───
function StatusTile({ tile, onClick }: { tile: Tile; onClick: () => void }) {
  const color = STATUS_COLORS[tile.status].bg;
  return (
    <div
      onClick={onClick}
      style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.gray200}`,
        borderTop: `4px solid ${color}`,
        borderRadius: BORDERS.radius.lg,
        padding: 16,
        boxShadow: SHADOWS.sm,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 96,
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = SHADOWS.md; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = SHADOWS.sm; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {tile.name}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: FONTS.weight.bold,
            padding: '2px 8px',
            borderRadius: 10,
            background: color,
            color: COLORS.white,
          }}
        >
          {tile.status.toUpperCase()}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, lineHeight: 1 }}>
        {tile.count > 0 ? tile.count : '✓'}
      </div>
      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, lineHeight: 1.3 }}>
        {tile.summary}
      </div>
    </div>
  );
}

// ─── Empty State ───
function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        textAlign: 'center',
        color: COLORS.textMuted,
      }}
    >
      <div style={{ color: COLORS.gray300, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: FONTS.size.sm, lineHeight: 1.4, maxWidth: 320 }}>{message}</div>
    </div>
  );
}

// ─── Shimmer line ───
function ShimmerLine({ width = '100%' }: { width?: string }) {
  return (
    <div
      style={{
        height: 10,
        width,
        borderRadius: 4,
        background: `linear-gradient(90deg, ${COLORS.gray200} 0%, ${COLORS.gray100} 50%, ${COLORS.gray200} 100%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    >
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

// ─── Morning Brief (rewritten) ───
function MorningBriefCard({ brief, loading }: { brief: Brief | null; loading: boolean; projectId?: string }) {
  const isWarmingUp = loading || !brief;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #1B2A4A 0%, #E8720C 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: COLORS.white,
            fontSize: 16,
          }}
        >
          ✦
        </div>
        <div>
          <div style={{ fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
            Good morning
          </div>
          <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
            {isWarmingUp
              ? 'Your AI co-pilot is warming up.'
              : `${brief!.copilot.alertCount} alert${brief!.copilot.alertCount !== 1 ? 's' : ''} • ${brief!.standards.noticeCount} notice${brief!.standards.noticeCount !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {isWarmingUp ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <ShimmerLine width="80%" />
          <ShimmerLine width="95%" />
          <ShimmerLine width="70%" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {brief!.copilot.topAlerts.length > 0 ? (
            brief!.copilot.topAlerts.slice(0, 3).map((a: any, i: number) => (
              <div
                key={i}
                style={{
                  fontSize: FONTS.size.sm,
                  color: COLORS.textPrimary,
                  padding: '6px 10px',
                  background: COLORS.gray100,
                  borderLeft: `3px solid ${STATUS_COLORS[a.severity]?.bg || COLORS.amber}`,
                  borderRadius: 4,
                }}
              >
                {a.message}
              </div>
            ))
          ) : (
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, padding: '6px 10px' }}>
              No priority alerts today. All systems green.
            </div>
          )}
        </div>
      )}

      <button
        disabled
        title="Full brief view coming in a future sprint"
        style={{
          background: COLORS.orange,
          color: COLORS.white,
          border: 'none',
          padding: '8px 16px',
          borderRadius: BORDERS.radius.md,
          fontSize: FONTS.size.sm,
          fontWeight: FONTS.weight.semibold,
          cursor: 'not-allowed',
          opacity: 0.55,
        }}
      >
        View Full Brief
      </button>
    </div>
  );
}

export function Dashboard({
  projectId,
  onBack: _onBack,
  onNavigateHome,
  onLogout,
  onSelectTile,
  onNavigateOwnerReports,
  onNavigateLessons,
  onNavigateDrawings,
}: {
  projectId: string;
  onBack: () => void;
  onNavigateHome: () => void;
  onLogout: () => void;
  onSelectTile: (key: string) => void;
  onNavigateOwnerReports?: () => void;
  onNavigateLessons?: () => void;
  onNavigateDrawings?: () => void;
}) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [currentProject, setCurrentProject] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAlerts, setShowAlerts] = useState(false);
  const [showProjectSwitcher, setShowProjectSwitcher] = useState(false);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'success' | 'error' } | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedRfiId, setSelectedRfiId] = useState<string | null>(null);
  const [selectedSubmittalId, setSelectedSubmittalId] = useState<string | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState<boolean>(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState<boolean>(false);
  const [selectedCoId, setSelectedCoId] = useState<string | null>(null);
  const [ownerReportDue, setOwnerReportDue] = useState<boolean>(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState<boolean>(false);
  const [connectedProducts, setConnectedProducts] = useState<ConnectedProductsState | undefined>();
  const [user, setUser] = useState<SidebarUser | null>(null);

  // Visualization data
  const [cashFlowData, setCashFlowData] = useState<any>(null);
  const [schedulePerfData, setSchedulePerfData] = useState<any>(null);
  const [safetyPerfData, setSafetyPerfData] = useState<any>(null);
  const [crewStatus, setCrewStatus] = useState<any>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [data, projectList, cf, sp, sf, cs] = await Promise.all([
          getDashboard(projectId),
          getProjects(),
          getCashFlow(projectId).catch(() => null),
          getSchedulePerformance(projectId).catch(() => null),
          getSafetyPerformance(projectId).catch(() => null),
          getCrewStatus(projectId).catch(() => null),
        ]);
        setProjects(projectList);
        const cp = projectList.find((p: any) => p.id === projectId);
        setCurrentProject(cp || { id: projectId, name: 'Project' });
        setDashboard(data);
        setCashFlowData(cf);
        setSchedulePerfData(sp);
        setSafetyPerfData(sf);
        setCrewStatus(cs);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  // Load morning brief (separate so it can fail without blocking dashboard)
  useEffect(() => {
    let cancelled = false;
    async function loadBrief() {
      try {
        const data = await getAgentBrief(projectId);
        if (!cancelled) {
          setBrief(data);
          setBriefLoading(false);
        }
      } catch {
        if (!cancelled) setBriefLoading(false);
      }
    }
    loadBrief();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Refresh crew status every 5 minutes
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const cs = await getCrewStatus(projectId);
        setCrewStatus(cs);
      } catch {
        // ignore
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [projectId]);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Owner report due: if the most-recent Friday's report is missing for
  // this project, show the "Owner Report Due" chip. We compute the
  // expected Friday and check the report list.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const reports: Array<{ weekEnding: string }> = await fetchApi(
          `/api/v1/projects/${projectId}/agents/owner-report`
        );
        if (cancelled) return;
        const lastFriday = new Date();
        lastFriday.setUTCHours(0, 0, 0, 0);
        const dow = lastFriday.getUTCDay();
        const back = dow >= 5 ? dow - 5 : dow + 2;
        lastFriday.setUTCDate(lastFriday.getUTCDate() - back);
        const fridayStr = lastFriday.toISOString().slice(0, 10);
        setOwnerReportDue(!reports.some((r) => r.weekEnding.slice(0, 10) === fridayStr));
      } catch {
        // Non-fatal — chip just won't show.
        setOwnerReportDue(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Best-effort fetch of /api/v1/health for the ConnectedProducts dots.
  // The endpoint is unauthenticated, but a missing token doesn't matter —
  // the route is open. We never throw from here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/health');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.connectedProducts) {
          setConnectedProducts(data.connectedProducts);
        }
      } catch {
        // Health endpoint down — leave undefined, dots render gray.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Best-effort read of current user info for the sidebar footer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let info: SidebarUser = {
        email: localStorage.getItem('sitedeck-dev-email') || null,
        displayName: null,
      };
      try {
        const { getFirebaseAuth } = await import('../firebase');
        const auth = getFirebaseAuth();
        if (auth?.currentUser) {
          info = {
            email: auth.currentUser.email ?? info.email,
            displayName: auth.currentUser.displayName ?? null,
          };
        }
      } catch {
        // No Firebase or not initialized — keep the dev fallback.
      }
      if (!cancelled) setUser(info);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function showToast(message: string, tone: 'info' | 'success' | 'error' = 'info') {
    setToast({ message, tone });
  }

  const tiles = dashboard ? Object.entries(dashboard.tiles) : [];
  const criticalTiles = tiles.filter(([, tile]) => tile.status === 'red');
  const alertCount = criticalTiles.reduce((sum, [, tile]) => sum + (tile.count || 0), 0);

  const navItems: ProjectNavItem[] = [
    { key: 'dashboard', icon: Icons.dashboard, label: 'Dashboard' },
    { key: 'schedule', icon: Icons.schedule, label: 'Schedule' },
    { key: 'rfi', icon: Icons.rfi, label: 'RFI' },
    { key: 'comm', icon: Icons.chat, label: 'Comm' },
    { key: 'meetings', icon: Icons.schedule, label: 'Meetings' },
    { key: 'reports', icon: Icons.report, label: 'Reports' },
    { key: 'owner-reports', icon: Icons.report, label: 'Owner Reports' },
    { key: 'lessons', icon: Icons.report, label: 'Lessons' },
    { key: 'drawings', icon: Icons.report, label: 'Drawings' },
    { key: 'equipment', icon: Icons.gear, label: 'Equipment' },
    { key: 'wbs', icon: Icons.report, label: 'WBS' },
    { key: 'settings', icon: Icons.gear, label: 'Settings' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: COLORS.offWhite }}>
        <div style={{ textAlign: 'center', color: COLORS.textSecondary }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${COLORS.gray200}`, borderTop: `3px solid ${COLORS.orange}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: COLORS.offWhite }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: COLORS.red, fontWeight: FONTS.weight.semibold, marginBottom: 16, fontSize: FONTS.size.md }}>{error}</div>
          <p style={{ color: COLORS.textSecondary, marginBottom: 20 }}>Your session may have expired.</p>
          <button onClick={onLogout} style={{ padding: '10px 20px', borderRadius: BORDERS.radius.md, border: 'none', background: COLORS.orange, color: COLORS.white, fontSize: FONTS.size.md, fontWeight: FONTS.weight.semibold, cursor: 'pointer' }}>
            Sign Out and Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: COLORS.offWhite, fontFamily: FONTS.family }}>
      {/* ─── Left Navy Sidebar (224px) ─── */}
      <ProjectSidebar
        navItems={navItems}
        activeNav={activeNav}
        onSelectKey={(key) => {
          if (key === 'owner-reports' && onNavigateOwnerReports) {
            onNavigateOwnerReports();
            return;
          }
          if (key === 'lessons' && onNavigateLessons) {
            onNavigateLessons();
            return;
          }
          if (key === 'drawings' && onNavigateDrawings) {
            onNavigateDrawings();
            return;
          }
          setActiveNav(key);
          if (key === 'schedule') onSelectTile('schedule');
        }}
        user={user}
        onLogout={onLogout}
        connectedProducts={connectedProducts}
        headerSlot={
          <div
            style={{
              padding: '16px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              position: 'relative',
            }}
          >
            <button
              onClick={onNavigateHome}
              title="Back to Projects"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                color: COLORS.white,
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'inherit',
                marginBottom: 12,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: COLORS.orange,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: COLORS.white,
                  fontWeight: FONTS.weight.bold,
                  fontSize: FONTS.size.xs,
                }}
              >
                S
              </div>
              <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold }}>
                SiteDeck PM
              </span>
            </button>

            <button
              onClick={() => setShowProjectSwitcher((s) => !s)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)',
                color: COLORS.white,
                fontSize: FONTS.size.sm,
                fontWeight: FONTS.weight.medium,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            >
              <span
                style={{
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentProject?.name || 'Select Project'}
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <button
              onClick={() => setShowSaveTemplate(true)}
              title="Save this project as a reusable template"
              style={{
                width: '100%',
                marginTop: 8,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.7)',
                fontSize: FONTS.size.xs,
                fontWeight: FONTS.weight.semibold,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = COLORS.white;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
              }}
            >
              Save as Template
            </button>

            {showProjectSwitcher && (
              <div
                style={{
                  ...projectSwitcherDropdownStyle,
                  position: 'absolute',
                  top: '100%',
                  left: 16,
                  right: 16,
                  marginTop: 4,
                  zIndex: 50,
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderBottom: `1px solid ${COLORS.gray200}`,
                    fontWeight: FONTS.weight.bold,
                    fontSize: FONTS.size.sm,
                    color: COLORS.textPrimary,
                  }}
                >
                  Switch Project
                </div>
                {projects.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: `1px solid ${COLORS.gray100}`,
                      background: p.id === projectId ? COLORS.offWhite : 'transparent',
                      fontWeight: p.id === projectId ? FONTS.weight.semibold : FONTS.weight.regular,
                    }}
                    onClick={() => {
                      setShowProjectSwitcher(false);
                      if (p.id !== projectId) {
                        window.location.href = `/?project=${p.id}`;
                        window.location.reload();
                      }
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.offWhite)}
                    onMouseLeave={(e) => {
                      if (p.id !== projectId) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary }}>{p.name}</div>
                    {p.id === projectId && (
                      <div style={{ fontSize: FONTS.size.xs, color: COLORS.green, marginTop: 2 }}>
                        Current project
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        }
      />

      {/* ─── Main Content ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Navigation Bar */}
        <nav style={topNavStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <div style={searchBarStyle}>
              {Icons.search}
              <input type="text" placeholder="Search anything here..." style={searchInputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {ownerReportDue && onNavigateOwnerReports && (
              <button
                onClick={onNavigateOwnerReports}
                title="Owner report due this week"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 16,
                  border: 'none',
                  background: COLORS.amber || '#F59E0B',
                  color: COLORS.white,
                  fontSize: FONTS.size.xs,
                  fontWeight: FONTS.weight.semibold,
                  cursor: 'pointer',
                }}
              >
                <span>Owner Report Due</span>
              </button>
            )}
            <button style={topNavIconStyle}>{Icons.apps}</button>
            <button style={topNavIconStyle}>{Icons.help}</button>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowAlerts((s) => !s)} style={topNavIconStyle}>
                {Icons.bell}
                {alertCount > 0 && <span style={topNavBadgeStyle}>{alertCount}</span>}
              </button>
              {showAlerts && (
                <div style={topAlertDropdownStyle}>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderBottom: `1px solid ${COLORS.gray200}`,
                      fontWeight: FONTS.weight.bold,
                      fontSize: FONTS.size.sm,
                      color: COLORS.textPrimary,
                    }}
                  >
                    Critical Alerts ({alertCount})
                  </div>
                  {criticalTiles.length === 0 && (
                    <div style={{ padding: '12px 14px', fontSize: FONTS.size.sm, color: COLORS.textMuted }}>
                      No critical alerts
                    </div>
                  )}
                  {criticalTiles.map(([key, tile]) => (
                    <div
                      key={key}
                      style={{
                        padding: '10px 14px',
                        borderBottom: `1px solid ${COLORS.gray100}`,
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setShowAlerts(false);
                        onSelectTile(key);
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.offWhite)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div
                        style={{
                          fontSize: FONTS.size.sm,
                          fontWeight: FONTS.weight.semibold,
                          color: COLORS.red,
                        }}
                      >
                        {tile.name}
                      </div>
                      <div
                        style={{
                          fontSize: FONTS.size.xs,
                          color: COLORS.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {tile.summary}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* ─── Dashboard Body ─── */}
        <div style={bodyLayoutStyle}>
          {selectedRfiId ? (
            <RfiDetailView
              projectId={projectId}
              rfiId={selectedRfiId}
              token={localStorage.getItem('token') || ''}
              apiBase={import.meta.env.VITE_API_URL || ''}
              onBack={() => setSelectedRfiId(null)}
            />
          ) : selectedCoId ? (
            <ChangeOrderDetailView
              projectId={projectId}
              coId={selectedCoId}
              token={localStorage.getItem('token') || ''}
              apiBase={import.meta.env.VITE_API_URL || ''}
              onBack={() => setSelectedCoId(null)}
            />
          ) : selectedSubmittalId ? (
            <SubmittalDetailView
              projectId={projectId}
              submittalId={selectedSubmittalId}
              token={localStorage.getItem('token') || ''}
              apiBase={import.meta.env.VITE_API_URL || ''}
              onBack={() => setSelectedSubmittalId(null)}
            />
          ) : activeNav === 'meetings' ? (
            <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
              <MeetingsView projectId={projectId} />
            </div>
          ) : activeNav === 'equipment' ? (
            <EquipmentPage projectId={projectId} canEdit={canEditSchedule()} />
          ) : activeNav === 'wbs' ? (
            <WbsBuilder
              projectId={projectId}
              canEdit={canEditSchedule()}
              structureType={(currentProject as any)?.structureType || 'wbs'}
            />
          ) : activeNav === 'comm' || activeNav === 'rfi' ? (
            <CommunicationsView
              projectId={projectId}
              onBack={() => setActiveNav('dashboard')}
              onOpenRfi={(id) => setSelectedRfiId(id)}
              onOpenSubmittal={(id) => setSelectedSubmittalId(id)}
            />
          ) : (
            <div>
              {/* ── Row 1: Morning Brief (full width) ── */}
              <Card title="Morning Brief">
                <MorningBriefCard projectId={projectId} brief={brief} loading={briefLoading} />
              </Card>

              {/* ── Row 1b: Risk Intelligence (full width) — Sprint 11 Task 7 ── */}
              <Card title="Risk Intelligence">
                <RiskIntelligencePanel projectId={projectId} />
              </Card>

              {/* ── Row 2: Six tiles (2×3) | Project Metrics | Upcoming ── */}
              <div style={rowStyle(3)}>
                {/* Six status tiles in 2x3 grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr 1fr', gap: 12, minHeight: 312 }}>
                  {(dashboard ? Object.entries(dashboard.tiles) : []).map(([key, tile]) => (
                    <StatusTile
                      key={key}
                      tile={tile}
                      onClick={() => onSelectTile(key)}
                    />
                  ))}
                </div>

                {/* Project Metrics */}
                <Card title="Project Metrics">
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
                    <Gauge value={dashboard?.performance?.cpi ?? 1} label="CPI" size={100} />
                    <Gauge value={dashboard?.performance?.spi ?? 1} label="SPI" size={100} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12, borderTop: `1px solid ${COLORS.gray100}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>% Complete</span>
                      <span style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: (dashboard?.metrics?.completedPct ?? 0) >= 85 ? COLORS.green : COLORS.amber }}>
                        {dashboard?.metrics?.completedPct ?? 0}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>Cost Variance</span>
                      <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: (dashboard?.performance?.costVariance ?? 0) >= 0 ? COLORS.green : COLORS.red }}>
                        ${Math.abs(dashboard?.performance?.costVariance ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>Schedule Variance</span>
                      <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: (dashboard?.performance?.scheduleVariance ?? 0) >= 0 ? COLORS.green : COLORS.red }}>
                        ${Math.abs(dashboard?.performance?.scheduleVariance ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Upcoming */}
                <Card title="Upcoming">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <UpcomingRow label="Next Milestone" daysLeft={dashboard?.upcoming?.nextMilestone?.daysLeft ?? null} sub={dashboard?.upcoming?.nextMilestone?.name ?? 'None scheduled'} />
                    <UpcomingRow label="Next Checkpoint" daysLeft={dashboard?.upcoming?.nextCheckpoint?.daysLeft ?? null} sub={dashboard?.upcoming?.nextCheckpoint?.name ?? 'None scheduled'} />
                    <UpcomingRow label="Next Draw" daysLeft={dashboard?.upcoming?.nextDraw?.daysLeft ?? null} sub={dashboard?.upcoming?.nextDraw?.name ?? 'None scheduled'} />
                  </div>
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLORS.gray100}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <MiniKpi icon={Icons.wallet} label="Total value" value={formatM((dashboard?.projectValue ?? 0))} />
                    <MiniKpi icon={Icons.clock} label="Task count" value={`${dashboard?.upcoming?.nextCheckpoint?.taskCount ?? 0}`} />
                    <MiniKpi icon={Icons.dollar} label="Draw value" value={formatM(dashboard?.upcoming?.nextDraw?.drawValue ?? 0)} />
                    <MiniKpi icon={Icons.trending} label="Remaining" value={formatM(dashboard?.upcoming?.nextMilestone?.taskValue ?? 0)} />
                  </div>
                </Card>
              </div>

              {/* ── Row 2b: EVM Forecasts (full width) — Sprint 12 Task 7 ── */}
              <ForecastCard projectId={projectId} />

              {/* ── Row 3: Cash Flow (60%) | Change Orders (40%) ── */}
              <div style={rowStyle(2, '3fr 2fr')}>
                <Card title="Cash Flow">
                  {cashFlowData?.months && cashFlowData.months.length > 1 ? (
                    <CashFlowChart data={cashFlowData.months} />
                  ) : (
                    <EmptyState
                      icon={Icons.trending}
                      message="Cash flow data builds as project progresses. Check back after the first month of activity."
                    />
                  )}
                </Card>

                <Card title="Change Orders">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ padding: 12, background: COLORS.greenLight, borderRadius: BORDERS.radius.md }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, color: COLORS.green }}>Approved</div>
                        <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.green }}>{dashboard?.changeOrders?.approved ?? 0}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginTop: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{Icons.dollar} ${(dashboard?.changeOrders?.approvedCost ?? 0).toLocaleString()}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{Icons.clock} {dashboard?.changeOrders?.approvedSchedule ?? 0}h</span>
                      </div>
                    </div>
                    <div style={{ padding: 12, background: COLORS.amberLight, borderRadius: BORDERS.radius.md }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, color: COLORS.amber }}>Pending</div>
                        <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.amber }}>{dashboard?.changeOrders?.pending ?? 0}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginTop: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{Icons.dollar} ${(dashboard?.changeOrders?.pendingCost ?? 0).toLocaleString()}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{Icons.clock} {dashboard?.changeOrders?.pendingSchedule ?? 0}h</span>
                      </div>
                    </div>
                    {(dashboard?.changeOrders?.recentIds ?? []).length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, fontWeight: FONTS.weight.semibold }}>
                          Recent COs
                        </div>
                        {(dashboard?.changeOrders?.recentIds ?? []).slice(0, 3).map((co: any) => {
                          const coStatusColor = co.status === 'approved' ? COLORS.green : co.status === 'rejected' ? COLORS.red : COLORS.amber;
                          return (
                            <div
                              key={co.id}
                              onClick={() => setSelectedCoId(co.id)}
                              style={{
                                padding: '8px 10px',
                                marginBottom: 4,
                                fontSize: FONTS.size.xs,
                                background: COLORS.offWhite,
                                borderRadius: BORDERS.radius.sm,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                borderLeft: `3px solid ${coStatusColor}`,
                              }}
                            >
                              <span style={{ fontFamily: 'monospace', fontWeight: FONTS.weight.bold, color: COLORS.navy, minWidth: 80 }}>{co.coNumber}</span>
                              <span style={{ color: COLORS.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {co.description?.slice(0, 40)}{(co.description?.length || 0) > 40 ? '…' : ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* ── Row 4: Schedule Performance (50%) | Safety TRIR (50%) ── */}
              <div style={rowStyle(2)}>
                <Card title="Schedule Performance">
                  {schedulePerfData?.data && schedulePerfData.data.length > 2 ? (
                    <>
                      <SchedulePerformanceChart data={schedulePerfData.data} />
                      {(() => {
                        const last = schedulePerfData.data.slice(-1)[0];
                        const variance = last.actualPct - last.baselinePct;
                        const varianceColor = variance >= 0 ? COLORS.green : variance >= -5 ? COLORS.amber : COLORS.red;
                        return (
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.gray100}`, display: 'flex', justifyContent: 'space-around', fontSize: FONTS.size.sm }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: FONTS.weight.bold, color: COLORS.navy }}>{last.baselinePct.toFixed(1)}%</div>
                              <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>Baseline</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: FONTS.weight.bold, color: COLORS.orange }}>{last.forecastPct.toFixed(1)}%</div>
                              <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>Forecast</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: FONTS.weight.bold, color: varianceColor }}>{last.actualPct.toFixed(1)}%</div>
                              <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>Actual</div>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <EmptyState
                      icon={Icons.schedule}
                      message="Schedule performance will appear once activities are in progress. Check back as work advances."
                    />
                  )}
                </Card>

                <Card title="Safety TRIR">
                  <SafetyPerformancePanel data={safetyPerfData} />
                </Card>
              </div>

              {/* ── Row 5: Communications (50%) | Crew (50%) ── */}
              <div style={rowStyle(2)}>
                <Card title="Communications">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.navy, marginBottom: 8, borderBottom: `1px solid ${COLORS.gray100}`, paddingBottom: 4 }}>
                        RFIs — Latest 2
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(dashboard?.communications?.rfis ?? []).slice(0, 2).map((rfi) => (
                          <div
                            key={rfi.id}
                            style={{
                              display: 'flex', flexDirection: 'column', gap: 4,
                              padding: '10px 12px',
                              borderRadius: BORDERS.radius.md,
                              border: `1px solid ${COLORS.gray200}`,
                              borderLeft: `3px solid ${rfi.status === 'open' || rfi.status === 'draft' ? COLORS.red : COLORS.amber}`,
                              background: COLORS.white,
                              cursor: 'pointer',
                            }}
                            onClick={() => rfi.recordId && setSelectedRfiId(rfi.recordId)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold, color: COLORS.textMuted, fontFamily: 'monospace' }}>{rfi.number}</span>
                              <span style={{ fontSize: 10, fontWeight: FONTS.weight.semibold, padding: '2px 6px', borderRadius: 4, background: rfi.status === 'open' || rfi.status === 'draft' ? COLORS.redLight : COLORS.amberLight, color: rfi.status === 'open' || rfi.status === 'draft' ? COLORS.red : COLORS.amber }}>
                                {rfi.status === 'open' || rfi.status === 'draft' ? 'Open' : 'In Progress'}
                              </span>
                            </div>
                            <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, color: COLORS.textPrimary, lineHeight: 1.3 }}>{rfi.subject}</div>
                            <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>{rfi.date}</div>
                          </div>
                        ))}
                        {(dashboard?.communications?.rfis?.length ?? 0) === 0 && (
                          <div style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, padding: 8 }}>No open RFIs</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.amber, marginBottom: 8, borderBottom: `1px solid ${COLORS.gray100}`, paddingBottom: 4 }}>
                        Field Issues — Latest 2
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(dashboard?.communications?.fieldIssues ?? []).slice(0, 2).map((issue) => (
                          <div
                            key={issue.id}
                            style={{
                              display: 'flex', flexDirection: 'column', gap: 4,
                              padding: '10px 12px',
                              borderRadius: BORDERS.radius.md,
                              border: `1px solid ${COLORS.gray200}`,
                              borderLeft: `3px solid ${issue.priority === 'high' ? COLORS.red : COLORS.amber}`,
                              background: COLORS.white,
                              cursor: 'pointer',
                            }}
                            onClick={() => issue.recordId && setSelectedIssueId(issue.recordId)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold, color: COLORS.textMuted, fontFamily: 'monospace' }}>{issue.id}</span>
                              <span style={{ fontSize: 10, fontWeight: FONTS.weight.semibold, padding: '2px 6px', borderRadius: 4, background: issue.status === 'open' ? COLORS.redLight : COLORS.amberLight, color: issue.status === 'open' ? COLORS.red : COLORS.amber }}>
                                {issue.status === 'open' ? 'Open' : 'In Progress'}
                              </span>
                            </div>
                            <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, color: COLORS.textPrimary, lineHeight: 1.3 }}>{issue.title}</div>
                            <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>{issue.date}</div>
                          </div>
                        ))}
                        {(dashboard?.communications?.fieldIssues?.length ?? 0) === 0 && (
                          <div style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, padding: 8 }}>No open field issues</div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card
                  title="Crew"
                  headerRight={
                    canEditSchedule() ? (
                      <button
                        onClick={() => setShowAttendanceModal(true)}
                        style={{
                          background: COLORS.orange,
                          color: COLORS.white,
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: BORDERS.radius.sm,
                          fontSize: FONTS.size.xs,
                          fontWeight: FONTS.weight.semibold,
                          cursor: 'pointer',
                        }}
                      >
                        Log Attendance
                      </button>
                    ) : null
                  }
                >
                  <CrewPanel
                    data={crewStatus ?? null}
                    onLogEquipment={() => setShowEquipmentModal(true)}
                  />
                </Card>
              </div>

              {/* ── Row 6: Quick Actions (full width) ── */}
              <Card title="Quick Actions">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  {[
                    { icon: Icons.rfi, label: 'New RFI', color: COLORS.navy, onClick: () => { setActiveNav('rfi'); showToast('RFI form opening...', 'info'); } },
                    { icon: Icons.schedule, label: 'New Issue', color: COLORS.red, onClick: () => showToast('Issue form opening...', 'info') },
                    { icon: Icons.report, label: 'Daily Report', color: COLORS.green, onClick: () => showToast('Daily report form opening...', 'info') },
                    { icon: Icons.chat, label: 'New Submittal', color: COLORS.amber, onClick: () => { setActiveNav('rfi'); showToast('Submittal form opening...', 'info'); } },
                    { icon: Icons.mic, label: 'Voice Issue', color: '#7C3AED', onClick: () => showToast('Voice logging coming soon — your audio will be transcribed into a structured issue in a future release.', 'info') },
                  ].map((action) => (
                    <button
                      key={action.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 14px',
                        borderRadius: BORDERS.radius.md,
                        border: `1px solid ${COLORS.gray200}`,
                        background: COLORS.white,
                        color: COLORS.textPrimary,
                        fontSize: FONTS.size.sm,
                        fontWeight: FONTS.weight.semibold,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = action.color + '12'; e.currentTarget.style.borderColor = action.color; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.white; e.currentTarget.style.borderColor = COLORS.gray200; }}
                      onClick={action.onClick}
                    >
                      <span style={{ color: action.color }}>{action.icon}</span>
                      <span>+ {action.label}</span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

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
            background: toast.tone === 'error' ? COLORS.red : toast.tone === 'success' ? COLORS.green : COLORS.navy,
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

      <IssueDetailDrawer
        projectId={projectId}
        issueId={selectedIssueId}
        token={localStorage.getItem('token') || ''}
        apiBase={import.meta.env.VITE_API_URL || ''}
        onClose={() => setSelectedIssueId(null)}
        onOpenActivity={() => {
          setSelectedIssueId(null);
          setActiveNav('schedule');
        }}
      />

      {showAttendanceModal && (
        <AttendanceEntryModal
          projectId={projectId}
          onClose={() => setShowAttendanceModal(false)}
          onSaved={async () => {
            try {
              const cs = await getCrewStatus(projectId);
              setCrewStatus(cs);
            } catch {
              // ignore
            }
          }}
        />
      )}

      {showEquipmentModal && (
        <EquipmentStatusModal
          projectId={projectId}
          onClose={() => setShowEquipmentModal(false)}
          onSaved={async () => {
            try {
              const cs = await getCrewStatus(projectId);
              setCrewStatus(cs);
            } catch {
              // ignore
            }
          }}
        />
      )}

      {showSaveTemplate && (
        <SaveAsTemplateModal
          projectId={projectId}
          onClose={() => setShowSaveTemplate(false)}
          onSaved={() => {
            setShowSaveTemplate(false);
            setToast({ message: 'Template saved', tone: 'success' });
          }}
        />
      )}
    </div>
  );
}

// ─── Helpers ───

function SaveAsTemplateModal({
  projectId,
  onClose,
  onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await fetchApi(`/api/v1/projects/${projectId}/templates`, {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div style={{ background: 'white', borderRadius: 8, padding: 24, width: 420 }}>
        <h2 style={{ margin: '0 0 16px', color: '#1B2A4A', fontSize: 18 }}>Save as Template</h2>
        {error && (
          <div
            style={{
              background: '#FEE2E2',
              border: '1px solid #EF4444',
              color: '#991B1B',
              padding: 8,
              borderRadius: 4,
              marginBottom: 12,
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
        <p style={{ color: '#6B7280', fontSize: 12, margin: '0 0 12px' }}>
          Captures the project's WBS, activity shells, budget structure, risk register, and lessons
          flagged for templates.
        </p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', color: '#374151', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Template name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              border: '1px solid #D1D5DB',
              borderRadius: 4,
              padding: 8,
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', color: '#374151', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              border: '1px solid #D1D5DB',
              borderRadius: 4,
              padding: 8,
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              background: 'white',
              border: '1px solid #6B7280',
              color: '#6B7280',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || saving}
            style={{
              background: '#E8720C',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: !name || saving ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              opacity: !name || saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatM(n: number): string {
  if (!n || n === 0) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

// ─── Sub-Components ───

function Card({
  title,
  children,
  headerRight,
  style,
}: {
  title: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ ...cardStyle, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>{title}</span>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

function UpcomingRow({ label, daysLeft, sub }: { label: string; daysLeft: number | null; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ borderLeft: `3px solid ${COLORS.navy}`, paddingLeft: 8, flex: 1 }}>
        <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
            {daysLeft !== null ? daysLeft : '--'}
          </span>
          {daysLeft !== null && <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>days left</span>}
        </div>
        <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function MiniKpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: COLORS.textMuted }}>{icon}</span>
      <div>
        <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>{label}</div>
        <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>{value}</div>
      </div>
    </div>
  );
}

// ─── Styles ───

const topNavStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 24px',
  background: COLORS.white,
  borderBottom: `1px solid ${COLORS.gray200}`,
  gap: 16,
};

const searchBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: COLORS.offWhite,
  borderRadius: BORDERS.radius.lg,
  padding: '8px 14px',
  minWidth: 280,
  color: COLORS.textMuted,
};

const searchInputStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  outline: 'none',
  fontSize: FONTS.size.sm,
  color: COLORS.textPrimary,
  width: '100%',
};

const topNavIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: 'none',
  background: 'transparent',
  color: COLORS.textSecondary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  position: 'relative',
};

const topNavBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: -2,
  right: -2,
  minWidth: 18,
  height: 18,
  borderRadius: '50%',
  background: COLORS.red,
  color: COLORS.white,
  fontSize: '11px',
  fontWeight: FONTS.weight.bold,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 4px',
};

const topAlertDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 44,
  width: 280,
  background: COLORS.white,
  borderRadius: BORDERS.radius.lg,
  border: `1px solid ${COLORS.gray200}`,
  boxShadow: SHADOWS.lg,
  zIndex: 100,
  overflow: 'hidden',
};

const projectSwitcherDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 44,
  width: 260,
  background: COLORS.white,
  borderRadius: BORDERS.radius.lg,
  border: `1px solid ${COLORS.gray200}`,
  boxShadow: SHADOWS.lg,
  zIndex: 100,
  overflow: 'hidden',
  maxHeight: 320,
  overflowY: 'auto',
};

const bodyLayoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 16,
  padding: 16,
  flex: 1,
  overflow: 'auto',
  alignItems: 'start',
  maxWidth: 1600,
  margin: '0 auto',
  width: '100%',
};

const rowStyle = (columns: number, template?: string): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: template ?? `repeat(${columns}, minmax(0, 1fr))`,
  gap: 16,
  alignItems: 'start',
  minWidth: 0,
});

const cardStyle: React.CSSProperties = {
  background: COLORS.white,
  borderRadius: BORDERS.radius.lg,
  border: `1px solid ${COLORS.gray200}`,
  padding: 16,
  boxShadow: SHADOWS.sm,
  minWidth: 0,
};
