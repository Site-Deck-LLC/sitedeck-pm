/**
 * Sprint 14 Task 7 — Provision Jose Vasquez in PM
 * ============================================================================
 * Upserts Jose into the PM org orion-fiber-solutions, sets PM role
 * project_manager on Willow Creek project, and sets Firebase custom claims.
 * Run against production after deploy:
 *   ts-node src/scripts/provision-jose-pm.ts
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { getUserClaims, setUserProjectClaims } from '../services/auth.service';

async function main() {
  const uid = 'YUcAjSkVx6aCvzxBpG9NzIciVFG2';
  const email = 'vasquezj@orionfsl.com';
  const name = 'Jose Vasquez';
  const orgId = 'orion-fiber-solutions';
  const role = 'project_manager';
  const projectIds = ['willow-creek'];

  const prisma = getPrismaClient();

  // Upsert organization membership
  const existingOrgMember = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId, userId: uid } },
  });

  if (existingOrgMember) {
    await prisma.organizationMember.update({
      where: { id: existingOrgMember.id },
      data: {
        email,
        displayName: name,
        role,
        status: 'active',
      },
    });
    console.log(`[provision-jose] Updated OrganizationMember for ${email}`);
  } else {
    await prisma.organizationMember.create({
      data: {
        orgId,
        userId: uid,
        email,
        displayName: name,
        role,
        status: 'active',
        invitedBy: 'script',
      },
    });
    console.log(`[provision-jose] Created OrganizationMember for ${email}`);
  }

  // Upsert project memberships
  for (const projectId of projectIds) {
    const existingMember = await prisma.projectMember.findFirst({
      where: { projectId, userId: uid },
    });
    if (!existingMember) {
      await prisma.projectMember.create({
        data: {
          projectId,
          userId: uid,
          email,
          displayName: name,
          role,
          addedBy: 'script',
          status: 'active',
        },
      });
      console.log(`[provision-jose] Created ProjectMember for ${projectId}`);
    } else {
      console.log(`[provision-jose] ProjectMember for ${projectId} already exists`);
    }
  }

  // Set Firebase custom claims
  const currentClaims = await getUserClaims(uid);
  const mergedProjectIds = Array.from(new Set([...(currentClaims?.projectIds || []), ...projectIds]));
  await setUserProjectClaims(uid, {
    role: role as any,
    orgId,
    projectIds: mergedProjectIds,
  });
  console.log(`[provision-jose] Firebase custom claims set for ${uid}`);

  console.log('[provision-jose] Done.');
}

main().catch((err) => {
  console.error('[provision-jose] Error:', err);
  process.exit(1);
});
