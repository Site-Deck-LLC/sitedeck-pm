import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  // For each non-empty table in the benchmark schema, show row counts
  const tables: any[] = await p.$queryRawUnsafe(`
    SELECT table_name,
           (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
    FROM (
      SELECT table_name, query_to_xml(format('SELECT count(*) AS cnt FROM benchmark.%I', table_name), false, true, '') as xml_count
      FROM information_schema.tables
      WHERE table_schema = 'benchmark'
    ) t
    ORDER BY row_count DESC NULLS LAST, table_name
  `);
  console.log('=== benchmark schema — all tables + row counts ===');
  for (const t of tables) {
    const n = t.row_count === null ? '?' : t.row_count;
    console.log(`  ${t.table_name}: ${n}`);
  }

  // Sample row from dfows to see if it has columns populated
  console.log('\n=== sample benchmark.dfows columns ===');
  const cols: any[] = await p.$queryRawUnsafe(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'benchmark' AND table_name = 'dfows'
    ORDER BY ordinal_position
  `);
  for (const c of cols) console.log(`  ${c.column_name}: ${c.data_type}`);

  // Also check public.projects for any rows at all
  console.log('\n=== public.projects total rows ===');
  const r: any[] = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as n FROM public.projects`);
  console.log(`  count: ${r[0].n}`);

  // And organizations
  const orgs: any[] = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as n FROM public.organizations`);
  console.log(`  public.organizations count: ${orgs[0].n}`);

  // And any project members
  const pm: any[] = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as n FROM public.project_members`);
  console.log(`  public.project_members count: ${pm[0].n}`);

  await p.$disconnect();
}
main();
