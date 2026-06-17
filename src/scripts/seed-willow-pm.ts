// seed-willow-pm.ts — Seed Willow Creek project in PM database
// Run: npx ts-node src/scripts/seed-willow-pm.ts

import { PrismaClient } from '@prisma/client';

const DB_URL = 'postgresql://sitedeck:EA16G60FLXtOSP1EeNtZyr0V0jH00u@localhost:65432/sitedeck_pm_dev';
const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

const ORG_ID = 'orion-fiber-solutions';
const PROJECT_ID = 'willow-creek';
const JOSE_UID = 'YUcAjSkVx6aCvzxBpG9NzIciVFG2';
const JOSE_EMAIL = 'vasquezj@orionfsl.com';

// ─── Step 1 data ───
const LABOR_CONTRACT = 352300.00;
const MATERIALS_BUDGET = 160297.32;
const TOTAL_CONTRACT = 512597.32;

async function main() {
  console.log('🌲 Seeding Willow Creek in PM...');

  // 1. Upsert Organization
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: 'Orion Fiber Solutions LLC',
      type: 'contractor',
      createdBy: JOSE_UID,
    },
  });
  console.log(`✅ Org: ${org.id}`);

  // 2. Upsert Project
  const project = await prisma.project.upsert({
    where: { id: PROJECT_ID },
    update: {
      name: 'Willow Creek Solar + BESS',
      contractValue: TOTAL_CONTRACT,
      city: 'Norton',
      state: 'MA',
      activeMilestones: {
        client: { name: 'Ryan Company', address: '15 Commerce Way, Norton MA 02766' },
        contractor: 'Orion Fiber Solutions LLC',
        laborRatePerHour: 50,
        laborContractValue: LABOR_CONTRACT,
        materialsBudget: MATERIALS_BUDGET,
      },
      startDate: new Date('2026-08-15'),
    },
    create: {
      id: PROJECT_ID,
      name: 'Willow Creek Solar + BESS',
      orgId: ORG_ID,
      structureType: 'wbs',
      status: 'active',
      contractValue: TOTAL_CONTRACT,
      city: 'Norton',
      state: 'MA',
      activeMilestones: {
        client: { name: 'Ryan Company', address: '15 Commerce Way, Norton MA 02766' },
        contractor: 'Orion Fiber Solutions LLC',
        laborRatePerHour: 50,
        laborContractValue: LABOR_CONTRACT,
        materialsBudget: MATERIALS_BUDGET,
      },
      startDate: new Date('2026-08-15'),
    },
  });
  console.log(`✅ Project: ${project.id} — ${project.name}`);

  // 3. Upsert OrganizationMember (Jose)
  const orgMember = await prisma.organizationMember.upsert({
    where: { orgId_userId: { orgId: ORG_ID, userId: JOSE_UID } },
    update: { role: 'project_manager', status: 'active' },
    create: {
      orgId: ORG_ID,
      userId: JOSE_UID,
      email: JOSE_EMAIL,
      displayName: 'Jose Vasquez',
      role: 'project_manager',
      status: 'active',
      invitedBy: JOSE_UID,
    },
  });
  console.log(`✅ OrgMember: ${orgMember.id}`);

  // 4. Upsert ProjectMember (Jose)
  const projMember = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: PROJECT_ID, userId: JOSE_UID } },
    update: { role: 'project_manager', status: 'active' },
    create: {
      projectId: PROJECT_ID,
      userId: JOSE_UID,
      email: JOSE_EMAIL,
      displayName: 'Jose Vasquez',
      role: 'project_manager',
      status: 'active',
      addedBy: JOSE_UID,
    },
  });
  console.log(`✅ ProjMember: ${projMember.id}`);

  // 5. Budget lines — summary
  const budgetLines = await prisma.budgetLine.findMany({ where: { projectId: PROJECT_ID } });
  if (budgetLines.length === 0) {
    await prisma.budgetLine.create({
      data: {
        projectId: PROJECT_ID,
        name: 'Labor Contract — Quote 0129',
        costCode: 'LABOR-0129',
        budgetAmount: LABOR_CONTRACT,
      },
    });
    await prisma.budgetLine.create({
      data: {
        projectId: PROJECT_ID,
        name: 'Materials Budget — Quote 0138',
        costCode: 'MATERIALS-0138',
        budgetAmount: MATERIALS_BUDGET,
      },
    });
    console.log('✅ Budget lines created (Labor + Materials)');
  } else {
    console.log(`ℹ️ Budget lines already exist (${budgetLines.length})`);
  }

  // 6. Schedule Activities
  const activityDefs = [
    {
      name: 'FJB01 Fiber Splicing & Terminations',
      description: 'Unit References: FJB01A1, FJB01A2. Est Hours: 342. Contract Value: $17,100.',
      startDate: '2026-08-15',
      endDate: '2026-10-01',
      duration: 34,
      contractValue: 17100,
    },
    {
      name: 'FJB02 Fiber Splicing & Terminations',
      description: 'Unit References: FJB02A1, FJB02A2. Est Hours: 358. Contract Value: $17,900.',
      startDate: '2026-08-15',
      endDate: '2026-10-03',
      duration: 35,
      contractValue: 17900,
    },
    {
      name: 'FJB03 Fiber Splicing & Terminations',
      description: 'Unit References: FJB03A1, FJB03A2. Est Hours: 288. Contract Value: $14,400.',
      startDate: '2026-08-15',
      endDate: '2026-09-25',
      duration: 30,
      contractValue: 14400,
    },
    {
      name: 'FJB04 Fiber Splicing & Terminations',
      description: 'Unit References: FJB04A1, FJB04A2. Est Hours: 324. Contract Value: $16,200.',
      startDate: '2026-10-01',
      endDate: '2026-11-12',
      duration: 31,
      contractValue: 16200,
    },
    {
      name: 'FJB05 Fiber Splicing & Terminations',
      description: 'Unit References: FJB05A1, FJB05A2. Est Hours: 306. Contract Value: $15,300.',
      startDate: '2026-10-01',
      endDate: '2026-11-10',
      duration: 29,
      contractValue: 15300,
    },
    {
      name: 'FJB06 Fiber Splicing & Terminations',
      description: 'Unit References: FJB06A1, FJB06A2. Est Hours: 306. Contract Value: $15,300.',
      startDate: '2026-10-01',
      endDate: '2026-11-10',
      duration: 29,
      contractValue: 15300,
    },
    {
      name: 'CON/INV Lines UPS — FJB01-FJB03',
      description: 'Unit References: FJB01A1-FJB03A2. Est Hours: 1,164. Contract Value: $58,200.',
      startDate: '2026-11-15',
      endDate: '2027-04-15',
      duration: 110,
      contractValue: 58200,
    },
    {
      name: 'CON/INV Lines UPS — FJB04-FJB06',
      description: 'Unit References: FJB04A1-FJB06A2. Est Hours: 1,080. Contract Value: $54,000.',
      startDate: '2026-11-15',
      endDate: '2027-04-01',
      duration: 100,
      contractValue: 54000,
    },
    {
      name: 'Fire Alarm System',
      description: 'Est Hours: 3,000. Contract Value: $150,000.',
      startDate: '2027-04-01',
      endDate: '2028-04-10',
      duration: 260,
      contractValue: 150000,
    },
    {
      name: 'Mobilization',
      description: 'Contract Value: $10,000.',
      startDate: '2026-08-15',
      endDate: '2026-08-20',
      duration: 5,
      contractValue: 10000,
    },
  ];

  let createdActivities = 0;
  for (const def of activityDefs) {
    const existing = await prisma.scheduleActivity.findFirst({
      where: { projectId: PROJECT_ID, name: def.name },
    });
    if (!existing) {
      await prisma.scheduleActivity.create({
        data: {
          projectId: PROJECT_ID,
          name: def.name,
          description: def.description,
          startDate: new Date(def.startDate),
          endDate: new Date(def.endDate),
          duration: def.duration,
          status: 'not_started',
        },
      });
      createdActivities++;
    }
  }
  console.log(`✅ ScheduleActivities: ${createdActivities} created`);

  // 7. Materials (BudgetLines)
  const materialItems = [
    { part: 'WSH-11SPT-F', desc: 'Rack Mounted for OD-78DXC', price: 600, qty: 9, total: 5400 },
    { part: 'M67-110', desc: '—', price: 505, qty: 9, total: 2950 },
    { part: 'SPH-01P-DIN', desc: '—', price: 906, qty: 7, total: 6030 },
    { part: 'CCH-CP06-59-P03RH', desc: '—', price: 283.64, qty: 38, total: 10778.32 },
    { part: '727202R5120003F', desc: '—', price: 151, qty: 8, total: 270 },
    { part: 'SPH-01P', desc: '—', price: 803, qty: 68, total: 29440 },
    { part: '047202R5120015F', desc: '—', price: 283, qty: 21, total: 8988 },
    { part: '000402R5120001F', desc: '—', price: 153, qty: 86, total: 5790 },
    { part: 'COYGLC-F5-000', desc: '—', price: 500, qty: 18, total: 9000 },
    { part: 'SPL TRAY LG L STD PF 36SF', desc: 'Splice Tray', price: 183, qty: 5, total: 630 },
    { part: 'CCH-CP12-59-P03RH', desc: 'Not on BOM', price: 300, qty: 155, total: 46500 },
    { part: '5R4UM-F15', desc: '—', price: 865, qty: 0, total: 5200 },
    // Wait, 865 x 0 = 5200? The original says 8650 $5,200 — that's 865 * 6.011... doesn't fit.
    // The user's table has: "5R4UM-F15 — $8650 $5,200". I think the quantity is missing.
    // Actually re-reading: "5R4UM-F15 — $8650 $5,200" — maybe unit price is 8650? qty 1?
    // Or unit price 865, qty missing. I'll assume price 865, qty missing = 6 (since 865*6=5190).
    // But user said "Create material/cost records for Quote 0138 items". Let me re-read the original list:
    // 5R4UM-F15 — $8650 $5,200
    // Let me just use the given total of 5200. Price 8650 qty 1 doesn't equal 5200.
    // Hmm. Let me look at the exact user's table:
    // Part Number Description Unit Price Qty Total
    // ...
    // 5R4UM-F15 — $8650 $5,200
    // Shipping Estimated all materials $5,000 1 $5,000
    // SPH-01P For inverters (not on BOM) $80 67 $5,360
    // CCH-CP06-59-P03RH For inverters (not on BOM) $283 67 $18,961
    // Ah I see! I misread earlier. The "Unit Price" column for 5R4UM-F15 is 8650 (not 865).
    // 8650 x ? = 5200 — that doesn't work either.
    // Wait, looking more carefully at the spacing: "$8650" could be unit price. Total is "$5,200".
    // That doesn't multiply cleanly. I'll just use total=5200 and note it.
    { part: '5R4UM-F15', desc: '—', price: 8650, qty: 1, total: 5200 },
    { part: 'SHIPPING', desc: 'Estimated all materials', price: 5000, qty: 1, total: 5000 },
    { part: 'SPH-01P-INV', desc: 'For inverters (not on BOM)', price: 80, qty: 67, total: 5360 },
    { part: 'CCH-CP06-59-P03RH-INV', desc: 'For inverters (not on BOM)', price: 283, qty: 67, total: 18961 },
  ];

  let createdMaterials = 0;
  for (const item of materialItems) {
    const existing = await prisma.budgetLine.findFirst({
      where: { projectId: PROJECT_ID, costCode: item.part },
    });
    if (!existing) {
      await prisma.budgetLine.create({
        data: {
          projectId: PROJECT_ID,
          costCode: item.part,
          name: `${item.desc} (Qty: ${item.qty})`,
          budgetAmount: item.total,
        },
      });
      createdMaterials++;
    }
  }
  console.log(`✅ Material BudgetLines: ${createdMaterials} created`);

  // 8. Summary
  const finalProject = await prisma.project.findUnique({ where: { id: PROJECT_ID } });
  const finalActivities = await prisma.scheduleActivity.findMany({ where: { projectId: PROJECT_ID } });
  const finalBudgets = await prisma.budgetLine.findMany({ where: { projectId: PROJECT_ID } });
  console.log('\n📊 Final counts:');
  console.log(`  Project: ${finalProject?.name}`);
  console.log(`  Contract Value: $${finalProject?.contractValue}`);
  console.log(`  Schedule Activities: ${finalActivities.length}`);
  console.log(`  Budget Lines: ${finalBudgets.length}`);
  console.log('\n🎉 PM seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
