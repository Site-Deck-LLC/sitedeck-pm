import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { COLORS, STATUS_COLORS } from '../styles/design-system';

interface SafetyPoint {
  date: string;
  monthLabel: string;
  trirActual: number;
  trirTarget: number;
}

interface SafetyData {
  projectId: string;
  trirTarget: number;
  trirActual: number;
  status: 'green' | 'amber' | 'red';
  recordableIncidents: number;
  totalHoursWorked: number;
  series: SafetyPoint[];
}

export function SafetyPerformancePanel({ data }: { data: SafetyData | null }) {
  if (!data) {
    return (
      <div style={{ textAlign: 'center', color: COLORS.textMuted, padding: 24 }}>
        No safety data available
      </div>
    );
  }

  const statusColor = STATUS_COLORS[data.status].bg;

  // Use series if available, otherwise synthesize a single point
  const chartData =
    data.series && data.series.length > 0
      ? data.series
      : [
          {
            date: new Date().toISOString().split('T')[0],
            monthLabel: 'Current',
            trirActual: data.trirActual,
            trirTarget: data.trirTarget,
          },
        ];

  const yMax = Math.max(data.trirTarget * 1.5, data.trirActual * 1.1, 1);

  // Determine the color of the Actual line: use the latest point's status color
  const last = chartData[chartData.length - 1];
  const lastRatio = last.trirTarget > 0 ? last.trirActual / last.trirTarget : 0;
  const EPS = 1e-12;
  const actualLineColor =
    lastRatio <= 0.5 + EPS
      ? STATUS_COLORS.green.bg
      : lastRatio < 0.8 - EPS
        ? STATUS_COLORS.amber.bg
        : STATUS_COLORS.red.bg;

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
          padding: '8px 12px',
          borderRadius: 8,
          background: STATUS_COLORS[data.status].bg + '20',
          borderLeft: `4px solid ${statusColor}`,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
          Safety Status: {data.status.toUpperCase()}
        </span>
        <span style={{ fontSize: 12, color: COLORS.textSecondary, marginLeft: 'auto' }}>
          {data.recordableIncidents} recordable incident{data.recordableIncidents !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        style={{
          fontSize: 11,
          color: COLORS.textSecondary,
          marginBottom: 8,
          fontStyle: 'italic',
        }}
      >
        Lower is better ↓ — TRIR (Total Recordable Incident Rate) per 200,000 hours
      </div>

      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gray200} />
            <XAxis
              dataKey="monthLabel"
              tick={{ fontSize: 10, fill: COLORS.textSecondary }}
              axisLine={{ stroke: COLORS.gray300 }}
              tickLine={false}
            />
            <YAxis
              domain={[0, yMax]}
              tick={{ fontSize: 11, fill: COLORS.textSecondary }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip
              formatter={(value) => [Number(value).toFixed(2), '']}
              contentStyle={{
                background: COLORS.white,
                border: `1px solid ${COLORS.gray200}`,
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <ReferenceLine
              y={data.trirTarget}
              stroke={COLORS.navy}
              strokeWidth={2}
              label={{
                value: 'Target',
                position: 'right',
                fontSize: 10,
                fill: COLORS.navy,
              }}
            />
            <Line
              type="monotone"
              dataKey="trirTarget"
              name="TRIR Target"
              stroke={COLORS.navy}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="trirActual"
              name="TRIR Actual"
              stroke={actualLineColor}
              strokeWidth={2.5}
              dot={{ r: 3, fill: actualLineColor, strokeWidth: 0 }}
            />
            <ReferenceDot
              x={last.monthLabel}
              y={last.trirActual}
              r={5}
              fill={actualLineColor}
              stroke={COLORS.white}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${COLORS.gray100}`,
          fontSize: 13,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, color: COLORS.navy }}>{data.trirTarget.toFixed(2)}</div>
          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>TRIR Target</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, color: actualLineColor }}>{data.trirActual.toFixed(2)}</div>
          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>Current TRIR</div>
        </div>
        <div
          style={{
            textAlign: 'center',
            padding: '2px 8px',
            borderRadius: 6,
            background: statusColor,
            color: COLORS.white,
            alignSelf: 'center',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
        >
          {data.status}
        </div>
      </div>
    </div>
  );
}
