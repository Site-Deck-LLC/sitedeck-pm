import { getPrismaClient } from '../lib/prisma';
import { RFI_STATUSES, SUBMITTAL_STATUSES } from '../constants/communications';

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
  return prisma.rfi.update({
    where: { id },
    data: {
      status: RFI_STATUSES.SUBMITTED,
      submittedAt: new Date(),
    },
  });
}

export async function answerRfi(id: string, responseText: string, answeredBy: string) {
  const prisma = getPrismaClient();
  return prisma.rfi.update({
    where: { id },
    data: {
      status: RFI_STATUSES.ANSWERED,
      responseText,
      answeredAt: new Date(),
      assignedTo: answeredBy,
    },
  });
}

export async function closeRfi(id: string) {
  const prisma = getPrismaClient();
  return prisma.rfi.update({
    where: { id },
    data: {
      status: RFI_STATUSES.CLOSED,
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
  return prisma.submittal.update({
    where: { id },
    data: {
      status: SUBMITTAL_STATUSES.SUBMITTED,
      submittedAt: new Date(),
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

  const updatedDescription = notes
    ? `${submittal.description ?? ''}\n\nReview notes: ${notes}`
    : submittal.description;

  return prisma.submittal.update({
    where: { id },
    data: {
      status: statusMap[decision],
      reviewedBy,
      reviewedAt: new Date(),
      description: updatedDescription,
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
