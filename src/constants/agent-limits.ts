/**
 * Agent Security Limits
 * ============================================================================
 * Centralized configuration for the AI agent endpoints (Morning Brief, Coach,
 * Copilot, etc.). These are security-critical — see CLAUDE.md for the
 * non-negotiable rules.
 *
 * The values here are deliberately conservative defaults. A future task can
 * surface them in the admin UI for tuning without changing code.
 *
 * Categories:
 *   - Token limits: hard caps on model output. Never dynamic.
 *   - Rate limits: per-user and per-tenant request caps.
 *   - Spend guard: USD cap per project per day.
 *   - Anthropic model: the only model we call. No model choice from input.
 *
 * Environment overrides (for staging/prod):
 *   - ANTHROPIC_API_KEY (server-side secret)
 *   - AGENT_DAILY_USD_LIMIT (defaults to 5.00)
 *   - AGENT_RATE_PER_MINUTE (defaults to 10)
 * ============================================================================
 */

export const AGENT_MODEL = 'claude-sonnet-4-5';

export const AGENT_MAX_TOKENS = {
  brief: 800, // Morning brief — short, scannable summary
  coach: 500, // Onboarding tips
  copilot: 600, // Proactive alerts
  reporter: 1200, // Owner-ready status report
  standards: 400, // Compliance check summaries
  intelligence: 800, // Pattern analysis
} as const;

export type AgentEndpoint = keyof typeof AGENT_MAX_TOKENS;

// Cost per 1K tokens (input/output) — used for spend guard. These are
// approximate Sonnet 4.5 list prices as of 2026-06-11 and may drift;
// over-estimating is safer for the spend guard.
const INPUT_COST_PER_1K = 0.003;
const OUTPUT_COST_PER_1K = 0.015;

/**
 * Estimate USD cost for an agent call. Rounded up to the nearest 1/100 cent.
 */
export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  const cost = (inputTokens / 1000) * INPUT_COST_PER_1K + (outputTokens / 1000) * OUTPUT_COST_PER_1K;
  return Math.ceil(cost * 10000) / 10000; // 4 decimal places
}

export const AGENT_DAILY_USD_LIMIT = Number(process.env.AGENT_DAILY_USD_LIMIT) || 5.0;

export const AGENT_RATE_PER_MINUTE = Number(process.env.AGENT_RATE_PER_MINUTE) || 10;
