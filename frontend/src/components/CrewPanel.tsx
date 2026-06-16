import { COLORS, FONTS, STATUS_COLORS } from '../styles/design-system';

interface CrewStatus {
  plannedCrewToday: number;
  confirmedPresent: number;
  absentCount: number;
  lateCount: number;
  crewGapPct: number;
  gapStatus: 'green' | 'amber' | 'red';
  criticalPathImpacted: boolean;
  equipmentOnSite: number;
  equipmentIdle: number;
  equipmentDailyBurn: number;
  equipmentBudgetRate: number;
}

const formatCurrency = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n}`;
};

function GapFlag({ status }: { status: 'green' | 'amber' | 'red' }) {
  const color = STATUS_COLORS[status].bg;
  if (status === 'green') {
    return (
      <span
        title="On target"
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
        }}
      />
    );
  }
  if (status === 'amber') {
    return (
      <span
        title="Warning"
        style={{
          display: 'inline-block',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderBottom: `10px solid ${color}`,
        }}
      />
    );
  }
  // red alert
  return (
    <span
      title="Alert"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 14,
        height: 14,
        borderRadius: 3,
        background: color,
        color: COLORS.white,
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      !
    </span>
  );
}

export function CrewPanel({ data, onLogEquipment }: { data: CrewStatus | null; onLogEquipment?: () => void }) {
  if (!data) {
    return (
      <div style={{ textAlign: 'center', color: COLORS.textMuted, padding: 24 }}>
        No crew data available
      </div>
    );
  }

  const gapColor = STATUS_COLORS[data.gapStatus].bg;
  const burnColor =
    data.equipmentDailyBurn <= data.equipmentBudgetRate
      ? STATUS_COLORS.green.bg
      : data.equipmentDailyBurn <= data.equipmentBudgetRate * 1.1
        ? STATUS_COLORS.amber.bg
        : STATUS_COLORS.red.bg;

  return (
    <div style={{ width: '100%' }}>
      {/* Row 1: Crew */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          paddingBottom: 12,
          borderBottom: `1px solid ${COLORS.gray100}`,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase' }}>Planned</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.navy }}>{data.plannedCrewToday}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase' }}>Present</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.textPrimary }}>{data.confirmedPresent}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase' }}>Gap</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <GapFlag status={data.gapStatus} />
            <span style={{ fontSize: 22, fontWeight: 700, color: gapColor }}>{data.crewGapPct}%</span>
          </div>
          {data.criticalPathImpacted && (
            <div style={{ fontSize: 9, fontWeight: 700, color: STATUS_COLORS.red.bg, marginTop: 2 }}>
              CRITICAL PATH AT RISK
            </div>
          )}
        </div>
      </div>

      {/* Absent / late detail */}
      {(data.absentCount > 0 || data.lateCount > 0) && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            fontSize: 11,
            color: COLORS.textSecondary,
            paddingTop: 8,
            paddingBottom: 12,
            borderBottom: `1px solid ${COLORS.gray100}`,
          }}
        >
          {data.absentCount > 0 && (
            <span>
              <strong style={{ color: COLORS.textPrimary }}>{data.absentCount}</strong> absent
            </span>
          )}
          {data.lateCount > 0 && (
            <span>
              <strong style={{ color: COLORS.textPrimary }}>{data.lateCount}</strong> late
            </span>
          )}
        </div>
      )}

      {/* Row 2: Equipment */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          paddingTop: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase' }}>On Site</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.navy }}>{data.equipmentOnSite}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase' }}>Idle</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: data.equipmentIdle > 0 ? STATUS_COLORS.amber.bg : COLORS.textPrimary }}>
            {data.equipmentIdle}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase' }}>Burn</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: burnColor }}>
            {formatCurrency(data.equipmentDailyBurn)}/day
          </div>
          <div style={{ fontSize: 10, color: COLORS.textMuted }}>
            vs {formatCurrency(data.equipmentBudgetRate)}/day
          </div>
        </div>
      </div>
      {onLogEquipment && (
        <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${COLORS.gray100}`, textAlign: 'center' }}>
          <button
            onClick={onLogEquipment}
            style={{
              background: 'transparent',
              color: COLORS.navy,
              border: 'none',
              fontSize: 11,
              fontWeight: FONTS.weight.semibold,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            + Log Equipment Status
          </button>
        </div>
      )}
    </div>
  );
}
