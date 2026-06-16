import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { RFI_STATUSES, SUBMITTAL_STATUSES, MEETING_STATUSES } from '../constants/communications';

interface StatusHistoryEntry {
  status: string;
  changedBy: string;
  changedAt: string;
}

function appendHistory(
  prior: Prisma.JsonValue | null | undefined,
  newStatus: string
): StatusHistoryEntry[] {
  const list: StatusHistoryEntry[] = Array.isArray(prior) ? (prior as unknown as StatusHistoryEntry[]) : [];
  return [
    ...list,
    { status: newStatus, changedBy: 'system', changedAt: new Date().toISOString() },
  ];
}

export interface CreateRfiInput {
  projectId: string;
  subject: string;
  description: string;
  submittedBy: string;
  assignedTo?: string;
  holdOnActivityId?: string;
  sourceReference?: string;
}

export interface CreateSubmittalInput {
  projectId: string;
  title: string;
  description?: string;
  submittedBy: string;
  specSection?: string;
  holdOnActivityId?: string;
}

function generateRfiNumber(sequence: number): string {
  const year = new Date().getFullYear();
  const padded = String(sequence).padStart(4, '0');
  return `RFI-${year}-${padded}`;
}

function generateSubmittalNumber(sequence: number): string {
  const year = new Date().getFullYear();
  const padded = String(sequence).padStart(4, '0');
  return `SUB-${year}-${padded}`;
}

// RFI Log

export async function createRfi(data: CreateRfiInput) {
  const prisma = getPrismaClient();

  // Idempotency: skip if sourceReference already exists for this project
  if (data.sourceReference) {
    const existing = await prisma.rfi.findFirst({
      where: {
        projectId: data.projectId,
        sourceReference: data.sourceReference,
      },
    });
    if (existing) {
      return existing;
    }
  }

  const existingCount = await prisma.rfi.count({
    where: { projectId: data.projectId },
  });
  const rfiNumber = generateRfiNumber(existingCount + 1);

  return prisma.rfi.create({
    data: {
      projectId: data.projectId,
      rfiNumber,
      subject: data.subject,
      description: data.description,
      status: RFI_STATUSES.DRAFT,
      submittedBy: data.submittedBy,
      assignedTo: data.assignedTo,
      holdOnActivityId: data.holdOnActivityId,
      sourceReference: data.sourceReference,
    },
  });
}

export async function getRfiById(id: string) {
  const prisma = getPrismaClient();
  return prisma.rfi.findUnique({
    where: { id },
  });
}

export async function getRfiByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.rfi.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function submitRfi(id: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.rfi.findUnique({ where: { id } });
  if (!existing) throw new Error('RFI not found');
  const history = appendHistory(existing.statusHistory, RFI_STATUSES.SUBMITTED);
  const updated = await prisma.rfi.update({
    where: { id },
    data: {
      status: RFI_STATUSES.SUBMITTED,
      submittedAt: new Date(),
      statusHistory: history as unknown as Prisma.InputJsonValue,
      ballInCourt: existing.assignedTo || 'EOR',
    },
  });
  // Notification: when an RFI is submitted and the ball is in
  // someone else's court, that person gets a bell. We treat
  // assignedTo as the recipient unless it's empty (unassigned
  // RFIs have no one to ping).
  if (updated.assignedTo) {
    const { createNotificationSafe } = await import('./notifications.service');
    await createNotificationSafe({
      userId: updated.assignedTo,
      kind: 'rfi_assigned',
      title: `RFI ${updated.rfiNumber} needs your response`,
      body: updated.subject,
      payload: { projectId: updated.projectId, rfiId: updated.id, rfiNumber: updated.rfiNumber },
    });
  }
  return updated;
}

export async function answerRfi(id: string, responseText: string, answeredBy: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.rfi.findUnique({ where: { id } });
  if (!existing) throw new Error('RFI not found');
  const history = appendHistory(existing.statusHistory, RFI_STATUSES.ANSWERED);
  const updated = await prisma.rfi.update({
    where: { id },
    data: {
      status: RFI_STATUSES.ANSWERED,
      responseText,
      answeredAt: new Date(),
      assignedTo: answeredBy,
      ballInCourt: 'PM',
      statusHistory: history as unknown as Prisma.InputJsonValue,
    },
  });
  // Notification: the original submitter gets a "your RFI was
  // answered" bell. We use submittedBy as the recipient.
  if (existing.submittedBy && existing.submittedBy !== answeredBy) {
    const { createNotificationSafe } = await import('./notifications.service');
    await createNotificationSafe({
      userId: existing.submittedBy,
      kind: 'rfi_answered',
      title: `RFI ${updated.rfiNumber} was answered`,
      body: updated.subject,
      payload: { projectId: updated.projectId, rfiId: updated.id, rfiNumber: updated.rfiNumber },
    });
  }
  return updated;
}

export async function closeRfi(id: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.rfi.findUnique({ where: { id } });
  if (!existing) throw new Error('RFI not found');
  const history = appendHistory(existing.statusHistory, RFI_STATUSES.CLOSED);
  return prisma.rfi.update({
    where: { id },
    data: {
      status: RFI_STATUSES.CLOSED,
      statusHistory: history as unknown as Prisma.InputJsonValue,
    },
  });
}

export interface UpdateRfiInput {
  ballInCourt?: string | null;
  status?: string;
  assignedTo?: string | null;
  responseText?: string | null;
}

export async function updateRfi(id: string, data: UpdateRfiInput) {
  const prisma = getPrismaClient();
  const existing = await prisma.rfi.findUnique({ where: { id } });
  if (!existing) throw new Error('RFI not found');

  const newStatus = data.status && data.status !== existing.status ? data.status : null;
  const history = newStatus ? appendHistory(existing.statusHistory, newStatus) : existing.statusHistory;

  return prisma.rfi.update({
    where: { id },
    data: {
      ballInCourt: data.ballInCourt !== undefined ? data.ballInCourt : undefined,
      assignedTo: data.assignedTo !== undefined ? data.assignedTo : undefined,
      responseText: data.responseText !== undefined ? data.responseText : undefined,
      status: newStatus || undefined,
      statusHistory: history as unknown as Prisma.InputJsonValue,
    },
  });
}

export interface RfiPdfData {
  rfiNumber: string;
  subject: string;
  description: string;
  status: string;
  submittedBy: string;
  submittedAt: Date | null;
  responseText: string | null;
  answeredAt: Date | null;
  projectName: string;
}

export async function getRfiPdfData(id: string): Promise<RfiPdfData> {
  const prisma = getPrismaClient();
  const rfi = await prisma.rfi.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!rfi) {
    throw new Error('RFI not found');
  }

  return {
    rfiNumber: rfi.rfiNumber,
    subject: rfi.subject,
    description: rfi.description,
    status: rfi.status,
    submittedBy: rfi.submittedBy,
    submittedAt: rfi.submittedAt,
    responseText: rfi.responseText,
    answeredAt: rfi.answeredAt,
    projectName: rfi.project.name,
  };
}

// Submittal Register

export async function createSubmittal(data: CreateSubmittalInput) {
  const prisma = getPrismaClient();
  const existingCount = await prisma.submittal.count({
    where: { projectId: data.projectId },
  });
  const submittalNumber = generateSubmittalNumber(existingCount + 1);

  return prisma.submittal.create({
    data: {
      projectId: data.projectId,
      submittalNumber,
      title: data.title,
      description: data.description,
      status: SUBMITTAL_STATUSES.PENDING,
      specSection: data.specSection,
      submittedBy: data.submittedBy,
      holdOnActivityId: data.holdOnActivityId,
    },
  });
}

export async function getSubmittalById(id: string) {
  const prisma = getPrismaClient();
  return prisma.submittal.findUnique({
    where: { id },
  });
}

export async function getSubmittalsByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.submittal.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function submitSubmittal(id: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.submittal.findUnique({ where: { id } });
  if (!existing) throw new Error('Submittal not found');
  const history = appendHistory(existing.statusHistory, SUBMITTAL_STATUSES.SUBMITTED);
  return prisma.submittal.update({
    where: { id },
    data: {
      status: SUBMITTAL_STATUSES.SUBMITTED,
      submittedAt: new Date(),
      statusHistory: history as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function reviewSubmittal(
  id: string,
  decision: 'approved' | 'rejected' | 'revision_required',
  reviewedBy: string,
  notes?: string
) {
  const prisma = getPrismaClient();
  const statusMap = {
    approved: SUBMITTAL_STATUSES.APPROVED,
    rejected: SUBMITTAL_STATUSES.REJECTED,
    revision_required: SUBMITTAL_STATUSES.REVISION_REQUIRED,
  };

  const submittal = await prisma.submittal.findUnique({ where: { id } });
  if (!submittal) {
    throw new Error('Submittal not found');
  }

  const history = appendHistory(submittal.statusHistory, statusMap[decision]);

  return prisma.submittal.update({
    where: { id },
    data: {
      status: statusMap[decision],
      reviewedBy,
      reviewedAt: new Date(),
      reviewComments: notes ?? null,
      statusHistory: history as unknown as Prisma.InputJsonValue,
    },
  });
}

export interface SubmittalPdfData {
  submittalNumber: string;
  title: string;
  description: string | null;
  status: string;
  specSection: string | null;
  submittedBy: string;
  submittedAt: Date | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  projectName: string;
}

export async function getSubmittalPdfData(id: string): Promise<SubmittalPdfData> {
  const prisma = getPrismaClient();
  const submittal = await prisma.submittal.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!submittal) {
    throw new Error('Submittal not found');
  }

  return {
    submittalNumber: submittal.submittalNumber,
    title: submittal.title,
    description: submittal.description,
    status: submittal.status,
    specSection: submittal.specSection,
    submittedBy: submittal.submittedBy,
    submittedAt: submittal.submittedAt,
    reviewedBy: submittal.reviewedBy,
    reviewedAt: submittal.reviewedAt,
    projectName: submittal.project.name,
  };
}

// ── Meeting Minutes ──

export interface MeetingAttendee {
  name: string;
  role?: string;
}

export interface MeetingActionItem {
  description: string;
  assignee?: string;
  dueDate?: string; // ISO date
  status?: 'open' | 'in_progress' | 'closed';
}

export interface CreateMeetingInput {
  projectId: string;
  title: string;
  meetingDate: Date;
  location?: string;
  facilitator?: string;
  attendees?: MeetingAttendee[];
  agenda?: string[];
  minutes?: string;
  actionItems?: MeetingActionItem[];
  createdBy: string;
  status?: 'draft' | 'published';
}

export interface UpdateMeetingInput {
  title?: string;
  meetingDate?: Date;
  location?: string;
  facilitator?: string;
  attendees?: MeetingAttendee[];
  agenda?: string[];
  minutes?: string;
  actionItems?: MeetingActionItem[];
  status?: 'draft' | 'published';
}

export async function createMeeting(data: CreateMeetingInput) {
  const prisma = getPrismaClient();
  return prisma.meeting.create({
    data: {
      projectId: data.projectId,
      title: data.title,
      meetingDate: data.meetingDate,
      location: data.location,
      facilitator: data.facilitator,
      attendees: data.attendees as any,
      agenda: data.agenda as any,
      minutes: data.minutes,
      actionItems: data.actionItems as any,
      status: data.status ?? MEETING_STATUSES.DRAFT,
      createdBy: data.createdBy,
    },
  });
}

export async function getMeetingsByProject(projectId: string, startDate?: Date, endDate?: Date) {
  const prisma = getPrismaClient();
  return prisma.meeting.findMany({
    where: {
      projectId,
      ...(startDate || endDate
        ? {
            meetingDate: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    },
    orderBy: { meetingDate: 'desc' },
  });
}

export async function getMeetingById(id: string) {
  const prisma = getPrismaClient();
  return prisma.meeting.findUnique({ where: { id } });
}

export async function updateMeeting(id: string, data: UpdateMeetingInput) {
  const prisma = getPrismaClient();
  return prisma.meeting.update({
    where: { id },
    data: {
      title: data.title,
      meetingDate: data.meetingDate,
      location: data.location,
      facilitator: data.facilitator,
      attendees: data.attendees as any,
      agenda: data.agenda as any,
      minutes: data.minutes,
      actionItems: data.actionItems as any,
      status: data.status,
    },
  });
}

export async function updateMeetingActionItemStatus(
  meetingId: string,
  actionItemIndex: number,
  status: 'open' | 'in_progress' | 'closed'
) {
  const prisma = getPrismaClient();
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) {
    throw new Error('Meeting not found');
  }
  const actionItems = (meeting.actionItems as unknown as MeetingActionItem[]) ?? [];
  if (actionItemIndex < 0 || actionItemIndex >= actionItems.length) {
    throw new Error('Action item index out of range');
  }
  actionItems[actionItemIndex] = { ...actionItems[actionItemIndex], status };
  return prisma.meeting.update({
    where: { id: meetingId },
    data: { actionItems: actionItems as any },
  });
}

export async function deleteMeeting(id: string) {
  const prisma = getPrismaClient();
  return prisma.meeting.delete({ where: { id } });
}

export interface MeetingPdfData {
  title: string;
  meetingDate: Date;
  location: string | null;
  facilitator: string | null;
  attendees: MeetingAttendee[];
  agenda: string[];
  minutes: string | null;
  actionItems: MeetingActionItem[];
  status: string;
  projectName: string;
}

export async function getMeetingPdfData(id: string): Promise<MeetingPdfData> {
  const prisma = getPrismaClient();
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!meeting) {
    throw new Error('Meeting not found');
  }
  return {
    title: meeting.title,
    meetingDate: meeting.meetingDate,
    location: meeting.location,
    facilitator: meeting.facilitator,
    attendees: (meeting.attendees as unknown as MeetingAttendee[]) ?? [],
    agenda: (meeting.agenda as unknown as string[]) ?? [],
    minutes: meeting.minutes,
    actionItems: (meeting.actionItems as unknown as MeetingActionItem[]) ?? [],
    status: meeting.status,
    projectName: meeting.project.name,
  };
}


// ── Overdue helpers (used by the morning brief agent) ──

export interface OverdueRfi {
  id: string;
  rfiNumber: string;
  subject: string;
  requiredDate: Date | string | null;
  daysOverdue: number;
  status: string;
}

export async function getOverdueRfis(projectId: string): Promise<OverdueRfi[]> {
  const prisma = getPrismaClient();
  const now = new Date();
  const rfis = await prisma.rfi.findMany({
    where: {
      projectId,
      status: { notIn: ['closed', 'answered'] },
      requiredDate: { not: null, lt: now },
    },
  });
  return rfis.map((r) => ({
    id: r.id,
    rfiNumber: r.rfiNumber,
    subject: r.subject,
    requiredDate: r.requiredDate,
    daysOverdue: r.requiredDate
      ? Math.max(0, Math.ceil((now.getTime() - new Date(r.requiredDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 0,
    status: r.status,
  }));
}

export interface OverdueSubmittal {
  id: string;
  submittalNumber: string;
  title: string;
  requiredDate: Date | string | null;
  daysOverdue: number;
  status: string;
}

export async function getOverdueSubmittals(projectId: string): Promise<OverdueSubmittal[]> {
  const prisma = getPrismaClient();
  const now = new Date();
  const subs = await prisma.submittal.findMany({
    where: {
      projectId,
      status: { notIn: ['approved', 'rejected'] },
      requiredDate: { not: null, lt: now },
    },
  });
  return subs.map((s) => ({
    id: s.id,
    submittalNumber: s.submittalNumber,
    title: s.title,
    requiredDate: s.requiredDate,
    daysOverdue: s.requiredDate
      ? Math.max(0, Math.ceil((now.getTime() - new Date(s.requiredDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 0,
    status: s.status,
  }));
}
