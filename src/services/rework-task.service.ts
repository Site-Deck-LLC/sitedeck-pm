import { getPrismaClient } from '../lib/prisma';

export type ReworkTaskSource = 'ncr' | 'inspection' | 'manual';
export type ReworkTaskStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type ReworkTaskPriority = 'low' | 'medium' | 'high' | 'critical';

const VALID_SOURCES: ReworkTaskSource[] = ['ncr', 'inspection', 'manual'];
const VALID_STATUSES: ReworkTaskStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
const VALID_PRIORITIES: ReworkTaskPriority[] = ['low', 'medium', 'high', 'critical'];

export interface CreateReworkTaskInput {
  projectId: string;
  dfowId?: string | null;
  inspectionRecordId?: string | null;
  ncrId?: string | null;
  source: ReworkTaskSource;
  sourceEventId?: string | null;
  title: string;
  description?: string | null;
  status?: ReworkTaskStatus;
  priority?: ReworkTaskPriority;
  assignedTo?: string | null;
  dueDate?: Date | string | null;
  createdBy?: string;
}

export interface ReworkTaskFilters {
  status?: ReworkTaskStatus | ReworkTaskStatus[];
  source?: ReworkTaskSource | ReworkTaskSource[];
  assignedTo?: string;
}

function normalizeArray<T>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value : [value];
}

function parsePriority(severity?: string | null): ReworkTaskPriority {
  if (!severity) return 'medium';
  const s = severity.toLowerCase();
  if (s.includes('critical')) return 'critical';
  if (s.includes('high')) return 'high';
  if (s.includes('low')) return 'low';
  return 'medium';
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Create a ReworkTask. Idempotent when a matching source identifier is
 * provided (sourceEventId, ncrId, or inspectionRecordId). If a matching
 * task already exists, it is returned unchanged.
 */
export async function createReworkTask(input: CreateReworkTaskInput) {
  const prisma = getPrismaClient();

  if (!input.projectId) {
    throw new Error('projectId is required');
  }
  if (!VALID_SOURCES.includes(input.source)) {
    throw new Error(`Invalid source: ${input.source}`);
  }
  if (!input.title?.trim()) {
    throw new Error('title is required');
  }

  const priority = input.priority || parsePriority(input.priority || 'medium');
  const status = input.status && VALID_STATUSES.includes(input.status) ? input.status : 'open';
  const dueDate = toDate(input.dueDate);

  // Idempotency lookup by any provided external identifier.
  const existing = await findExistingReworkTask(input);
  if (existing) {
    return existing;
  }

  return prisma.reworkTask.create({
    data: {
      projectId: input.projectId,
      dfowId: input.dfowId || null,
      inspectionRecordId: input.inspectionRecordId || null,
      ncrId: input.ncrId || null,
      source: input.source,
      sourceEventId: input.sourceEventId || null,
      title: input.title.trim(),
      description: input.description || null,
      status,
      priority,
      assignedTo: input.assignedTo || null,
      dueDate,
      resolvedAt: status === 'resolved' || status === 'closed' ? new Date() : null,
      createdBy: input.createdBy || 'system',
    },
  });
}

async function findExistingReworkTask(input: CreateReworkTaskInput) {
  const prisma = getPrismaClient();
  const projectId = input.projectId;

  if (input.sourceEventId) {
    const found = await prisma.reworkTask.findFirst({
      where: { projectId, sourceEventId: input.sourceEventId },
    });
    if (found) return found;
  }
  if (input.ncrId) {
    const found = await prisma.reworkTask.findFirst({
      where: { projectId, ncrId: input.ncrId },
    });
    if (found) return found;
  }
  if (input.inspectionRecordId) {
    const found = await prisma.reworkTask.findFirst({
      where: { projectId, inspectionRecordId: input.inspectionRecordId },
    });
    if (found) return found;
  }
  return null;
}

export async function listReworkTasks(projectId: string, filters?: ReworkTaskFilters) {
  const prisma = getPrismaClient();

  const statusFilter = normalizeArray(filters?.status);
  const sourceFilter = normalizeArray(filters?.source);

  return prisma.reworkTask.findMany({
    where: {
      projectId,
      ...(statusFilter ? { status: { in: statusFilter } } : {}),
      ...(sourceFilter ? { source: { in: sourceFilter } } : {}),
      ...(filters?.assignedTo ? { assignedTo: filters.assignedTo } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
  });
}

export async function getReworkTask(id: string) {
  const prisma = getPrismaClient();
  return prisma.reworkTask.findUnique({ where: { id } });
}

export async function updateReworkTaskStatus(id: string, status: ReworkTaskStatus, userId: string) {
  const prisma = getPrismaClient();

  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  if (!userId) {
    throw new Error('userId is required');
  }

  const existing = await prisma.reworkTask.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('ReworkTask not found');
  }

  const resolvedAt = status === 'resolved' || status === 'closed' ? new Date() : null;

  return prisma.reworkTask.update({
    where: { id },
    data: {
      status,
      resolvedAt,
    },
  });
}

export async function assignReworkTask(id: string, assignedTo: string, userId: string) {
  const prisma = getPrismaClient();

  if (!assignedTo) {
    throw new Error('assignedTo is required');
  }
  if (!userId) {
    throw new Error('userId is required');
  }

  const existing = await prisma.reworkTask.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('ReworkTask not found');
  }

  return prisma.reworkTask.update({
    where: { id },
    data: { assignedTo },
  });
}
