/**
 * Owner Report Service
 * ============================================================================
 * Persists weekly owner reports and applies the per-project 3/day rate
 * limit. The agent (`owner-report.agent.ts`) does the AI call; this module
 * owns the database row + sent/edit lifecycle.
 *
 * Rate limit is in addition to the global per-(user, project) per-minute
 * limit in anthropic-client. The 3/day cap is project-scoped: a PM can
 * generate at most 3 reports per project per day before we 429.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';

const DAILY_LIMIT = 3;

export interface PersistReportInput {
  projectId: string;
  userId: string;
  weekEnding: Date;
  report: {
    report_title: string;
    week_ending: string;
    sections: {
      schedule: string;
      cost: string;
      rfis: string;
      change_orders: string;
      risks: string;
      lookahead: string;
    };
    full_report_text: string;
    source: 'ai' | 'fallback';
    metrics: unknown;
    meta: unknown;
  };
}

export async function getTodayCallCount(projectId: string): Promise<number> {
  const prisma = getPrismaClient();
  const since = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  return prisma.ownerReport.count({
    where: { projectId, generatedAt: { gte: since } },
  });
}

export async function checkDailyRateLimit(projectId: string): Promise<void> {
  const count = await getTodayCallCount(projectId);
  if (count >= DAILY_LIMIT) {
    const err: any = new Error(
      `Owner report rate limit reached: ${DAILY_LIMIT}/day per project. Try again tomorrow.`
    );
    err.status = 429;
    err.code = 'RATE_LIMITED';
    throw err;
  }
}

export async function saveReport(input: PersistReportInput) {
  const prisma = getPrismaClient();
  // Idempotent upsert keyed on (projectId, weekEnding)
  return prisma.ownerReport.upsert({
    where: {
      projectId_weekEnding: {
        projectId: input.projectId,
        weekEnding: input.weekEnding,
      },
    },
    update: {
      reportJson: input.report as any,
      generatedBy: input.userId,
      generatedAt: new Date(),
    },
    create: {
      projectId: input.projectId,
      weekEnding: input.weekEnding,
      reportJson: input.report as any,
      generatedBy: input.userId,
    },
  });
}

export async function listReports(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.ownerReport.findMany({
    where: { projectId },
    orderBy: { weekEnding: 'desc' },
    select: {
      id: true,
      projectId: true,
      weekEnding: true,
      generatedBy: true,
      generatedAt: true,
      sentAt: true,
      sentToEmail: true,
    },
  });
}

export async function getReport(id: string) {
  const prisma = getPrismaClient();
  return prisma.ownerReport.findUnique({ where: { id } });
}

export async function getReportForWeek(projectId: string, weekEnding: Date) {
  const prisma = getPrismaClient();
  return prisma.ownerReport.findUnique({
    where: { projectId_weekEnding: { projectId, weekEnding } },
  });
}

export async function editSection(
  id: string,
  section: 'schedule' | 'cost' | 'rfis' | 'change_orders' | 'risks' | 'lookahead',
  body: string
) {
  const prisma = getPrismaClient();
  const existing = await prisma.ownerReport.findUnique({ where: { id } });
  if (!existing) {
    const err: any = new Error('Report not found');
    err.status = 404;
    throw err;
  }
  const json = (existing.reportJson as any) || {};
  const sections = { ...(json.sections || {}) };
  sections[section] = body;
  // Re-render the full report text with the new section content.
  const full = renderFullReportFromJson(json, sections);
  const updated = await prisma.ownerReport.update({
    where: { id },
    data: {
      reportJson: { ...json, sections, full_report_text: full } as any,
    },
  });
  return updated;
}

export async function markAsSent(id: string, sentToEmail?: string) {
  const prisma = getPrismaClient();
  return prisma.ownerReport.update({
    where: { id },
    data: {
      sentAt: new Date(),
      sentToEmail: sentToEmail || null,
    },
  });
}

export function renderFullReportFromJson(json: any, sections: any): string {
  const title = json.report_title || 'Weekly Owner Report';
  const week = json.week_ending || '';
  return [
    title,
    week ? `Week ending ${week}` : '',
    '',
    'Schedule',
    sections.schedule || '',
    '',
    'Cost',
    sections.cost || '',
    '',
    'RFIs',
    sections.rfis || '',
    '',
    'Change Orders',
    sections.change_orders || '',
    '',
    'Risks',
    sections.risks || '',
    '',
    'Two-Week Lookahead',
    sections.lookahead || '',
  ]
    .filter((s) => s !== null && s !== undefined)
    .join('\n');
}
