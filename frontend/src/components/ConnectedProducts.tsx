/**
 * Connected Products
 * ============================================================================
 * Three-row footer section for the PM sidebar. Renders SiteDeck PM / Pro /
 * Benchmark with a green or gray dot indicating live connection state.
 *
 * Visual pattern matches Benchmark's Sidebar (`Connected Products` block):
 *   - small caps section header (text-xs, white/30, uppercase, tracking-wide)
 *   - row with 1.5x1.5 dot (green-400 / gray-500) + label
 *   - Pro / Benchmark are external links (target=_blank)
 *   - Design is disabled with a "Coming soon" tooltip
 *
 * PM itself is informational only (you're already on PM).
 */

interface ConnectedProductsState {
  pro: boolean;
  benchmark: boolean;
  design: boolean;
}

export type { ConnectedProductsState };

interface Props {
  connectedProducts?: ConnectedProductsState;
  compact?: boolean;
}

const DEFAULT_STATE: ConnectedProductsState = {
  pro: false,
  benchmark: false,
  design: false,
};

export function ConnectedProducts({ connectedProducts, compact }: Props) {
  const state = connectedProducts ?? DEFAULT_STATE;
  const fontSize = compact ? 11 : 12;
  const labelColor = `rgba(255, 255, 255, 0.5)`;
  const dotSize = 6;
  const dotStyle = (on: boolean): React.CSSProperties => ({
    width: dotSize,
    height: dotSize,
    borderRadius: '50%',
    background: on ? '#22C55E' : '#9CA3AF',
    flexShrink: 0,
  });

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
    textDecoration: 'none',
    color: labelColor,
    fontSize,
    transition: 'opacity 0.15s',
  };

  return (
    <div style={{ padding: compact ? '8px 12px' : '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
      <p
        style={{
          fontSize: 11,
          color: 'rgba(255, 255, 255, 0.3)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          margin: compact ? '0 0 4px 0' : '0 0 8px 0',
          fontWeight: 600,
        }}
      >
        Connected Products
      </p>

      {/* PM — informational, no link */}
      <div style={rowStyle} title="You are here">
        <div style={dotStyle(true)} />
        <span>SiteDeck PM</span>
      </div>

      {/* Benchmark — external link */}
      <a
        href="https://benchmark.sitedeck.pro"
        target="_blank"
        rel="noopener noreferrer"
        style={rowStyle}
        className="connected-product-row"
      >
        <div style={dotStyle(state.benchmark)} />
        <span>SiteDeck Benchmark</span>
      </a>

      {/* Pro — external link */}
      <a
        href="https://pro.sitedeck.pro"
        target="_blank"
        rel="noopener noreferrer"
        style={rowStyle}
        className="connected-product-row"
      >
        <div style={dotStyle(state.pro)} />
        <span>SiteDeck Pro</span>
      </a>

      {/* Design — disabled, "Coming soon" */}
      <div
        style={{ ...rowStyle, cursor: 'not-allowed', opacity: 0.5 }}
        title="Coming soon"
      >
        <div style={dotStyle(false)} />
        <span>SiteDeck Design</span>
      </div>
    </div>
  );
}
