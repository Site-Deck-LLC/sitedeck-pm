import { useEffect, useMemo, useState } from 'react';
import { getPortfolioSummary } from '../api';
import { COLORS, FONTS, SHADOWS, BORDERS, STATUS_COLORS } from '../styles/design-system';
import { USMap } from './USMap';

interface PortfolioProject {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  cpi: number;
  spi: number;
  scheduleStatus: 'green' | 'amber' | 'red';
  costStatus: 'green' | 'amber' | 'red';
  openIssues: number;
  openRfis: number;
  lastUpdated: string;
}

interface PortfolioSummary {
  totalProjects: number;
  onSchedule: number;
  onBudget: number;
  totalOpenIssues: number;
  totalOpenRfis: number;
  generatedAt: string;
  projects: PortfolioProject[];
}

type StatusKey = 'green' | 'amber' | 'red';

function computePct(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

// Convert lat/lng to a 0-100 percentage on the US-map viewBox. The
// map covers roughly 24-50 N latitude and 67-125 W longitude.
function projectToMapPercent(city: string | null, state: string | null): { x: number; y: number } | null {
  // We use a small lookup table for known states (covers 95% of US
  // projects). Cities within a state are not differentiated — the
  // map is a portfolio overview, not a navigation aid.
  const stateTable: Record<string, { x: number; y: number }> = {
    TX: { x: 48, y: 72 },
    OK: { x: 52, y: 62 },
    NM: { x: 38, y: 68 },
    LA: { x: 58, y: 80 },
    MS: { x: 64, y: 75 },
    AL: { x: 70, y: 73 },
    GA: { x: 76, y: 70 },
    FL: { x: 82, y: 85 },
    SC: { x: 78, y: 65 },
    NC: { x: 78, y: 60 },
    VA: { x: 78, y: 55 },
    TN: { x: 68, y: 62 },
    KY: { x: 70, y: 56 },
    OH: { x: 76, y: 50 },
    IN: { x: 70, y: 50 },
    IL: { x: 65, y: 50 },
    MI: { x: 72, y: 38 },
    WI: { x: 64, y: 38 },
    MN: { x: 58, y: 32 },
    IA: { x: 58, y: 45 },
    MO: { x: 58, y: 55 },
    AR: { x: 60, y: 65 },
    KS: { x: 50, y: 55 },
    NE: { x: 46, y: 48 },
    SD: { x: 46, y: 38 },
    ND: { x: 46, y: 28 },
    MT: { x: 30, y: 28 },
    WY: { x: 34, y: 38 },
    CO: { x: 38, y: 50 },
    UT: { x: 30, y: 50 },
    AZ: { x: 28, y: 65 },
    NV: { x: 20, y: 55 },
    CA: { x: 14, y: 60 },
    OR: { x: 16, y: 38 },
    WA: { x: 18, y: 25 },
    ID: { x: 24, y: 35 },
    NY: { x: 85, y: 38 },
    PA: { x: 82, y: 45 },
    NJ: { x: 88, y: 45 },
    MA: { x: 90, Y: 35 } as any,
    MD: { x: 82, y: 50 },
  };
  if (state && stateTable[state.toUpperCase()]) {
    return stateTable[state.toUpperCase()];
  }
  // No state means we can't place the marker accurately. The map
  // hides it; the table still shows the project row.
  void city;
  return null;
}

function worstStatus(p: PortfolioProject): StatusKey {
  const order: Record<StatusKey, number> = { green: 0, amber: 1, red: 2 };
  if (order[p.costStatus] >= order[p.scheduleStatus]) return p.costStatus;
  return p.scheduleStatus;
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: StatusKey;
}) {
  const color = accent ? STATUS_COLORS[accent].bg : COLORS.navy;
  return (
    <div
      style={{
        background: COLORS.white,
        borderRadius: BORDERS.radius.lg,
        padding: 20,
        boxShadow: SHADOWS.md,
        borderLeft: `4px solid ${color}`,
        flex: 1,
        minWidth: 180,
      }}
    >
      <div
        style={{
          fontSize: FONTS.size.xs,
          color: COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: FONTS.weight.semibold,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: FONTS.size.xl,
          fontWeight: FONTS.weight.bold,
          color: COLORS.textPrimary,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: StatusKey }) {
  const colors = STATUS_COLORS[status];
  const labels: Record<StatusKey, string> = { green: 'ON TRACK', amber: 'AT RISK', red: 'CRITICAL' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: FONTS.weight.semibold,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        background: colors.light,
        color: colors.bg,
        border: `1px solid ${colors.bg}`,
      }}
    >
      {labels[status]}
    </span>
  );
}

export function Portfolio({
  onBack,
  onSelectProject,
}: {
  onBack: () => void;
  onSelectProject: (id: string) => void;
}) {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | StatusKey>('all');

  useEffect(() => {
    async function load() {
      try {
        const data = await getPortfolioSummary();
        setSummary(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load portfolio');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredProjects = useMemo(() => {
    if (!summary) return [];
    if (filter === 'all') return summary.projects;
    return summary.projects.filter((p) => worstStatus(p) === filter);
  }, [summary, filter]);

  const mapMarkers = useMemo(() => {
    if (!summary) return [];
    return summary.projects
      .map((p) => {
        const pt = projectToMapPercent(p.city, p.state);
        if (!pt) return null;
        return {
          id: p.id,
          name: p.name,
          x: pt.x,
          y: pt.y,
          cpi: p.cpi,
          spi: p.spi,
          status: worstStatus(p),
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [summary]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: COLORS.offWhite }}>
        <div style={{ textAlign: 'center', color: COLORS.textSecondary }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: `3px solid ${COLORS.gray200}`,
              borderTop: `3px solid ${COLORS.orange}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          Loading portfolio...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: COLORS.offWhite }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: COLORS.red, fontWeight: FONTS.weight.semibold, marginBottom: 16, fontSize: FONTS.size.md }}>{error}</div>
          <button
            onClick={onBack}
            style={{
              padding: '10px 20px',
              borderRadius: BORDERS.radius.md,
              border: 'none',
              background: COLORS.orange,
              color: COLORS.white,
              fontSize: FONTS.size.md,
              fontWeight: FONTS.weight.semibold,
              cursor: 'pointer',
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Standalone-degradation empty state: an empty portfolio is a
  // valid state (no projects yet). The screen should still render
  // the KPI cards with zeros and an empty-state message in the
  // table — never crash the page.
  const totalProjects = summary?.totalProjects ?? 0;

  return (
    <div style={{ minHeight: '100vh', background: COLORS.offWhite, fontFamily: FONTS.family }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          background: COLORS.white,
          borderBottom: `1px solid ${COLORS.gray200}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px 14px',
              borderRadius: BORDERS.radius.md,
              border: `1px solid ${COLORS.gray200}`,
              background: COLORS.white,
              color: COLORS.textPrimary,
              fontSize: FONTS.size.sm,
              fontWeight: FONTS.weight.semibold,
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
          <span style={{ fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
            Portfolio
          </span>
        </div>
        <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
          {summary?.generatedAt
            ? `Updated ${new Date(summary.generatedAt).toLocaleTimeString()}`
            : ''}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px' }}>
        <h1 style={{ fontSize: FONTS.size.xxl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: '0 0 4px 0' }}>
          Portfolio Health
        </h1>
        <p style={{ fontSize: FONTS.size.md, color: COLORS.textSecondary, margin: '0 0 24px 0' }}>
          {totalProjects} active project{totalProjects !== 1 ? 's' : ''}
        </p>

        {/* KPI cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <KpiCard
            label="On Schedule"
            value={`${summary?.onSchedule ?? 0} / ${totalProjects}`}
            sub={totalProjects > 0 ? computePct(summary?.onSchedule ?? 0, totalProjects) : '—'}
            accent="green"
          />
          <KpiCard
            label="On Budget"
            value={`${summary?.onBudget ?? 0} / ${totalProjects}`}
            sub={totalProjects > 0 ? computePct(summary?.onBudget ?? 0, totalProjects) : '—'}
            accent="green"
          />
          <KpiCard
            label="Open Issues"
            value={summary?.totalOpenIssues ?? 0}
            sub="Across all projects"
            accent={(summary?.totalOpenIssues ?? 0) > 5 ? 'amber' : 'green'}
          />
          <KpiCard
            label="Open RFIs"
            value={summary?.totalOpenRfis ?? 0}
            sub="Across all projects"
            accent={(summary?.totalOpenRfis ?? 0) > 10 ? 'red' : 'green'}
          />
        </div>

        {/* Portfolio map */}
        <div
          style={{
            background: COLORS.white,
            borderRadius: BORDERS.radius.lg,
            boxShadow: SHADOWS.md,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <h2 style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: '0 0 12px 0' }}>
            Geographic Distribution
          </h2>
          {mapMarkers.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: COLORS.textSecondary,
                fontSize: FONTS.size.md,
              }}
            >
              No projects with location data yet.
            </div>
          ) : (
            <USMap
              markers={mapMarkers}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              onSelectProject={onSelectProject}
            />
          )}
        </div>

        {/* Project table */}
        <div
          style={{
            background: COLORS.white,
            borderRadius: BORDERS.radius.lg,
            boxShadow: SHADOWS.md,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: `1px solid ${COLORS.gray200}`,
            }}
          >
            <h2 style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: 0 }}>
              Project Health
            </h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'green', 'amber', 'red'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: BORDERS.radius.sm,
                    border: `1px solid ${filter === f ? COLORS.navy : COLORS.gray200}`,
                    background: filter === f ? COLORS.navy : COLORS.white,
                    color: filter === f ? COLORS.white : COLORS.textSecondary,
                    fontSize: FONTS.size.xs,
                    fontWeight: FONTS.weight.semibold,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div
              style={{
                padding: 48,
                textAlign: 'center',
                color: COLORS.textSecondary,
                fontSize: FONTS.size.md,
              }}
            >
              {totalProjects === 0
                ? 'No projects yet. Create your first project to see portfolio health.'
                : `No projects in "${filter}" status.`}
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: FONTS.size.sm,
              }}
            >
              <thead>
                <tr style={{ background: COLORS.gray100 }}>
                  <th style={cellHeadStyle}>Project</th>
                  <th style={cellHeadStyle}>Location</th>
                  <th style={cellHeadStyle}>CPI</th>
                  <th style={cellHeadStyle}>SPI</th>
                  <th style={cellHeadStyle}>Cost</th>
                  <th style={cellHeadStyle}>Schedule</th>
                  <th style={cellHeadStyle}>Open Issues</th>
                  <th style={cellHeadStyle}>Open RFIs</th>
                  <th style={cellHeadStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p) => (
                  <tr
                    key={p.id}
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId((id) => (id === p.id ? null : id))}
                    onClick={() => onSelectProject(p.id)}
                    style={{
                      cursor: 'pointer',
                      borderTop: `1px solid ${COLORS.gray200}`,
                      background: hoveredId === p.id ? COLORS.gray100 : COLORS.white,
                    }}
                  >
                    <td style={{ ...cellStyle, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>
                      {p.name}
                    </td>
                    <td style={{ ...cellStyle, color: COLORS.textSecondary }}>
                      {p.city ? `${p.city}, ${p.state || ''}` : '—'}
                    </td>
                    <td
                      style={{
                        ...cellStyle,
                        fontWeight: FONTS.weight.semibold,
                        color: p.cpi >= 1.0 ? COLORS.green : p.cpi >= 0.95 ? COLORS.amber : COLORS.red,
                      }}
                    >
                      {p.cpi.toFixed(2)}
                    </td>
                    <td
                      style={{
                        ...cellStyle,
                        fontWeight: FONTS.weight.semibold,
                        color: p.spi >= 0.9 ? COLORS.green : p.spi >= 0.85 ? COLORS.amber : COLORS.red,
                      }}
                    >
                      {p.spi.toFixed(2)}
                    </td>
                    <td style={cellStyle}>
                      <StatusPill status={p.costStatus} />
                    </td>
                    <td style={cellStyle}>
                      <StatusPill status={p.scheduleStatus} />
                    </td>
                    <td
                      style={{
                        ...cellStyle,
                        color: p.openIssues > 0 ? COLORS.amber : COLORS.textMuted,
                        fontWeight: p.openIssues > 0 ? FONTS.weight.semibold : FONTS.weight.regular,
                      }}
                    >
                      {p.openIssues}
                    </td>
                    <td
                      style={{
                        ...cellStyle,
                        color: p.openRfis > 0 ? COLORS.amber : COLORS.textMuted,
                        fontWeight: p.openRfis > 0 ? FONTS.weight.semibold : FONTS.weight.regular,
                      }}
                    >
                      {p.openRfis}
                    </td>
                    <td style={{ ...cellStyle, color: COLORS.textMuted, fontSize: FONTS.size.xs }}>
                      {new Date(p.lastUpdated).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  verticalAlign: 'middle',
};

const cellHeadStyle: React.CSSProperties = {
  ...cellStyle,
  fontSize: FONTS.size.xs,
  fontWeight: FONTS.weight.semibold,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: COLORS.textMuted,
  background: COLORS.gray100,
};
