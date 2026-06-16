import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { COLORS } from '../styles/design-system';

interface CashFlowMonth {
  year: number;
  month: number;
  monthLabel: string;
  plannedSpend: number;
  actualSpend: number;
  earnedValue: number;
  committed: number;
}

export function CashFlowChart({ data }: { data: CashFlowMonth[] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: COLORS.textMuted, padding: 24 }}>
        No cash flow data available
      </div>
    );
  }

  const formatCurrencyShort = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
  };

  const formatTick = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return `${value}`;
  };

  // Build cumulative series — the spec asks for cumulative dollar value
  let cumPlanned = 0;
  let cumActual = 0;
  let cumEarned = 0;
  let cumCommitted = 0;
  const cumulativeData = data.map((d) => {
    cumPlanned += d.plannedSpend;
    cumActual += d.actualSpend;
    cumEarned += d.earnedValue;
    cumCommitted += d.committed;
    return {
      ...d,
      cumPlanned: Math.round(cumPlanned),
      cumActual: Math.round(cumActual),
      cumEarned: Math.round(cumEarned),
      cumCommitted: Math.round(cumCommitted),
    };
  });

  const today = new Date();
  const currentMonthIndex = cumulativeData.findIndex(
    (d) => d.year === today.getFullYear() && d.month === today.getMonth() + 1
  );
  const currentMonth = currentMonthIndex >= 0 ? cumulativeData[currentMonthIndex] : null;

  // This-month summary: variance = actual - planned (positive = over budget = red)
  const thisMonthVariance = currentMonth ? currentMonth.actualSpend - currentMonth.plannedSpend : 0;
  const varianceColor = thisMonthVariance === 0
    ? COLORS.textSecondary
    : thisMonthVariance > 0
      ? '#EF4444'
      : '#22C55E';
  const varianceLabel = thisMonthVariance === 0
    ? 'On plan'
    : thisMonthVariance > 0
      ? `+${formatCurrencyShort(thisMonthVariance)} over`
      : `${formatCurrencyShort(Math.abs(thisMonthVariance))} under`;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={cumulativeData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gray200} />
            {currentMonthIndex >= 0 && (
              <ReferenceLine
                x={cumulativeData[currentMonthIndex].monthLabel}
                stroke={COLORS.navy}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'Today',
                  position: 'top',
                  fill: COLORS.navy,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}
            <XAxis
              dataKey="monthLabel"
              tick={{ fontSize: 11, fill: COLORS.textSecondary }}
              axisLine={{ stroke: COLORS.gray300 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: COLORS.textSecondary }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatTick}
            />
            <Tooltip
              formatter={(value) => [formatCurrencyShort(Number(value)), '']}
              labelStyle={{ color: COLORS.textPrimary, fontSize: 12 }}
              contentStyle={{
                background: COLORS.white,
                border: `1px solid ${COLORS.gray200}`,
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              iconType="circle"
              iconSize={8}
            />
            <Line
              type="monotone"
              dataKey="cumPlanned"
              name="Planned"
              stroke={COLORS.navy}
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="cumActual"
              name="Actual"
              stroke={COLORS.orange}
              strokeWidth={2.5}
              dot={{ r: 3, fill: COLORS.orange, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="cumEarned"
              name="Earned Value"
              stroke="#22C55E"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="cumCommitted"
              name="Committed"
              stroke="#9CA3AF"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {currentMonth && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${COLORS.gray100}`,
            fontSize: 12,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, color: COLORS.navy }}>{formatCurrencyShort(currentMonth.plannedSpend)}</div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>Planned (this mo)</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, color: COLORS.orange }}>{formatCurrencyShort(currentMonth.actualSpend)}</div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>Actual (this mo)</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, color: '#22C55E' }}>{formatCurrencyShort(currentMonth.earnedValue)}</div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>Earned (this mo)</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, color: varianceColor, fontSize: 12 }}>{varianceLabel}</div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>Variance</div>
          </div>
        </div>
      )}
    </div>
  );
}
