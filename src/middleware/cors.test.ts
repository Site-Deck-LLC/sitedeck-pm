/**
 * Tests for the CORS middleware — Sprint 10
 * ============================================================================
 * Pins the allowlist and the preflight behavior. We don't pull in
 * supertest; a tiny inline mock of req/res is enough.
 * ============================================================================
 */

import { corsForSiteDeck } from './cors';

function mockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let ended = false;
  const res: any = {
    setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; },
    status: (c: number) => { statusCode = c; return res; },
    end: () => { ended = true; },
    headers,
    get statusCode() { return statusCode; },
    get ended() { return ended; },
  };
  return res;
}

function mockReq(origin: string | undefined, method: string) {
  return {
    headers: origin ? { origin } : {},
    method,
  } as any;
}

function mockNext() {
  const fn: any = () => { fn.called = true; };
  fn.called = false;
  return fn;
}

describe('cors: allowlist', () => {
  it('adds headers for an allowlisted origin', () => {
    const res = mockRes();
    let nextCalled = false;
    corsForSiteDeck(mockReq('https://benchmark.sitedeck.pro', 'GET'), res, () => { nextCalled = true; });
    expect(res.headers['access-control-allow-origin']).toBe('https://benchmark.sitedeck.pro');
    expect(res.headers['access-control-allow-methods']).toMatch(/GET/);
    expect(nextCalled).toBe(true);
  });

  it('does not add headers for a non-allowlisted origin', () => {
    const res = mockRes();
    let nextCalled = false;
    corsForSiteDeck(mockReq('https://evil.example.com', 'GET'), res, () => { nextCalled = true; });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(nextCalled).toBe(true);
  });

  it('short-circuits OPTIONS preflight with 204', () => {
    const res = mockRes();
    let nextCalled = false;
    corsForSiteDeck(mockReq('https://benchmark.sitedeck.pro', 'OPTIONS'), res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(nextCalled).toBe(false);
  });
});
