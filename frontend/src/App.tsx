import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Login } from './components/Login';
import { Projects } from './components/Projects';
import { NotificationBell } from './components/NotificationBell';
import { RouteLoading } from './components/RouteLoading';
import { InstallPrompt } from './components/InstallPrompt';
import { NetworkBanner } from './components/NetworkBanner';
import { GetHelpButton, getHelpBuffer } from './components/GetHelpButton';

// Eager: shown on first paint and is a small component.
// Lazy: route-level views. Each lands in its own chunk so the
// initial bundle doesn't pay for the Gantt editor, the US map
// (which pulls in d3-geo), the WBS builder, or the template
// library until the user actually navigates to them.
const Dashboard = lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })));
const DashboardDetail = lazy(() =>
  import('./components/DashboardDetail').then((m) => ({ default: m.DashboardDetail }))
);
const GanttView = lazy(() => import('./components/GanttView').then((m) => ({ default: m.GanttView })));
const MapView = lazy(() => import('./components/MapView').then((m) => ({ default: m.MapView })));
const OwnerReports = lazy(() =>
  import('./components/OwnerReports').then((m) => ({ default: m.OwnerReports }))
);
const LessonsLearned = lazy(() =>
  import('./components/LessonsLearned').then((m) => ({ default: m.LessonsLearned }))
);
const TemplateLibrary = lazy(() =>
  import('./components/TemplateLibrary').then((m) => ({ default: m.TemplateLibrary }))
);
const BillingSettings = lazy(() =>
  import('./components/BillingSettings').then((m) => ({ default: m.BillingSettings }))
);
const Drawings = lazy(() => import('./components/Drawings').then((m) => ({ default: m.Drawings })));
const Portfolio = lazy(() => import('./components/Portfolio').then((m) => ({ default: m.Portfolio })));

type View =
  | 'projects'
  | 'dashboard'
  | 'dashboard-detail'
  | 'gantt'
  | 'map'
  | 'owner-reports'
  | 'lessons'
  | 'templates'
  | 'billing'
  | 'drawings'
  | 'portfolio';

interface AppState {
  view: View;
  projectId: string | null;
  tileKey: string | null;
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [state, setState] = useState<AppState>(() => {
    const h = window.history.state as AppState | null;
    return h || { view: 'projects', projectId: null, tileKey: null };
  });

  const { view, projectId, tileKey } = state;

  // Sync token to localStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  // Browser back button support
  useEffect(() => {
    function onPop(e: PopStateEvent) {
      const s = (e.state as AppState) || { view: 'projects', projectId: null, tileKey: null };
      setState(s);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Sprint 10: install a global error listener so the Get Help button
  // can include the most recent console errors in the captured context.
  // We also install an unhandledrejection listener for promise failures.
  useEffect(() => {
    function onError(ev: ErrorEvent) {
      getHelpBuffer.pushError(ev.error || ev.message || 'Unknown error');
    }
    function onReject(ev: PromiseRejectionEvent) {
      const r = ev.reason;
      const msg = r instanceof Error ? r.message : typeof r === 'string' ? r : (r && (r as any).message) || String(r);
      getHelpBuffer.pushError(msg);
    }
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onReject);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onReject);
    };
  }, []);

  // Track current projectId in the help buffer so reports can include
  // which project the user was on.
  useEffect(() => {
    getHelpBuffer.setProjectId(projectId);
  }, [projectId]);

  const push = useCallback((next: AppState) => {
    setState(next);
    window.history.pushState(next, '', '');
  }, []);

  if (!token) {
    return (
      <>
        <NetworkBanner />
        <Login onLogin={(t) => { setToken(t); }} />
        <InstallPrompt />
        <GetHelpButton />
      </>
    );
  }

  // A single Suspense boundary wraps every lazy view. Each view
  // has a small bespoke loading label so the user knows which
  // page is loading (e.g. "Loading map…" vs "Loading Gantt…").
  // The wrapper is positioned inside each view branch below.
  // Sprint 10: every view also gets the GetHelpButton at the bottom right.
  const wrap = (node: React.ReactNode, label: string) => (
    <>
      <Suspense fallback={<RouteLoading label={label} />}>{node}</Suspense>
      <GetHelpButton />
    </>
  );

  if (view === 'map') {
    return wrap(
      <MapView
        onBack={() => window.history.back()}
        onSelectProject={(id) => push({ view: 'dashboard', projectId: id, tileKey: null })}
      />,
      'Loading map…'
    );
  }

  if (view === 'gantt' && projectId) {
    return wrap(<GanttView projectId={projectId} onBack={() => window.history.back()} />, 'Loading Gantt…');
  }

  if (view === 'dashboard-detail' && projectId && tileKey) {
    return wrap(
      <DashboardDetail projectId={projectId} tileKey={tileKey} onBack={() => window.history.back()} />,
      'Loading details…'
    );
  }

  if (view === 'dashboard' && projectId) {
    return wrap(
      <Dashboard
        projectId={projectId}
        onBack={() => window.history.back()}
        onNavigateHome={() => push({ view: 'projects', projectId: null, tileKey: null })}
        onLogout={() => { setToken(null); setState({ view: 'projects', projectId: null, tileKey: null }); }}
        onSelectTile={(key) => push({ view: key === 'schedule' ? 'gantt' : 'dashboard-detail', projectId, tileKey: key })}
        onNavigateOwnerReports={() => push({ view: 'owner-reports', projectId, tileKey: null })}
        onNavigateLessons={() => push({ view: 'lessons', projectId, tileKey: null })}
        onNavigateDrawings={() => push({ view: 'drawings', projectId, tileKey: null })}
      />,
      'Loading dashboard…'
    );
  }

  if (view === 'owner-reports' && projectId) {
    return wrap(
      <OwnerReports projectId={projectId} onBack={() => window.history.back()} />,
      'Loading report…'
    );
  }

  if (view === 'lessons' && projectId) {
    return wrap(
      <LessonsLearned projectId={projectId} onBack={() => window.history.back()} />,
      'Loading lessons…'
    );
  }

  if (view === 'drawings' && projectId) {
    return wrap(<Drawings projectId={projectId} onBack={() => window.history.back()} />, 'Loading drawings…');
  }

  if (view === 'templates') {
    return wrap(
      <TemplateLibrary
        onBack={() => window.history.back()}
        onProjectCreated={(id) => push({ view: 'dashboard', projectId: id, tileKey: null })}
      />,
      'Loading templates…'
    );
  }

  if (view === 'billing') {
    return wrap(<BillingSettings onBack={() => window.history.back()} />, 'Loading billing…');
  }

  if (view === 'portfolio') {
    return wrap(
      <Portfolio
        onBack={() => window.history.back()}
        onSelectProject={(id) => push({ view: 'dashboard', projectId: id, tileKey: null })}
      />,
      'Loading portfolio…'
    );
  }

  return (
    <>
      <NetworkBanner />
      <Projects
        onSelectProject={(id) => push({ view: 'dashboard', projectId: id, tileKey: null })}
        onViewMap={() => push({ view: 'map', projectId: null, tileKey: null })}
        onLogout={() => { setToken(null); setState({ view: 'projects', projectId: null, tileKey: null }); }}
        onNavigateTemplates={() => push({ view: 'templates', projectId: null, tileKey: null })}
        onNavigateBilling={() => push({ view: 'billing', projectId: null, tileKey: null })}
        onNavigatePortfolio={() => push({ view: 'portfolio', projectId: null, tileKey: null })}
        headerRight={<NotificationBell onSelectProject={(id) => push({ view: 'dashboard', projectId: id, tileKey: null })} />}
      />
      <InstallPrompt />
      <GetHelpButton />
    </>
  );
}
