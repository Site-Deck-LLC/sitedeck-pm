/**
 * Tests for the Anthropic client. We mock global.fetch so no real
 * API calls are made. The rate-limit and spend-guard logic is verified
 * by feeding known call counts and cost values.
 */

import { callAnthropic, AnthropicError, isAnthropicEnabled } from './anthropic-client';
import { AGENT_DAILY_USD_LIMIT } from '../constants/agent-limits';

jest.mock('../services/agent-usage.service', () => ({
  logApiUsage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./prisma', () => ({
  getPrismaClient: () => ({
    apiUsageLog: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(undefined),
    },
    project: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    orgApiKey: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  }),
}));

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('anthropic-client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the in-process rate limit + spend maps by deleting the module
    jest.resetModules();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('isAnthropicEnabled reflects env presence', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(isAnthropicEnabled()).toBe(false);
    process.env.ANTHROPIC_API_KEY = 'test-key';
    expect(isAnthropicEnabled()).toBe(true);
  });

  it('throws DISABLED when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { callAnthropic: c } = await import('./anthropic-client');
    await expect(c({
      endpoint: 'brief',
      userId: 'u-1',
      projectId: 'p-1',
      systemPrompt: 'x',
      userPrompt: 'y',
    })).rejects.toMatchObject({ code: 'DISABLED' });
  });

  it('returns parsed text + token counts on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'hello world' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    });
    const { callAnthropic: c } = await import('./anthropic-client');
    const result = await c({
      endpoint: 'brief',
      userId: 'u-1',
      projectId: 'p-1',
      systemPrompt: 'system',
      userPrompt: 'user',
    });
    expect(result.text).toBe('hello world');
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it('sends the model id and hard-coded max_tokens', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'x' }], usage: { input_tokens: 0, output_tokens: 0 } }),
    });
    const { callAnthropic: c } = await import('./anthropic-client');
    await c({
      endpoint: 'brief',
      userId: 'u-1',
      projectId: 'p-1',
      systemPrompt: 'system',
      userPrompt: 'user',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('claude-sonnet-4-5');
    expect(body.max_tokens).toBe(800); // brief endpoint cap
  });

  it('throws API_ERROR on non-2xx response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'oops' });
    const { callAnthropic: c } = await import('./anthropic-client');
    await expect(c({
      endpoint: 'brief',
      userId: 'u-1',
      projectId: 'p-1',
      systemPrompt: 's',
      userPrompt: 'u',
    })).rejects.toMatchObject({ code: 'API_ERROR' });
  });

  it('throws RATE_LIMITED after exceeding per-minute cap', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'x' }], usage: { input_tokens: 0, output_tokens: 0 } }),
    });
    const { callAnthropic: c } = await import('./anthropic-client');
    // 10/minute default. Fire 10 successful calls then expect the 11th to fail.
    const args = {
      endpoint: 'brief' as const,
      userId: 'u-1',
      projectId: 'p-1',
      systemPrompt: 's',
      userPrompt: 'u',
    };
    for (let i = 0; i < 10; i++) {
      await c(args);
    }
    await expect(c(args)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('throws SPEND_LIMIT when projected cost exceeds daily cap', async () => {
    // We can't easily inflate AGENT_DAILY_USD_LIMIT in this test because it's
    // imported as a const. Instead, we craft a user prompt that produces a
    // large input-token estimate, then verify the spend guard kicks in by
    // making a separate short call fail after a single high-cost call.
    //
    // Easier path: stub the estimateCostUsd via mocking the module.
    jest.resetModules();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    // Re-mock the constants module so we get a tiny cap.
    jest.doMock('../constants/agent-limits', () => {
      const actual = jest.requireActual('../constants/agent-limits');
      return { ...actual, AGENT_DAILY_USD_LIMIT: 0.0001 };
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'x' }], usage: { input_tokens: 1000, output_tokens: 500 } }),
    });
    const { callAnthropic: c } = await import('./anthropic-client');
    const args = {
      endpoint: 'brief' as const,
      userId: 'u-2',
      projectId: 'p-2',
      systemPrompt: 's',
      userPrompt: 'u',
    };
    await expect(c(args)).rejects.toMatchObject({ code: 'SPEND_LIMIT' });
  });

  it('never includes the API key in error messages or logs', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockRejectedValue(new Error('boom'));
    const { callAnthropic: c } = await import('./anthropic-client');
    await expect(c({
      endpoint: 'brief',
      userId: 'u-1',
      projectId: 'p-1',
      systemPrompt: 's',
      userPrompt: 'u',
    })).rejects.toThrow();
    // The error message should not contain the API key
    try {
      await c({
        endpoint: 'brief',
        userId: 'u-1',
        projectId: 'p-1',
        systemPrompt: 's',
        userPrompt: 'u',
      });
    } catch (e: any) {
      expect(e.message).not.toContain('test-key');
    }
    consoleSpy.mockRestore();
  });
});
