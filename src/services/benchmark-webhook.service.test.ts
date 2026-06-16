/**
 * Tests for the Benchmark webhook outbound (project.created).
 * - buildProjectCreatedEvent: shapes the payload correctly
 * - emitProjectCreated: sends the POST with the right body and headers
 * - retries 3x with exponential backoff on 5xx / network errors
 * - no-op silently when PM_BENCHMARK_WEBHOOK_URL is unset
 * - does not throw when all retries fail
 * - signs the body with HMAC-SHA256 when PM_BENCHMARK_WEBHOOK_SECRET is set
 * - uses the contract Benchmark actually expects: x-sitedeck-signature
 *   header + projectId/projectName/projectType fields
 */

import * as webhook from './benchmark-webhook.service';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;
let fetchMock: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock = jest.fn();
  (global as any).fetch = fetchMock;
  delete process.env.PM_BENCHMARK_WEBHOOK_URL;
  delete process.env.PM_BENCHMARK_WEBHOOK_SECRET;
  // Zero out the backoff so the retry test runs in milliseconds, not
  // seconds. The implementation reads this env var to override.
  process.env.PM_BENCHMARK_WEBHOOK_TEST_BACKOFF = '1';
});

afterEach(() => {
  process.env = { ...originalEnv };
  (global as any).fetch = originalFetch;
});

describe('buildProjectCreatedEvent', () => {
  it('shapes the payload with the right top-level fields (Benchmark contract)', () => {
    const ev = webhook.buildProjectCreatedEvent('org1', {
      id: 'p1',
      name: 'Acme HQ',
      structureType: 'bess',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: null,
      city: 'Austin',
      state: 'TX',
      createdAt: new Date('2026-01-15T12:00:00Z'),
    });
    expect(ev.event).toBe('project.created');
    expect(ev.projectId).toBe('p1');
    expect(ev.projectName).toBe('Acme HQ');
    expect(ev.projectType).toBe('bess');
    expect(ev.startDate).toBe('2026-01-01T00:00:00.000Z');
    expect(ev.endDate).toBeNull();
    expect(ev.orgId).toBe('org1');
    expect(ev.emittedAt).toBeDefined();
  });

  it('tolerates string dates and nulls', () => {
    const ev = webhook.buildProjectCreatedEvent('o1', {
      id: 'p1',
      name: 'X',
      structureType: 'substation',
      startDate: '2026-01-01' as any,
      endDate: null,
      city: null,
      state: null,
      createdAt: new Date(),
    });
    expect(ev.startDate).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('emitProjectCreated', () => {
  it('is a silent no-op when PM_BENCHMARK_WEBHOOK_URL is unset', async () => {
    webhook.emitProjectCreated(
      webhook.buildProjectCreatedEvent('o1', {
        id: 'p1',
        name: 'X',
        structureType: 'bess',
        startDate: null,
        endDate: null,
        city: null,
        state: null,
        createdAt: new Date(),
      })
    );
    // setImmediate -> microtask
    await new Promise((r) => setImmediate(r));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs the event with the right headers and body (Benchmark contract)', async () => {
    process.env.PM_BENCHMARK_WEBHOOK_URL = 'https://benchmark.example.com/collect';
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    webhook.emitProjectCreated(
      webhook.buildProjectCreatedEvent('o1', {
        id: 'p1',
        name: 'X',
        structureType: 'bess',
        startDate: null,
        endDate: null,
        city: null,
        state: null,
        createdAt: new Date(),
      })
    );
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://benchmark.example.com/collect');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['X-PM-Event']).toBe('project.created');
    expect(init.headers['X-PM-Attempt']).toBe('1');
    const body = JSON.parse(init.body);
    expect(body.event).toBe('project.created');
    // The Benchmark handler keys idempotency off `projectId` — this is
    // the field most likely to break the contract.
    expect(body.projectId).toBe('p1');
    expect(body.projectName).toBe('X');
  });

  it('signs the body with HMAC-SHA256 on the header Benchmark actually reads', async () => {
    process.env.PM_BENCHMARK_WEBHOOK_URL = 'https://benchmark.example.com/collect';
    process.env.PM_BENCHMARK_WEBHOOK_SECRET = 'shh';
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    webhook.emitProjectCreated(
      webhook.buildProjectCreatedEvent('o1', {
        id: 'p1',
        name: 'X',
        structureType: 'bess',
        startDate: null,
        endDate: null,
        city: null,
        state: null,
        createdAt: new Date(),
      })
    );
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setTimeout(r, 50));

    const [, init] = fetchMock.mock.calls[0];
    // The header Benchmark actually reads.
    expect(init.headers['x-sitedeck-signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
    // Backwards-compat header for any in-house receiver.
    expect(init.headers['X-PM-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('retries 3x with backoff on 5xx', async () => {
    process.env.PM_BENCHMARK_WEBHOOK_URL = 'https://benchmark.example.com/collect';
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    webhook.emitProjectCreated(
      webhook.buildProjectCreatedEvent('o1', {
        id: 'p1',
        name: 'X',
        structureType: 'bess',
        startDate: null,
        endDate: null,
        city: null,
        state: null,
        createdAt: new Date(),
      })
    );
    await new Promise((r) => setTimeout(r, 200));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, init2] = fetchMock.mock.calls[1];
    expect(init2.headers['X-PM-Attempt']).toBe('2');
    const [, init3] = fetchMock.mock.calls[2];
    expect(init3.headers['X-PM-Attempt']).toBe('3');
  });

  it('does not throw when all 3 attempts fail', async () => {
    process.env.PM_BENCHMARK_WEBHOOK_URL = 'https://benchmark.example.com/collect';
    fetchMock.mockRejectedValue(new Error('network down'));

    expect(() =>
      webhook.emitProjectCreated(
        webhook.buildProjectCreatedEvent('o1', {
          id: 'p1',
          name: 'X',
          structureType: 'bess',
          startDate: null,
          endDate: null,
          city: null,
          state: null,
          createdAt: new Date(),
        })
      )
    ).not.toThrow();

    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).toHaveBeenCalled();
  });
});
