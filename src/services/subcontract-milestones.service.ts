/**
 * subcontract-milestones.service.ts
 * ============================================================================
 * Sprint 9 Task 9. Subcontract milestones link the SOV (Schedule of
 * Values) line items in a subcontract to planned dates that feed
 * both the Gantt chart and the billing module. The construction
 * industry runs on milestone-based payment — a contractor bills
 * when "foundation complete" or "rough-in 50%" hits, not on hours
 * logged. This service is the bridge.
 *
 * Architectural notes:
 * - A milestone can be `linkedActivityId`-bound to a schedule
 *   activity. When that activity's planned date moves, the
 *   milestone moves with it (one-way sync).
 * - `billingTrigger=true` means completing the milestone
 *   generates a draft invoice line. We don't generate the
 *   invoice here — billing.service is the source of truth for
 *   that, and it calls back into us via the event log.
 * - Status flow: pending → in_progress → completed | cancelled.
 *   actualDate is set on completion.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';

async function logUnifiedChange(args: {
  projectId: string;
  userId: string;
  module: string;
  changeType: string;
  description: string;
  affectedRecordId?: string;
  affectedRecordType?: string;
}) {
  const prisma = getPrismaClient();
  await prisma.unifiedChangeLog.create({
    data: {
      projectId: args.projectId,
      module: args.module,
      changeType: args.changeType,
      description: args.description,
      affectedRecordId: args.affectedRecordId,
      affectedRecordType: args.affectedRecordType,
      changedBy: args.userId,
      changedAt: new Date(),
    },
  });
}

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface SubcontractMilestoneInput {
  subcontractId: string;
  name: string;
  description?: string;
  plannedDate: string | Date;
  linkedActivityId?: string;
  billingTrigger?: boolean;
}

export class SubcontractMilestoneValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubcontractMilestoneValidationError';
  }
}

export class SubcontractMilestoneNotFoundError extends Error {
  constructor(id: string) {
    super(`Subcontract milestone ${id} not found`);
    this.name = 'SubcontractMilestoneNotFoundError';
  }
}

function toDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function validate(input: SubcontractMilestoneInput) {
  if (!input.subcontractId) throw new SubcontractMilestoneValidationError('subcontractId is required');
  if (!input.name || !input.name.trim()) throw new SubcontractMilestoneValidationError('name is required');
  const planned = toDate(input.plannedDate);
  if (!planned) throw new SubcontractMilestoneValidationError('plannedDate must be a valid date');
}

export async function listMilestonesForSubcontract(subcontractId: string) {
  const prisma = getPrismaClient();
  return prisma.subcontractMilestone.findMany({
    where: { subcontractId },
    orderBy: { plannedDate: 'asc' },
  });
}

export async function listMilestonesForProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.subcontractMilestone.findMany({
    where: { subcontract: { projectId } },
    orderBy: { plannedDate: 'asc' },
  });
}

export async function createMilestone(
  input: SubcontractMilestoneInput,
  userId: string
) {
  validate(input);
  const prisma = getPrismaClient();
  // Verify the subcontract exists — better to fail loudly here
  // than to let the FK violation bubble up.
  const sub = await prisma.subcontract.findUnique({ where: { id: input.subcontractId } });
  if (!sub) throw new SubcontractMilestoneValidationError('subcontract not found');
  const milestone = await prisma.subcontractMilestone.create({
    data: {
      subcontractId: input.subcontractId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      plannedDate: toDate(input.plannedDate)!,
      linkedActivityId: input.linkedActivityId || null,
      billingTrigger: input.billingTrigger ?? false,
    },
  });
  await logUnifiedChange({
    projectId: sub.projectId,
    userId,
    module: 'subcontracts',
    changeType: 'milestone_created',
    description: `Milestone "${milestone.name}" added`,
    affectedRecordId: milestone.id,
    affectedRecordType: 'subcontract_milestone',
  });
  return milestone;
}

export async function updateMilestone(
  id: string,
  patch: Partial<SubcontractMilestoneInput> & {
    status?: MilestoneStatus;
    actualDate?: string | Date | null;
  },
  userId: string
) {
  const prisma = getPrismaClient();
  const existing = await prisma.subcontractMilestone.findUnique({
    where: { id },
    include: { subcontract: true },
  });
  if (!existing) throw new SubcontractMilestoneNotFoundError(id);

  const data: any = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.plannedDate !== undefined) {
    const planned = toDate(patch.plannedDate);
    if (!planned) throw new SubcontractMilestoneValidationError('plannedDate must be a valid date');
    data.plannedDate = planned;
  }
  if (patch.linkedActivityId !== undefined) data.linkedActivityId = patch.linkedActivityId || null;
  if (patch.billingTrigger !== undefined) data.billingTrigger = !!patch.billingTrigger;
  if (patch.status !== undefined) {
    const allowed: MilestoneStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!allowed.includes(patch.status)) {
      throw new SubcontractMilestoneValidationError(`status must be one of ${allowed.join(', ')}`);
    }
    data.status = patch.status;
    // Auto-set actualDate on completion if caller didn't set it
    if (patch.status === 'completed' && patch.actualDate === undefined) {
      data.actualDate = new Date();
    }
  }
  if (patch.actualDate !== undefined) {
    data.actualDate = patch.actualDate === null ? null : toDate(patch.actualDate);
  }
  const updated = await prisma.subcontractMilestone.update({ where: { id }, data });
  await logUnifiedChange({
    projectId: existing.subcontract.projectId,
    userId,
    module: 'subcontracts',
    changeType: 'milestone_updated',
    description: `Milestone "${updated.name}" updated`,
    affectedRecordId: id,
    affectedRecordType: 'subcontract_milestone',
  });
  return updated;
}

export async function deleteMilestone(id: string, userId: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.subcontractMilestone.findUnique({
    where: { id },
    include: { subcontract: true },
  });
  if (!existing) throw new SubcontractMilestoneNotFoundError(id);
  await prisma.subcontractMilestone.delete({ where: { id } });
  await logUnifiedChange({
    projectId: existing.subcontract.projectId,
    userId,
    module: 'subcontracts',
    changeType: 'milestone_deleted',
    description: `Milestone "${existing.name}" deleted`,
    affectedRecordId: id,
    affectedRecordType: 'subcontract_milestone',
  });
  return { id };
}

/**
 * Sync from schedule activity: when an activity's planned date
 * moves, push the linked milestone forward. Best-effort: this is
 * a one-way sync. If the milestone has already been completed
 * (actualDate set), we do not regress it.
 */
export async function syncFromActivity(
  activityId: string,
  newPlannedDate: Date
): Promise<number> {
  const prisma = getPrismaClient();
  const milestones = await prisma.subcontractMilestone.findMany({
    where: { linkedActivityId: activityId, actualDate: null },
  });
  if (milestones.length === 0) return 0;
  await prisma.subcontractMilestone.updateMany({
    where: { id: { in: milestones.map((m) => m.id) } },
    data: { plannedDate: newPlannedDate },
  });
  return milestones.length;
}
