import { useEffect, useState } from 'react';
import { getProjects, getBillingStatus } from '../api';
import { COLORS, FONTS, SHADOWS, BORDERS } from '../styles/design-system';

interface Project {
  id: string;
  name: string;
  status: string;
  orgId: string;
  startDate?: string;
  endDate?: string;
}

export function Projects({
  onSelectProject,
  onLogout,
}: {
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

  return (
    <div style={{ minHeight: '100vh', background: COLORS.offWhite, fontFamily: FONTS.family }}>
      {/* Nav — always visible */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        background: COLORS.navy,
        color: COLORS.white,
        borderBottom: `1px solid ${COLORS.navyLight}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: COLORS.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: FONTS.weight.bold, fontSize: FONTS.size.sm }}>
            SD
          </div>
          <span style={{ fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold }}>SiteDeck PM</span>
        </div>
        <button onClick={onLogout} style={{
          padding: '6px 14px',
          borderRadius: BORDERS.radius.sm,
          border: 'none',
          background: COLORS.orange,
          color: COLORS.white,
          fontSize: FONTS.size.sm,
          fontWeight: FONTS.weight.semibold,
          cursor: 'pointer',
        }}>
          Sign Out
        </button>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: COLORS.textSecondary }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${COLORS.gray200}`, borderTop: `3px solid ${COLORS.orange}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            Loading projects...
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
            <header style={{ marginBottom: 32 }}>
              <h1 style={{ fontSize: FONTS.size.xxl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: '0 0 4px 0' }}>
                Projects
              </h1>
              <p style={{ fontSize: FONTS.size.md, color: COLORS.textSecondary, margin: 0 }}>
                Select a project to view the dashboard
              </p>
            </header>

            {billing && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                borderRadius: BORDERS.radius.md,
                background: COLORS.white,
                border: `1px solid ${COLORS.gray200}`,
                marginBottom: 24,
                boxShadow: SHADOWS.sm,
              }}>
                <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>Plan:</span>
                <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.orange, textTransform: 'uppercase' }}>{billing.planTier}</span>
                <span style={{ color: COLORS.gray300 }}>|</span>
                <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>{billing.projectCount} / {billing.projectLimit} projects</span>
                <span style={{ color: COLORS.gray300 }}>|</span>
                <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>Status:</span>
                <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: billing.status === 'active' ? COLORS.green : billing.status === 'trialing' ? COLORS.amber : COLORS.red }}>
                  {billing.status}
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
              {projects.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: 24,
                    borderRadius: BORDERS.radius.lg,
                    border: `1px solid ${COLORS.gray200}`,
                    background: COLORS.white,
                    boxShadow: SHADOWS.md,
                    cursor: 'pointer',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onClick={() => onSelectProject(p.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = SHADOWS.lg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = SHADOWS.md;
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: 0, lineHeight: 1.3 }}>
                      {p.name}
                    </h3>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: FONTS.size.xs,
                      fontWeight: FONTS.weight.semibold,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      background: p.status === 'active' ? COLORS.greenLight : COLORS.gray100,
                      color: p.status === 'active' ? COLORS.green : COLORS.textSecondary,
                    }}>
                      {p.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Start</div>
                      <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, color: COLORS.textPrimary }}>{p.startDate?.slice(0, 10) || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>End</div>
                      <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, color: COLORS.textPrimary }}>{p.endDate?.slice(0, 10) || '—'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: FONTS.size.xs, color: COLORS.orange, fontWeight: FONTS.weight.semibold, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      View Dashboard →
                    </span>
                  </div>
                </div>
              ))}

              {projects.length === 0 && (
                <div style={{ textAlign: 'center', padding: 60, color: COLORS.textMuted, gridColumn: '1 / -1' }}>
                  No projects found.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
