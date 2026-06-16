const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allProjects = await prisma.project.findMany({
    select: { id: true, name: true, latitude: true, longitude: true, city: true, state: true },
  });

  console.log('All projects:');
  for (const p of allProjects) {
    console.log(`  ${p.id}: ${p.name} → lat=${p.latitude}, lng=${p.longitude}, city=${p.city}, state=${p.state}`);
  }

  // Find and update Energy Storage Texas by name pattern
  const energy = allProjects.find(p => p.name.toLowerCase().includes('energy') && p.name.toLowerCase().includes('texas'));
  if (energy) {
    await prisma.project.update({
      where: { id: energy.id },
      data: { latitude: 31.9974, longitude: -102.0779, city: 'Midland', state: 'TX' },
    });
    console.log(`\nUpdated "${energy.name}" → lat=31.9974, lng=-102.0779`);
  } else {
    console.log('\nEnergy Storage Texas project not found.');
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
