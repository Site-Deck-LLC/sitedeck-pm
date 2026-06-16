/**
 * Team Management Service
 * ============================================================================
 * Sprint 9 Task 6 + Sprint 11 Task 2.
 *
 * Project-level team management. Sprint 11 wires Firebase custom-claims
 * propagation: when a user is added, their role/orgId/projectIds are
 * set on their Firebase token so the next sign-in picks them up.
 *
 * Standalone degradation: sendWelcomeEmail is best-effort. Firebase
 * claims propagation is best-effort — if firebase-admin is not
 * configured, the ProjectMember record still saves correctly.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { sendWelcomeEmail } from './email.service';
import {
  getOrCreateFirebaseUid,
  getUserClaims,
  setUserProjectClaims,
  addProjectToClaims,
  removeProjectFromClaims,
} from './auth.service';
import { logOpsAction } from '../ops/audit-log';

export interface ProjectMemberRow {
  id: string;
  projectId: string;
  userId: string;
  email: string;
  displayName: string | null;
  role: string;
  addedBy: string;
  addedAt: string;
  status: string;
}

export interface AddMemberInput {
  email: string;
  displayName: string;
  role: string;
}

const VALID_ROLES = [
  'owner_admin',
  'project_manager',
  'superintendent',
  'supervisor',
  'field_crew',
  'subcontractor_pm',
  'subcontractor_super',
  'owners_rep',
  'accountant_ap',
];

export class TeamValidationError extends Error {}
export class DuplicateMemberError extends Error {}

function toRow(r: any): ProjectMemberRow {
  return {
    id: r.id,
    projectId: r.projectId,
    userId: r.userId,
    email: r.email,
    displayName: r.displayName,
    role: r.role,
    addedBy: r.addedBy,
    addedAt: toIso(r.addedAt),
    status: r.status,
  };
}

function toIso(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString();
  if (d instanceof Date) return d.toISOString();
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function validateRole(role: string) {
  if (!VALID_ROLES.includes(role)) {
    throw new TeamValidationError(`role must be one of: ${VALID_ROLES.join(', ')}`);
  }
}

function validateEmail(email: string) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TeamValidationError('valid email is required');
  }
}

/**
 * Derive a stable userId from an email. The actual Firebase UID
 * is minted on first sign-in; this is the V1 placeholder that
 * gives us a unique key for the (projectId, userId) constraint.
 *
 * Sprint 11: we also try to resolve the real Firebase UID. If
 * firebase-admin is configured and the user exists (or is created),
 * the row's userId is the real UID. Otherwise we fall back to the
 * placeholder so the (projectId, userId) constraint still works.
 */
function emailToUserId(email: string): string {
  return `pending:${email.toLowerCase()}`;
}

async function resolveProjectOrgId(projectId: string): Promise<string | null> {
  try {
    const prisma = getPrismaClient();
    const proj = await prisma.project.findUnique({ where: { id: projectId }, select: { orgId: true } });
    return proj?.orgId || null;
  } catch {
    return null;
  }
}

export async function getProjectTeam(projectId: string): Promise<ProjectMemberRow[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.projectMember.findMany({
    where: { projectId, status: { not: 'inactive' } },
    orderBy: { addedAt: 'asc' },
  });
  return rows.map(toRow);
}

export async function addProjectMember(
  projectId: string,
  input: AddMemberInput,
  addedBy: string
): Promise<ProjectMemberRow> {
  validateEmail(input.email);
  validateRole(input.role);

  const prisma = getPrismaClient();

  // Sprint 11: try to resolve the real Firebase UID for this user.
  // Falls back to the email-based placeholder when firebase-admin is
  // not configured (standalone degradation).
  const emailLower = input.email.toLowerCase();
  const firebaseUid = await getOrCreateFirebaseUid(emailLower, input.displayName);
  const userId = firebaseUid || emailToUserId(emailLower);

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (existing && existing.status !== 'inactive') {
    throw new DuplicateMemberError('member already exists in this project');
  }
  let createdOrUpdated;
  if (existing) {
    createdOrUpdated = await prisma.projectMember.update({
      where: { id: existing.id },
      data: {
        email: emailLower,
        displayName: input.displayName,
        role: input.role,
        status: 'invited',
        addedBy,
      },
    });
  } else {
    createdOrUpdated = await prisma.projectMember.create({
      data: {
        projectId,
        userId,
        email: emailLower,
        displayName: input.displayName,
        role: input.role,
        addedBy,
        status: 'invited',
      },
    });
  }

  // Sprint 11: propagate Firebase custom claims. Best-effort — never
  // block the row write. The projectId is added to the user's
  // projectIds claim, and their role is set.
  if (firebaseUid) {
    try {
      const orgId = (await resolveProjectOrgId(projectId)) || 'unknown';
      await addProjectToClaims(firebaseUid, projectId, input.role as any, orgId);
      await logOpsAction({
        action: 'member_added_claims_set',
        performedBy: addedBy,
        targetType: 'project_member',
        targetId: createdOrUpdated.id,
        details: { email: emailLower, projectId, role: input.role },
      });
    } catch (err: any) {
      console.warn('[team] firebase claims propagation failed:', err?.message);
    }
  }

  // Best-effort welcome email
  try {
    await sendWelcomeEmail({
      recipientEmail: input.email,
      displayName: input.displayName,
      projectName: '',
      role: input.role,
      loginLink: process.env.APP_LOGIN_URL || 'https://projects.sitedeck.pro/login',
    });
  } catch {
    // best-effort
  }

  return toRow(createdOrUpdated);
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
  removedBy: string
): Promise<{ removed: boolean }> {
  const prisma = getPrismaClient();
  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!existing) return { removed: false };
  await prisma.projectMember.update({
    where: { id: existing.id },
    data: { status: 'inactive' },
  });

  // Sprint 11: remove the projectId from the user's claims. If this
  // was their last project, drop their role to field_crew (the
  // minimum access role). Skip if userId is the placeholder.
  if (!userId.startsWith('pending:')) {
    try {
      await removeProjectFromClaims(userId, projectId);
      await logOpsAction({
        action: 'member_removed_claims_updated',
        performedBy: removedBy,
        targetType: 'project_member',
        targetId: existing.id,
        details: { email: existing.email, projectId },
      });
    } catch (err: any) {
      console.warn('[team] firebase claims removal failed:', err?.message);
    }
  }

  return { removed: true };
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  newRole: string
): Promise<ProjectMemberRow> {
  validateRole(newRole);
  const prisma = getPrismaClient();
  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!existing) {
    throw new TeamValidationError('member not found in this project');
  }
  const updated = await prisma.projectMember.update({
    where: { id: existing.id },
    data: { role: newRole },
  });

  // Sprint 11: update the user's role claim, preserving orgId and
  // projectIds. Skip if userId is the email-placeholder.
  if (!userId.startsWith('pending:')) {
    try {
      const current = await getUserClaims(userId);
      if (current) {
        await setUserProjectClaims(userId, { ...current, role: newRole as any });
        await logOpsAction({
          action: 'role_updated_claims_set',
          performedBy: userId, // system actor for this op
          targetType: 'project_member',
          targetId: existing.id,
          details: { projectId, newRole },
        });
      }
    } catch (err: any) {
      console.warn('[team] firebase role update failed:', err?.message);
    }
  }

  return toRow(updated);
}

export interface OrganizationRow {
  id: string;
  name: string;
  type: string;
  createdBy: string;
  createdAt: string;
  memberCount?: number;
}

export async function getOrganization(orgId: string): Promise<OrganizationRow | null> {
  const prisma = getPrismaClient();
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return null;
  const memberCount = await prisma.organizationMember.count({
    where: { orgId, status: { not: 'inactive' } },
  });
  return {
    id: org.id,
    name: org.name,
    type: org.type,
    createdBy: org.createdBy,
    createdAt: toIso(org.createdAt),
    memberCount,
  };
}

export async function createOrganization(
  input: { name: string; type: 'contractor' | 'owner' | 'sub' },
  createdBy: string
): Promise<OrganizationRow> {
  if (!input.name || !input.name.trim()) {
    throw new TeamValidationError('name is required');
  }
  if (!['contractor', 'owner', 'sub'].includes(input.type)) {
    throw new TeamValidationError('type must be contractor, owner, or sub');
  }
  const prisma = getPrismaClient();
  const org = await prisma.organization.create({
    data: {
      name: input.name.trim(),
      type: input.type,
      createdBy,
    },
  });
  return {
    id: org.id,
    name: org.name,
    type: org.type,
    createdBy: org.createdBy,
    createdAt: toIso(org.createdAt),
  };
}
