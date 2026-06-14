/**
 * Lessons Learned Service
 * ============================================================================
 * Real-time capture of project lessons. Lessons are:
 *   - agent_flagged: auto-created from pattern detection in the morning
 *     brief or other agents. See `scanForPatterns()`.
 *   - pm_entered: PM manually adds a lesson from the UI.
 *   - field_reported: future — a superintendent/crew member reports a
 *     lesson from the field UI. (Not wired in V1.)
 *
 * Categories: schedule, cost, procurement, quality, safety,
 *             communications, risk, other.
 *
 * The `addedToTemplate` flag drives what rides along when the project
 * is saved as a template (see task 4).
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';

export const LESSON_CATEGORIES = [
  'schedule',
  'cost',
  'procurement',
  'quality',
  'safety',
  'communications',
  'risk',
  'other',
] as const;
export type LessonCategory = (typeof LESSON_CATEGORIES)[number];

export const LESSON_SOURCES = ['agent_flagged', 'pm_entered', 'field_reported'] as const;
export type LessonSource = (typeof LESSON_SOURCES)[number];

export interface CreateLessonInput {
  projectId: string;
  title: string;
  description?: string;
  category: LessonCategory;
  source: LessonSource;
  impact?: string;
  recommendation?: string;
  dfowRef?: string;
  createdBy: string;
  addedToTemplate?: boolean;
}

export interface LessonFilters {
  category?: LessonCategory;
  source?: LessonSource;
  addedToTemplate?: boolean;
  search?: string;
}

export async function createLesson(input: CreateLessonInput) {
  const prisma = getPrismaClient();
  return prisma.lessonLearned.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      description: input.description || null,
      category: input.category,
      source: input.source,
      impact: input.impact || null,
      recommendation: input.recommendation || null,
      dfowRef: input.dfowRef || null,
      createdBy: input.createdBy,
      addedToTemplate: input.addedToTemplate ?? false,
    },
  });
}

export async function flagForTemplate(lessonId: string, on: boolean = true) {
  const prisma = getPrismaClient();
  return prisma.lessonLearned.update({
    where: { id: lessonId },
    data: { addedToTemplate: on },
  });
}

export async function getLessons(projectId: string, filters: LessonFilters = {}) {
  const prisma = getPrismaClient();
  return prisma.lessonLearned.findMany({
    where: {
      projectId,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.addedToTemplate !== undefined ? { addedToTemplate: filters.addedToTemplate } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

export interface LessonsByCategory {
  category: LessonCategory;
  lessons: Awaited<ReturnType<typeof getLessons>>;
}

/**
 * Returns lessons grouped by category. Empty categories are returned
 * with empty arrays so the UI can show "0" without an extra check.
 */
export async function getLessonsByCategory(projectId: string): Promise<LessonsByCategory[]> {
  const all = await getLessons(projectId);
  const groups: Record<string, typeof all> = {};
  for (const cat of LESSON_CATEGORIES) groups[cat] = [];
  for (const l of all) {
    if (!groups[l.category]) groups[l.category] = [];
    groups[l.category].push(l);
  }
  return LESSON_CATEGORIES.map((c) => ({ category: c, lessons: groups[c] || [] }));
}

export async function getLessonById(id: string) {
  const prisma = getPrismaClient();
  return prisma.lessonLearned.findUnique({ where: { id } });
}

export async function updateLesson(id: string, data: Partial<CreateLessonInput>) {
  const prisma = getPrismaClient();
  return prisma.lessonLearned.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.impact !== undefined ? { impact: data.impact } : {}),
      ...(data.recommendation !== undefined ? { recommendation: data.recommendation } : {}),
      ...(data.dfowRef !== undefined ? { dfowRef: data.dfowRef } : {}),
      ...(data.addedToTemplate !== undefined ? { addedToTemplate: data.addedToTemplate } : {}),
    },
  });
}

export async function deleteLesson(id: string) {
  const prisma = getPrismaClient();
  return prisma.lessonLearned.delete({ where: { id } });
}

// ─── Pattern detection (agent_flagged lesson creation) ──────────────────────

/**
 * Recurring schedule delay: same reason code on 3+ change requests.
 * Returns the lesson to insert, or null if the pattern isn't met.
 */
export async function detectRecurringScheduleDelay(projectId: string): Promise<{
  reasonCode: string;
  count: number;
} | null> {
  const prisma = getPrismaClient();
  const rows = await prisma.scheduleChangeRequest.findMany({
    where: { projectId },
    select: { reasonCode: true },
  });
  if (rows.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.reasonCode] = (counts[r.reasonCode] || 0) + 1;
  for (const [code, n] of Object.entries(counts)) {
    if (n >= 3) return { reasonCode: code, count: n };
  }
  return null;
}

/**
 * RFI ball-in-court: same party has 3+ overdue RFIs.
 */
export async function detectOverdueRfiPattern(projectId: string): Promise<{
  party: string;
  count: number;
} | null> {
  const prisma = getPrismaClient();
  const now = new Date();
  const overdue = await prisma.rfi.findMany({
    where: {
      projectId,
      requiredDate: { lt: now },
      status: { notIn: ['closed', 'answered'] },
    },
    select: { ballInCourt: true, assignedTo: true },
  });
  if (overdue.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const r of overdue) {
    const party = (r.ballInCourt || r.assignedTo || 'unknown').trim();
    if (!party) continue;
    counts[party] = (counts[party] || 0) + 1;
  }
  for (const [party, n] of Object.entries(counts)) {
    if (n >= 3) return { party, count: n };
  }
  return null;
}

/**
 * Cost variance: WBS element exceeds 10% variance before 50% complete.
 */
export async function detectEarlyCostVariance(projectId: string): Promise<{
  wbsElement: string;
  variancePct: number;
  pctComplete: number;
} | null> {
  const prisma = getPrismaClient();
  const lines = await prisma.budgetLine.findMany({
    where: { projectId, budgetAmount: { gt: 0 } },
    select: { id: true, name: true, budgetAmount: true, incurredAmount: true, percentComplete: true },
  });
  for (const l of lines) {
    const budget = Number(l.budgetAmount);
    const incurred = Number(l.incurredAmount || 0);
    const pct = l.percentComplete;
    if (pct >= 0.5) continue;
    const variancePct = budget > 0 ? ((incurred - budget * pct) / (budget * pct)) * 100 : 0;
    if (Math.abs(variancePct) > 10) {
      return { wbsElement: l.name || l.id, variancePct, pctComplete: pct };
    }
  }
  return null;
}

/**
 * Schedule recovery: activities that finished ahead of their
 * baseline by 2+ days. Recognises a "what worked" pattern.
 *
 * The baseline is stored as a JSON snapshot on ScheduleBaseline, not
 * as a separate row per activity. We pull the most-recent locked
 * (or just latest) baseline, index its activities by name, and
 * compare actual endDate to baseline endDate.
 */
export async function detectScheduleRecoveryPattern(projectId: string): Promise<{
  activityName: string;
  daysSaved: number;
} | null> {
  const prisma = getPrismaClient();
  const baseline = await prisma.scheduleBaseline.findFirst({
    where: { projectId },
    orderBy: { locked: 'desc', baselineDate: 'desc' },
  });
  if (!baseline) return null;
  const baselineActs = (baseline.activities as Array<{ name: string; endDate: string }>) || [];
  if (baselineActs.length === 0) return null;
  const plannedEnd = new Map<string, Date>();
  for (const b of baselineActs) {
    if (b.name && b.endDate) plannedEnd.set(b.name, new Date(b.endDate));
  }
  const current = await prisma.scheduleActivity.findMany({
    where: { projectId },
    select: { name: true, endDate: true },
  });
  for (const a of current) {
    const planned = plannedEnd.get(a.name);
    if (!planned || !a.endDate) continue;
    const actualEnd = new Date(a.endDate);
    const daysSaved = Math.floor((planned.getTime() - actualEnd.getTime()) / 86_400_000);
    if (daysSaved >= 2) {
      return { activityName: a.name, daysSaved };
    }
  }
  return null;
}

/**
 * Cost overrun: WBS element that has gone over budget (incurred >
 * budget) but isn't yet 100% complete. Predictive of a final
 * over-budget close.
 */
export async function detectCostOverrunPattern(projectId: string): Promise<{
  wbsElement: string;
  overrunPct: number;
} | null> {
  const prisma = getPrismaClient();
  const lines = await prisma.budgetLine.findMany({
    where: { projectId, budgetAmount: { gt: 0 }, percentComplete: { lt: 1 } },
    select: { name: true, budgetAmount: true, incurredAmount: true, percentComplete: true },
  });
  for (const l of lines) {
    const budget = Number(l.budgetAmount);
    const incurred = Number(l.incurredAmount || 0);
    if (incurred > budget) {
      const overrunPct = ((incurred - budget) / budget) * 100;
      return { wbsElement: l.name, overrunPct };
    }
  }
  return null;
}

/**
 * RFI clustering: 3+ RFIs created in the same calendar week. Predictive
 * of a design-coordination problem that will keep producing RFIs.
 */
export async function detectRfiClusteringPattern(projectId: string): Promise<{
  weekStarting: string;
  count: number;
} | null> {
  const prisma = getPrismaClient();
  const rfis = await prisma.rfi.findMany({
    where: { projectId },
    select: { createdAt: true },
  });
  if (rfis.length === 0) return null;
  // Bucket by ISO week-start (Monday).
  const buckets: Record<string, number> = {};
  for (const r of rfis) {
    if (!r.createdAt) continue;
    const d = new Date(r.createdAt);
    const day = d.getUTCDay(); // 0..6, Sun..Sat
    const back = day === 0 ? 6 : day - 1; // shift to Monday
    d.setUTCDate(d.getUTCDate() - back);
    d.setUTCHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = (buckets[key] || 0) + 1;
  }
  for (const [week, n] of Object.entries(buckets)) {
    if (n >= 3) return { weekStarting: week, count: n };
  }
  return null;
}

/**
 * Sub performance: subcontractor with 2+ late milestones. Surfaces
 * the underlying reliability question before it costs the project.
 */
export async function detectSubPerformancePattern(projectId: string): Promise<{
  subcontractorName: string;
  lateMilestones: number;
} | null> {
  const prisma = getPrismaClient();
  const subs = await prisma.subcontract.findMany({
    where: { projectId },
    include: { milestones: true },
  });
  for (const s of subs) {
    let late = 0;
    for (const m of s.milestones) {
      // status 'late' or plannedDate in past with status not 'complete'
      if (m.status === 'late') late++;
      else if (m.plannedDate && m.status !== 'complete' && m.status !== 'paid') {
        if (new Date(m.plannedDate) < new Date()) late++;
      }
    }
    if (late >= 2) return { subcontractorName: s.subcontractorName, lateMilestones: late };
  }
  return null;
}

export interface PatternScanResult {
  schedule?: { reasonCode: string; count: number };
  rfis?: { party: string; count: number };
  cost?: { wbsElement: string; variancePct: number; pctComplete: number };
  scheduleRecovery?: { activityName: string; daysSaved: number };
  costOverrun?: { wbsElement: string; overrunPct: number };
  rfiClustering?: { weekStarting: string; count: number };
  subPerformance?: { subcontractorName: string; lateMilestones: number };
  created: string[]; // lesson ids created
}

/**
 * Run all three pattern detectors. For each one that fires, check if a
 * lesson already exists with the same title (idempotent: re-running the
 * morning brief doesn't create a duplicate lesson), and if not, create
 * a new agent_flagged lesson.
 *
 * Returns the lessons that were created (id list). The PM can then
 * review and confirm/edit.
 */
export async function scanForPatterns(projectId: string): Promise<PatternScanResult> {
  const [sched, rfi, cost, recovery, overrun, cluster, subPerf] = await Promise.all([
    detectRecurringScheduleDelay(projectId),
    detectOverdueRfiPattern(projectId),
    detectEarlyCostVariance(projectId),
    detectScheduleRecoveryPattern(projectId).catch(() => null),
    detectCostOverrunPattern(projectId).catch(() => null),
    detectRfiClusteringPattern(projectId).catch(() => null),
    detectSubPerformancePattern(projectId).catch(() => null),
  ]);

  const created: string[] = [];

  if (sched) {
    const title = `Recurring ${sched.reasonCode} delay detected`;
    const existing = await getLessons(projectId, { source: 'agent_flagged' });
    if (!existing.some((l) => l.title === title)) {
      const l = await createLesson({
        projectId,
        title,
        description: `Detected ${sched.count} schedule change requests with reason code "${sched.reasonCode}". Consider adding buffer to similar activities on future projects.`,
        category: 'schedule',
        source: 'agent_flagged',
        impact: `${sched.count} change requests with this reason code suggest an underlying planning gap.`,
        recommendation: `Review the activity library for "${sched.reasonCode}" activities and add a buffer; pre-stage crews where possible.`,
        createdBy: 'system:pattern-detector',
      });
      created.push(l.id);
    }
  }

  if (rfi) {
    const title = `RFI process with ${rfi.party} needs escalation`;
    const existing = await getLessons(projectId, { source: 'agent_flagged' });
    if (!existing.some((l) => l.title === title)) {
      const l = await createLesson({
        projectId,
        title,
        description: `${rfi.count} RFIs are overdue with ${rfi.party}. The ball-in-court pattern is delaying project work.`,
        category: 'communications',
        source: 'agent_flagged',
        impact: `Multiple RFIs delayed; downstream activities may be on hold.`,
        recommendation: `Escalate RFI process with ${rfi.party}. Consider a weekly check-in or formal escalation memo.`,
        createdBy: 'system:pattern-detector',
      });
      created.push(l.id);
    }
  }

  if (cost) {
    const title = `Early cost variance on ${cost.wbsElement}`;
    const existing = await getLessons(projectId, { source: 'agent_flagged' });
    if (!existing.some((l) => l.title === title)) {
      const l = await createLesson({
        projectId,
        title,
        description: `WBS element "${cost.wbsElement}" shows ${cost.variancePct.toFixed(1)}% cost variance at ${(cost.pctComplete * 100).toFixed(0)}% complete.`,
        category: 'cost',
        source: 'agent_flagged',
        impact: `Variance is appearing early; if the trend continues, the line will overrun.`,
        recommendation: `Review scope and pricing on ${cost.wbsElement}; consider a change order or scope adjustment.`,
        createdBy: 'system:pattern-detector',
      });
      created.push(l.id);
    }
  }

  if (recovery) {
    const title = `Schedule recovery: ${recovery.activityName} finished ${recovery.daysSaved}d ahead of baseline`;
    const existing = await getLessons(projectId, { source: 'agent_flagged' });
    if (!existing.some((l) => l.title === title)) {
      const l = await createLesson({
        projectId,
        title,
        description: `"${recovery.activityName}" completed ${recovery.daysSaved} days ahead of its baseline. The crew, sequencing, or preconditions are worth replicating.`,
        category: 'schedule',
        source: 'agent_flagged',
        impact: `Positive variance — the activity ran ahead without slipping downstream work.`,
        recommendation: `Identify what made this activity successful (pre-staged materials, dry-run, dedicated crew) and bake it into the activity library.`,
        createdBy: 'system:pattern-detector',
      });
      created.push(l.id);
    }
  }

  if (overrun) {
    const title = `Cost overrun on ${overrun.wbsElement}`;
    const existing = await getLessons(projectId, { source: 'agent_flagged' });
    if (!existing.some((l) => l.title === title)) {
      const l = await createLesson({
        projectId,
        title,
        description: `WBS element "${overrun.wbsElement}" is already ${overrun.overrunPct.toFixed(1)}% over budget. Without intervention, the line will close red.`,
        category: 'cost',
        source: 'agent_flagged',
        impact: `Incurred cost exceeds budgeted amount; forecast at completion is at risk.`,
        recommendation: `Pull the cost-code detail; identify the top 3 drivers. If the scope is correct, raise a change order for the difference. If pricing is the issue, re-quote with the sub.`,
        createdBy: 'system:pattern-detector',
      });
      created.push(l.id);
    }
  }

  if (cluster) {
    const title = `RFI clustering: ${cluster.count} RFIs in week of ${cluster.weekStarting}`;
    const existing = await getLessons(projectId, { source: 'agent_flagged' });
    if (!existing.some((l) => l.title === title)) {
      const l = await createLesson({
        projectId,
        title,
        description: `${cluster.count} RFIs were created in the week starting ${cluster.weekStarting}. Spikes this size usually trace back to a single design-coordination gap.`,
        category: 'communications',
        source: 'agent_flagged',
        impact: `RFI throughput is the leading indicator of design-coordination issues; the next 2-3 RFIs are likely from the same root cause.`,
        recommendation: `Schedule a coordination meeting with the design team; bring the week's RFIs and look for the common subject. Often a single detail clarification closes the cluster.`,
        createdBy: 'system:pattern-detector',
      });
      created.push(l.id);
    }
  }

  if (subPerf) {
    const title = `Sub performance: ${subPerf.subcontractorName} has ${subPerf.lateMilestones} late milestones`;
    const existing = await getLessons(projectId, { source: 'agent_flagged' });
    if (!existing.some((l) => l.title === title)) {
      const l = await createLesson({
        projectId,
        title,
        description: `${subPerf.subcontractorName} has ${subPerf.lateMilestones} milestones that are past their planned date without completion.`,
        category: 'procurement',
        source: 'agent_flagged',
        impact: `Cascading late milestones slip the recovery margin on the activities downstream.`,
        recommendation: `Schedule a check-in with the sub's PM. If the pattern persists, consider pulling the remaining work in-house or rebidding the unstarted scope. Add to the sub-vetted list with a flag.`,
        createdBy: 'system:pattern-detector',
      });
      created.push(l.id);
    }
  }

  return {
    schedule: sched || undefined,
    rfis: rfi || undefined,
    cost: cost || undefined,
    scheduleRecovery: recovery || undefined,
    costOverrun: overrun || undefined,
    rfiClustering: cluster || undefined,
    subPerformance: subPerf || undefined,
    created,
  };
}
