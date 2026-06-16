import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { COLORS, STATUS_COLORS } from '../styles/design-system';

interface SchedulePoint {
  date: string;
  baselinePct: number;
  actualPct: number;
  forecastPct: number;
}

export function SchedulePerformanceChart({ data }: { data: SchedulePoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: COLORS.textMuted, padding: 24 }}>
        No schedule performance data available
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const last = data[data.length - 1];
  const actualColor =
    last.actualPct >= last.baselinePct
      ? STATUS_COLORS.green.bg
      : last.actualPct >= last.baselinePct - 5
        ? STATUS_COLORS.amber.bg
        : STATUS_COLORS.red.bg;

  const variance = last.actualPct - last.baselinePct;
  const varianceLabel =
    Math.abs(variance) < 0.05
      ? 'On plan'
      : variance > 0
        ? `${variance.toFixed(1)}% ahead`
        : `${Math.abs(variance).toFixed(1)}% behind`;
  const varianceColor =
    Math.abs(variance) < 0.05
      ? STATUS_COLORS.green.bg
      : variance > 0
        ? STATUS_COLORS.green.bg
        : variance >= -2
          ? STATUS_COLORS.green.bg
          : variance >= -5
            ? STATUS_COLORS.amber.bg
            : STATUS_COLORS.red.bg;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gray200} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: COLORS.textSecondary }}
            axisLine={{ stroke: COLORS.gray300 }}
            tickLine={false}
            tickFormatter={(str: string) => {
              const d = new Date(str);
              return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
            }}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: COLORS.textSecondary }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
            labelFormatter={(label) => String(label)}
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
          <ReferenceLine
            x={todayStr}
            stroke={COLORS.gray400}
            strokeDasharray="3 3"
            label={{ value: 'Today', position: 'insideTopRight', fontSize: 10, fill: COLORS.gray400 }}
          />
          <Line
            type="monotone"
            dataKey="baselinePct"
            name="Baseline"
            stroke={COLORS.navy}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="actualPct"
            name="Actual"
            stroke={actualColor}
            strokeWidth={2.5}
            dot={{ r: 3, fill: actualColor, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="forecastPct"
            name="Forecast"
            stroke={COLORS.orange}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
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
          <div style={{ fontWeight: 600, color: COLORS.navy }}>{last.baselinePct.toFixed(1)}%</div>
          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>Baseline</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, color: COLORS.orange }}>{last.forecastPct.toFixed(1)}%</div>
          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>Forecast</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, color: actualColor }}>{last.actualPct.toFixed(1)}%</div>
          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>Actual</div>
        </div>
      </div>
      <div
        style={{
          textAlign: 'center',
          marginTop: 8,
          fontSize: 12,
          fontWeight: 600,
          color: varianceColor,
        }}
      >
        {varianceLabel} vs baseline
      </div>
    </div>
  );
}
