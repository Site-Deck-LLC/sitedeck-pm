import { useState, useEffect, useCallback } from 'react';
import { Login } from './components/Login';
import { Projects } from './components/Projects';
import { Dashboard } from './components/Dashboard';
import { DashboardDetail } from './components/DashboardDetail';
import { GanttView } from './components/GanttView';

type View = 'projects' | 'dashboard' | 'dashboard-detail' | 'gantt';

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

  const push = useCallback((next: AppState) => {
    setState(next);
    window.history.pushState(next, '', '');
  }, []);

  if (!token) {
    return <Login onLogin={(t) => { setToken(t); }} />;
  }

  if (view === 'gantt' && projectId) {
    return (
      <GanttView
        projectId={projectId}
        onBack={() => window.history.back()}
      />
    );
  }

  if (view === 'dashboard-detail' && projectId && tileKey) {
    return (
      <DashboardDetail
        projectId={projectId}
        tileKey={tileKey}
        onBack={() => window.history.back()}
      />
    );
  }

  if (view === 'dashboard' && projectId) {
    return (
      <Dashboard
        projectId={projectId}
        onBack={() => window.history.back()}
        onLogout={() => { setToken(null); setState({ view: 'projects', projectId: null, tileKey: null }); }}
        onSelectTile={(key) => push({ view: 'dashboard-detail', projectId, tileKey: key })}
      />
    );
  }

  return (
    <Projects
      onSelectProject={(id) => push({ view: 'dashboard', projectId: id, tileKey: null })}
      onLogout={() => { setToken(null); setState({ view: 'projects', projectId: null, tileKey: null }); }}
    />
  );
}
