import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Projects } from './components/Projects';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [view, setView] = useState<'projects' | 'dashboard'>('projects');
  const [projectId, setProjectId] = useState<string | null>(null);

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

  if (view === 'dashboard' && projectId) {
    return <Dashboard
      projectId={projectId}
      onBack={() => setView('projects')}
      onLogout={() => { setToken(null); setView('projects'); }}
    />;
  }

  return <Projects
    token={token}
    onSelectProject={(id) => { setProjectId(id); setView('dashboard'); }}
    onLogout={() => { setToken(null); setView('projects'); }}
  />;
}
