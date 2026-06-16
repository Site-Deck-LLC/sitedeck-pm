import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // BEFORE
  console.log('=== BEFORE ===');
  const before = await prisma.project.findMany({
    select: { id: true, name: true, trirTarget: true },
    orderBy: { name: 'asc' },
  });
  before.forEach((p) => {
    console.log(`${p.id}  ${p.name}  trirTarget=${p.trirTarget}`);
  });

  // UPDATES — match by name ILIKE per spec
  const u1 = await prisma.project.updateMany({
    where: {
      OR: [
        { name: { contains: 'BESS', mode: 'insensitive' } },
        { name: { contains: 'Energy', mode: 'insensitive' } },
      ],
    },
    data: { trirTarget: 0.8 },
  });
  console.log(`\nUpdated ${u1.count} project(s) to trirTarget=0.8 (BESS/Energy)`);

  const u2 = await prisma.project.updateMany({
    where: {
      OR: [
        { name: { contains: 'Data Center', mode: 'insensitive' } },
        { name: { contains: 'Virginia', mode: 'insensitive' } },
      ],
    },
    data: { trirTarget: 0.9 },
  });
  console.log(`Updated ${u2.count} project(s) to trirTarget=0.9 (Data Center/Virginia)`);

  const u3 = await prisma.project.updateMany({
    where: {
      OR: [
        { name: { contains: 'Pacific', mode: 'insensitive' } },
        { name: { contains: 'Northwest', mode: 'insensitive' } },
        { name: { contains: 'Communications', mode: 'insensitive' } },
      ],
    },
    data: { trirTarget: 1.0 },
  });
  console.log(`Updated ${u3.count} project(s) to trirTarget=1.0 (Pacific/Northwest/Communications)`);

  const u4 = await prisma.project.updateMany({
    where: {
      OR: [
        { name: { contains: 'Residential', mode: 'insensitive' } },
        { name: { contains: 'Phoenix', mode: 'insensitive' } },
      ],
    },
    data: { trirTarget: 1.2 },
  });
  console.log(`Updated ${u4.count} project(s) to trirTarget=1.2 (Residential/Phoenix)`);

  // AFTER
  console.log('\n=== AFTER ===');
  const after = await prisma.project.findMany({
    select: { id: true, name: true, trirTarget: true },
    orderBy: { name: 'asc' },
  });
  after.forEach((p) => {
    console.log(`${p.id}  ${p.name}  trirTarget=${p.trirTarget}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
