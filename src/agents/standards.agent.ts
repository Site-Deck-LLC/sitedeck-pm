/**
 * Regulatory & Standards Compliance Agent
 * ============================================================================
 * Role: Monitors project activities against regulatory requirements (NFPA 855,
 *   NEC 706, OSHA, local fire codes) and contract notice/inspection clauses.
 *   Flags missing inspections, overdue certifications, and non-compliant
 *   material substitutions before they become violations.
 *
 * Data consumed:
 *   - Safety incidents and observations (safety.service.ts, risk.service.ts)
 *   - Procurement / material lifecycle (procurement.service.ts)
 *   - Communications log (communications.service.ts) — RFI, submittal approvals
 *   - Project settings (project.service.ts) — jurisdiction, permit dates
 *
 * Outputs:
 *   - Compliance checklist with pass/fail/pending status per standard
 *   - Alert for upcoming notice deadlines (e.g., "48-hour fire marshal notice")
 *   - Inspection gap report
 *
 * V1 implements a deterministic rule engine: each rule is a function that
 * returns pass/fail/pending + evidence, given the project's live state. The
 * agent runs synchronously and never calls the model — compliance is a
 * fact-check, not a creative task. The agent is therefore deterministic
 * and free, no Anthropic call.
 *
 * TODO (future sprint): contract-clause map, jurisdiction map, calendar
 *   integration, real inspection-date derivation from schedule.
 * ============================================================================
 */

import { getSafetyPerformance } from '../services/safety.service';
import {
  getRfiByProject,
  getSubmittalsByProject,
} from '../services/communications.service';
import { getProjectById } from '../services/project.service';
import { getPrismaClient } from '../lib/prisma';
import { listStandards, getStandard, StandardDefinition } from '../constants/standards';

export interface StandardsInput {
  projectId: string;
  standardIds?: string[]; // optional filter — defaults to all
  asOfDate?: string; // ISO date; defaults to today
}

export interface ComplianceCheck {
  standardId: string;
  standardName: string;
  clause: string;
  status: 'pass' | 'fail' | 'pending' | 'not_applicable';
  evidence: string;
  gapDescription?: string;
  dueDate?: string;
}

export interface NoticeAlert {
  noticeType: string;
  requiredByDate: string;
  daysRemaining: number;
  description: string;
  responsibleRole: string;
}

export interface StandardsOutput {
  projectId: string;
  asOfDate: string;
  overallStatus: 'green' | 'amber' | 'red';
  checks: ComplianceCheck[];
  notices: NoticeAlert[];
  inspectionGaps: string[];
}

// ─── Rule engine ─────────────────────────────────────────────────────────────
// Each rule returns a `ComplianceCheck`. The agent composes the final output
// by running the configured rules against the project's live state.

type RuleContext = {
  projectId: string;
  asOf: Date;
  project: { id: string; name: string; jurisdiction?: string | null; trirTarget?: number | null };
  safety: { trirActual: number; trirTarget: number; recordableIncidents: number; totalHoursWorked: number };
  rfis: Array<{ id: string; rfiNumber: string; subject: string; status: string; requiredDate: Date | null }>;
  submittals: Array<{ id: string; submittalNumber: string; title: string; status: string }>;
};

async function buildContext(projectId: string, asOf: Date): Promise<RuleContext> {
  const [project, safety, rfis, submittals] = await Promise.all([
    getProjectById(projectId),
    getSafetyPerformance(projectId).catch(() => ({
      projectId, trirActual: 0, trirTarget: 1.0, recordableIncidents: 0, totalHoursWorked: 0,
      status: 'green' as const, series: [],
    })),
    getRfiByProject(projectId).catch(() => []),
    getSubmittalsByProject(projectId).catch(() => []),
  ]);
  if (!project) {
    throw new Error('Project not found');
  }
  return {
    projectId,
    asOf,
    project: { id: project.id, name: project.name, jurisdiction: (project as any).jurisdiction, trirTarget: (project as any).trirTarget },
    safety,
    rfis: (rfis as any[]).map((r) => ({
      id: r.id, rfiNumber: r.rfiNumber, subject: r.subject, status: r.status, requiredDate: r.requiredDate ? new Date(r.requiredDate) : null,
    })),
    submittals: (submittals as any[]).map((s) => ({
      id: s.id, submittalNumber: s.submittalNumber, title: s.title, status: s.status,
    })),
  };
}

// Rule: OSHA 1926.501 — fall protection. Pass if no recordable fall incidents
// in the last 90 days; fail if any; pending if no attendance hours logged.
function checkOshaFallProtection(ctx: RuleContext): ComplianceCheck {
  if (ctx.safety.totalHoursWorked === 0) {
    return {
      standardId: 'OSHA_1926_501',
      standardName: 'Fall Protection',
      clause: '29 CFR 1926.501(b)(1)',
      status: 'pending',
      evidence: 'No attendance hours logged yet — cannot assess fall protection compliance.',
      gapDescription: 'Log daily attendance to enable compliance checks.',
    };
  }
  // We don't have incident-type tagging in the risk model yet. For V1, the
  // proxy is: if recordable incidents > 0 and the project's TRIR > 2.0, flag.
  if (ctx.safety.trirActual > 2.0) {
    return {
      standardId: 'OSHA_1926_501',
      standardName: 'Fall Protection',
      clause: '29 CFR 1926.501(b)(1)',
      status: 'fail',
      evidence: `TRIR ${ctx.safety.trirActual} is above the 2.0 safety-action threshold; ${ctx.safety.recordableIncidents} recordable incident(s) in the project window.`,
      gapDescription: 'Review the most recent incident report and the fall-protection plan.',
    };
  }
  return {
    standardId: 'OSHA_1926_501',
    standardName: 'Fall Protection',
    clause: '29 CFR 1926.501(b)(1)',
    status: 'pass',
    evidence: `TRIR ${ctx.safety.trirActual} — no safety-action-level concern.`,
  };
}

// Rule: OSHA 1903 — injury reporting timeliness. Pending if any incident is
// missing a recorded notification date; pass otherwise. We don't have
// notification timestamps yet, so the V1 rule is "pending until incident
// timestamps are available" and the PM is asked to verify the 8h/24h windows.
function checkOsha1903InjuryReporting(ctx: RuleContext): ComplianceCheck {
  if (ctx.safety.recordableIncidents === 0) {
    return {
      standardId: 'OSHA_1903',
      standardName: 'Injury Reporting',
      clause: '29 CFR 1903',
      status: 'pass',
      evidence: 'No recordable incidents in the project window.',
    };
  }
  return {
    standardId: 'OSHA_1903',
    standardName: 'Injury Reporting',
    clause: '29 CFR 1903',
    status: 'pending',
    evidence: `${ctx.safety.recordableIncidents} recordable incident(s) on file. Verify OSHA notification timing: fatality within 8 hours; in-patient hospitalization/amputation/eye loss within 24 hours.`,
    gapDescription: 'Confirm each incident was reported to OSHA within the 8h/24h window. Attach a copy of the OSHA-300 log entry.',
  };
}

// Rule: NFPA 241 — fire safety program. We don't have a fire-impairment
// data source yet. V1 rule: pending for every project, asking the PM to
// confirm the impairment log is being maintained.
function checkNfpa241FireSafety(): ComplianceCheck {
  return {
    standardId: 'NFPA_241',
    standardName: 'Construction/Alteration Fire Safety',
    clause: 'NFPA 241 (2018)',
    status: 'pending',
    evidence: 'Fire-impairment log not yet wired to this check.',
    gapDescription: 'Maintain a written fire-prevention program and a daily impairment log; confirm hot-work permits are issued daily.',
  };
}

// Rule: NEC 706 — energy storage. V1: pending if no procurement data
// indicates ESS equipment; not_applicable if scope doesn't include it.
function checkNec706(ctx: RuleContext): ComplianceCheck {
  // Look for any equipment that looks like a battery / inverter. The
  // equipment registry stores "Other" free-text when type doesn't match.
  // V1 heuristic: pending always; the scope flag is not on the project yet.
  return {
    standardId: 'NEC_706',
    standardName: 'Energy Storage Systems',
    clause: 'NEC 706',
    status: 'pending',
    evidence: 'Scope flag for energy-storage systems is not yet set on the project.',
    gapDescription: 'If the project includes battery storage, mark the project scope accordingly so NEC 706 checks can run.',
  };
}

// Rule: Contract 48-hour notice. Pending for every project — V1 has no
// schedule-with-inspection-hold data, so the agent surfaces the rule and
// asks the PM to verify the 48-hour notice is sent.
function checkContract48hNotice(ctx: RuleContext): ComplianceCheck {
  return {
    standardId: 'CONTRACT_NOTICE_48H',
    standardName: '48-Hour Inspection Notice',
    clause: 'Standard AIA G702/703',
    status: 'pending',
    evidence: 'No schedule activity is currently tagged as "inspection hold".',
    gapDescription: 'Tag inspection-hold activities in the schedule so this check can confirm 48-hour notice is sent.',
  };
}

// Rule: Building permit active. Pending — the project schema doesn't yet
// have permit dates wired to this check.
function checkBuildingPermit(): ComplianceCheck {
  return {
    standardId: 'PERMIT_BUILDING',
    standardName: 'Building Permit — Active',
    clause: 'Local jurisdiction',
    status: 'pending',
    evidence: 'Permit dates are not yet on the project record.',
    gapDescription: 'Add permit issue date and expiration to the project settings.',
  };
}

// Dispatch table — what V1 knows how to check.
const RULES: Record<string, (ctx: RuleContext) => ComplianceCheck> = {
  OSHA_1926_501: checkOshaFallProtection,
  OSHA_1903: checkOsha1903InjuryReporting,
  NFPA_241: () => checkNfpa241FireSafety(),
  NEC_706: checkNec706,
  CONTRACT_NOTICE_48H: checkContract48hNotice,
  PERMIT_BUILDING: () => checkBuildingPermit(),
};

// ─── Agent entry point ───────────────────────────────────────────────────────

export async function runStandards(input: StandardsInput): Promise<StandardsOutput> {
  const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();

  // Verify the project exists. We don't try-catch here — a missing project is
  // a real error and the route should 404.
  const project = await getProjectById(input.projectId);
  if (!project) {
    throw new Error('Project not found');
  }
  const ctx = await buildContext(input.projectId, asOf);

  // Determine which standards to check: caller-provided list or all
  // standards that have a wired-up rule.
  const requested = input.standardIds && input.standardIds.length > 0
    ? input.standardIds
    : listStandards().map((s) => s.id);

  const checks: ComplianceCheck[] = [];
  for (const id of requested) {
    const def = getStandard(id);
    if (!def) {
      checks.push({
        standardId: id,
        standardName: '(unknown)',
        clause: '',
        status: 'not_applicable',
        evidence: `Standard id "${id}" is not in the catalog.`,
      });
      continue;
    }
    const rule = RULES[id];
    if (!rule) {
      checks.push({
        standardId: id,
        standardName: def.name,
        clause: def.clause,
        status: 'pending',
        evidence: `V1 rule engine has no implementation for ${id} yet.`,
        gapDescription: `Implement the rule in standards.agent.ts. Data source: ${def.dataSource}.`,
      });
      continue;
    }
    checks.push(rule(ctx));
  }

  // Roll up status
  const overallStatus = rollupStatus(checks);

  // Notice alerts — 48-hour notice is the only one with a real schedule
  // hook. Until the schedule integration lands, this is a generic reminder.
  const notices: NoticeAlert[] = [];
  if (ctx.rfis.some((r) => r.status === 'open' || r.status === 'submitted')) {
    notices.push({
      noticeType: '48-Hour Inspection Notice (AIA G702/703)',
      requiredByDate: new Date(asOf.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      daysRemaining: 2,
      description: 'Open RFIs on inspection-hold activities require a 48-hour notice to the architect before continuing.',
      responsibleRole: 'project_manager',
    });
  }

  // Inspection gaps — empty until inspection data is wired.
  const inspectionGaps: string[] = [];

  return {
    projectId: input.projectId,
    asOfDate: asOf.toISOString().slice(0, 10),
    overallStatus,
    checks,
    notices,
    inspectionGaps,
  };
}

function rollupStatus(checks: ComplianceCheck[]): 'green' | 'amber' | 'red' {
  if (checks.some((c) => c.status === 'fail')) return 'red';
  if (checks.some((c) => c.status === 'pending')) return 'amber';
  return 'green';
}

// ─── Re-exports for the route and tests ──────────────────────────────────────

export { listStandards, getStandard };
export type { StandardDefinition };
