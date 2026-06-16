const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const migrationName = process.argv[2];
  if (!migrationName) {
    console.error('Usage: node mark-applied.js <migration_name>');
    process.exit(1);
  }
  await p.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     SELECT gen_random_uuid()::text, 'manual', NOW(), $1, NULL, NULL, NOW(), 1
     WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1)`,
    migrationName
  );
  console.log('Marked applied:', migrationName);
  await p.$disconnect();
})();
