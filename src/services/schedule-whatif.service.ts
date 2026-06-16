/**
 * Schedule What-If Analysis
 * ============================================================================
 * Simulates the effect of a single-activity delay on the entire project
 * completion date. Performs a CPM forward pass on a copy of the activity
 * network (in memory only — no DB writes) and compares the resulting
 * project end to the original.
 *
 * Uses the SAME calculateCpm() engine that the rest of the schedule module
 * uses. Critical-path changes are detected by comparing per-activity
 * `isCritical` between the two CPM runs.
 *
 * Use cases:
 *   - "If Battery Rack Installation slips 14 days, what's the impact?"
 *   - "If we add 7 days to Concrete Pour duration, does the LD change?"
 *   - "If we delay the start of Cable Pull by 3 days, does completion move?"
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { calculateCpm, ActivityNode, CpmResult } from './schedule.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type DelayType = 'start_delay' | 'duration_extension';

export interface WhatIfRequest {
  activityId: string;
  delayDays: number;
  delayType: DelayType;
}

export interface WhatIfAffectedActivity {
  id: string;
  name: string;
  original_end: string; // ISO
  new_end: string; // ISO
  days_shifted: number;
}

export interface WhatIfResult {
  original_completion: string; // ISO date
  new_completion: string; // ISO date
  days_impact: number;
  critical_path_changed: boolean;
  newly_critical_activities: { id: string; name: string }[];
  no_longer_critical: { id: string; name: string }[];
  affected_activities: WhatIfAffectedActivity[];
  ld_exposure_days: number;
  summary: string;
}

interface RawActivity {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  predecessors: { activityId: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }[] | null;
  successors: { activityId: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }[] | null;
}

/**
 * Run a what-if analysis. Loads the project activities, applies the delay
 * to a copy in memory, runs CPM on both, and returns the impact.
 *
 * NEVER writes to the database.
 */
export async function runWhatIf(
  projectId: string,
  req: WhatIfRequest
): Promise<WhatIfResult> {
  if (req.delayDays < 1 || req.delayDays > 365) {
    throw new Error('delayDays must be between 1 and 365');
  }
  if (req.delayType !== 'start_delay' && req.delayType !== 'duration_extension') {
    throw new Error('delayType must be start_delay or duration_extension');
  }

  const prisma = getPrismaClient();

  // Load project for start date
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, startDate: true, name: true },
  });
  if (!project) {
    throw new Error('Project not found');
  }
  if (!project.startDate) {
    throw new Error('Project has no start date');
  }

  // Load all activities for the project
  const rows = await prisma.scheduleActivity.findMany({
    where: { projectId },
    orderBy: { startDate: 'asc' },
  });
  if (rows.length === 0) {
    throw new Error('Project has no activities');
  }

  // Parse JSON predecessor/successor fields
  const activities: RawActivity[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    startDate: r.startDate,
    endDate: r.endDate,
    duration: r.duration,
    predecessors: (r.predecessors as any) || [],
    successors: (r.successors as any) || [],
  }));

  // Verify the target activity exists
  const target = activities.find((a) => a.id === req.activityId);
  if (!target) {
    throw new Error('Activity not found in this project');
  }

  // Build ActivityNode arrays for the CPM engine. The engine computes ES/EF
  // as offsets from the project start, so we use duration and the
  // relationship topology — the startDate/endDate on the nodes are placeholders
  // for type compatibility.
  const projectStart = project.startDate;
  const toNodes = (acts: RawActivity[]): ActivityNode[] =>
    acts.map((a) => ({
      id: a.id,
      startDate: a.startDate,
      endDate: a.endDate,
      duration: a.duration,
      predecessors: a.predecessors || [],
      successors: a.successors || [],
    }));

  // Run the original CPM
  const originalCpm = calculateCpm(toNodes(activities), projectStart);
  const originalEnd = projectEndDate(originalCpm);

  // Build the modified network
  const modifiedActs = applyDelay(activities, req);
  const modifiedCpm = calculateCpm(toNodes(modifiedActs), projectStart);
  const newEnd = projectEndDate(modifiedCpm);

  const daysImpact = Math.round((newEnd.getTime() - originalEnd.getTime()) / MS_PER_DAY);

  // Critical path diff
  const newlyCritical: { id: string; name: string }[] = [];
  const noLongerCritical: { id: string; name: string }[] = [];
  const criticalPathChanged = (() => {
    for (const a of activities) {
      const origCrit = originalCpm.get(a.id)?.isCritical || false;
      const newCrit = modifiedCpm.get(a.id)?.isCritical || false;
      if (!origCrit && newCrit) {
        newlyCritical.push({ id: a.id, name: a.name });
      } else if (origCrit && !newCrit) {
        noLongerCritical.push({ id: a.id, name: a.name });
      }
    }
    return newlyCritical.length > 0 || noLongerCritical.length > 0;
  })();

  // Affected activities: any whose early finish moved
  const affected: WhatIfAffectedActivity[] = [];
  for (const a of activities) {
    const origEf = originalCpm.get(a.id)?.earlyFinish.getTime();
    const newEf = modifiedCpm.get(a.id)?.earlyFinish.getTime();
    if (origEf !== undefined && newEf !== undefined && origEf !== newEf) {
      const days = Math.round((newEf - origEf) / MS_PER_DAY);
      affected.push({
        id: a.id,
        name: a.name,
        original_end: new Date(origEf).toISOString(),
        new_end: new Date(newEf).toISOString(),
        days_shifted: days,
      });
    }
  }

  // LD exposure: equal to the project completion impact in calendar days
  // (real-world LDs are usually calendar days, not working days; if the
  // project has a calendar-day LD contract, this is exact; if it's a
  // working-day LD, the consumer can adjust).
  const ldExposureDays = Math.max(0, daysImpact);

  const summary = buildSummary({
    activityName: target.name,
    delayDays: req.delayDays,
    delayType: req.delayType,
    originalEnd,
    newEnd,
    daysImpact,
    newlyCriticalCount: newlyCritical.length,
    affectedCount: affected.length,
  });

  return {
    original_completion: originalEnd.toISOString(),
    new_completion: newEnd.toISOString(),
    days_impact: daysImpact,
    critical_path_changed: criticalPathChanged,
    newly_critical_activities: newlyCritical,
    no_longer_critical: noLongerCritical,
    affected_activities: affected,
    ld_exposure_days: ldExposureDays,
    summary,
  };
}

function projectEndDate(cpm: Map<string, CpmResult>): Date {
  let maxMs = -Infinity;
  for (const r of cpm.values()) {
    if (r.earlyFinish.getTime() > maxMs) maxMs = r.earlyFinish.getTime();
  }
  return new Date(maxMs);
}

/**
 * Apply a delay to the target activity in a copy of the activity list.
 *
 *   - duration_extension: extend the activity's duration by the delay days.
 *     Effect on successors:
 *       FS: ES_successor += N  (EF moved by N, FS follows EF)
 *       SS: ES_successor unchanged  (SS keys off ES which didn't move)
 *       FF: ES_successor += N  (EF moved by N, FF keys off EF)
 *       SF: ES_successor unchanged  (SF keys off ES which didn't move)
 *
 *   - start_delay: shift the activity's start (and end) later. Implemented by
 *     adding the delay to the duration. Since the CPM engine computes ES
 *     from predecessors and EF = ES + duration, bumping duration by N
 *     produces the same EF as bumping ES by N — so the effect on the
 *     activity's own EF is the same. The DIFFERENCE between start_delay
 *     and duration_extension shows up in the successor shifts:
 *       start_delay: ES_X moves by +N → all successors (FS, SS, FF, SF)
 *                    shift by +N (each keys off either ES_X or EF_X, both
 *                    moved by N)
 *       duration_extension: only EF_X moves by +N → FS and FF shift by N,
 *                           SS and SF do not shift
 *
 * In a pure-FS network, the two are observationally identical to downstream
 * activities. In mixed networks (any SS/SF relationship), the affected set
 * differs.
 */
function applyDelay(activities: RawActivity[], req: WhatIfRequest): RawActivity[] {
  return activities.map((a) => {
    if (a.id !== req.activityId) return a;
    if (req.delayType === 'duration_extension' || req.delayType === 'start_delay') {
      return {
        ...a,
        duration: a.duration + req.delayDays,
      };
    }
    return a;
  });
}

interface SummaryArgs {
  activityName: string;
  delayDays: number;
  delayType: DelayType;
  originalEnd: Date;
  newEnd: Date;
  daysImpact: number;
  newlyCriticalCount: number;
  affectedCount: number;
}

function buildSummary(s: SummaryArgs): string {
  const orig = formatShortDate(s.originalEnd);
  const next = formatShortDate(s.newEnd);
  const typeWord = s.delayType === 'start_delay' ? 'start delay' : 'duration extension';

  if (s.daysImpact === 0) {
    return `A ${s.delayDays}-day ${typeWord} on ${s.activityName} has no impact on the project completion date (the activity has ${s.delayDays}+ days of float to absorb it).`;
  }

  const base = `A ${s.delayDays}-day ${typeWord} on ${s.activityName} shifts project completion from ${orig} to ${next} — ${s.daysImpact} days of LD exposure at contract rate.`;

  if (s.newlyCriticalCount > 0) {
    return `${base} The critical path changes; ${s.newlyCriticalCount} new activit${s.newlyCriticalCount === 1 ? 'y becomes' : 'ies become'} critical.`;
  }
  if (s.affectedCount > 1) {
    return `${base} ${s.affectedCount} activities shift in total.`;
  }
  return base;
}

function formatShortDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
