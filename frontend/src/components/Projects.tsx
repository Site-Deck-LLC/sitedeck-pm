import { useEffect, useState } from 'react';
import { getProjects } from '../api';
import { COLORS, FONTS, SHADOWS, BORDERS, STATUS_COLORS } from '../styles/design-system';
import { Sidebar, type SidebarView, type SidebarUser } from './Sidebar';
import type { ConnectedProductsState } from './ConnectedProducts';

interface Project {
  id: string;
  name: string;
  status: string;
  orgId: string;
  startDate?: string;
  endDate?: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  cpi: number;
  spi: number;
  healthStatus: 'green' | 'amber' | 'red';
  openItems: number;
  location: { x: number; y: number }; // percentage on US map
}

// ─── Mock project locations (approximate US map %) ───
const MOCK_LOCATIONS: Record<string, { x: number; y: number }> = {
  // Texas (BESS project)
  default: { x: 48, y: 72 },
};

function getMockLocation(name: string): { x: number; y: number } {
  const key = Object.keys(MOCK_LOCATIONS).find((k) => name.toLowerCase().includes(k.toLowerCase()));
  if (key) return MOCK_LOCATIONS[key];
  // Deterministic pseudo-random based on name length
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return {
    x: 20 + (hash % 55),
    y: 30 + (hash % 45),
  };
}

function getMockSummary(project: Project): ProjectSummary {
  const hash = project.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const cpi = 0.85 + (hash % 25) / 100; // 0.85 - 1.10
  const spi = 0.80 + (hash % 30) / 100; // 0.80 - 1.10
  const healthStatus = cpi >= 1.0 ? 'green' : cpi >= 0.95 ? 'amber' : 'red';
  const openItems = hash % 8;
  return {
    ...project,
    cpi,
    spi,
    healthStatus,
    openItems,
    location: getMockLocation(project.name),
  };
}

interface UserInfo {
  email: string | null;
  displayName: string | null;
}

export function Projects({
  onSelectProject,
  onViewMap,
  onLogout,
  onNavigateTemplates,
  onNavigateBilling,
  onNavigatePortfolio,
  onNavigateAdmin,
  headerRight,
}: {
  onSelectProject: (id: string) => void;
  onViewMap: () => void;
  onLogout: () => void;
  onNavigateTemplates?: () => void;
  onNavigateBilling?: () => void;
  onNavigatePortfolio?: () => void;
  onNavigateAdmin?: () => void;
  headerRight?: React.ReactNode;
}) {
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectedProducts, setConnectedProducts] = useState<ConnectedProductsState | undefined>();
  const [user, setUser] = useState<SidebarUser | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const list = await getProjects();
        setSummaries(list.map(getMockSummary));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Best-effort fetch of /api/v1/health for the ConnectedProducts dots.
  // The endpoint is unauthenticated, but a missing token doesn't matter —
  // the route is open. We never throw from here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/health');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.connectedProducts) {
          setConnectedProducts(data.connectedProducts);
        }
      } catch {
        // Health endpoint down — leave undefined, dots render gray.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // First try the synchronous dev-email hint.
      let info: UserInfo = {
        email: localStorage.getItem('sitedeck-dev-email') || null,
        displayName: null,
      };
      // Then try Firebase currentUser (async; best-effort).
      try {
        const { getFirebaseAuth } = await import('../firebase');
        const auth = getFirebaseAuth();
        if (auth?.currentUser) {
          info = {
            email: auth.currentUser.email ?? info.email,
            displayName: auth.currentUser.displayName ?? null,
          };
        }
      } catch {
        // No Firebase or not initialized — keep the dev fallback.
      }
      if (!cancelled) setUser(info);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNavigate = (view: SidebarView) => {
    switch (view) {
      case 'projects':
        // Already on projects; no-op (could re-load or scroll to top).
        break;
      case 'templates':
        onNavigateTemplates?.();
        break;
      case 'portfolio':
        onNavigatePortfolio?.();
        break;
      case 'billing':
        onNavigateBilling?.();
        break;
      case 'admin':
        onNavigateAdmin?.();
        break;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: COLORS.offWhite,
        fontFamily: FONTS.family,
      }}
    >
      <Sidebar
        currentView="projects"
        onNavigate={handleNavigate}
        user={user}
        onLogout={onLogout}
        connectedProducts={connectedProducts}
      />

      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: '32px 40px',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: COLORS.textSecondary }}>
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
            Loading projects...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div
              style={{
                color: COLORS.red,
                fontWeight: FONTS.weight.semibold,
                marginBottom: 16,
                fontSize: FONTS.size.md,
              }}
            >
              {error}
            </div>
            <p style={{ color: COLORS.textSecondary, marginBottom: 20 }}>
              Your session may have expired or the token is no longer valid.
            </p>
            <button
              onClick={onLogout}
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
              Sign Out and Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Header + Toggle */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: FONTS.size.xxl,
                    fontWeight: FONTS.weight.bold,
                    color: COLORS.textPrimary,
                    margin: '0 0 4px 0',
                  }}
                >
                  Projects
                </h1>
                <p style={{ fontSize: FONTS.size.md, color: COLORS.textSecondary, margin: 0 }}>
                  {summaries.length} active project{summaries.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {headerRight}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    background: COLORS.white,
                    padding: 4,
                    borderRadius: BORDERS.radius.md,
                    border: `1px solid ${COLORS.gray200}`,
                  }}
                >
                  <button
                    style={{
                      padding: '8px 16px',
                      borderRadius: BORDERS.radius.sm,
                      border: 'none',
                      background: COLORS.navy,
                      color: COLORS.white,
                      fontSize: FONTS.size.sm,
                      fontWeight: FONTS.weight.semibold,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                    Tiles
                  </button>
                  <button
                    onClick={onViewMap}
                    style={{
                      padding: '8px 16px',
                      borderRadius: BORDERS.radius.sm,
                      border: 'none',
                      background: 'transparent',
                      color: COLORS.textSecondary,
                      fontSize: FONTS.size.sm,
                      fontWeight: FONTS.weight.semibold,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                      <line x1="8" y1="2" x2="8" y2="18" />
                      <line x1="16" y1="6" x2="16" y2="22" />
                    </svg>
                    Map
                  </button>
                </div>
              </div>
            </div>

            {/* Tile View */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: 20,
              }}
            >
              {summaries.map((s) => {
                const colors = STATUS_COLORS[s.healthStatus];
                return (
                  <div
                    key={s.id}
                    style={{
                      padding: 24,
                      borderRadius: BORDERS.radius.lg,
                      border: `1px solid ${COLORS.gray200}`,
                      borderTop: `4px solid ${colors.border}`,
                      background: COLORS.white,
                      boxShadow: SHADOWS.md,
                      cursor: 'pointer',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onClick={() => onSelectProject(s.id)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = SHADOWS.lg;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = SHADOWS.md;
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: 12,
                      }}
                    >
                      <h3
                        style={{
                          fontSize: FONTS.size.lg,
                          fontWeight: FONTS.weight.bold,
                          color: COLORS.textPrimary,
                          margin: 0,
                          lineHeight: 1.3,
                        }}
                      >
                        {s.name}
                      </h3>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: FONTS.size.xs,
                          fontWeight: FONTS.weight.semibold,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          background: colors.light,
                          color: colors.bg,
                        }}
                      >
                        {s.status}
                      </span>
                    </div>

                    {/* CPI / SPI mini gauges */}
                    <div
                      style={{
                        display: 'flex',
                        gap: 16,
                        marginBottom: 16,
                        padding: 12,
                        background: COLORS.offWhite,
                        borderRadius: BORDERS.radius.md,
                      }}
                    >
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: FONTS.size.xl,
                            fontWeight: FONTS.weight.bold,
                            color:
                              s.cpi >= 1.0
                                ? COLORS.green
                                : s.cpi >= 0.95
                                ? COLORS.amber
                                : COLORS.red,
                          }}
                        >
                          {s.cpi.toFixed(2)}
                        </div>
                        <div
                          style={{
                            fontSize: FONTS.size.xs,
                            color: COLORS.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          CPI
                        </div>
                      </div>
                      <div style={{ width: 1, background: COLORS.gray200 }} />
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: FONTS.size.xl,
                            fontWeight: FONTS.weight.bold,
                            color:
                              s.spi >= 1.0
                                ? COLORS.green
                                : s.spi >= 0.95
                                ? COLORS.amber
                                : COLORS.red,
                          }}
                        >
                          {s.spi.toFixed(2)}
                        </div>
                        <div
                          style={{
                            fontSize: FONTS.size.xs,
                            color: COLORS.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          SPI
                        </div>
                      </div>
                      <div style={{ width: 1, background: COLORS.gray200 }} />
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: FONTS.size.xl,
                            fontWeight: FONTS.weight.bold,
                            color: s.openItems > 0 ? COLORS.amber : COLORS.green,
                          }}
                        >
                          {s.openItems}
                        </div>
                        <div
                          style={{
                            fontSize: FONTS.size.xs,
                            color: COLORS.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          Open Items
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                      <div>
                        <div
                          style={{
                            fontSize: FONTS.size.xs,
                            color: COLORS.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: 2,
                          }}
                        >
                          Start
                        </div>
                        <div
                          style={{
                            fontSize: FONTS.size.sm,
                            fontWeight: FONTS.weight.medium,
                            color: COLORS.textPrimary,
                          }}
                        >
                          {s.startDate?.slice(0, 10) || '—'}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: FONTS.size.xs,
                            color: COLORS.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: 2,
                          }}
                        >
                          End
                        </div>
                        <div
                          style={{
                            fontSize: FONTS.size.sm,
                            fontWeight: FONTS.weight.medium,
                            color: COLORS.textPrimary,
                          }}
                        >
                          {s.endDate?.slice(0, 10) || '—'}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <span
                        style={{
                          fontSize: FONTS.size.xs,
                          color: COLORS.orange,
                          fontWeight: FONTS.weight.semibold,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        View Dashboard →
                      </span>
                    </div>
                  </div>
                );
              })}

              {summaries.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 60,
                    color: COLORS.textMuted,
                    gridColumn: '1 / -1',
                  }}
                >
                  No projects found.
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
