import { useEffect, useState } from 'react';
import {
  getScheduleActivities,
  getBudgetLines,
  getInvoices,
  getIssues,
  getEquipment,
} from '../api';
import { Gauge } from './Gauge';
import { COLORS, FONTS, SHADOWS, BORDERS, STATUS_COLORS } from '../styles/design-system';

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
  cost: 'Cost Summary',
  materials: 'Invoices & Materials',
  clientIssues: 'Client Issues',
  fieldIssues: 'Field Issues',
  safety: 'Safety & Equipment',
};

// Calculate mock CPI and SPI from budget data
function calculateEvm(data: any[]) {
  const totalBudget = data.reduce((sum, b) => sum + Number(b.budgetAmount || 0), 0);
  const totalIncurred = data.reduce((sum, b) => sum + Number(b.incurredAmount || 0), 0);
  const totalCommitted = data.reduce((sum, b) => sum + Number(b.committedAmount || 0), 0);
  const totalPct = data.reduce((sum, b) => sum + (b.percentComplete || 0), 0) / (data.length || 1);

  const ev = totalBudget * totalPct;
  const cpi = totalIncurred > 0 ? ev / totalIncurred : 1;
  const spi = totalPct; // Simplified

  return { cpi, spi, ev, totalBudget, totalIncurred, totalCommitted, totalPct };
}

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
  const [evm, setEvm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const loader = loaders[tileKey] || getEquipment;
        const data = await loader(projectId);
        setItems(Array.isArray(data) ? data : data?.items || data?.data || []);

        if (tileKey === 'cost') {
          setEvm(calculateEvm(data));
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, tileKey]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center', padding: '80px 0', color: COLORS.textSecondary, fontFamily: FONTS.family }}>
          Loading {titles[tileKey]}...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center', padding: '80px 0', color: COLORS.red, fontFamily: FONTS.family }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Nav */}
      <nav style={navStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={backButtonStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}>
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Dashboard
          </button>
          <span style={{ color: COLORS.white, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium }}>
            {titles[tileKey] || tileKey}
          </span>
        </div>
      </nav>

      <div style={contentStyle}>
        {/* Cost Gauges */}
        {tileKey === 'cost' && evm && (
          <div style={gaugesContainerStyle}>
            <div style={gaugeCardStyle}>
              <Gauge value={evm.cpi} label="Cost Performance Index (CPI)" size={160} />
              <div style={gaugeLegendStyle}>
                <div style={legendItemStyle}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.green }} />
                  <span style={legendTextStyle}>≥1.0 On Budget</span>
                </div>
                <div style={legendItemStyle}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.amber }} />
                  <span style={legendTextStyle}>0.95–1.0 Warning</span>
                </div>
                <div style={legendItemStyle}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.red }} />
                  <span style={legendTextStyle}>{'<0.95 Overrun'}</span>
                </div>
              </div>
            </div>
            <div style={gaugeCardStyle}>
              <Gauge value={evm.spi} label="Schedule Performance Index (SPI)" size={160} />
            </div>
            <div style={gaugeCardStyle}>
              <div style={evmSummaryStyle}>
                <div style={evmRowStyle}>
                  <span style={evmLabelStyle}>Earned Value</span>
                  <span style={evmValueStyle}>${(evm.ev / 1000000).toFixed(2)}M</span>
                </div>
                <div style={evmRowStyle}>
                  <span style={evmLabelStyle}>Budget</span>
                  <span style={evmValueStyle}>${(evm.totalBudget / 1000000).toFixed(2)}M</span>
                </div>
                <div style={evmRowStyle}>
                  <span style={evmLabelStyle}>Incurred</span>
                  <span style={evmValueStyle}>${(evm.totalIncurred / 1000000).toFixed(2)}M</span>
                </div>
                <div style={evmRowStyle}>
                  <span style={evmLabelStyle}>Committed</span>
                  <span style={evmValueStyle}>${(evm.totalCommitted / 1000000).toFixed(2)}M</span>
                </div>
                <div style={{ ...evmRowStyle, borderTop: `2px solid ${COLORS.gray200}`, paddingTop: 12, marginTop: 8 }}>
                  <span style={evmLabelStyle}>Overall % Complete</span>
                  <span style={{ ...evmValueStyle, color: COLORS.orange }}>{(evm.totalPct * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div style={tableCardStyle}>
          <div style={tableHeaderStyle}>
            <h2 style={tableTitleStyle}>{items.length} Records</h2>
          </div>

          {items.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: COLORS.textMuted, fontFamily: FONTS.family }}>
              No items found.
            </div>
          )}

          {items.map((item, i) => (
            <div key={item.id || i} style={rowStyle}>
              <div style={rowHeaderStyle}>
                <span style={rowNameStyle}>
                  {item.name || item.title || item.subject || item.description?.slice(0, 50) || `Record ${i + 1}`}
                </span>
                {'status' in item && (
                  <span style={statusBadgeStyle(item.status)}>{item.status}</span>
                )}
              </div>
              <div style={rowDetailsStyle}>
                {renderFields(item, tileKey)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderFields(item: any, tileKey: string) {
  const fields: { label: string; value: any }[] = [];

  if (tileKey === 'schedule') {
    fields.push(
      { label: 'Duration', value: `${item.duration} days` },
      { label: 'Start', value: item.startDate?.slice(0, 10) },
      { label: 'End', value: item.endDate?.slice(0, 10) },
      { label: '% Complete', value: `${Math.round((item.percentComplete || 0) * 100)}%` },
      { label: 'Critical', value: item.isCritical ? 'Yes' : 'No' },
    );
  } else if (tileKey === 'cost') {
    fields.push(
      { label: 'Budget', value: `$${Number(item.budgetAmount || 0).toLocaleString()}` },
      { label: 'Incurred', value: `$${Number(item.incurredAmount || 0).toLocaleString()}` },
      { label: 'Committed', value: `$${Number(item.committedAmount || 0).toLocaleString()}` },
      { label: '% Complete', value: `${Math.round((item.percentComplete || 0) * 100)}%` },
      { label: 'Flag', value: item.varianceFlag || '—' },
    );
  } else if (tileKey === 'materials') {
    fields.push(
      { label: 'Invoice #', value: item.invoiceNumber },
      { label: 'Amount', value: `$${Number(item.invoiceAmount || 0).toLocaleString()}` },
      { label: 'Status', value: item.status },
      { label: 'Match', value: item.matchStatus || 'pending' },
    );
  } else if (tileKey === 'clientIssues' || tileKey === 'fieldIssues') {
    fields.push(
      { label: 'Priority', value: item.priority },
      { label: 'Assignee', value: item.assignee || '—' },
      { label: 'Due', value: item.dueDate?.slice(0, 10) || '—' },
      { label: 'Source', value: item.source },
    );
  } else if (tileKey === 'safety') {
    fields.push(
      { label: 'Type', value: item.type },
      { label: 'Hours', value: item.totalHours },
      { label: 'Status', value: item.status },
      { label: 'Last Used', value: item.lastUsageDate?.slice(0, 10) || '—' },
    );
  } else {
    // Generic: show first 4 non-id fields
    Object.entries(item).slice(0, 6).forEach(([key, val]) => {
      if (!key.endsWith('Id') && !key.endsWith('At') && typeof val !== 'object') {
        fields.push({ label: key, value: String(val || '—') });
      }
    });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
      {fields.map((f) => (
        <div key={f.label}>
          <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{f.label}</div>
          <div style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary, fontWeight: FONTS.weight.medium }}>{f.value}</div>
        </div>
      ))}
    </div>
  );
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.amber;
  return {
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    background: colors.light,
    color: colors.bg,
  };
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

const contentStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: 24,
};

const gaugesContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 16,
  marginBottom: 24,
};

const gaugeCardStyle: React.CSSProperties = {
  background: COLORS.white,
  borderRadius: BORDERS.radius.lg,
  border: `1px solid ${COLORS.gray200}`,
  padding: 24,
  boxShadow: SHADOWS.md,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const gaugeLegendStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginTop: 12,
};

const legendItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const legendTextStyle: React.CSSProperties = {
  fontSize: FONTS.size.xs,
  color: COLORS.textSecondary,
};

const evmSummaryStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const evmRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '6px 0',
};

const evmLabelStyle: React.CSSProperties = {
  fontSize: FONTS.size.sm,
  color: COLORS.textSecondary,
};

const evmValueStyle: React.CSSProperties = {
  fontSize: FONTS.size.md,
  fontWeight: FONTS.weight.bold,
  color: COLORS.textPrimary,
};

const tableCardStyle: React.CSSProperties = {
  background: COLORS.white,
  borderRadius: BORDERS.radius.lg,
  border: `1px solid ${COLORS.gray200}`,
  boxShadow: SHADOWS.md,
  overflow: 'hidden',
};

const tableHeaderStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: `1px solid ${COLORS.gray100}`,
  background: COLORS.offWhite,
};

const tableTitleStyle: React.CSSProperties = {
  fontSize: FONTS.size.lg,
  fontWeight: FONTS.weight.bold,
  color: COLORS.textPrimary,
  margin: 0,
};

const rowStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: `1px solid ${COLORS.gray100}`,
  transition: 'background 0.1s',
};

const rowHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
};

const rowNameStyle: React.CSSProperties = {
  fontSize: FONTS.size.md,
  fontWeight: FONTS.weight.semibold,
  color: COLORS.textPrimary,
};

const rowDetailsStyle: React.CSSProperties = {
  color: COLORS.textSecondary,
};
