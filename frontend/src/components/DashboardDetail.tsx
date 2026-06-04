import { useEffect, useState } from 'react';
import {
  getScheduleActivities,
  getBudgetLines,
  getInvoices,
  getIssues,
  getEquipment,
} from '../api';

const loaders: Record<string, (projectId: string) => Promise<any>> = {
  schedule: getScheduleActivities,
  cost: getBudgetLines,
  materials: getInvoices,
  clientIssues: getIssues,
  fieldIssues: getIssues,
  safety: getEquipment,
};

const titles: Record<string, string> = {
  schedule: 'Schedule Activities',
  cost: 'Budget Lines',
  materials: 'Invoices / Materials',
  clientIssues: 'Client Issues',
  fieldIssues: 'Field Issues',
  safety: 'Safety / Equipment',
};

export function DashboardDetail({
  projectId,
  tileKey,
  onBack,
}: {
  projectId: string;
  tileKey: string;
  onBack: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const loader = loaders[tileKey] || getEquipment;
        const data = await loader(projectId);
        setItems(Array.isArray(data) ? data : data?.items || data?.data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, tileKey]);

  if (loading) return <div style={styles.center}>Loading details...</div>;
  if (error) return <div style={{ ...styles.center, color: '#dc2626' }}>{error}</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button onClick={onBack} style={styles.back}>← Dashboard</button>
        <h2>{titles[tileKey] || tileKey}</h2>
      </header>

      <section style={styles.list}>
        {items.length === 0 && <p style={styles.empty}>No items found.</p>}
        {items.map((item, i) => (
          <div key={item.id || i} style={styles.row}>
            <pre style={styles.pre}>{JSON.stringify(item, null, 2)}</pre>
          </div>
        ))}
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
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  back: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #ccc',
    background: '#fff',
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  row: {
    padding: 16,
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    background: '#fafafa',
  },
  pre: {
    margin: 0,
    fontSize: 12,
    overflowX: 'auto',
  },
  empty: {
    color: '#9ca3af',
    textAlign: 'center',
    padding: 40,
  },
};
