import { useEffect, useState } from 'react';
import { getProjects, getBillingStatus } from '../api';

interface Project {
  id: string;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
}

export function Projects({
  onSelectProject,
  onLogout,
}: {
  token: string;
  onSelectProject: (id: string) => void;
  onLogout: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const list = await getProjects();
        setProjects(list);
        if (list[0]?.orgId) {
          const status = await getBillingStatus(list[0].orgId);
          setBilling(status);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div style={styles.center}>Loading...</div>;
  if (error) return <div style={{ ...styles.center, color: '#dc2626' }}>{error}</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1>SiteDeck PM</h1>
        <div style={styles.meta}>
          {billing && (
            <span style={styles.badge}>
              {billing.planTier} — {billing.projectCount}/{billing.projectLimit} projects
            </span>
          )}
          <button onClick={onLogout} style={styles.logout}>Logout</button>
        </div>
      </header>

      <section style={styles.grid}>
        {projects.map((p) => (
          <div
            key={p.id}
            style={styles.card}
            onClick={() => onSelectProject(p.id)}
          >
            <h3>{p.name}</h3>
            <p style={styles.status}>Status: {p.status}</p>
            <p style={styles.dates}>
              {p.startDate?.slice(0, 10)} → {p.endDate?.slice(0, 10)}
            </p>
          </div>
        ))}
        {projects.length === 0 && <p>No projects yet.</p>}
      </section>
    </div>
  );
}

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
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 12,
    background: '#e5e7eb',
    color: '#374151',
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 16,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'box-shadow 0.15s',
  },
  status: {
    color: '#6b7280',
    fontSize: 14,
    margin: '4px 0',
  },
  dates: {
    color: '#9ca3af',
    fontSize: 12,
    margin: 0,
  },
};
