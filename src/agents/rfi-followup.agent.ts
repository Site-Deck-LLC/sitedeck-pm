/**
 * RFI Follow-Up Draft Agent
 * ============================================================================
 * Drafts a follow-up email/note for an RFI that has been waiting for a
 * response past its required date. The PM or superintendent can then review,
 * tweak, and send — the model never sends anything, it just drafts.
 *
 * SECURITY — follows the non-negotiable rules in CLAUDE.md:
 *   1. The system prompt is a constant in this file. It is NEVER built from
 *      user input or request parameters. It is the only system prompt the
 *      model ever sees.
 *   2. All RFI fields fed to the model are sanitized via sanitizeForPrompt.
 *   3. max_tokens is hard-coded (draft endpoint → 600 tokens).
 *   4. The endpoint enforces Firebase auth + tenant isolation.
 *   5. Rate limit + spend guard live in the client wrapper.
 *   6. Every call is logged to api_usage_log (no prompt content).
 *
 * If the Anthropic API is disabled (no key) or the call fails for any reason,
 * the agent returns a deterministic rule-based draft so the rest of the system
 * stays up. The fallback is documented in the return value
 * (`source: 'ai' | 'fallback'`).
 * ============================================================================
 */

import { callAnthropic, AnthropicError } from '../lib/anthropic-client';
import { sanitizeForPrompt } from '../lib/sanitize';
import { getRfiById } from '../services/communications.service';

export interface RfiFollowUpInput {
  rfiId: string;
  projectId: string;
  userId: string;
  // Optional override for forcing fallback. Defaults to 'auto'.
  mode?: 'auto' | 'fallback';
  // Optional tone. Defaults to 'firm_professional'.
  tone?: 'firm_professional' | 'collaborative' | 'urgent';
}

export interface RfiFollowUpDraft {
  rfiId: string;
  generatedAt: string;
  source: 'ai' | 'fallback';
  tone: 'firm_professional' | 'collaborative' | 'urgent';
  // The drafted message. The PM reviews and sends it themselves; this is a
  // draft only and is never sent automatically.
  subject: string;
  body: string;
  // Field-level summary of what data the draft is based on. Helps the PM
  // sanity-check before sending.
  context: {
    rfiNumber: string;
    daysOpen: number;
    daysOverdue: number;
    assignedTo: string | null;
  };
  meta: {
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
    failureCode?: string;
  };
}

// ─── System prompt — server-side constant ────────────────────────────────────

const RFI_FOLLOWUP_SYSTEM_PROMPT = `You are an assistant for a SiteDeck PM construction project manager. Your job is to draft a short follow-up message about a Request for Information (RFI) that has been waiting for a response.

Rules:
- Output valid JSON only. No prose before or after the JSON.
- Use this exact shape: {"subject": string, "body": string}
- The body is 3-6 sentences. Suitable for an email or a project chat message.
- Reference the RFI number, how many days it has been open, and what the RFI is about.
- Stay professional and constructive. Do not threaten, do not assign blame to a person by name.
- Do not invent facts. Use ONLY what's in the data summary.
- Match the requested tone: "firm_professional" = polite but clear it's blocking work; "collaborative" = ask if they need more info; "urgent" = flag schedule impact.
- Subject line should be 5-10 words. Include the RFI number.`;

// ─── Agent entry point ───────────────────────────────────────────────────────

export async function runRfiFollowUp(input: RfiFollowUpInput): Promise<RfiFollowUpDraft> {
  const tone = input.tone || 'firm_professional';
  const ctx = await buildRfiContext(input.rfiId, input.projectId);

  // Fallback path — no API key, mode=fallback, or call failure
  if (input.mode === 'fallback' || !process.env.ANTHROPIC_API_KEY) {
    return {
      rfiId: input.rfiId,
      generatedAt: new Date().toISOString(),
      source: 'fallback',
      tone,
      subject: buildFallbackSubject(ctx),
      body: buildFallbackBody(ctx, tone),
      context: {
        rfiNumber: ctx.rfiNumber,
        daysOpen: ctx.daysOpen,
        daysOverdue: ctx.daysOverdue,
        assignedTo: ctx.assignedTo,
      },
      meta: { failureCode: process.env.ANTHROPIC_API_KEY ? undefined : 'DISABLED' },
    };
  }

  // Build the user prompt from sanitized data
  const dataSummary = {
    rfiNumber: ctx.rfiNumber,
    subject: ctx.subject,
    description: ctx.description,
    daysOpen: ctx.daysOpen,
    daysOverdue: ctx.daysOverdue,
    assignedTo: ctx.assignedTo,
    status: ctx.status,
    requestedBy: ctx.requestedBy,
    tone,
  };
  const userPrompt = JSON.stringify(dataSummary, null, 2);

  try {
    const result = await callAnthropic({
      endpoint: 'copilot', // 600 tokens — same budget as a copilot alert
      userId: input.userId,
      projectId: input.projectId,
      systemPrompt: RFI_FOLLOWUP_SYSTEM_PROMPT,
      userPrompt,
    });

    const parsed = parseDraftJson(result.text);
    if (!parsed) {
      return {
        rfiId: input.rfiId,
        generatedAt: new Date().toISOString(),
        source: 'fallback',
        tone,
        subject: buildFallbackSubject(ctx),
        body: buildFallbackBody(ctx, tone),
        context: {
          rfiNumber: ctx.rfiNumber,
          daysOpen: ctx.daysOpen,
          daysOverdue: ctx.daysOverdue,
          assignedTo: ctx.assignedTo,
        },
        meta: { failureCode: 'INVALID_OUTPUT', costUsd: result.costUsd },
      };
    }

    return {
      rfiId: input.rfiId,
      generatedAt: new Date().toISOString(),
      source: 'ai',
      tone,
      subject: parsed.subject.slice(0, 120),
      body: parsed.body.slice(0, 1000),
      context: {
        rfiNumber: ctx.rfiNumber,
        daysOpen: ctx.daysOpen,
        daysOverdue: ctx.daysOverdue,
        assignedTo: ctx.assignedTo,
      },
      meta: {
        model: 'claude-sonnet-4-5',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      },
    };
  } catch (err) {
    const code = err instanceof AnthropicError ? err.code : 'API_ERROR';
    return {
      rfiId: input.rfiId,
      generatedAt: new Date().toISOString(),
      source: 'fallback',
      tone,
      subject: buildFallbackSubject(ctx),
      body: buildFallbackBody(ctx, tone),
      context: {
        rfiNumber: ctx.rfiNumber,
        daysOpen: ctx.daysOpen,
        daysOverdue: ctx.daysOverdue,
        assignedTo: ctx.assignedTo,
      },
      meta: { failureCode: code },
    };
  }
}

// ─── Context — sanitized for prompt injection ────────────────────────────────

interface RfiContext {
  rfiNumber: string;
  subject: string;
  description: string;
  status: string;
  assignedTo: string | null;
  requestedBy: string | null;
  daysOpen: number;
  daysOverdue: number;
}

async function buildRfiContext(rfiId: string, projectId: string): Promise<RfiContext> {
  const rfi = await getRfiById(rfiId);
  if (!rfi) {
    throw new Error(`RFI ${rfiId} not found`);
  }
  if (rfi.projectId !== projectId) {
    // Tenant isolation check — refuse to draft a follow-up for an RFI that
    // does not belong to the project in the URL.
    throw new Error('RFI does not belong to the specified project');
  }

  // Look up assignee display name if available. The RFI schema stores
  // assignedTo as a free-form string (name or email) — we don't have a
  // User model to join to, so this is best-effort sanitization of whatever
  // string was stored.
  const assignedTo: string | null = rfi.assignedTo
    ? sanitizeForPrompt(rfi.assignedTo, { maxLen: 80 })
    : null;
  const requestedBy: string | null = rfi.submittedBy
    ? sanitizeForPrompt(rfi.submittedBy, { maxLen: 80 })
    : null;

  const now = Date.now();
  const created = rfi.createdAt ? new Date(rfi.createdAt).getTime() : now;
  const required = rfi.requiredDate ? new Date(rfi.requiredDate).getTime() : null;
  const daysOpen = Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
  const daysOverdue = required ? Math.max(0, Math.floor((now - required) / (1000 * 60 * 60 * 24))) : 0;

  return {
    rfiNumber: sanitizeForPrompt(rfi.rfiNumber, { maxLen: 30 }),
    subject: sanitizeForPrompt(rfi.subject || '', { maxLen: 200 }),
    description: sanitizeForPrompt(rfi.description || '', { maxLen: 600 }),
    status: sanitizeForPrompt(rfi.status || 'open', { maxLen: 30 }),
    assignedTo: assignedTo ? sanitizeForPrompt(assignedTo, { maxLen: 80 }) : null,
    requestedBy: requestedBy ? sanitizeForPrompt(requestedBy, { maxLen: 80 }) : null,
    daysOpen,
    daysOverdue,
  };
}

// ─── JSON parser — permissive about surrounding prose ────────────────────────

interface ParsedDraft {
  subject: string;
  body: string;
}

function parseDraftJson(text: string): ParsedDraft | null {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  try {
    const obj = JSON.parse(candidate);
    if (typeof obj.subject !== 'string' || typeof obj.body !== 'string') return null;
    return { subject: obj.subject, body: obj.body };
  } catch {
    return null;
  }
}

// ─── Fallback — deterministic draft from the data summary ────────────────────

function buildFallbackSubject(ctx: RfiContext): string {
  const overdue = ctx.daysOverdue > 0 ? ` — ${ctx.daysOverdue}d overdue` : '';
  return `RFI ${ctx.rfiNumber} follow-up${overdue}`;
}

function buildFallbackBody(ctx: RfiContext, tone: 'firm_professional' | 'collaborative' | 'urgent'): string {
  const assignee = ctx.assignedTo ? ` ${ctx.assignedTo}` : '';
  const daysLine = ctx.daysOverdue > 0
    ? `It is now ${ctx.daysOverdue} day${ctx.daysOverdue === 1 ? '' : 's'} past the required response date, and our team is waiting on the answer to keep work moving.`
    : ctx.daysOpen > 0
      ? `It has been ${ctx.daysOpen} day${ctx.daysOpen === 1 ? '' : 's'} since this was raised, and the answer is needed to avoid delay.`
      : 'A response would help us keep work moving.';

  const opener = tone === 'collaborative'
    ? `Hi${assignee}, checking in on RFI ${ctx.rfiNumber} ("${ctx.subject}").`
    : tone === 'urgent'
      ? `Hi${assignee}, RFI ${ctx.rfiNumber} ("${ctx.subject}") needs an answer today to keep the schedule on track.`
      : `Hi${assignee}, following up on RFI ${ctx.rfiNumber} ("${ctx.subject}").`;

  const askLine = tone === 'collaborative'
    ? 'If you need additional information or a site walk to clarify, let me know and we can set one up.'
    : tone === 'urgent'
      ? 'Please reply with the answer or a date you can commit to. If we do not hear back by EOD, we will have to flag this on the daily huddle and may pause the affected activity.'
      : 'A response by end of week would keep us on schedule.';

  return `${opener}\n\n${daysLine} ${askLine}\n\nThanks,\nProject Manager`;
}
