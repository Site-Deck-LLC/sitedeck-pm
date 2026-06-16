import { COLORS, FONTS } from '../styles/design-system';

/**
 * Suspense fallback for lazy-loaded route chunks. Kept tiny
 * (no third-party spinner) so the loading flash is just a
 * single centered text label — the chunk typically resolves
 * in <100ms on a warm cache and we don't want the spinner
 * library to outweigh the chunk it gates.
 */
export function RouteLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: COLORS.textMuted,
        fontFamily: FONTS.family,
        fontSize: 14,
      }}
    >
      {label}
    </div>
  );
}
