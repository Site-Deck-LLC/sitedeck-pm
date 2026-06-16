import { useEffect, useState } from 'react';
import { getAgentBrief } from '../api';
import { COLORS, FONTS, SHADOWS, BORDERS } from '../styles/design-system';

interface Brief {
  generatedAt: string;
  copilot: {
    alertCount: number;
    scenarioCount: number;
    compoundFlagCount: number;
    topAlerts: any[];
  };
  coach: {
    tipCount: number;
    nudgeCount: number;
    topTips: any[];
    nextStep: { label: string; link: string } | null;
  };
  standards: {
    overallStatus: 'green' | 'amber' | 'red';
    checkCount: number;
    noticeCount: number;
    upcomingNotices: any[];
  };
}

const STATUS_COLOR: Record<string, string> = {
  green: COLORS.green,
  amber: COLORS.amber,
  red: COLORS.red,
};

export function MorningBrief({ projectId }: { projectId: string }) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getAgentBrief(projectId);
        if (!cancelled) {
          setBrief(data);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>
        Generating morning brief…
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: COLORS.textMuted, fontSize: FONTS.size.sm }}>
        Morning brief unavailable. Agents will be live in a future sprint.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Standards status pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: COLORS.gray100,
          borderRadius: BORDERS.radius.md,
          border: `1px solid ${COLORS.gray200}`,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: STATUS_COLOR[brief.standards.overallStatus] || COLORS.gray500,
          }}
        />
        <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>
          Standards & Compliance
        </span>
        <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>
          {brief.standards.checkCount} check{brief.standards.checkCount !== 1 ? 's' : ''}
          {' • '}
          {brief.standards.noticeCount} notice{brief.standards.noticeCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <StatTile
          label="Co-Pilot"
          value={`${brief.copilot.alertCount}`}
          sub="Alerts"
          color={brief.copilot.alertCount > 0 ? COLORS.amber : COLORS.green}
        />
        <StatTile
          label="Coach"
          value={`${brief.coach.tipCount}`}
          sub="Tips"
          color={brief.coach.tipCount > 0 ? COLORS.navy : COLORS.textMuted}
        />
        <StatTile
          label="Compound"
          value={`${brief.copilot.compoundFlagCount}`}
          sub="Flags"
          color={brief.copilot.compoundFlagCount > 0 ? COLORS.red : COLORS.green}
        />
      </div>

      {/* Next step from coach */}
      {brief.coach.nextStep && (
        <div
          style={{
            padding: '10px 12px',
            background: COLORS.navy,
            color: COLORS.white,
            borderRadius: BORDERS.radius.md,
            fontSize: FONTS.size.sm,
          }}
        >
          <div style={{ fontSize: FONTS.size.xs, opacity: 0.7, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Next step
          </div>
          <div style={{ fontWeight: FONTS.weight.semibold }}>{brief.coach.nextStep.label}</div>
        </div>
      )}

      {/* Upcoming notices */}
      {brief.standards.upcomingNotices.length > 0 && (
        <div style={{ borderTop: `1px solid ${COLORS.gray100}`, paddingTop: 8 }}>
          <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, fontWeight: FONTS.weight.semibold, marginBottom: 6 }}>
            UPCOMING NOTICES
          </div>
          {brief.standards.upcomingNotices.map((n: any, i: number) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: FONTS.size.xs,
                color: COLORS.textPrimary,
                padding: '4px 0',
              }}
            >
              <span>{n.description}</span>
              <span style={{ color: n.daysRemaining <= 2 ? COLORS.red : COLORS.amber, fontWeight: FONTS.weight.semibold }}>
                {n.daysRemaining}d
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 10, color: COLORS.textMuted, textAlign: 'right', marginTop: 4 }}>
        Generated {new Date(brief.generatedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div
      style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.gray200}`,
        borderRadius: BORDERS.radius.md,
        padding: 10,
        textAlign: 'center',
        boxShadow: SHADOWS.sm,
      }}
    >
      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color, marginTop: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: COLORS.textMuted }}>{sub}</div>
    </div>
  );
}
