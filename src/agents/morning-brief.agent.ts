/**
 * Morning Brief Agent
 * ============================================================================
 * AI Co-Pilot V1 — generates a short, scannable "morning brief" for a
 * project. Calls the Anthropic Messages API (claude-sonnet-4-5) with a
 * server-side constant system prompt, a sanitized data summary built from
 * the project's live state, and a hard-coded max_tokens cap.
 *
 * SECURITY — follows the non-negotiable rules in CLAUDE.md:
 *   1. The system prompt is a constant in this file. It is NEVER built
 *      from user input or request parameters. It is the only system
 *      prompt the model ever sees.
 *   2. All data fed to the model has been sanitized via sanitizeForPrompt.
 *   3. max_tokens is hard-coded (brief endpoint → 800 tokens).
 *   4. The endpoint enforces Firebase auth + tenant isolation.
 *   5. Rate limit + spend guard live in the client wrapper.
 *   6. Every call is logged to api_usage_log (no prompt content).
 *
 * If the Anthropic API is disabled (no key) or the call fails for any
 * reason, the agent falls back to a deterministic, rule-based brief so
 * the rest of the system stays up. The fallback is documented in the
 * return value (`source: 'ai' | 'fallback'`).
 * ============================================================================
 */

import { callAnthropic, AnthropicError } from '../lib/anthropic-client';
import { sanitizeForPrompt } from '../lib/sanitize';
import { getMorningDashboard, getRiskDashboardStatus } from '../services/dashboard.service';
import { getOverdueRfis, getOverdueSubmittals } from '../services/communications.service';
import { getChangeOrdersByProject } from '../services/scope.service';
import { getPrismaClient } from '../lib/prisma';
import { scanForPatterns } from '../services/lessons.service';
import { detectCompoundRisksForDashboard } from '../services/risk-intelligence.service';

export interface MorningBriefInput {
  projectId: string;
  userId: string;
  // Optional override for forcing fallback (e.g. for testing). Defaults to
  // 'auto' which uses AI when available, else fallback.
  mode?: 'auto' | 'fallback';
}

export interface MorningBriefSection {
  title: string;
  body: string;
  severity: 'green' | 'amber' | 'red';
}

export interface MorningBrief {
  projectId: string;
  generatedAt: string;
  source: 'ai' | 'fallback';
  sections: MorningBriefSection[];
  headline: string; // one-sentence summary at the top of the card
  // Diagnostic metadata — never includes prompt content.
  meta: {
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
    failureCode?: string;
  };
  // Lessons auto-created from pattern detection during this run. The
  // dashboard uses this to surface a "View new lessons" link. Empty
  // when no patterns fired.
  lessonsCreated?: string[];
  // Compound risk patterns. Each entry is a short label that names
  // a known combination of amber/red signals (e.g. "Schedule slip +
  // cost overrun + overdue RFIs"). Surfaced as red callouts in the
  // morning brief card so the PM sees the multi-signal cascade
  // before diving into the per-metric sections.
  compoundRisks: string[];
}

// ─── System prompt — server-side constant ────────────────────────────────────
// This is a hard-coded string literal. It cannot be parameterized by
// any caller. It is what the model is told its job is, and only this.

const MORNING_BRIEF_SYSTEM_PROMPT = `You are the SiteDeck PM morning-brief assistant. Your job is to write a short, scannable morning brief for the project manager or superintendent of a construction project.

Rules:
- Output valid JSON only. No prose before or after the JSON.
- Use this exact shape: {"headline": string, "sections": [{"title": string, "body": string, "severity": "green"|"amber"|"red"}]}
- 3-5 sections maximum. Each body is 1-3 sentences.
- Use the language of the data summary (English).
- Highlight the SINGLE most important thing first. If everything is green, the headline is positive.
- Severity meanings: green = on track, amber = needs attention this week, red = act today.
- The data summary includes a pre-computed "compoundRisks" array. These are multi-signal cascades (e.g. "Schedule slip + cost overrun") that the system has already determined to be red. The FIRST section of your brief must address any compound risk that is present; quote the label verbatim and explain in one sentence why it matters. Do not invent additional compound risks — only reference what is in the array.
- Never make up data. Only reference items present in the data summary.
- Never suggest actions that require credentials you do not have (e.g. "log in as owner").`;

// ─── Agent entry point ───────────────────────────────────────────────────────

export async function runMorningBrief(input: MorningBriefInput): Promise<MorningBrief> {
  const dataSummary = await buildProjectDataSummary(input.projectId);
  // Sprint 9 Task 7: use the shared risk-intelligence detector so
  // the morning brief and the dashboard see the same cascade list.
  const detected = await detectCompoundRisksForDashboard(input.projectId);
  const compoundRisks = detected.map((d) => d.label);

  // Real-time lessons-learned pattern detection. Runs after every brief
  // generation but errors are swallowed — a failed scan must never
  // fail the morning brief. Each detected pattern auto-creates an
  // `agent_flagged` lesson the PM can review.
  let lessonsCreated: string[] = [];
  try {
    const scan = await scanForPatterns(input.projectId);
    lessonsCreated = scan.created;
  } catch {
    // Swallowed — pattern detection is best-effort.
  }

  // Fallback path — no API key, mode=fallback, or call failure
  if (input.mode === 'fallback' || !process.env.ANTHROPIC_API_KEY) {
    return {
      projectId: input.projectId,
      generatedAt: new Date().toISOString(),
      source: 'fallback',
      sections: buildFallbackSections(dataSummary, compoundRisks),
      headline: deriveFallbackHeadline(dataSummary, compoundRisks),
      meta: { failureCode: process.env.ANTHROPIC_API_KEY ? undefined : 'DISABLED' },
      lessonsCreated,
      compoundRisks,
    };
  }

  // Build the user prompt from sanitized data. The compound list
  // is appended so the model sees the same compound signals the
  // fallback surfaces — the AI doesn't have to re-derive them.
  const userPrompt = JSON.stringify(
    { ...dataSummary, compoundRisks },
    null,
    2
  );

  try {
    const result = await callAnthropic({
      endpoint: 'brief',
      userId: input.userId,
      projectId: input.projectId,
      systemPrompt: MORNING_BRIEF_SYSTEM_PROMPT,
      userPrompt,
    });

    const parsed = parseBriefJson(result.text);
    if (!parsed) {
      return {
        projectId: input.projectId,
        generatedAt: new Date().toISOString(),
        source: 'fallback',
        sections: buildFallbackSections(dataSummary, compoundRisks),
        headline: deriveFallbackHeadline(dataSummary, compoundRisks),
        meta: {
          failureCode: 'INVALID_OUTPUT',
          costUsd: result.costUsd,
        },
        lessonsCreated,
        compoundRisks,
      };
    }

    return {
      projectId: input.projectId,
      generatedAt: new Date().toISOString(),
      source: 'ai',
      sections: parsed.sections,
      headline: parsed.headline,
      meta: {
        model: 'claude-sonnet-4-5',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      },
      lessonsCreated,
      compoundRisks,
    };
  } catch (err) {
    const code = err instanceof AnthropicError ? err.code : 'API_ERROR';
    return {
      projectId: input.projectId,
      generatedAt: new Date().toISOString(),
      source: 'fallback',
      sections: buildFallbackSections(dataSummary, compoundRisks),
      headline: deriveFallbackHeadline(dataSummary, compoundRisks),
      meta: { failureCode: code },
      lessonsCreated,
      compoundRisks,
    };
  }
}

// ─── Data summary — sanitized for prompt injection ───────────────────────────

interface DataSummary {
  projectName: string;
  asOf: string;
  health: { spi: number; cpi: number; pctComplete: number; scheduleVariance: number; costVariance: number };
  overdueRfis: Array<{ id: string; rfiNumber: string; subject: string; daysOverdue: number }>;
  overdueSubmittals: Array<{ id: string; submittalNumber: string; title: string; daysOverdue: number }>;
  openChangeOrders: Array<{ id: string; coNumber: string; status: string; dollarValue: number | null }>;
  riskStatus: { status: 'green' | 'amber' | 'red'; summary: string; openCount: number };
  safety: { incidents: number; openObservations: number };
  procurement: { materialsAlert: string };
}

async function buildProjectDataSummary(projectId: string): Promise<DataSummary> {
  // Pull live state from existing services. Each call is wrapped so a
  // failure in one doesn't tank the whole brief.
  const [projectRow, dashboard, risk, overdueR, overdueS, cos] = await Promise.all([
    safeCall(() => getPrismaClient().project.findUnique({ where: { id: projectId }, select: { name: true } })),
    safeCall(() => getMorningDashboard(projectId, { incidents: 0, openObservations: 0 })),
    safeCall(() => getRiskDashboardStatus(projectId)),
    safeCall(() => getOverdueRfis(projectId)),
    safeCall(() => getOverdueSubmittals(projectId)),
    safeCall(() => getChangeOrdersByProject(projectId)),
  ]);

  return {
    projectName: sanitizeForPrompt(projectRow?.name ?? 'Project', { maxLen: 100 }),
    asOf: new Date().toISOString().slice(0, 10),
    health: {
      spi: num(dashboard?.performance?.spi, 2),
      cpi: num(dashboard?.performance?.cpi, 2),
      pctComplete: num(dashboard?.metrics?.completedPct, 2),
      scheduleVariance: num(dashboard?.performance?.scheduleVariance, 0),
      costVariance: num(dashboard?.performance?.costVariance, 0),
    },
    overdueRfis: (overdueR || []).slice(0, 5).map((r) => ({
      id: r.id,
      rfiNumber: sanitizeForPrompt(r.rfiNumber, { maxLen: 30 }),
      subject: sanitizeForPrompt(r.subject, { maxLen: 120 }),
      daysOverdue: Math.max(0, Math.round(r.daysOverdue || 0)),
    })),
    overdueSubmittals: (overdueS || []).slice(0, 5).map((s) => ({
      id: s.id,
      submittalNumber: sanitizeForPrompt(s.submittalNumber, { maxLen: 30 }),
      title: sanitizeForPrompt(s.title, { maxLen: 120 }),
      daysOverdue: Math.max(0, Math.round(s.daysOverdue || 0)),
    })),
    openChangeOrders: (cos || [])
      .filter((c) => c.status === 'pending' || c.status === 'submitted')
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        coNumber: sanitizeForPrompt(c.coNumber, { maxLen: 30 }),
        status: c.status,
        dollarValue: c.dollarValue ? Number(c.dollarValue) : null,
      })),
    riskStatus: {
      status: risk?.status ?? 'green',
      summary: sanitizeForPrompt(risk?.summary ?? '0 open risks', { maxLen: 200 }),
      openCount: risk?.count ?? 0,
    },
    safety: {
      incidents: dashboard?.tiles?.safety?.count ?? 0,
      openObservations: 0,
    },
    procurement: {
      materialsAlert: sanitizeForPrompt(dashboard?.tiles?.materials?.summary ?? 'ok', { maxLen: 100 }),
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function num(x: unknown, decimals: number): number {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

interface ParsedBrief {
  headline: string;
  sections: MorningBriefSection[];
}

function parseBriefJson(text: string): ParsedBrief | null {
  if (!text) return null;
  // The model is told to output only JSON. Be permissive about surrounding
  // prose in case the model adds a brief preamble.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  try {
    const obj = JSON.parse(candidate);
    if (typeof obj.headline !== 'string') return null;
    if (!Array.isArray(obj.sections)) return null;
    const sections: MorningBriefSection[] = [];
    for (const s of obj.sections) {
      if (typeof s?.title === 'string' && typeof s?.body === 'string') {
        const sev = s.severity;
        sections.push({
          title: String(s.title).slice(0, 80),
          body: String(s.body).slice(0, 400),
          severity: sev === 'green' || sev === 'amber' || sev === 'red' ? sev : 'amber',
        });
      }
    }
    if (sections.length === 0) return null;
    return {
      headline: String(obj.headline).slice(0, 200),
      sections: sections.slice(0, 5),
    };
  } catch {
    return null;
  }
}

// ─── Compound risk detection ──────────────────────────────────────────────
//
// A "compound risk" is two-or-more amber/red signals that, together,
// form a known project-failure pattern. Single-metric amber is
// something to watch; two or three signals together is something to
// act on today. The detector is rule-based (no LLM) so it's stable
// across calls and testable. The list of patterns lives in
// COMPOUND_PATTERNS below — add a new pattern, write a test.
//
// Each pattern returns a short human label that names the cascade
// (e.g. "Schedule slip + cost overrun") plus a longer "why this
// matters" sentence the AI prompt can quote verbatim. The brief
// surfaces the label as a red callout.

interface CompoundPattern {
  name: string;
  match: (d: DataSummary) => boolean;
  // Either a static label string or a function that derives the
  // label from the data (used for patterns that include a count
  // or a name from the data).
  label: string | ((d: DataSummary) => string);
  whyItMatters: string;
}

const COMPOUND_PATTERNS: CompoundPattern[] = [
  {
    name: 'schedule-cost-overrun',
    match: (d) => d.health.spi < 0.95 && d.health.cpi < 0.95,
    label: 'Schedule slip + cost overrun',
    whyItMatters:
      'Schedule and cost variance moving together is the classic recipe for a margin-killing project. Pull the EAC and the change-order log before any new commitments.',
  },
  {
    name: 'overdue-rfis-with-schedule-slip',
    match: (d) => d.overdueRfis.length >= 3 && d.health.spi < 0.95,
    label: 'Overdue RFIs + schedule slip',
    whyItMatters:
      'A backlog of unanswered RFIs is the most common cause of downstream schedule slip on design-build work. Chasing the architect on the oldest 1-2 RFIs usually unblocks several activities at once.',
  },
  {
    name: 'overdue-rfis-with-cost-overrun',
    match: (d) => d.overdueRfis.length >= 3 && d.health.cpi < 0.95,
    label: 'Overdue RFIs + cost overrun',
    whyItMatters:
      'RFIs sit unanswered because the answer is going to cost money. Open the affected budget lines, get a number on the change, and price it before it goes to change order.',
  },
  {
    name: 'change-orders-stacking',
    match: (d) => d.openChangeOrders.length >= 3,
    label: (d) => `${d.openChangeOrders.length} pending change orders`,
    whyItMatters:
      'When 3+ COs are stacked, the EAC re-flow runs out of headroom for the next one. Triage the oldest first; do not let the queue grow past 5.',
  },
  {
    name: 'triple-threat-safety-cost-schedule',
    match: (d) =>
      d.safety.incidents > 0 && d.health.cpi < 0.95 && d.health.spi < 0.95,
    label: 'Safety + cost + schedule all amber/red',
    whyItMatters:
      'A recordable incident during a project that is already over budget and behind schedule is the #1 predictor of margin erosion. Stop-work review is justified.',
  },
  {
    name: 'materials-with-schedule-slip',
    match: (d) =>
      d.procurement.materialsAlert !== 'ok' && d.health.spi < 0.9,
    label: 'Materials alert + schedule slip',
    whyItMatters:
      'Late materials + schedule slip means the recovery plan needs a different supplier or a phased handoff, not a longer day. The 48-hour alert is the early signal; do not wait for the activity to actually start late.',
  },
  {
    name: 'risk-amber-with-schedule-or-cost',
    match: (d) =>
      d.riskStatus.status !== 'green' &&
      d.riskStatus.openCount >= 3 &&
      (d.health.spi < 0.95 || d.health.cpi < 0.95),
    label: 'Risk register amber + schedule/cost pressure',
    whyItMatters:
      'When the risk register itself is amber and the project is also slipping, the next 1-2 risks are likely to fire. Run the risk review this week; do not defer.',
  },
];

function detectCompoundRisks(d: DataSummary): string[] {
  const out: string[] = [];
  for (const p of COMPOUND_PATTERNS) {
    if (p.match(d)) {
      out.push(typeof p.label === 'function' ? p.label(d) : p.label);
    }
  }
  return out;
}

// ─── Fallback — deterministic brief from the data summary ────────────────────

function buildFallbackSections(d: DataSummary, compoundRisks: string[]): MorningBriefSection[] {
  const sections: MorningBriefSection[] = [];

  // Compound risks come first — they're the multi-signal cascades
  // that deserve the most attention. If any fire, the headline
  // and first section flag them.
  if (compoundRisks.length > 0) {
    sections.push({
      title: 'Compound risk',
      body: `${compoundRisks.length} cascading signal${compoundRisks.length === 1 ? '' : 's'}: ${compoundRisks.join('; ')}. Treat as priority for the next 24h.`,
      severity: 'red',
    });
  }

  // Schedule
  if (d.health.spi < 0.9) {
    sections.push({
      title: 'Schedule slip',
      body: `SPI ${d.health.spi.toFixed(2)} — behind plan. Review the critical path and the most-recent weekly update.`,
      severity: 'red',
    });
  } else if (d.health.spi < 0.95) {
    sections.push({
      title: 'Schedule watch',
      body: `SPI ${d.health.spi.toFixed(2)} — slightly behind. Watch the next two milestones.`,
      severity: 'amber',
    });
  } else {
    sections.push({
      title: 'Schedule',
      body: `SPI ${d.health.spi.toFixed(2)} — on plan.`,
      severity: 'green',
    });
  }

  // Cost
  if (d.health.cpi < 0.9) {
    sections.push({
      title: 'Cost overrun',
      body: `CPI ${d.health.cpi.toFixed(2)} — over budget. Check the largest incurred lines and any new change orders.`,
      severity: 'red',
    });
  } else if (d.health.cpi < 0.95) {
    sections.push({
      title: 'Cost watch',
      body: `CPI ${d.health.cpi.toFixed(2)} — trending over. Review this week's commitments.`,
      severity: 'amber',
    });
  } else {
    sections.push({
      title: 'Cost',
      body: `CPI ${d.health.cpi.toFixed(2)} — on budget.`,
      severity: 'green',
    });
  }

  // Overdue items
  const totalOverdue = d.overdueRfis.length + d.overdueSubmittals.length;
  if (totalOverdue > 0) {
    const parts: string[] = [];
    if (d.overdueRfis.length > 0) {
      parts.push(`${d.overdueRfis.length} RFI${d.overdueRfis.length === 1 ? '' : 's'}`);
    }
    if (d.overdueSubmittals.length > 0) {
      parts.push(`${d.overdueSubmittals.length} submittal${d.overdueSubmittals.length === 1 ? '' : 's'}`);
    }
    sections.push({
      title: 'Overdue items',
      body: `${parts.join(' and ')} past required date. Triage the oldest ones first.`,
      severity: 'red',
    });
  }

  // Open change orders
  if (d.openChangeOrders.length > 0) {
    const totalValue = d.openChangeOrders.reduce((s, c) => s + (c.dollarValue || 0), 0);
    sections.push({
      title: 'Change orders',
      body: `${d.openChangeOrders.length} pending/submitted (est. $${Math.round(totalValue).toLocaleString()}). Check approval status.`,
      severity: 'amber',
    });
  }

  // Risk
  if (d.riskStatus.openCount > 0) {
    sections.push({
      title: 'Risk register',
      body: d.riskStatus.summary,
      severity: d.riskStatus.status,
    });
  }

  // Always include the "% complete" line for context
  sections.push({
    title: 'Progress',
    body: `${Math.round(d.health.pctComplete * 100)}% complete.`,
    severity: 'green',
  });

  return sections.slice(0, 5);
}

function deriveFallbackHeadline(d: DataSummary, compoundRisks: string[]): string {
  // A compound cascade trumps every individual-signal headline —
  // if two-or-more signals are firing together the PM needs to
  // see that first, not the per-metric list.
  if (compoundRisks.length > 0) {
    return `${d.projectName}: ${compoundRisks[0]}. ${compoundRisks.length > 1 ? `+${compoundRisks.length - 1} more cascading signal${compoundRisks.length - 1 === 1 ? '' : 's'}.` : ''}`;
  }
  const totalOverdue = d.overdueRfis.length + d.overdueSubmittals.length;
  if (d.health.spi < 0.9 || d.health.cpi < 0.9 || totalOverdue > 0) {
    return `${d.projectName} needs attention: ${d.health.spi < 0.9 ? 'schedule slip' : ''}${d.health.spi < 0.9 && d.health.cpi < 0.9 ? ' + ' : ''}${d.health.cpi < 0.9 ? 'cost overrun' : ''}${(d.health.spi < 0.9 || d.health.cpi < 0.9) && totalOverdue > 0 ? '; ' : ''}${totalOverdue > 0 ? `${totalOverdue} overdue` : ''}.`;
  }
  return `${d.projectName} is on track — ${Math.round(d.health.pctComplete * 100)}% complete.`;
}
