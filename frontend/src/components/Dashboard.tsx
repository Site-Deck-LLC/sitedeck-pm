import { useEffect, useState } from 'react';
import { getDashboard } from '../api';

interface Tile {
  name: string;
  status: 'green' | 'amber' | 'red';
  summary: string;
  count: number;
}

export function Dashboard({
  projectId,
  onBack,
  onLogout,
}: {
  projectId: string;
  onBack: () => void;
  onLogout: () => void;
}) {
  const [dashboard, setDashboard] = useState<Record<string, Tile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await getDashboard(projectId);
        setDashboard(data.tiles);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  if (loading) return <div style={styles.center}>Loading dashboard...</div>;
  if (error) return <div style={{ ...styles.center, color: '#dc2626' }}>{error}</div>;

  const tiles = dashboard ? Object.values(dashboard) : [];

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.nav}>
          <button onClick={onBack} style={styles.back}>← Projects</button>
          <h2>Morning Dashboard</h2>
        </div>
        <button onClick={onLogout} style={styles.logout}>Logout</button>
      </header>

      <section style={styles.grid}>
        {tiles.map((tile) => (
          <div key={tile.name} style={{ ...styles.card, borderColor: colorMap[tile.status] }}>
            <div style={{ ...styles.dot, background: colorMap[tile.status] }} />
            <h3>{tile.name}</h3>
            <p style={styles.summary}>{tile.summary}</p>
            {tile.count > 0 && <span style={styles.count}>{tile.count}</span>}
          </div>
        ))}
      </section>
    </div>
  );
}

const colorMap: Record<string, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 960,
    margin: '0 auto',
    padding: 24,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  center: {
    textAlign: 'center',
    marginTop: 80,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  back: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #ccc',
    background: '#fff',
    cursor: 'pointer',
  },
  logout: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #ccc',
    background: '#fff',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    border: '3px solid transparent',
    background: '#fafafa',
    position: 'relative',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    position: 'absolute',
    top: 16,
    right: 16,
  },
  summary: {
    color: '#4b5563',
    fontSize: 14,
    marginTop: 8,
  },
  count: {
    display: 'inline-block',
    marginTop: 8,
    padding: '2px 8px',
    borderRadius: 10,
    background: '#e5e7eb',
    fontSize: 12,
    color: '#374151',
  },
};
