import { COLORS } from '../styles/design-system';

interface GaugeProps {
  value: number; // 0 to 2 typically
  max?: number;
  label: string;
  size?: number;
}

export function Gauge({ value, max = 2, label, size = 120 }: GaugeProps) {
  const percentage = Math.min(Math.max(value / max, 0), 1);
  const angle = percentage * 180; // 0 to 180 degrees
  const radius = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;

  // Color based on value
  let color: string = COLORS.green;
  if (value < 0.95) color = COLORS.red;
  else if (value < 1.0) color = COLORS.amber;

  // Arc path
  const arcPath = describeArc(cx, cy, radius, 180, 0);

  // Needle angle in radians
  const needleAngle = (angle + 180) * (Math.PI / 180);
  const needleX = cx + radius * 0.85 * Math.cos(needleAngle);
  const needleY = cy + radius * 0.85 * Math.sin(needleAngle);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
        {/* Background arc */}
        <path d={arcPath} fill="none" stroke={COLORS.gray200} strokeWidth={8} strokeLinecap="round" />

        {/* Value arc */}
        <path
          d={describeArc(cx, cy, radius, 180, 180 - angle)}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
        />

        {/* Tick marks */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const tickAngle = (180 + tick * 180) * (Math.PI / 180);
          const tickInnerR = radius - 15;
          const tickOuterR = radius - 5;
          const x1 = cx + tickInnerR * Math.cos(tickAngle);
          const y1 = cy + tickInnerR * Math.sin(tickAngle);
          const x2 = cx + tickOuterR * Math.cos(tickAngle);
          const y2 = cy + tickOuterR * Math.sin(tickAngle);
          return (
            <line
              key={tick}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={COLORS.gray300}
              strokeWidth={2}
            />
          );
        })}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={5} fill={color} />

        {/* Value text */}
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fill={COLORS.textPrimary}
          fontSize={size / 8}
          fontWeight="700"
        >
          {value.toFixed(2)}
        </text>
      </svg>
      <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
    </div>
  );
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const angleInRadians = (angle * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
}
