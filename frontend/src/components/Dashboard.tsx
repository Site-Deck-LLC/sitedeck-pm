import { useEffect, useState } from 'react';
import { getDashboard } from '../api';
import { COLORS, STATUS_COLORS, SHADOWS, FONTS, BORDERS } from '../styles/design-system';

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
  onSelectTile,
}: {
  projectId: string;
  onBack: () => void;
  onLogout: () => void;
  onSelectTile: (key: string) => void;
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

  const tiles = dashboard ? Object.entries(dashboard) : [];

  // Calculate overall project health
  const statusCounts = { green: 0, amber: 0, red: 0 };
  tiles.forEach(([, tile]) => { statusCounts[tile.status]++; });
  const overallStatus = statusCounts.red > 0 ? 'red' : statusCounts.amber > 0 ? 'amber' : 'green';

  return (
    <div style={pageStyle}>
      {/* Top Navigation Bar */}
      <nav style={navStyle}>
        <div style={navLeftStyle}>
          <button onClick={onBack} style={backButtonStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}>
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Projects
          </button>
          <div style={breadcrumbStyle}>
            <span style={{ color: COLORS.textMuted }}>100MW BESS — Texas EPC</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={healthBadgeStyle(overallStatus)}>
            {overallStatus === 'green' ? 'On Track' : overallStatus === 'amber' ? 'Attention' : 'Critical'}
          </div>
          <button onClick={onLogout} style={logoutButtonStyle}>
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div style={contentLayoutStyle}>
        {/* Left: Tile Grid */}
        <div style={mainAreaStyle}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: COLORS.textSecondary }}>
              <div style={{ width: 40, height: 40, border: `3px solid ${COLORS.gray200}`, borderTop: `3px solid ${COLORS.orange}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              Loading dashboard...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ color: COLORS.red, fontWeight: FONTS.weight.semibold, marginBottom: 16, fontSize: FONTS.size.md }}>{error}</div>
              <p style={{ color: COLORS.textSecondary, marginBottom: 20 }}>Your session may have expired or the token is no longer valid.</p>
              <button onClick={onLogout} style={{
                padding: '10px 20px',
                borderRadius: BORDERS.radius.md,
                border: 'none',
                background: COLORS.orange,
                color: COLORS.white,
                fontSize: FONTS.size.md,
                fontWeight: FONTS.weight.semibold,
                cursor: 'pointer',
              }}>
                Sign Out and Try Again
              </button>
            </div>
          ) : (
            <>
              <header style={headerStyle}>
            <h1 style={titleStyle}>
              Morning Dashboard
            </h1>
            <span style={dateStyle}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </header>

          <section style={gridStyle}>
            {tiles.map(([key, tile]) => {
              const colors = STATUS_COLORS[tile.status];
              return (
                <div
                  key={key}
                  style={tileStyle(colors)}
                  onClick={() => onSelectTile(key)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = SHADOWS.lg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = SHADOWS.md;
                  }}
                >
                  <div style={tileHeaderStyle(colors)}>
                    <span style={tileNameStyle}>{tile.name}</span>
                    <div style={statusDotStyle(colors)} />
                  </div>
                  <div style={tileBodyStyle}>
                    <p style={summaryStyle}>{tile.summary}</p>
                    {tile.count > 0 && (
                      <div style={countBadgeStyle(colors)}>
                        {tile.count} {tile.count === 1 ? 'item' : 'items'}
                      </div>
                    )}
                  </div>
                  <div style={tileFooterStyle}>
                    <span style={clickHintStyle}>Click for details →</span>
                  </div>
                </div>
              );
            })}
          </section>
          </>
          )}
        </div>

        {/* Right: Summary Rail */}
        <aside style={rightRailStyle}>
          <div style={railCardStyle}>
            <h3 style={railTitleStyle}>Project Health</h3>
            <div style={healthSummaryStyle}>
              {tiles.map(([key, tile]) => (
                <div key={key} style={railItemStyle}>
                  <div style={railDotStyle(STATUS_COLORS[tile.status])} />
                  <div style={railItemTextStyle}>
                    <span style={railItemNameStyle}>{tile.name}</span>
                    <span style={railItemStatusStyle(tile.status)}>
                      {tile.status === 'green' ? 'Good' : tile.status === 'amber' ? 'Warning' : 'Alert'}
                    </span>
                  </div>
                  {tile.count > 0 && (
                    <span style={railCountStyle}>{tile.count}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={railCardStyle}>
            <h3 style={railTitleStyle}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={quickActionStyle}>+ New RFI</button>
              <button style={quickActionStyle}>+ New Issue</button>
              <button style={quickActionStyle}>+ Daily Report</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
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
  justifyContent: 'space-between',
  padding: '12px 24px',
  background: COLORS.navy,
  color: COLORS.white,
  borderBottom: `1px solid ${COLORS.navyLight}`,
};

const navLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
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
  transition: 'all 0.15s',
};

const breadcrumbStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: FONTS.size.sm,
  fontWeight: FONTS.weight.medium,
};

const healthBadgeStyle = (status: string): React.CSSProperties => ({
  padding: '4px 12px',
  borderRadius: '20px',
  fontSize: FONTS.size.xs,
  fontWeight: FONTS.weight.semibold,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  background: STATUS_COLORS[status].bg,
  color: STATUS_COLORS[status].text,
});

const logoutButtonStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: BORDERS.radius.sm,
  border: 'none',
  background: COLORS.orange,
  color: COLORS.white,
  fontSize: FONTS.size.sm,
  fontWeight: FONTS.weight.semibold,
  cursor: 'pointer',
};

const contentLayoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 320px',
  gap: 24,
  maxWidth: 1400,
  margin: '0 auto',
  padding: 24,
};

const mainAreaStyle: React.CSSProperties = {
  minWidth: 0,
};

const headerStyle: React.CSSProperties = {
  marginBottom: 24,
};

const titleStyle: React.CSSProperties = {
  fontSize: FONTS.size.xxl,
  fontWeight: FONTS.weight.bold,
  color: COLORS.textPrimary,
  margin: '0 0 4px 0',
  letterSpacing: '-0.5px',
};

const dateStyle: React.CSSProperties = {
  fontSize: FONTS.size.sm,
  color: COLORS.textMuted,
  fontWeight: FONTS.weight.medium,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 16,
};

const tileStyle = (colors: any): React.CSSProperties => ({
  background: COLORS.white,
  borderRadius: BORDERS.radius.lg,
  border: `1px solid ${COLORS.gray200}`,
  borderTop: `4px solid ${colors.border}`,
  boxShadow: SHADOWS.md,
  cursor: 'pointer',
  transition: 'transform 0.15s, box-shadow 0.15s',
  overflow: 'hidden',
});

const tileHeaderStyle = (colors: any): React.CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 20px 8px',
  background: colors.light,
});

const tileNameStyle: React.CSSProperties = {
  fontSize: FONTS.size.lg,
  fontWeight: FONTS.weight.bold,
  color: COLORS.textPrimary,
};

const statusDotStyle = (colors: any): React.CSSProperties => ({
  width: 12,
  height: 12,
  borderRadius: '50%',
  background: colors.bg,
  boxShadow: `0 0 0 3px ${colors.light}`,
});

const tileBodyStyle: React.CSSProperties = {
  padding: '12px 20px 16px',
};

const summaryStyle: React.CSSProperties = {
  fontSize: FONTS.size.md,
  color: COLORS.textSecondary,
  lineHeight: 1.5,
  margin: 0,
};

const countBadgeStyle = (colors: any): React.CSSProperties => ({
  display: 'inline-block',
  marginTop: 12,
  padding: '4px 10px',
  borderRadius: '20px',
  fontSize: FONTS.size.xs,
  fontWeight: FONTS.weight.semibold,
  background: colors.light,
  color: colors.bg,
});

const tileFooterStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderTop: `1px solid ${COLORS.gray100}`,
  background: COLORS.offWhite,
};

const clickHintStyle: React.CSSProperties = {
  fontSize: FONTS.size.xs,
  color: COLORS.orange,
  fontWeight: FONTS.weight.semibold,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const rightRailStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const railCardStyle: React.CSSProperties = {
  background: COLORS.white,
  borderRadius: BORDERS.radius.lg,
  border: `1px solid ${COLORS.gray200}`,
  padding: 20,
  boxShadow: SHADOWS.sm,
};

const railTitleStyle: React.CSSProperties = {
  fontSize: FONTS.size.md,
  fontWeight: FONTS.weight.bold,
  color: COLORS.textPrimary,
  margin: '0 0 16px 0',
};

const healthSummaryStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const railItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const railDotStyle = (colors: any): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: colors.bg,
  flexShrink: 0,
});

const railItemTextStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const railItemNameStyle: React.CSSProperties = {
  fontSize: FONTS.size.sm,
  fontWeight: FONTS.weight.medium,
  color: COLORS.textPrimary,
};

const railItemStatusStyle = (status: string): React.CSSProperties => ({
  fontSize: FONTS.size.xs,
  color: status === 'green' ? COLORS.green : status === 'amber' ? COLORS.amber : COLORS.red,
  fontWeight: FONTS.weight.medium,
});

const railCountStyle: React.CSSProperties = {
  fontSize: FONTS.size.sm,
  fontWeight: FONTS.weight.bold,
  color: COLORS.textSecondary,
  minWidth: 24,
  textAlign: 'right',
};

const quickActionStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: BORDERS.radius.md,
  border: `1px solid ${COLORS.gray200}`,
  background: COLORS.white,
  color: COLORS.textPrimary,
  fontSize: FONTS.size.sm,
  fontWeight: FONTS.weight.medium,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'all 0.15s',
};
