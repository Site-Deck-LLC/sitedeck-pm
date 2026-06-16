import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  // Row counts in the benchmark schema (seed data from 2026-06-12)
  const tables = [
    'dfows', 'dfow_hold_points', 'dfow_witness_points',
    'inspection_records', 'inspection_field_values', 'inspection_record_saves',
    'inspection_templates', 'form_fields',
    'ncrs', 'daily_qc_reports', 'quality_report_packages',
    'torque_records', 'torque_connections',
  ];
  console.log('=== benchmark schema row counts ===');
  for (const t of tables) {
    const r: any[] = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as n FROM benchmark."${t}"`);
    console.log(`  benchmark.${t}: ${r[0].n}`);
  }

  // And the PM public.projects table
  console.log('\n=== public schema (PM) project data ===');
  const projects: any[] = await p.$queryRawUnsafe(`SELECT id, name, city, state, status, created_at FROM public.projects ORDER BY created_at DESC LIMIT 10`);
  console.log(`  public.projects count: ${projects.length}`);
  for (const p of projects) console.log(`    ${p.id}  ${p.name}  (${p.city}, ${p.state})  status=${p.status}`);

  await p.$disconnect();
}
main();
