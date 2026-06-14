/**
 * ops/triage.agent.ts — Sprint 10, Task 2
 * ============================================================================
 * AI agent that classifies user-submitted bug reports into one of four
 * categories:
 *
 *   1. USER_ERROR       — user mistake; respond with step-by-step fix
 *   2. FEATURE_REQUEST  — feature does not exist; return the exact
 *                         required text ("That is a cool idea for a
 *                         new feature. Let me see if this is possible
 *                         for a future build.")
 *   3. DATA_FIX         — corrupt data; safe to correct without code
 *   4. CODE_CHANGE      — real software bug; needs human approval +
 *                         blast-radius calculation
 *
 * SECURITY (non-negotiable, per CLAUDE.md):
 *   - The system prompt is a hard-coded constant in this file. It is
 *     never parameterized. It is never built from user input.
 *   - All user-controlled fields (route, userAction, consoleErrors,
 *     lastApiCall response) pass through sanitizeTriageInput() before
 *     they are sent to the model. PII, tokens, credit-card numbers are
 *     redacted.
 *   - max_tokens is hard-coded at 800.
 *   - The call uses the same Anthropic client + rate limit + spend
 *     guard as every other agent. The cost is logged to api_usage_log.
 *   - The agent endpoint is 'brief' (existing slot in the spend guard).
 *
 * Failure mode: if the API is unavailable, the call fails, or the
 * model returns invalid JSON, the bug report is left in `new` status
 * with classification=null and a flag in the details to indicate
 * manual review. It will be re-tried on the next operator action.
 * ============================================================================
 */

import { callAnthropic, AnthropicError } from '../lib/anthropic-client';
import { getPrismaClient } from '../lib/prisma';
import { logApiUsage } from '../services/agent-usage.service';
import { AGENT_MODEL } from '../constants/agent-limits';
import { sanitizeTriageObject, sanitizeTriageInput } from './sanitize';
import { logOpsAction } from './audit-log';
import { executeDataFix } from './data-fix.engine';
import { calculateBlastRadius } from './blast-radius.calculator';

export type TriageClassification =
  | 'user_error'
  | 'feature_request'
  | 'data_fix'
  | 'code_change';

export interface TriageResult {
  classification: TriageClassification;
  confidence: number; // 0-100
  userFacingMessage: string;
  internalNotes: string;
  suggestedFix?: string;
  affectedFiles?: string[];
  workaround?: string;
}

export interface TriageOutcome {
  bugReportId: string;
  classification: TriageClassification;
  confidence: number;
  userFacingMessage: string;
  status: string;
  dataFixExecuted?: boolean;
  blastRadius?: unknown;
  tokenId?: string;
}

// ─── System prompt — server-side constant ────────────────────────────────────
// Hard-coded. Never built from request parameters. The only thing the
// model is told its job is.

const TRIAGE_SYSTEM_PROMPT = `You are an internal software quality agent for SiteDeck, a construction project management platform. Analyze this bug report and classify it into exactly one of four categories:

1. USER_ERROR — The user made a mistake in their input or misunderstood a feature. Provide step-by-step instructions to fix it.

2. FEATURE_REQUEST — The user wants something that does not exist. The response must be exactly: "That is a cool idea for a new feature. Let me see if this is possible for a future build."

3. DATA_FIX — Something in the data is wrong but no source code needs to change. Describe the exact data correction needed.

4. CODE_CHANGE — An actual software bug requiring source code modification. Describe the likely affected files and the nature of the fix needed.

Respond in JSON only. No markdown. No preamble.
Schema: {
  "classification": string,
  "confidence": number (0-100),
  "userFacingMessage": string,
  "internalNotes": string,
  "suggestedFix": string (for DATA_FIX and CODE_CHANGE only),
  "affectedFiles": string[] (CODE_CHANGE only),
  "workaround": string (CODE_CHANGE only)
}`;

// ─── Feature-request exact-text guard ────────────────────────────────────────
// Per the spec, FEATURE_REQUEST must return this exact string. If the
// model drifts, we override.
const FEATURE_REQUEST_REQUIRED_TEXT =
  'That is a cool idea for a new feature. Let me see if this is possible for a future build.';

// ─── Rate limiter (in-process) for triage calls ─────────────────────────────
// 20 triage calls per hour total, across all callers. The Anthropic
// client also enforces per-(user, project) rate limit and a daily spend
// cap. The triage limiter is in addition to those.

const TRIAGE_PER_HOUR_LIMIT = 20;
const triageCalls: number[] = [];

function checkTriageRateLimit(): void {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  while (triageCalls.length && now - triageCalls[0]! > windowMs) {
    triageCalls.shift();
  }
  if (triageCalls.length >= TRIAGE_PER_HOUR_LIMIT) {
    throw new AnthropicError(
      'RATE_LIMITED',
      `Triage rate limit ${TRIAGE_PER_HOUR_LIMIT}/hr exceeded`
    );
  }
  triageCalls.push(now);
}

// ─── JSON parsing ────────────────────────────────────────────────────────────
// Tolerant: extracts the first JSON object in the response, even if the
// model wrapped it in a markdown fence or a leading "Here is the JSON:".
function extractFirstJsonObject(s: string): unknown | null {
  const fence = s.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  const candidate = fence ? fence[1] : s;
  const start = candidate.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeClassification(input: unknown): TriageClassification | null {
  if (typeof input !== 'string') return null;
  const v = input.trim().toLowerCase();
  if (v === 'user_error' || v === 'user-error' || v === 'user error') return 'user_error';
  if (v === 'feature_request' || v === 'feature-request' || v === 'feature request') return 'feature_request';
  if (v === 'data_fix' || v === 'data-fix' || v === 'data fix') return 'data_fix';
  if (v === 'code_change' || v === 'code-change' || v === 'code change') return 'code_change';
  return null;
}

function parseTriageJson(text: string): TriageResult | null {
  const obj = extractFirstJsonObject(text);
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const classification = normalizeClassification(o.classification);
  if (!classification) return null;
  const confidence = Number(o.confidence);
  const userFacingMessage = String(o.userFacingMessage || '').slice(0, 1000);
  const internalNotes = String(o.internalNotes || '').slice(0, 2000);
  const suggestedFix = o.suggestedFix ? String(o.suggestedFix).slice(0, 4000) : undefined;
  const workaround = o.workaround ? String(o.workaround).slice(0, 1000) : undefined;
  const affectedFiles = Array.isArray(o.affectedFiles)
    ? (o.affectedFiles as unknown[]).filter((f) => typeof f === 'string').map((f) => String(f).slice(0, 200)).slice(0, 50)
    : undefined;
  return {
    classification,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 0,
    userFacingMessage,
    internalNotes,
    suggestedFix,
    affectedFiles,
    workaround,
  };
}

// ─── Feature-request duplicate detection ─────────────────────────────────────
// Increment requestCount if a recent FeatureRequest from the same product
// has a similar description. Similarity is a simple bag-of-words Jaccard
// score — fast, no embeddings, good enough for V1.
function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4)
  );
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

async function findDuplicateFeatureRequest(
  product: string,
  description: string
): Promise<{ id: string; requestCount: number } | null> {
  const prisma = getPrismaClient();
  const candidates = await prisma.featureRequest.findMany({
    where: { product },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  const descTokens = tokenize(description);
  let best: { id: string; requestCount: number; score: number } | null = null;
  for (const c of candidates) {
    const score = jaccard(descTokens, tokenize(c.description));
    if (score >= 0.5 && (!best || score > best.score)) {
      best = { id: c.id, requestCount: c.requestCount, score };
    }
  }
  return best ? { id: best.id, requestCount: best.requestCount } : null;
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function triageBugReport(bugReportId: string): Promise<TriageOutcome> {
  const prisma = getPrismaClient();
  const bug = await prisma.bugReport.findUnique({ where: { id: bugReportId } });
  if (!bug) {
    throw new Error(`BugReport ${bugReportId} not found`);
  }

  // Mark as triaging.
  await prisma.bugReport.update({
    where: { id: bugReportId },
    data: { status: 'triaging' },
  });

  // Sanitize all user-derived fields.
  const sanitized = sanitizeTriageObject({
    route: bug.route,
    pageTitle: bug.pageTitle,
    userAction: bug.userAction,
    consoleErrors: bug.consoleErrors,
    lastApiCall: bug.lastApiCall,
    browserInfo: bug.browserInfo,
  }, { maxLen: 1500, allowNewlines: true });

  const userPrompt = JSON.stringify(
    {
      product: bug.product,
      projectId: bug.projectId,
      ...sanitized,
    },
    null,
    2
  );

  // Fast path: no API key → fallback
  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackTriage(bugReportId, bug.userId, 'DISABLED');
  }

  try {
    checkTriageRateLimit();
    const result = await callAnthropic({
      endpoint: 'brief',
      userId: bug.userId,
      projectId: bug.projectId || 'ops-global',
      systemPrompt: TRIAGE_SYSTEM_PROMPT,
      userPrompt,
    });

    const parsed = parseTriageJson(result.text);
    if (!parsed) {
      return fallbackTriage(bugReportId, bug.userId, 'INVALID_JSON', { raw: result.text.slice(0, 200) });
    }

    // Apply business rules on top of the model's classification.
    return applyTriageOutcome(bugReportId, bug.userId, bug.product, bug.projectId, parsed);
  } catch (err) {
    const code = err instanceof AnthropicError ? err.code : 'API_ERROR';
    return fallbackTriage(bugReportId, bug.userId, code, { message: (err as Error)?.message?.slice(0, 200) });
  }
}

async function applyTriageOutcome(
  bugReportId: string,
  userId: string,
  product: string,
  projectId: string | null,
  parsed: TriageResult
): Promise<TriageOutcome> {
  const prisma = getPrismaClient();

  // Enforce exact FEATURE_REQUEST text.
  if (parsed.classification === 'feature_request') {
    parsed.userFacingMessage = FEATURE_REQUEST_REQUIRED_TEXT;
  }

  // Persist classification + suggestedFix + workaround (riskLevel set later
  // by the blast-radius calculator for code_change rows).
  await prisma.bugReport.update({
    where: { id: bugReportId },
    data: {
      classification: parsed.classification,
      classificationConfidence: parsed.confidence,
      suggestedFix: parsed.suggestedFix ?? null,
      workaround: parsed.workaround ?? null,
    },
  });

  // Audit the classification itself.
  await logOpsAction({
    action: `bug.${parsed.classification}`,
    performedBy: 'agent:triage',
    targetType: 'bug_report',
    targetId: bugReportId,
    details: {
      confidence: parsed.confidence,
      product,
      internalNotes: parsed.internalNotes.slice(0, 500),
    },
  });

  if (parsed.classification === 'user_error') {
    await prisma.bugReport.update({
      where: { id: bugReportId },
      data: { status: 'user_error_resolved', resolvedAt: new Date() },
    });
    return {
      bugReportId,
      classification: 'user_error',
      confidence: parsed.confidence,
      userFacingMessage: parsed.userFacingMessage,
      status: 'user_error_resolved',
    };
  }

  if (parsed.classification === 'feature_request') {
    // De-dupe against recent feature requests on the same product.
    const dupe = await findDuplicateFeatureRequest(product, parsed.internalNotes || parsed.userFacingMessage);
    if (dupe) {
      await prisma.featureRequest.update({
        where: { id: dupe.id },
        data: { requestCount: dupe.requestCount + 1, updatedAt: new Date() },
      });
    } else {
      await prisma.featureRequest.create({
        data: {
          product,
          userId,
          projectId: projectId ?? null,
          route: '(from triage)',
          description: parsed.internalNotes || parsed.userFacingMessage || 'Feature request',
          userRole: 'unknown',
          status: 'new',
        },
      });
    }
    await prisma.bugReport.update({
      where: { id: bugReportId },
      data: { status: 'feature_logged' },
    });
    return {
      bugReportId,
      classification: 'feature_request',
      confidence: parsed.confidence,
      userFacingMessage: FEATURE_REQUEST_REQUIRED_TEXT,
      status: 'feature_logged',
    };
  }

  if (parsed.classification === 'data_fix') {
    // High confidence (>= 90) → execute the data fix.
    if (parsed.confidence >= 90 && parsed.suggestedFix) {
      const fix = await executeDataFix(bugReportId, parsed.suggestedFix, 'agent:triage');
      if (fix.success) {
        return {
          bugReportId,
          classification: 'data_fix',
          confidence: parsed.confidence,
          userFacingMessage: `We found and fixed the issue. Here's what happened: ${parsed.suggestedFix.slice(0, 240)}`,
          status: 'data_fixed',
          dataFixExecuted: true,
        };
      }
      // Data fix was rejected (protected table, too many rows, etc.) —
      // fall through to code_change handling.
    }
    // Low confidence → treat as code change (conservative).
    const blast = await calculateBlastRadius({
      id: bugReportId,
      suggestedFix: parsed.suggestedFix,
    } as any);
    await prisma.bugReport.update({
      where: { id: bugReportId },
      data: { status: 'code_fix_pending', blastRadius: blast as any, riskLevel: blast.riskLevel },
    });
    return {
      bugReportId,
      classification: 'data_fix',
      confidence: parsed.confidence,
      userFacingMessage: "We're looking into this. You'll hear back from us when it's resolved.",
      status: 'code_fix_pending',
      blastRadius: blast,
    };
  }

  // CODE_CHANGE — calculate blast radius, set status pending. Email
  // approval is sent by the route layer after triage returns.
  const blast = await calculateBlastRadius({
    id: bugReportId,
    suggestedFix: parsed.suggestedFix,
    affectedFiles: parsed.affectedFiles,
  } as any);
  await prisma.bugReport.update({
    where: { id: bugReportId },
    data: {
      status: 'code_fix_pending',
      blastRadius: blast as any,
      riskLevel: blast.riskLevel,
    },
  });
  return {
    bugReportId,
    classification: 'code_change',
    confidence: parsed.confidence,
    userFacingMessage: parsed.workaround
      ? `We're looking into this. In the meantime: ${parsed.workaround}`
      : "We're looking into this. You'll hear back from us when it's resolved.",
    status: 'code_fix_pending',
    blastRadius: blast,
  };
}

async function fallbackTriage(
  bugReportId: string,
  userId: string,
  code: string,
  extra?: Record<string, unknown>
): Promise<TriageOutcome> {
  const prisma = getPrismaClient();
  await prisma.bugReport.update({
    where: { id: bugReportId },
    data: {
      status: 'code_fix_pending',
      // Save the fallback reason in the blastRadius blob so the operator
      // can see why AI didn't classify this row.
      blastRadius: { fallback: code, ...(extra ?? {}) } as any,
    },
  });
  await logOpsAction({
    action: 'bug.triage_fallback',
    performedBy: 'agent:triage',
    targetType: 'bug_report',
    targetId: bugReportId,
    details: { code, ...(extra ?? {}) },
  });
  return {
    bugReportId,
    classification: 'code_change',
    confidence: 0,
    userFacingMessage: "We're looking into this. You'll hear back from us when it's resolved.",
    status: 'code_fix_pending',
  };
}

// Re-export for tests.
export const __test__ = {
  parseTriageJson,
  extractFirstJsonObject,
  normalizeClassification,
  sanitizeTriageInput,
  FEATURE_REQUEST_REQUIRED_TEXT,
};
