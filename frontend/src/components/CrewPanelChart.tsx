import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { COLORS } from '../styles/design-system';

interface CrewData {
  speciality: number;
  general: number;
  equipment: number;
  equipmentActive: number;
  equipmentIdle: number;
  dailyBurnRate: number;
}

export function CrewPanelChart({ data }: { data: CrewData | null }) {
  if (!data) {
    return (
      <div style={{ textAlign: 'center', color: COLORS.textMuted, padding: 24 }}>
        No crew data available
      </div>
    );
  }

  const chartData = [
    { name: 'Specialty Crew', value: data.speciality, color: COLORS.orange },
    { name: 'General Crew', value: data.general, color: COLORS.navy },
    { name: 'Equipment', value: data.equipment, color: '#0EA5A0' },
  ];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gray200} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: COLORS.textSecondary }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: COLORS.textSecondary }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              formatter={(value) => [`${value}`, 'Count']}
              contentStyle={{
                background: COLORS.white,
                border: `1px solid ${COLORS.gray200}`,
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.gray100}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
          <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>{data.equipmentActive}</span> active / <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>{data.equipmentIdle}</span> idle
        </div>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, textAlign: 'right' }}>
          Daily burn: <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>${data.dailyBurnRate.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
