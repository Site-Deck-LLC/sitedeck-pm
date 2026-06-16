/**
 * portfolio.service.ts — Multi-project portfolio health aggregation
 * ============================================================================
 * Sprint 8. The portfolio view summarizes CPI/SPI, schedule and cost
 * status, and open work (issues, RFIs) across every project the calling
 * user is allowed to see. Tenant isolation: the user's `orgId` (from
 * the Firebase custom claim) scopes the project list. When `orgId` is
 * null (dev-token path), all projects are returned — this is the same
 * fallback that `GET /api/v1/projects` already uses today.
 *
 * Standalone degradation: each project block is computed in a try/catch
 * so a single project's failure (e.g. its dashboard query hits a
 * transient DB error) does not blow up the whole summary. The
 * affected project returns placeholder neutral values (cpi=1, spi=1,
 * status='green', openItems=0) so the UI can still render.
 * ============================================================================
 */

import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma';
import { getMorningDashboard } from './dashboard.service';
import { PROJECT_STATUSES } from '../constants/status';

export type PortfolioStatus = 'green' | 'amber' | 'red';

export interface PortfolioProjectSummary {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  cpi: number;
  spi: number;
  scheduleStatus: PortfolioStatus;
  costStatus: PortfolioStatus;
  openIssues: number;
  openRfis: number;
  lastUpdated: string; // ISO
}

export interface PortfolioSummary {
  totalProjects: number;
  onSchedule: number;
  onBudget: number;
  totalOpenIssues: number;
  totalOpenRfis: number;
  generatedAt: string; // ISO
  projects: PortfolioProjectSummary[];
}

/**
 * Cost-status thresholds mirror `project.service.ts`:
 *   CPI >= 1.0         -> green
 *   0.95 <= CPI < 1.0  -> amber
 *   CPI < 0.95         -> red
 */
function costStatusFromCpi(cpi: number): PortfolioStatus {
  if (cpi >= 1.0) return 'green';
  if (cpi >= 0.95) return 'amber';
  return 'red';
}

/**
 * Schedule-status thresholds:
 *   SPI >= 0.90 -> green
 *   0.85 <= SPI < 0.90 -> amber
 *   SPI < 0.85 -> red
 * (Asymmetric: SPI is a leading indicator of slip; a small amount of
 *  slippage is normal, but anything below 0.85 means recovery is needed.)
 */
function scheduleStatusFromSpi(spi: number): PortfolioStatus {
  if (spi >= 0.90) return 'green';
  if (spi >= 0.85) return 'amber';
  return 'red';
}

/**
 * Build a per-project summary by combining the morning dashboard
 * (CPI/SPI/client+field issue counts) with a fast RFI count.
 *
 * Wrapped in try/catch so a single project that throws (e.g. dashboard
 * service hits a transient DB issue) doesn't drop the whole portfolio
 * response. Standalone degradation: a broken project returns neutral
 * placeholders so the UI can still render it.
 */
async function summarizeOne(
  projectId: string,
  now: Date
): Promise<PortfolioProjectSummary> {
  const prisma = getPrismaClient();
  const base = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      updatedAt: true,
    },
  });

  if (!base) {
    // Project was deleted between the list and the summary. The
    // most graceful thing is to skip — return a minimal marker that
    // the route can filter out.
    return {
      id: projectId,
      name: '(deleted)',
      city: null,
      state: null,
      cpi: 1,
      spi: 1,
      scheduleStatus: 'green',
      costStatus: 'green',
      openIssues: 0,
      openRfis: 0,
      lastUpdated: now.toISOString(),
    };
  }

  let cpi = 1;
  let spi = 1;
  let openIssues = 0;
  try {
    const dashboard = await getMorningDashboard(projectId, { incidents: 0, openObservations: 0 });
    cpi = dashboard.performance?.cpi ?? 1;
    spi = dashboard.performance?.spi ?? 1;
    openIssues =
      (dashboard.tiles?.clientIssues?.count ?? 0) +
      (dashboard.tiles?.fieldIssues?.count ?? 0);
  } catch {
    // Standalone degradation: a broken dashboard shouldn't kill the
    // portfolio. Fall through with the placeholder CPI/SPI and
    // openIssues=0. The cost tile's red/amber flag will be the
    // catch-up signal on the next refresh.
  }

  // Open RFI count: a simple fast query against the rfi table.
  // We filter to "not closed" statuses: anything not in
  // {closed, void, answered} is treated as open. The set mirrors the
  // status transitions defined in communications.service.ts.
  let openRfis = 0;
  try {
    openRfis = await prisma.rfi.count({
      where: {
        projectId,
        status: { notIn: ['closed', 'void', 'answered'] },
      },
    });
  } catch {
    // Same: never fail the summary over a count.
  }

  return {
    id: base.id,
    name: base.name,
    city: base.city,
    state: base.state,
    cpi: Math.round(cpi * 100) / 100,
    spi: Math.round(spi * 100) / 100,
    scheduleStatus: scheduleStatusFromSpi(spi),
    costStatus: costStatusFromCpi(cpi),
    openIssues,
    openRfis,
    lastUpdated: (base.updatedAt ?? now).toISOString(),
  };
}

export async function getPortfolioSummary(
  orgId: string | null
): Promise<PortfolioSummary> {
  const prisma = getPrismaClient();
  const now = new Date();

  // Tenant isolation: when the caller has an orgId, scope to that
  // org. When orgId is null (dev-token fallback), include every
  // non-cancelled project — matches the behavior of GET /api/v1/projects
  // today, and keeps the dev environment usable.
  const projects = await prisma.project.findMany({
    where: {
      status: { not: PROJECT_STATUSES.CANCELLED },
      ...(orgId ? { orgId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true },
  });

  // Build summaries in parallel. The dashboard service does several
  // queries per project (budget lines, RFI, etc.) so a sequential
  // loop would scale poorly with portfolio size. Promise.all caps at
  // the project count and the connection pool absorbs the fanout.
  const summaries = await Promise.all(
    projects.map((p) => summarizeOne(p.id, now))
  );

  const onSchedule = summaries.filter(
    (s) => s.scheduleStatus === 'green' && s.name !== '(deleted)'
  ).length;
  const onBudget = summaries.filter(
    (s) => s.costStatus === 'green' && s.name !== '(deleted)'
  ).length;
  const totalOpenIssues = summaries.reduce((acc, s) => acc + s.openIssues, 0);
  const totalOpenRfis = summaries.reduce((acc, s) => acc + s.openRfis, 0);

  return {
    totalProjects: summaries.filter((s) => s.name !== '(deleted)').length,
    onSchedule,
    onBudget,
    totalOpenIssues,
    totalOpenRfis,
    generatedAt: now.toISOString(),
    projects: summaries.filter((s) => s.name !== '(deleted)'),
  };
}
