// Inspect the production DB state for projects, orgs, and members.
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const projects = await p.project.findMany({
    select: { id: true, name: true, createdAt: true, orgId: true, city: true, state: true, status: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`=== projects count: ${projects.length}`);
  projects.forEach((pr) =>
    console.log(`  ${pr.id}  ${pr.name}  status=${pr.status}  org=${pr.orgId}  (${pr.city ?? '?'}, ${pr.state ?? '?'})  createdAt=${pr.createdAt.toISOString()}`)
  );

  const orgs = await p.organization.findMany();
  console.log(`\n=== organizations count: ${orgs.length}`);
  orgs.forEach((o) => console.log(`  ${o.id}  ${o.name}  type=${o.type}  createdBy=${o.createdBy}`));

  const orgMembers = await p.organizationMember.findMany();
  console.log(`\n=== organization_members count: ${orgMembers.length}`);
  orgMembers.forEach((m) =>
    console.log(`  ${m.userId} → org=${m.orgId}  role=${m.role}  status=${m.status}  email=${m.email}`)
  );

  const projectMembers = await p.projectMember.findMany();
  console.log(`\n=== project_members count: ${projectMembers.length}`);
  projectMembers.forEach((m) =>
    console.log(`  ${m.userId} → project=${m.projectId}  role=${m.role}  status=${m.status}`)
  );

  await p.$disconnect();
}

main();
