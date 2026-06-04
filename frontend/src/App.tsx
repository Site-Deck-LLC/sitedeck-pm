import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Projects } from './components/Projects';
import { Dashboard } from './components/Dashboard';
import { DashboardDetail } from './components/DashboardDetail';
import { GanttView } from './components/GanttView';

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [view, setView] = useState<'projects' | 'dashboard' | 'dashboard-detail' | 'gantt'>('projects');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tileKey, setTileKey] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  if (!token) {
    return <Login onLogin={(t, _role) => setToken(t)} />;
  }

  if (view === 'gantt' && projectId) {
    return (
      <GanttView
        projectId={projectId}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'dashboard-detail' && projectId && tileKey) {
    return (
      <DashboardDetail
        projectId={projectId}
        tileKey={tileKey}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'dashboard' && projectId) {
    return (
      <Dashboard
        projectId={projectId}
        onBack={() => setView('projects')}
        onLogout={() => { setToken(null); setView('projects'); }}
        onSelectTile={(key) => { setTileKey(key); setView('dashboard-detail'); }}
      />
    );
  }

  return (
    <Projects
      onSelectProject={(id) => { setProjectId(id); setView('dashboard'); }}
      onLogout={() => { setToken(null); setView('projects'); }}
    />
  );
}
