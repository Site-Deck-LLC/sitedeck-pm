import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const schemas: any[] = await p.$queryRawUnsafe(
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY schema_name"
  );
  console.log('Schemas in connected database:');
  for (const s of schemas) console.log('  ' + s.schema_name);

  // Probe specific known schema names
  for (const name of ['benchmark', 'sitedeck_pm', 'sitedeck', 'public']) {
    try {
      const tables: any[] = await p.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
        name
      );
      console.log(`\n[${name}] tables (${tables.length}):`);
      for (const t of tables.slice(0, 30)) console.log('  ' + t.table_name);
      if (tables.length > 30) console.log(`  ... and ${tables.length - 30} more`);
    } catch (e: any) {
      console.log(`\n[${name}] error: ${e.message?.slice(0, 100)}`);
    }
  }
  await p.$disconnect();
}
main();
