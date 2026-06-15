/**
 * branding.ts — Hostname-driven site variant detection
 * ============================================================================
 * Sprint 12 Task 9. The PM frontend serves two domains:
 *   - https://projects.sitedeck.pro — customer PM dashboard
 *   - https://ops.sitedeck.pro       — internal SiteDeck ops console
 *
 * The same bundle is served to both. The hostname decides which variant
 * we show. We pick the variant at module-load time (the value is
 * frozen for the page lifetime) and expose a small helper.
 *
 * `isOps` is computed once. Components check it; we don't recompute on
 * every render. This keeps the build deterministic in SSR/test contexts
 * (no `window` access in non-browser code paths).
 * ============================================================================
 */

const OPS_HOSTS: ReadonlySet<string> = new Set([
  'ops.sitedeck.pro',
  'ops.staging.sitedeck.pro', // future
  'localhost', // dev — toggle via ?ops=1 to test the ops shell
]);

function detectVariant(): { variant: 'customer' | 'ops'; isOps: boolean } {
  if (typeof window === 'undefined') {
    return { variant: 'customer', isOps: false };
  }
  // ?ops=1 in the query string forces ops mode for local dev
  // (and for support engineers who need to reproduce a customer report).
  if (typeof window.location !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('ops') === '1') return { variant: 'ops', isOps: true };
    if (params.get('ops') === '0') return { variant: 'customer', isOps: false };
  }
  const host = window.location.hostname.toLowerCase();
  if (OPS_HOSTS.has(host)) return { variant: 'ops', isOps: true };
  return { variant: 'customer', isOps: false };
}

const detected = detectVariant();

export const isOps: boolean = detected.isOps;
export const siteVariant: 'customer' | 'ops' = detected.variant;

/**
 * Display name for the current site. Customer view = "SiteDeck PM".
 * Ops view = "SiteDeck Ops". Other UI strings (titles, page headers)
 * use this for the human-readable label.
 */
export const siteName: string = isOps ? 'SiteDeck Ops' : 'SiteDeck PM';

/**
 * Color accent for the current site. Both use the navy primary.
 * Ops adds an orange chip so internal users can tell at a glance
 * which environment they're in.
 */
export const siteAccent: 'navy' | 'orange' = isOps ? 'orange' : 'navy';
