/**
 * CORS middleware for SiteDeck PM
 * ============================================================================
 * Sprint 10: the Get Help button on the Benchmark product must POST to
 * PM's /support/report endpoint from https://benchmark.sitedeck.pro.
 * This middleware adds the CORS headers for the allowlisted origins.
 *
 * The allowlist is intentionally narrow:
 *   - https://projects.sitedeck.pro (same-origin, always allowed)
 *   - https://benchmark.sitedeck.pro (cross-origin from Benchmark)
 *   - https://pro.sitedeck.pro (reserved for future Pro Get Help)
 *   - https://design.sitedeck.pro (reserved for future Design Get Help)
 *
 * The middleware only adds headers; it does NOT short-circuit OPTIONS
 * preflight — Express handles OPTIONS via the standard CORS preflight
 * flow when Access-Control-Allow-Methods/Headers are set.
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';

const ALLOWED_ORIGINS = new Set<string>([
  'https://projects.sitedeck.pro',
  'https://benchmark.sitedeck.pro',
  'https://pro.sitedeck.pro',
  'https://design.sitedeck.pro',
]);

export function corsForSiteDeck(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Product, X-Requested-With'
    );
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}
