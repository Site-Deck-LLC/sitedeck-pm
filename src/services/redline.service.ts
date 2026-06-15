/**
 * Redline Service — Field redline capture workflow
 * ============================================================================
 * Sprint 9 Task 2. Field users submit markups against IFC drawings;
 * the PM reviews them and decides: escalate to RFI, accept as field
 * decision, or mark incorporated. Each decision has a downstream
 * effect (RFI creation, change-log entry, drawing-revision flag).
 *
 * Standalone degradation: every external side effect (notification,
 * draft RFI creation, change-log entry) is best-effort. A redline
 * submission must always succeed even if downstream services throw.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { createNotificationSafe } from './notifications.service';

export type RedlineType =
  | 'conflict'
  | 'clarification'
  | 'as_built_deviation'
  | 'field_decision'
  | 'rfi_required';

export type RedlineStatus =
  | 'pending'
  | 'reviewed'
  | 'escalated_to_rfi'
  | 'accepted_field_decision'
  | 'incorporated';

export interface SubmitRedlineInput {
  projectId: string;
  documentId: string;
  revisionId?: string;
  description: string;
  redlineType: RedlineType;
  photoUrl?: string;
  linkedActivityId?: string;
  submittedBy: string;
}

export interface ReviewRedlineDecision {
  decision: 'escalate_rfi' | 'field_decision' | 'incorporate';
  reviewNotes?: string;
  reviewerId: string;
  // Optional: caller can supply a pre-built RFI id to link.
  // Otherwise the service creates a draft RFI.
  draftRfiId?: string;
}

export interface RedlineRow {
  id: string;
  projectId: string;
  documentId: string;
  revisionId: string | null;
  submittedBy: string;
  submittedAt: string;
  description: string;
  redlineType: string;
  photoUrl: string | null;
  linkedRfiId: string | null;
  linkedActivityId: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

const REDLINE_STATUSES: RedlineStatus[] = [
  'pending',
  'reviewed',
  'escalated_to_rfi',
  'accepted_field_decision',
  'incorporated',
];

const REDLINE_TYPES: RedlineType[] = [
  'conflict',
  'clarification',
  'as_built_deviation',
  'field_decision',
  'rfi_required',
];

export class RedlineValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class RedlineNotFoundError extends Error {
  constructor() {
    super('Redline not found');
  }
}

function toRow(r: any): RedlineRow {
  return {
    id: r.id,
    projectId: r.projectId,
    documentId: r.documentId,
    revisionId: r.revisionId,
    submittedBy: r.submittedBy,
    submittedAt: (r.submittedAt instanceof Date ? r.submittedAt : new Date(r.submittedAt)).toISOString(),
    description: r.description,
    redlineType: r.redlineType,
    photoUrl: r.photoUrl,
    linkedRfiId: r.linkedRfiId,
    linkedActivityId: r.linkedActivityId,
    status: r.status,
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt ? (r.reviewedAt instanceof Date ? r.reviewedAt : new Date(r.reviewedAt)).toISOString() : null,
    reviewNotes: r.reviewNotes,
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
    updatedAt: (r.updatedAt instanceof Date ? r.updatedAt : new Date(r.updatedAt)).toISOString(),
  };
}

export async function submitRedline(input: SubmitRedlineInput): Promise<RedlineRow> {
  if (!input.description || input.description.trim().length === 0) {
    throw new RedlineValidationError('description is required');
  }
  if (!input.documentId) {
    throw new RedlineValidationError('documentId is required');
  }
  if (!REDLINE_TYPES.includes(input.redlineType)) {
    throw new RedlineValidationError(`redlineType must be one of: ${REDLINE_TYPES.join(', ')}`);
  }

  const prisma = getPrismaClient();
  // Tenant isolation: document must belong to the project
  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
    select: { projectId: true, name: true, drawingNo: true },
  });
  if (!doc || doc.projectId !== input.projectId) {
    throw new RedlineValidationError('document not found in this project');
  }

  const created = await prisma.drawingRedline.create({
    data: {
      projectId: input.projectId,
      documentId: input.documentId,
      revisionId: input.revisionId ?? null,
      submittedBy: input.submittedBy,
      description: input.description.trim(),
      redlineType: input.redlineType,
      photoUrl: input.photoUrl ?? null,
      linkedActivityId: input.linkedActivityId ?? null,
      status: 'pending',
    },
  });

  // Best-effort notify the PM that a new redline landed.
  // V1: a system broadcast row; Sprint 10 expands to per-PM users.
  try {
    await createNotificationSafe({
      userId: 'broadcast:project-pm',
      kind: 'system',
      title: 'New field redline submitted',
      body: `${input.redlineType.replace(/_/g, ' ')}: ${input.description.slice(0, 100)}`,
      payload: {
        projectId: input.projectId,
        documentId: input.documentId,
        redlineId: created.id,
        event: 'redline_submitted',
        actionUrl: `/projects/${input.projectId}/documents/${input.documentId}/redlines/${created.id}`,
      },
    });
  } catch {
    // best-effort
  }

  return toRow(created);
}

export async function reviewRedline(
  projectId: string,
  redlineId: string,
  decision: ReviewRedlineDecision
): Promise<RedlineRow> {
  if (!['escalate_rfi', 'field_decision', 'incorporate'].includes(decision.decision)) {
    throw new RedlineValidationError(`decision must be one of: escalate_rfi, field_decision, incorporate`);
  }

  const prisma = getPrismaClient();
  const existing = await prisma.drawingRedline.findUnique({ where: { id: redlineId } });
  if (!existing || existing.projectId !== projectId) {
    throw new RedlineNotFoundError();
  }
  if (existing.status !== 'pending' && existing.status !== 'reviewed') {
    throw new RedlineValidationError(`redline already in terminal state: ${existing.status}`);
  }

  // Map the decision to the new status + any side effects
  let newStatus: RedlineStatus = 'reviewed';
  let linkedRfiId: string | null = existing.linkedRfiId;

  if (decision.decision === 'escalate_rfi') {
    newStatus = 'escalated_to_rfi';
    if (decision.draftRfiId) {
      linkedRfiId = decision.draftRfiId;
    } else {
      // Create a draft RFI. Best-effort — the redline update still
      // succeeds even if RFI creation fails (a follow-up is required
      // to backfill linkedRfiId, but the redline status is correct).
      try {
        const rfi = await prisma.rfi.create({
          data: {
            projectId,
            rfiNumber: `RFI-${Date.now().toString(36).toUpperCase()}`,
            subject: `Redline ${existing.id} — ${existing.redlineType}`,
            description: existing.description,
            status: 'draft',
            submittedBy: decision.reviewerId,
            sourceReference: `redline:${existing.id}`,
          },
        });
        linkedRfiId = rfi.id;
      } catch (err) {
        // best-effort
      }
    }
  } else if (decision.decision === 'field_decision') {
    newStatus = 'accepted_field_decision';
    try {
      await prisma.unifiedChangeLog.create({
        data: {
          projectId,
          module: 'drawings',
          changeType: 'redline_field_decision',
          description: `Field decision on redline ${existing.id}: ${existing.description.slice(0, 200)}`,
          affectedRecordId: existing.documentId,
          affectedRecordType: 'document',
          changedBy: decision.reviewerId,
          changedAt: new Date(),
        },
      });
    } catch {
      // best-effort
    }
  } else {
    newStatus = 'incorporated';
  }

  const updated = await prisma.drawingRedline.update({
    where: { id: redlineId },
    data: {
      status: newStatus,
      reviewedBy: decision.reviewerId,
      reviewedAt: new Date(),
      reviewNotes: decision.reviewNotes ?? null,
      linkedRfiId: linkedRfiId ?? null,
    },
  });

  return toRow(updated);
}

export interface GetRedlinesFilters {
  documentId?: string;
  status?: RedlineStatus;
  type?: RedlineType;
  limit?: number;
}

export async function getRedlines(
  projectId: string,
  filters: GetRedlinesFilters = {}
): Promise<RedlineRow[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.drawingRedline.findMany({
    where: {
      projectId,
      ...(filters.documentId ? { documentId: filters.documentId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { redlineType: filters.type } : {}),
    },
    orderBy: { submittedAt: 'desc' },
    take: filters.limit ?? 200,
  });
  return rows.map(toRow);
}

export async function getRedlineById(
  projectId: string,
  redlineId: string
): Promise<RedlineRow | null> {
  const prisma = getPrismaClient();
  const row = await prisma.drawingRedline.findUnique({ where: { id: redlineId } });
  if (!row || row.projectId !== projectId) return null;
  return toRow(row);
}

/**
 * As-built export — gather the data needed to render the PDF. Returns
 * an empty structure (not a 404) if the project has no documents so
 * the PDF is still rendered and the certification block can be signed.
 */
export interface AsBuiltExportData {
  projectName: string;
  preparedBy: string;
  exportDate: string;
  projectStart: string | null;
  drawings: {
    documentId: string;
    drawingNo: string | null;
    name: string;
    discipline: string;
    currentRevisionNo: number | null;
    ifcReleasedAt: string | null;
    redlines: {
      redlineId: string;
      description: string;
      redlineType: string;
      submittedBy: string;
      submittedAt: string;
      status: string;
      reviewNotes: string | null;
      submittedAfterLock: boolean;
    }[];
  }[];
}

export async function asBuiltExportData(projectId: string): Promise<AsBuiltExportData> {
  const prisma = getPrismaClient();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, startDate: true },
  });
  const projectName = project?.name ?? `Project ${projectId}`;
  const projectStart = project?.startDate
    ? (project.startDate instanceof Date ? project.startDate : new Date(project.startDate)).toISOString()
    : null;

  const documents = await prisma.document.findMany({
    where: { projectId },
    include: {
      revisions: {
        orderBy: { revisionNo: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ drawingNo: 'asc' }, { name: 'asc' }],
  });

  const drawings: AsBuiltExportData['drawings'] = [];
  for (const d of documents) {
    const currentRev = d.revisions[0] ?? null;
    const redlines = await prisma.drawingRedline.findMany({
      where: { projectId, documentId: d.id },
      orderBy: { submittedAt: 'asc' },
    });
    const ifcDate = d.ifcReleasedAt
      ? d.ifcReleasedAt instanceof Date
        ? d.ifcReleasedAt
        : new Date(d.ifcReleasedAt)
      : null;
    drawings.push({
      documentId: d.id,
      drawingNo: d.drawingNo ?? null,
      name: d.name,
      discipline: d.discipline,
      currentRevisionNo: currentRev?.revisionNo ?? null,
      ifcReleasedAt: ifcDate ? ifcDate.toISOString() : null,
      redlines: redlines.map((r) => {
        const submittedAt =
          r.submittedAt instanceof Date ? r.submittedAt : new Date(r.submittedAt);
        const submittedAfterLock = Boolean(
          ifcDate && submittedAt.getTime() > ifcDate.getTime()
        );
        return {
          redlineId: r.id,
          description: r.description,
          redlineType: r.redlineType,
          submittedBy: r.submittedBy,
          submittedAt: submittedAt.toISOString(),
          status: r.status,
          reviewNotes: r.reviewNotes ?? null,
          submittedAfterLock,
        };
      }),
    });
  }

  return {
    projectName,
    preparedBy: 'SiteDeck PM', // Replaced at route time with the caller's name
    exportDate: new Date().toISOString(),
    projectStart,
    drawings,
  };
}

/**
 * Legacy stub — kept for back-compat. The real PDF endpoint lives at
 * /api/v1/projects/:id/redlines/as-built-pdf and renders a multi-page
 * drawing record from the data returned by asBuiltExportData().
 */
export async function asBuiltExportStub(projectId: string): Promise<{
  stub: true;
  message: string;
  projectId: string;
}> {
  return {
    stub: true,
    projectId,
    message: 'As-built export coming in Sprint 10',
  };
}
