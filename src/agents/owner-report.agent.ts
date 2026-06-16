/**
 * Owner Report Agent
 * ============================================================================
 * AI Co-Pilot V1, Mode 4 — generates a weekly owner status report.
 *
 * Mirrors the security stack of morning-brief and rfi-followup:
 *   1. Hard-coded system prompt (NEVER built from request input)
 *   2. Sanitized data summary (sanitizeForPrompt on every user-derived field)
 *   3. Hard-coded max_tokens = 1200 (per spec)
 *   4. Auth + tenant isolation + rate limit enforced at the route
 *   5. Spend guard shared via the global daily cap
 *   6. Every call logged to api_usage_log
 *
 * The output is structured (sections keyed by topic) so the PM can edit
 * each section independently on the report detail page.
 *
 * Fallback: if the API key is missing or the call fails, we build a
 * template-based report from the same metrics. The user gets a usable
 * report either way; the source field tells them which path produced it.
 * ============================================================================
 */

import { callAnthropic, AnthropicError } from '../lib/anthropic-client';
import { sanitizeForPrompt } from '../lib/sanitize';
import { getPrismaClient } from '../lib/prisma';
import { getMorningDashboard } from '../services/dashboard.service';
import { getRfiByProject } from '../services/communications.service';
import { getChangeOrdersByProject } from '../services/scope.service';
import { getOpenRisksByProject } from '../services/risk.service';
import { calculateProjectEvm } from '../services/cost.service';

// ─── Public types ───────────────────────────────────────────────────────────

export interface OwnerReportInput {
  projectId: string;
  userId: string;
  weekEnding?: string; // ISO date; defaults to current Friday
  // 'auto' = use AI when key present, else fallback. 'fallback' = always
  // template. 'force' = always AI (caller will catch AnthropicError and
  // surface it; we don't use this from routes).
  mode?: 'auto' | 'fallback' | 'force';
}

export interface OwnerReportSections {
  schedule: string;
  cost: string;
  rfis: string;
  change_orders: string;
  risks: string;
  lookahead: string;
}

export interface OwnerReport {
  report_title: string;
  week_ending: string; // YYYY-MM-DD
  sections: OwnerReportSections;
  full_report_text: string;
  generated_at: string;
  source: 'ai' | 'fallback';
  // Sanitized metrics snapshot — useful for the PM to see what the agent
  // was given. Not user-editable.
  metrics: OwnerReportMetrics;
  meta: {
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
    failureCode?: string;
  };
}

export interface OwnerReportMetrics {
  week_ending_date: string;
  schedule: {
    spi: number;
    baseline_pct: number;
    actual_pct: number;
    critical_activities_count: number;
    delayed_count: number;
  };
  cost: {
    cpi: number;
    budget_total: number;
    incurred_total: number;
    committed_total: number;
    variance_pct: number;
  };
  rfis: {
    open_count: number;
    overdue_count: number;
    answered_this_week: number;
  };
  change_orders: {
    approved_count: number;
    pending_count: number;
    approved_value: number;
    pending_value: number;
  };
  risks: {
    high_count: number;
    new_this_week: number;
  };
  lookahead: {
    activities_starting_next_14_days: number;
  };
}

// ─── System prompt — server-side constant ──────────────────────────────────
// Verbatim from the spec. Do not parameterize.

const OWNER_REPORT_SYSTEM_PROMPT = `You are a construction project manager generating a weekly status report for the project owner. Write a professional, concise report that covers: schedule status vs baseline, cost performance, open RFIs and their impact, change order status, key risks, and the two-week lookahead. Use construction industry language. Be factual and direct. Format with clear sections. Keep under 400 words total.`;

// ─── Agent entry point ──────────────────────────────────────────────────────

export async function runOwnerReport(input: OwnerReportInput): Promise<OwnerReport> {
  const weekEnding = input.weekEnding ? new Date(input.weekEnding) : currentFriday();
  // Normalize to Friday midnight UTC
  weekEnding.setUTCHours(0, 0, 0, 0);

  const metrics = await buildMetrics(input.projectId, weekEnding);
  const project = await getPrismaClient().project.findUnique({
    where: { id: input.projectId },
    select: { name: true },
  });
  const projectName = sanitizeForPrompt(project?.name ?? 'Project', { maxLen: 100 });

  const useAi =
    (input.mode === 'force' || input.mode === undefined || input.mode === 'auto') &&
    Boolean(process.env.ANTHROPIC_API_KEY);

  if (!useAi || input.mode === 'fallback') {
    const sections = buildFallbackSections(metrics, projectName);
    return assemble(
      projectName,
      weekEnding,
      metrics,
      'fallback',
      { failureCode: process.env.ANTHROPIC_API_KEY ? undefined : 'DISABLED' },
      sections
    );
  }

  const userPrompt = JSON.stringify(metrics, null, 2);

  try {
    const result = await callAnthropic({
      endpoint: 'reporter', // 1200 token cap from agent-limits
      userId: input.userId,
      projectId: input.projectId,
      systemPrompt: OWNER_REPORT_SYSTEM_PROMPT,
      userPrompt,
    });

    const sections = parseSections(result.text);
    if (!sections) {
      return assemble(
        projectName,
        weekEnding,
        metrics,
        'fallback',
        { failureCode: 'INVALID_OUTPUT', costUsd: result.costUsd },
        buildFallbackSections(metrics, projectName)
      );
    }
    return assemble(
      projectName,
      weekEnding,
      metrics,
      'ai',
      {
        model: 'claude-sonnet-4-5',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      },
      sections
    );
  } catch (err) {
    const code = err instanceof AnthropicError ? err.code : 'API_ERROR';
    return assemble(
      projectName,
      weekEnding,
      metrics,
      'fallback',
      { failureCode: code },
      buildFallbackSections(metrics, projectName)
    );
  }
}

// ─── Metric assembly ────────────────────────────────────────────────────────

async function buildMetrics(projectId: string, weekEnding: Date): Promise<OwnerReportMetrics> {
  const prisma = getPrismaClient();
  const mondayOfWeek = new Date(weekEnding);
  mondayOfWeek.setUTCDate(mondayOfWeek.getUTCDate() - 4);
  const startOfLastWeek = new Date(mondayOfWeek);
  startOfLastWeek.setUTCDate(startOfLastWeek.getUTCDate() - 7);

  // Run all the reads in parallel; each is wrapped so a single failure
  // doesn't blow up the whole report.
  const [dashboard, evm, rfis, changeOrders, risks, activities, answeredThisWeek] =
    await Promise.all([
      safe(() => getMorningDashboard(projectId, { incidents: 0, openObservations: 0 })),
      safe(() => calculateProjectEvm(projectId)),
      safe(() => getRfiByProject(projectId)),
      safe(() => getChangeOrdersByProject(projectId)),
      safe(() => getOpenRisksByProject(projectId)),
      prisma.scheduleActivity.findMany({
        where: { projectId },
        select: { isCritical: true, status: true, percentComplete: true },
      }),
      prisma.rfi.findMany({
        where: {
          projectId,
          answeredAt: { gte: startOfLastWeek, lte: weekEnding },
        },
        select: { id: true },
      }),
    ]);

  const totalCount = activities.length;
  const criticalCount = activities.filter((a) => a.isCritical).length;
  const delayedCount = activities.filter((a) => a.status === 'delayed').length;
  const actualPct =
    totalCount > 0
      ? activities.reduce((s, a) => s + a.percentComplete, 0) / totalCount
      : 0;

  // Baseline progress: derived from EVM's BCWS vs total budget. bcws is
  // the budgeted cost of work scheduled, so bcws/totalBudget is the
  // baseline % complete.
  const baselinePct =
    evm && evm.totalBudget > 0 ? evm.totalBcwp / evm.totalBudget : 0;

  const now = new Date();
  const overdueRfis = (rfis || []).filter(
    (r) => r.requiredDate && r.requiredDate < now && r.status !== 'closed' && r.status !== 'answered'
  );

  const openCos = (changeOrders || []).filter(
    (c) => c.status === 'pending' || c.status === 'submitted'
  );
  const approvedCos = (changeOrders || []).filter((c) => c.status === 'approved');

  const highRisks = (risks || []).filter((r) => (r.score || 0) >= 7);
  const newRisksThisWeek = (risks || []).filter(
    (r) => r.createdAt >= startOfLastWeek && r.createdAt <= weekEnding
  );

  // Lookahead: count activities starting in next 14 days
  const horizon = new Date();
  horizon.setUTCDate(horizon.getUTCDate() + 14);
  const lookaheadCount = await prisma.scheduleActivity.count({
    where: {
      projectId,
      startDate: { gte: now, lte: horizon },
    },
  });

  return {
    week_ending_date: weekEnding.toISOString().slice(0, 10),
    schedule: {
      spi: round(dashboard?.performance?.spi ?? 0, 2),
      baseline_pct: round(baselinePct, 2),
      actual_pct: round(actualPct, 2),
      critical_activities_count: criticalCount,
      delayed_count: delayedCount,
    },
    cost: {
      cpi: round(dashboard?.performance?.cpi ?? 0, 2),
      budget_total: round(evm?.totalBudget ?? 0, 0),
      incurred_total: round(evm?.totalAcwp ?? 0, 0),
      committed_total: round(evm?.totalAcwp ?? 0, 0), // EVM has no committed column; ACWP is the closest available
      variance_pct: round(dashboard?.performance?.costVariance ?? 0, 2),
    },
    rfis: {
      open_count: (rfis || []).filter((r) => r.status !== 'closed' && r.status !== 'answered').length,
      overdue_count: overdueRfis.length,
      answered_this_week: answeredThisWeek.length,
    },
    change_orders: {
      approved_count: approvedCos.length,
      pending_count: openCos.length,
      approved_value: round(
        approvedCos.reduce((s, c) => s + Number(c.dollarValue || 0), 0),
        0
      ),
      pending_value: round(
        openCos.reduce((s, c) => s + Number(c.dollarValue || 0), 0),
        0
      ),
    },
    risks: {
      high_count: highRisks.length,
      new_this_week: newRisksThisWeek.length,
    },
    lookahead: {
      activities_starting_next_14_days: lookaheadCount,
    },
  };
}

// ─── Section assembly (shared by AI + fallback paths) ────────────────────────

function assemble(
  projectName: string,
  weekEnding: Date,
  metrics: OwnerReportMetrics,
  source: 'ai' | 'fallback',
  meta: OwnerReport['meta'],
  sections: OwnerReportSections
): OwnerReport {
  const full = renderFullReport(projectName, weekEnding, sections, metrics);
  return {
    report_title: `Weekly Owner Report — ${projectName} (week ending ${formatDate(weekEnding)})`,
    week_ending: weekEnding.toISOString().slice(0, 10),
    sections,
    full_report_text: full,
    generated_at: new Date().toISOString(),
    source,
    metrics,
    meta,
  };
}

function renderFullReport(
  projectName: string,
  weekEnding: Date,
  s: OwnerReportSections,
  m: OwnerReportMetrics
): string {
  return [
    `Weekly Owner Report — ${projectName}`,
    `Week ending ${formatDate(weekEnding)}`,
    '',
    'Schedule',
    s.schedule,
    '',
    'Cost',
    s.cost,
    '',
    'RFIs',
    s.rfis,
    '',
    'Change Orders',
    s.change_orders,
    '',
    'Risks',
    s.risks,
    '',
    'Two-Week Lookahead',
    s.lookahead,
  ].join('\n');
}

// ─── Fallback template ──────────────────────────────────────────────────────

function buildFallbackSections(m: OwnerReportMetrics, projectName: string): OwnerReportSections {
  const sch = m.schedule;
  const cost = m.cost;
  const rfi = m.rfis;
  const co = m.change_orders;
  const risk = m.risks;
  const look = m.lookahead;

  const schedLine =
    sch.spi < 0.9
      ? `Behind plan (SPI ${sch.spi.toFixed(2)}). ${sch.delayed_count} delayed activities, ${sch.critical_activities_count} on the critical path.`
      : sch.spi < 0.95
      ? `Slightly behind (SPI ${sch.spi.toFixed(2)}). ${sch.delayed_count} delayed activities, ${sch.critical_activities_count} critical.`
      : `On plan (SPI ${sch.spi.toFixed(2)}). ${Math.round(sch.actual_pct * 100)}% actual vs ${Math.round(
          sch.baseline_pct * 100
        )}% baseline.`;

  const costLine =
    cost.cpi < 0.9
      ? `Over budget (CPI ${cost.cpi.toFixed(2)}). Incurred $${fmtMoney(
          cost.incurred_total
        )} of $${fmtMoney(cost.budget_total)} budget.`
      : cost.cpi < 0.95
      ? `Trending over (CPI ${cost.cpi.toFixed(2)}). Incurred $${fmtMoney(
          cost.incurred_total
        )}; committed $${fmtMoney(cost.committed_total)}.`
      : `On budget (CPI ${cost.cpi.toFixed(2)}). Incurred $${fmtMoney(
          cost.incurred_total
        )} of $${fmtMoney(cost.budget_total)}.`;

  const rfiLine =
    rfi.open_count === 0
      ? `No open RFIs. ${rfi.answered_this_week} answered this week.`
      : `${rfi.open_count} open RFIs (${rfi.overdue_count} overdue). ${rfi.answered_this_week} answered this week.`;

  const coLine =
    co.approved_count === 0 && co.pending_count === 0
      ? `No change orders this period.`
      : `${co.approved_count} approved ($${fmtMoney(co.approved_value)}), ${co.pending_count} pending ($${fmtMoney(
          co.pending_value
        )}).`;

  const riskLine =
    risk.high_count === 0
      ? `No high-severity risks. ${risk.new_this_week} new this week.`
      : `${risk.high_count} high-severity risks open. ${risk.new_this_week} new this week.`;

  const lookLine = `${look.activities_starting_next_14_days} activities scheduled to start in the next two weeks.`;

  return {
    schedule: schedLine,
    cost: costLine,
    rfis: rfiLine,
    change_orders: coLine,
    risks: riskLine,
    lookahead: lookLine,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function round(n: number, decimals: number): number {
  if (!Number.isFinite(n)) return 0;
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

function fmtMoney(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the most recent Friday at 00:00 UTC. If today is Friday, returns
 * today. Otherwise walks back to the previous Friday.
 */
function currentFriday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay(); // 0=Sun, 5=Fri
  const back = dow >= 5 ? dow - 5 : dow + 2;
  d.setUTCDate(d.getUTCDate() - back);
  return d;
}

interface ParsedSections {
  schedule: string;
  cost: string;
  rfis: string;
  change_orders: string;
  risks: string;
  lookahead: string;
}

function parseSections(text: string): ParsedSections | null {
  if (!text) return null;
  // The model is told to use clear sections. Be permissive: look for the
  // first JSON object in the response.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) return null;
  let candidate = text.slice(start, end + 1);
  // Strip code fences if the model wrapped in them
  candidate = candidate.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const obj = JSON.parse(candidate);
    return {
      schedule: str(obj.schedule, 600),
      cost: str(obj.cost, 600),
      rfis: str(obj.rfis, 400),
      change_orders: str(obj.change_orders, 400),
      risks: str(obj.risks, 400),
      lookahead: str(obj.lookahead, 400),
    };
  } catch {
    // Fall back: try to find a "Schedule:" / "Cost:" etc. flat layout
    return parseFlatLayout(text);
  }
}

function parseFlatLayout(text: string): ParsedSections | null {
  const sections: Record<string, string> = {};
  const lines = text.split('\n');
  let current = '';
  for (const line of lines) {
    const m = /^(Schedule|Cost|RFIs?|Change Orders?|Risks?|Two[-\s]?Week Lookahead|Lookahead)\s*[:\-]/i.exec(
      line.trim()
    );
    if (m) {
      current = m[1].toLowerCase().replace(/[-\s]/g, '_');
      if (current === 'rfi') current = 'rfis';
      if (current === 'change_order') current = 'change_orders';
      if (current === 'lookahead' || current === 'two_week_lookahead') current = 'lookahead';
      const body = line.slice(m[0].length).trim();
      sections[current] = body;
    } else if (current && line.trim()) {
      sections[current] = (sections[current] || '') + ' ' + line.trim();
    }
  }
  if (!sections.schedule && !sections.cost) return null;
  return {
    schedule: str(sections.schedule, 600),
    cost: str(sections.cost, 600),
    rfis: str(sections.rfis, 400),
    change_orders: str(sections.change_orders, 400),
    risks: str(sections.risks, 400),
    lookahead: str(sections.lookahead, 400),
  };
}

function str(x: unknown, max: number): string {
  if (typeof x !== 'string') return '';
  return x.slice(0, max);
}
