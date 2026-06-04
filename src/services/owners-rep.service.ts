import { Issue } from '@prisma/client';
import { ROLES, Role } from '../constants/roles';
import { RFI_STATUSES, SUBMITTAL_STATUSES } from '../constants/communications';
import { getPrismaClient } from '../lib/prisma';
import {
  DashboardTile,
  getClientIssuesTileStatus,
  getFieldIssuesTileStatus,
  getMaterialsTileStatus,
  getSafetyTileStatus,
  getScheduleTileStatus,
  SafetyData,
} from './dashboard.service';
import { getIssuesByType } from './integration.service';

export interface OwnersRepDashboard {
  projectId: string;
  generatedAt: Date;
  tiles: {
    safety: DashboardTile;
    schedule: DashboardTile;
    materials: DashboardTile;
    clientIssues: DashboardTile;
    fieldIssues: DashboardTile;
  };
}

export interface OwnersRepRfiSummary {
  projectId: string;
  totalRfis: number;
  openRfis: number;
  answeredRfis: number;
  closedRfis: number;
  overdueRfis: number;
  recentRfis: {
    rfiNumber: string;
    subject: string;
    status: string;
    submittedAt: Date | null;
  }[];
}

export interface OwnersRepSubmittalSummary {
  projectId: string;
  totalSubmittals: number;
  pendingSubmittals: number;
  approvedSubmittals: number;
  rejectedSubmittals: number;
  underReviewSubmittals: number;
  recentSubmittals: {
    submittalNumber: string;
    title: string;
    status: string;
    submittedAt: Date | null;
  }[];
}

export interface OwnersRepProjectSummary {
  projectId: string;
  projectName: string;
  dashboard: OwnersRepDashboard;
  issues: {
    total: number;
    open: number;
    highPriority: number;
    items: Issue[];
  };
  rfiStatus: OwnersRepRfiSummary;
  submittalStatus: OwnersRepSubmittalSummary;
}

const PRIORITY_WEIGHT: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function sortIssuesByPriorityDesc(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    const aWeight = PRIORITY_WEIGHT[a.priority] ?? 0;
    const bWeight = PRIORITY_WEIGHT[b.priority] ?? 0;
    if (aWeight !== bWeight) {
      return bWeight - aWeight;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function getOwnersRepDashboard(
  projectId: string,
  safetyData: SafetyData
): Promise<OwnersRepDashboard> {
  const prisma = getPrismaClient();

  const activities = await prisma.scheduleActivity.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      status: true,
      isCritical: true,
      totalFloat: true,
    },
  });

  const safetyTile = getSafetyTileStatus(safetyData);
  const scheduleTile = getScheduleTileStatus(activities);
  const materialsTile = await getMaterialsTileStatus(projectId);
  const clientIssuesTile = await getClientIssuesTileStatus(projectId);
  const fieldIssuesTile = await getFieldIssuesTileStatus(projectId);

  return {
    projectId,
    generatedAt: new Date(),
    tiles: {
      safety: safetyTile,
      schedule: scheduleTile,
      materials: materialsTile,
      clientIssues: clientIssuesTile,
      fieldIssues: fieldIssuesTile,
    },
  };
}

export async function getOwnersRepIssues(projectId: string): Promise<Issue[]> {
  const issues = await getIssuesByType(projectId, 'client_issue');
  return sortIssuesByPriorityDesc(issues);
}

export async function getOwnersRepRfiStatus(
  projectId: string
): Promise<OwnersRepRfiSummary> {
  const prisma = getPrismaClient();
  const rfis = await prisma.rfi.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  const totalRfis = rfis.length;
  const openRfis = rfis.filter(
    (r) =>
      r.status === RFI_STATUSES.SUBMITTED || r.status === RFI_STATUSES.UNDER_REVIEW
  ).length;
  const answeredRfis = rfis.filter(
    (r) => r.status === RFI_STATUSES.ANSWERED
  ).length;
  const closedRfis = rfis.filter(
    (r) => r.status === RFI_STATUSES.CLOSED
  ).length;

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const overdueRfis = rfis.filter((r) => {
    const isOpen =
      r.status === RFI_STATUSES.SUBMITTED ||
      r.status === RFI_STATUSES.UNDER_REVIEW;
    const submittedAt = r.submittedAt ? new Date(r.submittedAt) : null;
    return isOpen && submittedAt !== null && submittedAt < fourteenDaysAgo;
  }).length;

  const recentRfis = rfis.slice(0, 5).map((r) => ({
    rfiNumber: r.rfiNumber,
    subject: r.subject,
    status: r.status,
    submittedAt: r.submittedAt,
  }));

  return {
    projectId,
    totalRfis,
    openRfis,
    answeredRfis,
    closedRfis,
    overdueRfis,
    recentRfis,
  };
}

export async function getOwnersRepSubmittalStatus(
  projectId: string
): Promise<OwnersRepSubmittalSummary> {
  const prisma = getPrismaClient();
  const submittals = await prisma.submittal.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  const totalSubmittals = submittals.length;
  const pendingSubmittals = submittals.filter(
    (s) => s.status === SUBMITTAL_STATUSES.PENDING
  ).length;
  const approvedSubmittals = submittals.filter(
    (s) => s.status === SUBMITTAL_STATUSES.APPROVED
  ).length;
  const rejectedSubmittals = submittals.filter(
    (s) => s.status === SUBMITTAL_STATUSES.REJECTED
  ).length;
  const underReviewSubmittals = submittals.filter(
    (s) => s.status === SUBMITTAL_STATUSES.UNDER_REVIEW
  ).length;

  const recentSubmittals = submittals.slice(0, 5).map((s) => ({
    submittalNumber: s.submittalNumber,
    title: s.title,
    status: s.status,
    submittedAt: s.submittedAt,
  }));

  return {
    projectId,
    totalSubmittals,
    pendingSubmittals,
    approvedSubmittals,
    rejectedSubmittals,
    underReviewSubmittals,
    recentSubmittals,
  };
}

export function canAccessOwnersRepPortal(userRole: Role): boolean {
  return userRole === ROLES.OWNERS_REP;
}

export async function getOwnersRepProjectSummary(
  projectId: string,
  safetyData: SafetyData
): Promise<OwnersRepProjectSummary> {
  const prisma = getPrismaClient();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const [dashboard, issues, rfiStatus, submittalStatus] = await Promise.all([
    getOwnersRepDashboard(projectId, safetyData),
    getOwnersRepIssues(projectId),
    getOwnersRepRfiStatus(projectId),
    getOwnersRepSubmittalStatus(projectId),
  ]);

  const openStatuses = ['open', 'in_progress'];
  const open = issues.filter((i) => openStatuses.includes(i.status)).length;
  const highPriority = issues.filter((i) => i.priority === 'high').length;

  return {
    projectId,
    projectName: project.name,
    dashboard,
    issues: {
      total: issues.length,
      open,
      highPriority,
      items: issues,
    },
    rfiStatus,
    submittalStatus,
  };
}
