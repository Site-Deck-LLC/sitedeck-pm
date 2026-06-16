import { COLORS, FONTS, BORDERS, SHADOWS } from '../styles/design-system';

interface ProjectMarker {
  id: string;
  name: string;
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  cpi: number;
  spi: number;
  status: 'green' | 'amber' | 'red';
}

const US_OUTLINE = `M 45 5 L 140 5 L 155 20 L 180 20 L 190 35 L 200 35 L 205 50 L 220 50 L 225 65 L 235 70 L 240 85 L 245 100 L 250 120 L 255 140 L 250 155 L 245 170 L 235 180 L 225 185 L 210 190 L 195 195 L 180 198 L 160 200 L 140 198 L 120 195 L 100 190 L 80 185 L 65 175 L 50 165 L 40 150 L 35 135 L 30 120 L 25 100 L 20 85 L 18 70 L 18 55 L 20 40 L 25 25 L 30 15 L 38 8 Z`;

const AK_OUTLINE = `M 15 165 L 40 160 L 55 165 L 60 170 L 55 178 L 40 182 L 25 180 L 15 175 Z`;
const HI_OUTLINE = `M 55 185 L 70 182 L 78 185 L 75 190 L 65 192 L 55 190 Z`;

export function USMap({
  markers,
  onSelectProject,
  hoveredId,
  onHover,
}: {
  markers: ProjectMarker[];
  onSelectProject: (id: string) => void;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '60%', background: '#EAF0F6', borderRadius: BORDERS.radius.lg, overflow: 'hidden' }}>
      <svg
        viewBox="0 0 260 200"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* US Outline */}
        <path d={US_OUTLINE} fill={COLORS.white} stroke={COLORS.gray300} strokeWidth={1.5} />
        <path d={AK_OUTLINE} fill={COLORS.white} stroke={COLORS.gray300} strokeWidth={1} />
        <path d={HI_OUTLINE} fill={COLORS.white} stroke={COLORS.gray300} strokeWidth={1} />

        {/* Grid lines */}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 25} x2="260" y2={i * 25} stroke={COLORS.gray200} strokeWidth={0.5} strokeDasharray="2,2" />
        ))}
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`v${i}`} x1={i * 26} y1="0" x2={i * 26} y2="200" stroke={COLORS.gray200} strokeWidth={0.5} strokeDasharray="2,2" />
        ))}

        {/* Project markers */}
        {markers.map((m) => {
          const isHovered = hoveredId === m.id;
          const color = m.cpi >= 1.0 ? COLORS.green : m.cpi >= 0.95 ? COLORS.amber : COLORS.red;
          return (
            <g
              key={m.id}
              transform={`translate(${m.x * 2.6}, ${m.y * 2})`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectProject(m.id)}
              onMouseEnter={() => onHover(m.id)}
              onMouseLeave={() => onHover(null)}
            >
              {/* Pulse ring when hovered */}
              {isHovered && (
                <circle r={14} fill={color} opacity={0.15}>
                  <animate attributeName="r" values="10;18;10" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Marker dot */}
              <circle r={isHovered ? 10 : 7} fill={color} stroke={COLORS.white} strokeWidth={2} />
              {/* Status ring */}
              <circle r={isHovered ? 14 : 10} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray={m.status === 'green' ? 'none' : '4,2'} />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredId && (
        <MapTooltip markers={markers} hoveredId={hoveredId} />
      )}
    </div>
  );
}

function MapTooltip({ markers, hoveredId }: { markers: ProjectMarker[]; hoveredId: string }) {
  const m = markers.find((x) => x.id === hoveredId);
  if (!m) return null;

  const color = m.cpi >= 1.0 ? COLORS.green : m.cpi >= 0.95 ? COLORS.amber : COLORS.red;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${m.x}%`,
        top: `${m.y}%`,
        transform: 'translate(-50%, -130%)',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: COLORS.white,
          borderRadius: BORDERS.radius.md,
          border: `1px solid ${COLORS.gray200}`,
          boxShadow: SHADOWS.lg,
          padding: 12,
          minWidth: 180,
        }}
      >
        <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, marginBottom: 6 }}>
          {m.name}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color }}>{m.cpi.toFixed(2)}</div>
            <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>CPI</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: m.spi >= 1.0 ? COLORS.green : m.spi >= 0.95 ? COLORS.amber : COLORS.red }}>{m.spi.toFixed(2)}</div>
            <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>SPI</div>
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: FONTS.size.xs, color: COLORS.textMuted, textAlign: 'center' }}>
          Click to open dashboard
        </div>
      </div>
      {/* Arrow */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: `6px solid ${COLORS.white}`,
          margin: '0 auto',
        }}
      />
    </div>
  );
}
