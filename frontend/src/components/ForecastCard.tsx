/**
 * EVM Forecasts Card
 * ============================================================================
 * Sprint 12 Task 7. Renders:
 *   - TCPI gauge (with tight/on-pace/cushion flag)
 *   - EAC confidence range (optimistic / most likely / pessimistic)
 *   - Forecast completion date with delta vs baseline
 *   - VAC
 *
 * Designed to drop into the existing Cost / Dashboard layout.
 * Pulls its own data — caller passes projectId.
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { getEvmForecasts, type EvmForecasts } from '../api';
import { COLORS, FONTS, BORDERS } from '../styles/design-system';

const fmtMoney = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(1)}k`
    : `$${n.toFixed(0)}`;

const fmtDate = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');

export function ForecastCard({ projectId }: { projectId: string }) {
  const [f, setF] = useState<EvmForecasts | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await getEvmForecasts(projectId);
        setF(r);
      } catch (e: any) {
        setError(e?.message || 'failed to load');
      }
    })();
  }, [projectId]);

  if (error) {
    return (
      <div style={card}>
        <p style={{ color: COLORS.red, fontSize: FONTS.size.sm }}>Forecasts: {error}</p>
      </div>
    );
  }
  if (!f) {
    return (
      <div style={card}>
        <p style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm }}>Loading forecasts…</p>
      </div>
    );
  }

  const tcpiColor =
    f.tcpiFlag === 'tight'
      ? COLORS.red
      : f.tcpiFlag === 'cushion'
      ? COLORS.green
      : COLORS.navy;
  const dateDelta = f.completeDateDeltaDays;
  const dateColor =
    dateDelta == null ? COLORS.navy : dateDelta > 0 ? COLORS.red : COLORS.green;

  return (
    <div style={card}>
      <h3 style={{ margin: 0, marginBottom: 12, color: COLORS.navy, fontSize: FONTS.size.lg }}>
        Forecasts
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <Tile label="TCPI" value={f.tcpi.toFixed(2)} color={tcpiColor} subtitle={tcpiLabel(f.tcpiFlag)} />
        <Tile
          label="Most Likely EAC"
          value={fmtMoney(f.confidenceRange.mostLikely)}
          color={f.vac < 0 ? COLORS.red : COLORS.navy}
          subtitle={`${f.vac < 0 ? '+' : ''}${fmtMoney(Math.abs(f.vac))} ${f.vac < 0 ? 'over' : 'under'}`}
        />
        <Tile
          label="Forecast Complete"
          value={fmtDate(f.forecastCompleteDate)}
          color={dateColor}
          subtitle={
            dateDelta == null
              ? '—'
              : dateDelta > 0
              ? `+${dateDelta}d vs baseline`
              : `${dateDelta}d ahead`
          }
        />
      </div>
      <div style={{ marginTop: 16, fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
        Confidence range: {fmtMoney(f.confidenceRange.optimistic)} (optimistic) →{' '}
        {fmtMoney(f.confidenceRange.mostLikely)} (most likely) →{' '}
        {fmtMoney(f.confidenceRange.pessimistic)} (pessimistic)
      </div>
    </div>
  );
}

function tcpiLabel(flag: EvmForecasts['tcpiFlag']): string {
  if (flag === 'tight') return 'Tight — work 10%+ harder on remaining';
  if (flag === 'cushion') return 'Comfortable cushion';
  if (flag === 'on_pace') return 'On pace';
  return 'Unknown';
}

function Tile({
  label,
  value,
  color,
  subtitle,
}: {
  label: string;
  value: string;
  color: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        background: COLORS.gray100,
        borderRadius: BORDERS.radius.sm,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>{subtitle}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: COLORS.white,
  border: `1px solid ${COLORS.gray200}`,
  borderRadius: BORDERS.radius.md,
  padding: 16,
};
