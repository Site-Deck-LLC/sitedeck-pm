import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Projects } from './components/Projects';
import { Dashboard } from './components/Dashboard';
import { DashboardDetail } from './components/DashboardDetail';

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [view, setView] = useState<'projects' | 'dashboard' | 'dashboard-detail'>('projects');
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
    return <Login onLogin={setToken} />;
  }

  if (view === 'dashboard-detail' && projectId && tileKey) {
    return <DashboardDetail
      projectId={projectId}
      tileKey={tileKey}
      onBack={() => setView('dashboard')}
    />;
  }

  if (view === 'dashboard' && projectId) {
    return <Dashboard
      projectId={projectId}
      onBack={() => setView('projects')}
      onLogout={() => { setToken(null); setView('projects'); }}
      onSelectTile={(key) => { setTileKey(key); setView('dashboard-detail'); }}
    />;
  }

  return <Projects
    token={token}
    onSelectProject={(id) => { setProjectId(id); setView('dashboard'); }}
    onLogout={() => { setToken(null); setView('projects'); }}
  />;
}
