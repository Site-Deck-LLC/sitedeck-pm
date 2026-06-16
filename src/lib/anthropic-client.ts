/**
 * Anthropic API Client — Server-Side Only
 * ============================================================================
 * Thin wrapper over the Anthropic Messages API for use by agent endpoints.
 *
 * SECURITY — NON-NEGOTIABLE RULES (see CLAUDE.md):
 *   1. The API key is read from `process.env.ANTHROPIC_API_KEY`. It is
 *      never logged, never returned in errors, and never sent to clients.
 *   2. The system prompt is a server-side constant. It is NEVER constructed
 *      from user input. It never accepts parameters from the request.
 *   3. `max_tokens` is hard-coded by endpoint, never dynamic.
 *   4. Every call is rate-limited per (user, project) and spend-guarded
 *      against a per-project daily USD cap.
 *   5. Every call is logged to `api_usage_log` with input/output tokens,
 *      cost estimate, and a failure reason if it failed.
 *
 * If `ANTHROPIC_API_KEY` is missing, this module returns a "disabled" stub
 * that throws an explicit error. The agent endpoints catch that error and
 * fall back to a deterministic, non-LLM response so the rest of the system
 * stays up in dev/staging.
 * ============================================================================
 */

import { AGENT_MODEL, AGENT_MAX_TOKENS, AgentEndpoint, estimateCostUsd, AGENT_DAILY_USD_LIMIT, AGENT_RATE_PER_MINUTE } from '../constants/agent-limits';
import { getPrismaClient } from './prisma';
import { logApiUsage } from '../services/agent-usage.service';
import { getEffectiveAnthropicKey } from '../services/byok.service';

interface CallParams {
  endpoint: AgentEndpoint;
  userId: string;
  projectId: string;
  systemPrompt: string; // server-side constant — see agents/*.agent.ts
  userPrompt: string; // sanitized by the caller
}

interface CallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

// In-process rate limiter: (userId + projectId) → array of recent call
// timestamps. We keep the last minute of timestamps; on each call we
// prune and count. This is intentionally simple — production would
// use Redis, but a single-process counter is enough for V1.
const recentCalls = new Map<string, number[]>();

function checkRateLimit(userId: string, projectId: string): void {
  const key = `${userId}::${projectId}`;
  const now = Date.now();
  const windowMs = 60_000;
  const list = (recentCalls.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= AGENT_RATE_PER_MINUTE) {
    throw new AnthropicError('RATE_LIMITED', `Rate limit ${AGENT_RATE_PER_MINUTE}/min exceeded for this user/project`);
  }
  list.push(now);
  recentCalls.set(key, list);
}

// In-process spend counter: projectId → { date, usd }. Reset at UTC midnight.
const dailySpend = new Map<string, { date: string; usd: number }>();

async function checkAndRecordSpend(projectId: string, costUsd: number): Promise<void> {
  // Source-of-truth: api_usage_log table. The in-process map is a hot
  // fast-path to avoid a DB hit on every call. We trust the DB when the
  // map is empty (cold start) or the date is stale.
  const today = new Date().toISOString().slice(0, 10);
  let entry = dailySpend.get(projectId);

  if (!entry || entry.date !== today) {
    // Cold start or date rollover: query the DB for today's spend.
    const since = new Date(today + 'T00:00:00.000Z');
    const prisma = getPrismaClient();
    const rows = await prisma.apiUsageLog.findMany({
      where: { projectId, calledAt: { gte: since }, success: true },
      select: { costUsd: true },
    });
    const total = rows.reduce((sum, r) => sum + (r.costUsd || 0), 0);
    entry = { date: today, usd: total };
    dailySpend.set(projectId, entry);
  }

  if (entry.usd + costUsd > AGENT_DAILY_USD_LIMIT) {
    throw new AnthropicError(
      'SPEND_LIMIT',
      `Daily spend limit $${AGENT_DAILY_USD_LIMIT.toFixed(2)} would be exceeded (current: $${entry.usd.toFixed(2)})`
    );
  }

  // Reserve the spend up front so a concurrent call can't slip through.
  entry.usd += costUsd;
}

export class AnthropicError extends Error {
  code: 'RATE_LIMITED' | 'SPEND_LIMIT' | 'DISABLED' | 'API_ERROR' | 'INVALID_INPUT';
  constructor(code: AnthropicError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'AnthropicError';
  }
}

export function isAnthropicEnabled(): boolean {
  // For backward compat — checks only the platform key. Prefer
  // `getEffectiveAnthropicKey(projectId)` for any new code path so
  // that per-org BYOK keys are honored.
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Call the Anthropic Messages API. Throws AnthropicError on any failure
 * path. Returns CallResult with text + token counts + cost on success.
 *
 * The caller (an agent endpoint) is responsible for:
 *   - Building a system prompt from a server-side constant template
 *   - Sanitizing any user-derived data before it appears in userPrompt
 *   - Catching AnthropicError and falling back to a deterministic stub
 *
 * The API key is resolved per call from `getEffectiveAnthropicKey`,
 * which honors per-org BYOK overrides (encrypted at rest) before
 * falling back to the platform key in `process.env.ANTHROPIC_API_KEY`.
 */
export async function callAnthropic(params: CallParams): Promise<CallResult> {
  const apiKey = await getEffectiveAnthropicKey(params.projectId);
  if (!apiKey) {
    throw new AnthropicError('DISABLED', 'Anthropic API is not configured on this server');
  }

  // Pre-flight guards: rate limit, then spend guard. Each throws
  // AnthropicError on failure.
  checkRateLimit(params.userId, params.projectId);

  // Estimate max cost up front (assume the output is the full max_tokens)
  // so we can fail-fast on the spend guard. If the actual output is
  // smaller, the cost recorded is the actual; the pre-flight reserve
  // is conservative but bounded by the per-request max.
  const maxCost = estimateCostUsd(
    Math.ceil(params.userPrompt.length / 4), // rough input-token estimate
    AGENT_MAX_TOKENS[params.endpoint]
  );
  await checkAndRecordSpend(params.projectId, maxCost);

  // Make the API call
  let text = '';
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AGENT_MODEL,
        max_tokens: AGENT_MAX_TOKENS[params.endpoint],
        system: params.systemPrompt,
        messages: [{ role: 'user', content: params.userPrompt }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      // Never include the API key or full body in the error message
      throw new AnthropicError('API_ERROR', `Anthropic returned ${res.status}`);
    }

    const json: any = await res.json();
    // Extract text and token counts from the response
    const blocks = (json?.content || []) as Array<{ type: string; text?: string }>;
    text = blocks
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text!)
      .join('')
      .trim();
    inputTokens = Number(json?.usage?.input_tokens) || 0;
    outputTokens = Number(json?.usage?.output_tokens) || 0;
  } catch (err) {
    // Log the failure (without leaking the API key or prompt contents)
    await logApiUsage({
      projectId: params.projectId,
      userId: params.userId,
      endpoint: params.endpoint,
      model: AGENT_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      success: false,
      failureCode: err instanceof AnthropicError ? err.code : 'API_ERROR',
    }).catch(() => {
      // Logging must never fail the user request; swallow.
    });
    throw err;
  }

  const costUsd = estimateCostUsd(inputTokens, outputTokens);
  await logApiUsage({
    projectId: params.projectId,
    userId: params.userId,
    endpoint: params.endpoint,
    model: AGENT_MODEL,
    inputTokens,
    outputTokens,
    costUsd,
    success: true,
  }).catch(() => {});

  return { text, inputTokens, outputTokens, costUsd };
}
