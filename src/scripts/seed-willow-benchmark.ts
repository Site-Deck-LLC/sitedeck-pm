// seed-willow-benchmark.ts — Seed Willow Creek real data in Benchmark DB
// Run: npx ts-node src/scripts/seed-willow-benchmark.ts

import { PrismaClient } from '@prisma/client';

const DB_URL = 'postgresql://sitedeck:EA16G60FLXtOSP1EeNtZyr0V0jH00u@localhost:65432/sitedeck_benchmark';
const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

const PROJECT_BENCH_ID = 'cmqgqwt8o0000rfuy8zyl8uwl';

const DFOWS: Record<string, { id: string; units: string }> = {
  'OTDR Testing': {
    id: 'cmqgqwt900004rfuyb6aeidqx',
    units: 'FJB01A1, FJB01A2, FJB02A1, FJB02A2, FJB03A1, FJB03A2, FJB04A1, FJB04A2, FJB05A1, FJB05A2, FJB06A1, FJB06A2',
  },
  'Fiber Terminations': {
    id: 'cmqgqwt8x0002rfuytdxjtjs5',
    units: 'FJB01A1, FJB01A2, FJB02A1, FJB02A2, FJB03A1, FJB03A2, FJB04A1, FJB04A2, FJB05A1, FJB05A2, FJB06A1, FJB06A2',
  },
  'Splice Enclosures': {
    id: 'cmqgqwt970008rfuy8ye76avj',
    units: 'FJB01A1, FJB01A2, FJB02A1, FJB02A2, FJB03A1, FJB03A2, FJB04A1, FJB04A2, FJB05A1, FJB05A2, FJB06A1, FJB06A2',
  },
  'Conduit Installation': {
    id: 'cmqgqwt930006rfuyv5usc5fr',
    units: 'FJB01A1, FJB01A2, FJB02A1, FJB02A2, FJB03A1, FJB03A2, FJB04A1, FJB04A2, FJB05A1, FJB05A2, FJB06A1, FJB06A2',
  },
  'Cable Pulling': {
    id: 'cmqgqwt9a000arfuy00nl08ug',
    units: 'FJB01A1, FJB01A2, FJB02A1, FJB02A2, FJB03A1, FJB03A2, FJB04A1, FJB04A2, FJB05A1, FJB05A2, FJB06A1, FJB06A2',
  },
};

const OTDR_TEMPLATE_ID = 'cmqgqwt9g000drfuyzt2boxgw';

// Helper to generate a CUID-like ID
function mkId(prefix = 'cw'): string {
  const rand = () => Math.random().toString(36).substring(2, 10);
  return `${prefix}${rand()}${rand()}`;
}

async function main() {
  console.log('🌲 Seeding Willow Creek in Benchmark...');

  // ─── 1. Update DFOW descriptions ───
  for (const [name, data] of Object.entries(DFOWS)) {
    await prisma.$queryRawUnsafe(
      `UPDATE dfows SET description = $1, updated_at = NOW() WHERE id = $2`,
      `Unit references: ${data.units}`,
      data.id
    );
    console.log(`✅ Updated DFOW: ${name}`);
  }

  // ─── 2. Create inspection records for OTDR Testing ───
  // Locked passing records (FJB01A1-FJB03A2)
  const passUnits = ['FJB01A1', 'FJB01A2', 'FJB02A1', 'FJB02A2', 'FJB03A1', 'FJB03A2'];
  const failUnits = ['FJB04A1', 'FJB04A2'];
  const inProgressUnits = ['FJB05A1', 'FJB05A2', 'FJB06A1', 'FJB06A2'];

  // Fetch form field UUIDs for the OTDR template
  const formFieldRows = await prisma.$queryRawUnsafe<{ id: string; field_id: string }[]>(
    `SELECT id, field_id FROM form_fields WHERE template_id = $1`,
    OTDR_TEMPLATE_ID
  );
  const FORM_FIELD_MAP = new Map(formFieldRows?.map(r => [r.field_id, r.id]) ?? []);
  console.log(`📋 Form fields loaded: ${FORM_FIELD_MAP.size}`);

  let createdRecords = 0;

  async function ensureRecord(unit: string, status: string, pct: number, notes: string, lockedAt?: Date) {
    const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM inspection_records WHERE dfow_id = $1 AND unit_reference = $2 LIMIT 1`,
      DFOWS['OTDR Testing'].id,
      unit
    );
    if (existing && existing.length > 0) {
      console.log(`  ℹ️ Skipping ${unit} — already exists`);
      return existing[0].id;
    }
    const recId = mkId('ir');
    if (lockedAt) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO inspection_records (
          id, benchmark_project_id, dfow_id, template_id, unit_reference,
          status, completion_pct, locked_at, notes, created_at, updated_at, initiated_by
        ) VALUES ($1, $2, $3, $4, $5, $6::"InspectionRecordStatus", $7, $8, $9, NOW(), NOW(), $10)`,
        recId,
        PROJECT_BENCH_ID,
        DFOWS['OTDR Testing'].id,
        OTDR_TEMPLATE_ID,
        unit,
        status,
        pct,
        lockedAt,
        notes,
        'system_seed'
      );
    } else {
      await prisma.$queryRawUnsafe(
        `INSERT INTO inspection_records (
          id, benchmark_project_id, dfow_id, template_id, unit_reference,
          status, completion_pct, notes, created_at, updated_at, initiated_by
        ) VALUES ($1, $2, $3, $4, $5, $6::"InspectionRecordStatus", $7, $8, NOW(), NOW(), $9)`,
        recId,
        PROJECT_BENCH_ID,
        DFOWS['OTDR Testing'].id,
        OTDR_TEMPLATE_ID,
        unit,
        status,
        pct,
        notes,
        'system_seed'
      );
    }
    createdRecords++;
    return recId;
  }

  for (const unit of passUnits) {
    const recId = await ensureRecord(
      unit,
      'locked',
      100,
      `OTDR pass — Fiber count: 12, Wavelength: 1310nm/1550nm, Attenuation: 0.18 dB/km, Splice loss: 0.04 dB avg`,
      new Date()
    );
    await createFieldValues(recId, 'pass', FORM_FIELD_MAP, { fiber_count: 12, wavelength: '1310nm/1550nm', attenuation: 0.18, splice_loss: 0.04 });
  }

  for (const unit of failUnits) {
    const recId = await ensureRecord(
      unit,
      'locked',
      100,
      `OTDR fail — Splice loss: 0.38 dB (exceeds 0.3 dB spec)`,
      new Date()
    );
    await createFieldValues(recId, 'fail', FORM_FIELD_MAP, { fiber_count: 12, wavelength: '1310nm/1550nm', attenuation: 0.18, splice_loss: 0.38 });
  }

  for (const unit of inProgressUnits) {
    const recId = await ensureRecord(
      unit,
      'in_progress',
      50,
      `OTDR in progress — Partially filled, awaiting field completion`
    );
  }

  console.log(`✅ Inspection records created: ${createdRecords}`);

  // ─── 3. Create open NCR for FJB04A1 ───
  const ncrId = mkId('nc');
  const failedRecId = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM inspection_records WHERE dfow_id = $1 AND unit_reference = $2 AND status = 'locked' ORDER BY created_at DESC LIMIT 1`,
    DFOWS['OTDR Testing'].id,
    'FJB04A1'
  );

  const existingNcr = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM ncrs WHERE internal_number = $1 LIMIT 1`,
    'NCR-2026-WC-001'
  );
  if (existingNcr && existingNcr.length > 0) {
    console.log(`ℹ️ NCR NCR-2026-WC-001 already exists`);
  } else if (failedRecId && failedRecId.length > 0) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO ncrs (
        id, benchmark_project_id, dfow_id, inspection_record_id,
        internal_number, description, severity, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::"NcrStatus", NOW(), NOW())`,
      ncrId,
      PROJECT_BENCH_ID,
      DFOWS['OTDR Testing'].id,
      failedRecId[0].id,
      'NCR-2026-WC-001',
      'Splice loss on FJB04A1 exceeds specification — 0.38 dB recorded against 0.3 dB maximum',
      'high',
      'open'
    );
    console.log(`✅ Open NCR created: ${ncrId} for FJB04A1`);
  } else {
    console.warn('⚠️ Could not find failed inspection record for FJB04A1 — NCR not created');
  }

  // ─── 4. Verification counts ───
  const counts = await prisma.$queryRawUnsafe<{
    total: number; locked_pass: number; locked_fail: number; in_progress: number; open_ncrs: number;
  }[]>(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'locked' AND notes LIKE '%pass%')::int AS locked_pass,
      COUNT(*) FILTER (WHERE status = 'locked' AND notes LIKE '%fail%')::int AS locked_fail,
      COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress
    FROM inspection_records
    WHERE dfow_id = '${DFOWS['OTDR Testing'].id}'
  `);

  const ncrCounts = await prisma.$queryRawUnsafe<{ open_ncrs: number }[]>(`
    SELECT COUNT(*)::int AS open_ncrs FROM ncrs
    WHERE benchmark_project_id = '${PROJECT_BENCH_ID}' AND status = 'open'
  `);

  console.log('\n📊 Benchmark verification:');
  console.log(`  Inspection records total: ${counts[0]?.total ?? 0}`);
  console.log(`  Locked passing: ${counts[0]?.locked_pass ?? 0}`);
  console.log(`  Locked failing: ${counts[0]?.locked_fail ?? 0}`);
  console.log(`  In progress: ${counts[0]?.in_progress ?? 0}`);
  console.log(`  Open NCRs: ${ncrCounts[0]?.open_ncrs ?? 0}`);
  console.log('\n🎉 Benchmark seed complete.');
}

async function createFieldValues(
  recordId: string,
  result: 'pass' | 'fail',
  fieldMap: Map<string, string>,
  data: { fiber_count: number; wavelength: string; attenuation: number; splice_loss: number }
) {
  const entries: { fieldId: string; text?: string; num?: number; photos?: string[] }[] = [
    { fieldId: 'otdr_trace_photo', photos: ['placeholder.jpg'] },
    { fieldId: 'fiber_id', text: data.fiber_count.toString() },
    { fieldId: 'launch_loss', num: 0.05 },
    { fieldId: 'span_loss', num: parseFloat((data.attenuation * 2).toFixed(2)) },
    { fieldId: 'span_length', num: 1200 },
    { fieldId: 'reflectance', num: -45.0 },
    { fieldId: 'pass_fail', text: result === 'pass' ? 'PASS' : 'FAIL' },
  ];

  for (const e of entries) {
    const formFieldUuid = fieldMap.get(e.fieldId);
    if (!formFieldUuid) {
      console.warn(`  ⚠️ Form field ${e.fieldId} not found — skipping`);
      continue;
    }
    const fvId = mkId('fv');
    await prisma.$queryRawUnsafe(
      `INSERT INTO inspection_field_values (
        id, record_id, field_id, value_text, value_numeric, photo_urls, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      fvId,
      recordId,
      formFieldUuid,
      e.text ?? null,
      e.num ?? null,
      e.photos ? JSON.stringify(e.photos) : null
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
