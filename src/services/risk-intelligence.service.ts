/**
 * risk-intelligence.service.ts
 * ============================================================================
 * Sprint 9 Task 7. The compound-risk detector that lives in the
 * morning-brief agent is now re-exported as a first-class service
 * so the dashboard's risk tile can call it directly. The detector
 * is deterministic (rule-based) and lives in this file; the
 * morning-brief agent wraps it with AI-style narrative.
 *
 * This service is also the rate-limited refresh endpoint: a
 * `tryRefresh()` helper enforces a 5-per-day-per-project cap so
 * the PM cannot accidentally DDoS the detector.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { getMorningDashboard } from './dashboard.service';
import { getOverdueRfis, getOverdueSubmittals } from './communications.service';
import { getChangeOrdersByProject } from './scope.service';
import { getRiskDashboardStatus } from './risk.service';

const REFRESH_LIMIT_PER_DAY = 5;

export interface CompoundRiskEntry {
  id: string;
  label: string;
  severity: 'warning' | 'critical';
  whyItMatters: string;
  // Optional deep-link context for the UI
  links: Array<{ kind: 'activity' | 'rfi' | 'submittal' | 'changeOrder' | 'risk'; id: string; label: string }>;
}

export interface RiskIntelligenceSnapshot {
  projectId: string;
  generatedAt: string;
  status: 'clear' | 'warning' | 'critical';
  count: number;
  topRisk: string | null;
  compoundRisks: CompoundRiskEntry[];
}

// The compound pattern library. Mirrors the agent's
// COMPOUND_PATTERNS; mirrored here so the dashboard doesn't
// need to import the agent (which would also drag in the AI client).
interface CompoundPattern {
  id: string;
  match: (d: CompountInputs) => boolean;
  severity: 'warning' | 'critical';
  label: string | ((d: CompountInputs) => string);
  whyItMatters: string;
  links: (d: CompountInputs) => CompoundRiskEntry['links'];
}

interface CompountInputs {
  spi: number;
  cpi: number;
  overdueRfis: Array<{ id: string; rfiNumber: string }>;
  overdueSubmittals: Array<{ id: string; submittalNumber: string }>;
  openChangeOrders: Array<{ id: string; coNumber: string }>;
  safetyIncidents: number;
  materialsAlertStatus: 'green' | 'amber' | 'red';
  riskStatus: 'green' | 'amber' | 'red';
  openRiskCount: number;
}

const COMPOUND_PATTERNS: CompoundPattern[] = [
  {
    id: 'schedule-cost-overrun',
    match: (d) => d.spi < 0.95 && d.cpi < 0.95,
    severity: 'critical',
    label: 'Schedule slip + cost overrun',
    whyItMatters: 'Schedule and cost variance moving together is the classic recipe for a margin-killing project. Pull the EAC and the change-order log before any new commitments.',
    links: (d) => [
      ...d.openChangeOrders.slice(0, 2).map((co) => ({ kind: 'changeOrder' as const, id: co.id, label: co.coNumber })),
    ],
  },
  {
    id: 'overdue-rfis-with-schedule-slip',
    match: (d) => d.overdueRfis.length >= 3 && d.spi < 0.95,
    severity: 'critical',
    label: (d) => `${d.overdueRfis.length} overdue RFIs + schedule slip`,
    whyItMatters: 'A backlog of unanswered RFIs is the most common cause of downstream schedule slip on design-build work. Chasing the architect on the oldest 1-2 RFIs usually unblocks several activities at once.',
    links: (d) => d.overdueRfis.slice(0, 2).map((r) => ({ kind: 'rfi' as const, id: r.id, label: r.rfiNumber })),
  },
  {
    id: 'overdue-rfis-with-cost-overrun',
    match: (d) => d.overdueRfis.length >= 3 && d.cpi < 0.95,
    severity: 'critical',
    label: (d) => `${d.overdueRfis.length} overdue RFIs + cost overrun`,
    whyItMatters: 'RFIs sit unanswered because the answer is going to cost money. Open the affected budget lines, get a number on the change, and price it before it goes to change order.',
    links: (d) => d.overdueRfis.slice(0, 2).map((r) => ({ kind: 'rfi' as const, id: r.id, label: r.rfiNumber })),
  },
  {
    id: 'change-orders-stacking',
    match: (d) => d.openChangeOrders.length >= 3,
    severity: 'warning',
    label: (d) => `${d.openChangeOrders.length} pending change orders`,
    whyItMatters: 'When 3+ COs are stacked, the EAC re-flow runs out of headroom for the next one. Triage the oldest first; do not let the queue grow past 5.',
    links: (d) => d.openChangeOrders.slice(0, 3).map((co) => ({ kind: 'changeOrder' as const, id: co.id, label: co.coNumber })),
  },
  {
    id: 'triple-threat-safety-cost-schedule',
    match: (d) => d.safetyIncidents > 0 && d.cpi < 0.95 && d.spi < 0.95,
    severity: 'critical',
    label: 'Safety + cost + schedule all amber/red',
    whyItMatters: 'A recordable incident during a project that is already over budget and behind schedule is the #1 predictor of margin erosion. Stop-work review is justified.',
    links: () => [],
  },
  {
    id: 'materials-with-schedule-slip',
    match: (d) => d.materialsAlertStatus !== 'green' && d.spi < 0.9,
    severity: 'warning',
    label: 'Materials alert + schedule slip',
    whyItMatters: 'Late materials + schedule slip means the recovery plan needs a different supplier or a phased handoff, not a longer day. The 48-hour alert is the early signal; do not wait for the activity to actually start late.',
    links: () => [],
  },
  {
    id: 'risk-amber-with-schedule-or-cost',
    match: (d) => d.riskStatus !== 'green' && d.openRiskCount >= 3 && (d.spi < 0.95 || d.cpi < 0.95),
    severity: 'warning',
    label: 'Risk register amber + schedule/cost pressure',
    whyItMatters: 'When the risk register itself is amber and the project is also slipping, the next 1-2 risks are likely to fire. Run the risk review this week; do not defer.',
    links: () => [],
  },
];

function buildInputs(d: CompountInputs): CompountInputs {
  return {
    spi: d.spi,
    cpi: d.cpi,
    overdueRfis: d.overdueRfis,
    overdueSubmittals: d.overdueSubmittals,
    openChangeOrders: d.openChangeOrders,
    safetyIncidents: d.safetyIncidents,
    materialsAlertStatus: d.materialsAlertStatus,
    riskStatus: d.riskStatus,
    openRiskCount: d.openRiskCount,
  };
}

export async function detectCompoundRisksForDashboard(
  projectId: string
): Promise<CompoundRiskEntry[]> {
  const inputs = await collectInputs(projectId);
  return COMPOUND_PATTERNS.filter((p) => p.match(inputs)).map((p) => ({
    id: p.id,
    label: typeof p.label === 'function' ? p.label(inputs) : p.label,
    severity: p.severity,
    whyItMatters: p.whyItMatters,
    links: p.links(inputs),
  }));
}

/**
 * Sprint 11 Task 7: persist a row in compound_risks for every
 * compound risk that the detector surfaces. Best-effort — never
 * throws. A single active (resolvedAt=null) row per (projectId,
 * ruleTriggered) is the "current state"; re-detection is
 * idempotent.
 */
export async function persistCompoundRisks(
  projectId: string,
  entries: CompoundRiskEntry[]
): Promise<void> {
  try {
    const prisma = getPrismaClient();
    for (const e of entries) {
      const existing = await prisma.compoundRisk.findFirst({
        where: { projectId, ruleTriggered: e.id, resolvedAt: null },
      });
      if (existing) continue;
      await prisma.compoundRisk.create({
        data: {
          projectId,
          ruleTriggered: e.id,
          description: e.label,
          linkedItems: e.links as any,
          detectedAt: new Date(),
        },
      });
    }
  } catch (err: any) {
    console.warn('[risk-intel] persistCompoundRisks failed:', err?.message || err);
  }
}

/**
 * Sprint 11 Task 7: list historical compound risks for a project.
 * Active (unresolved) first, then by detectedAt desc.
 */
export async function listCompoundRiskHistory(projectId: string, limit = 50) {
  const prisma = getPrismaClient();
  return prisma.compoundRisk.findMany({
    where: { projectId },
    orderBy: [{ resolvedAt: 'asc' }, { detectedAt: 'desc' }],
    take: Math.min(limit, 200),
  });
}

/**
 * Sprint 11 Task 7: mark a compound risk as resolved.
 */
export async function resolveCompoundRisk(
  riskId: string,
  resolvedBy: string,
  resolution: string
): Promise<{ ok: boolean }> {
  const prisma = getPrismaClient();
  await prisma.compoundRisk.update({
    where: { id: riskId },
    data: { resolvedAt: new Date(), resolvedBy, resolution },
  });
  return { ok: true };
}

async function collectInputs(projectId: string): Promise<CompountInputs> {
  const [dashboard, overdueR, overdueS, cos, risk] = await Promise.all([
    safeCall(() => getMorningDashboard(projectId, { incidents: 0, openObservations: 0 })),
    safeCall(() => getOverdueRfis(projectId)),
    safeCall(() => getOverdueSubmittals(projectId)),
    safeCall(() => getChangeOrdersByProject(projectId)),
    safeCall(() => getRiskDashboardStatus(projectId)),
  ]);
  return buildInputs({
    spi: dashboard?.performance?.spi ?? 1,
    cpi: dashboard?.performance?.cpi ?? 1,
    overdueRfis: (overdueR || []).slice(0, 10).map((r) => ({ id: r.id, rfiNumber: r.rfiNumber })),
    overdueSubmittals: (overdueS || []).slice(0, 10).map((s) => ({ id: s.id, submittalNumber: s.submittalNumber })),
    openChangeOrders: (cos || [])
      .filter((c) => c.status === 'pending' || c.status === 'submitted')
      .slice(0, 10)
      .map((c) => ({ id: c.id, coNumber: c.coNumber })),
    safetyIncidents: dashboard?.tiles?.safety?.count ?? 0,
    materialsAlertStatus: dashboard?.tiles?.materials?.status ?? 'green',
    riskStatus: risk?.status ?? 'green',
    openRiskCount: risk?.count ?? 0,
  });
}

async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

export async function getRiskIntelligenceSnapshot(
  projectId: string
): Promise<RiskIntelligenceSnapshot> {
  const compound = await detectCompoundRisksForDashboard(projectId);
  // Sprint 11: persist detected risks for the history view.
  // Best-effort — never throws into the caller.
  await persistCompoundRisks(projectId, compound);
  const critical = compound.some((c) => c.severity === 'critical');
  const status: 'clear' | 'warning' | 'critical' = compound.length === 0 ? 'clear' : critical ? 'critical' : 'warning';
  return {
    projectId,
    generatedAt: new Date().toISOString(),
    status,
    count: compound.length,
    topRisk: compound[0]?.label ?? null,
    compoundRisks: compound,
  };
}

// ─── Refresh rate limit (5 / project / day) ──────────────────────────────

export class RiskRefreshLimitError extends Error {
  constructor() {
    super('Risk refresh rate limit exceeded (5 per project per day)');
  }
}

function todayKey(projectId: string): string {
  const today = new Date();
  return `risk-refresh:${projectId}:${today.toISOString().slice(0, 10)}`;
}

export async function tryRefreshRiskIntelligence(
  projectId: string
): Promise<RiskIntelligenceSnapshot> {
  const prisma = getPrismaClient();
  const key = todayKey(projectId);
  const existing = await prisma.apiUsageLog.findFirst({
    where: {
      projectId,
      endpoint: key,
      // Just look at the start of the day. We use calledAt as
      // a coarse timestamp — the api_usage_log already exists
      // and indexes well on (projectId, calledAt).
    },
    orderBy: { calledAt: 'desc' },
    take: REFRESH_LIMIT_PER_DAY + 5,
  }).catch(() => null);
  // We can't get a reliable count from the inline query above; do
  // a strict count call. This is one extra query per refresh,
  // which is fine at 5/day.
  const calls = await prisma.apiUsageLog.count({
    where: {
      projectId,
      endpoint: key,
      calledAt: { gte: startOfToday() },
    },
  }).catch(() => 0);
  if (calls >= REFRESH_LIMIT_PER_DAY) {
    throw new RiskRefreshLimitError();
  }
  // Record the attempt
  await prisma.apiUsageLog.create({
    data: {
      projectId,
      userId: 'system:risk-refresh',
      endpoint: key,
      model: 'risk-intelligence',
      calledAt: new Date(),
      success: true,
    },
  }).catch(() => {
    // best-effort
  });
  return getRiskIntelligenceSnapshot(projectId);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
