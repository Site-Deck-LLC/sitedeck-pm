import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const userId = 'seed-system';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function createWbs(projectId: string, items: { code: string; name: string }[]) {
  return prisma.workBreakdownItem.createMany({
    data: items.map((item) => ({
      projectId,
      structureType: 'WBS',
      code: item.code,
      name: item.name,
      level: 1,
    })),
  });
}

async function createActivities(projectId: string, activities: { name: string; start: Date; end: Date; duration: number; wbsCode?: string; isMilestone?: boolean; status?: string; percentComplete?: number }[], wbsMap: Map<string, string>) {
  const created: { id: string; name: string; startDate: Date; endDate: Date; duration: number }[] = [];
  for (const act of activities) {
    const wbsItemId = act.wbsCode ? wbsMap.get(act.wbsCode) : undefined;
    const record = await prisma.scheduleActivity.create({
      data: {
        projectId,
        name: act.name,
        startDate: act.start,
        endDate: act.end,
        duration: act.duration,
        wbsItemId,
        isMilestone: act.isMilestone || false,
        status: act.status || 'not_started',
        percentComplete: act.percentComplete || 0,
      },
    });
    created.push({ id: record.id, name: record.name, startDate: record.startDate, endDate: record.endDate, duration: record.duration });
  }
  return created;
}

async function linkPredecessors(activities: { id: string }[], links: [number, number][]) {
  for (const [fromIdx, toIdx] of links) {
    const fromId = activities[fromIdx].id;
    const toId = activities[toIdx].id;
    await prisma.scheduleActivity.update({
      where: { id: toId },
      data: {
        predecessors: [{ activityId: fromId, type: 'FS', lag: 0 }],
      },
    });
  }
}

async function createBudgetLine(projectId: string, wbsItemId: string | undefined, name: string, budget: number, incurred: number, pct: number) {
  return prisma.budgetLine.create({
    data: {
      projectId,
      wbsItemId,
      name,
      budgetAmount: budget,
      incurredAmount: incurred,
      percentComplete: pct / 100,
      varianceFlag: incurred > budget ? 'red' : incurred > budget * 0.9 ? 'amber' : 'green',
      varianceThreshold: 0.1,
    },
  });
}

async function createPo(projectId: string, poNumber: string, vendor: string, amount: number, items: { materialName: string; quantity: number; unit: string; unitPrice: number }[], wbsCode?: string, wbsMap?: Map<string, string>) {
  const wbsItemId = wbsCode && wbsMap ? wbsMap.get(wbsCode) : undefined;
  const po = await prisma.purchaseOrder.create({
    data: {
      projectId,
      poNumber,
      vendorName: vendor,
      status: 'issued',
      totalAmount: amount,
      wbsItemId,
      createdBy: userId,
      lineItems: {
        create: items.map((it) => ({
          materialName: it.materialName,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          lineTotal: it.quantity * it.unitPrice,
        })),
      },
    },
  });
  return po;
}

async function createSubcontract(projectId: string, name: string, amount: number) {
  return prisma.subcontract.create({
    data: {
      projectId,
      subcontractorName: name,
      contractAmount: amount,
      status: 'active',
      scheduleOfValues: [],
    },
  });
}

async function createRfi(projectId: string, number: string, subject: string, description: string, status: string) {
  return prisma.rfi.create({
    data: {
      projectId,
      rfiNumber: number,
      subject,
      description,
      status,
      submittedBy: userId,
    },
  });
}

async function createSubmittal(projectId: string, number: string, title: string, description: string, status: string) {
  return prisma.submittal.create({
    data: {
      projectId,
      submittalNumber: number,
      title,
      description,
      status,
      submittedBy: userId,
    },
  });
}

async function createRisk(projectId: string, description: string, category: string, probability: string, impact: string, score: number, status: string, recordable?: boolean) {
  return prisma.riskItem.create({
    data: {
      projectId,
      description,
      category,
      probability,
      impact,
      score,
      status,
      owner: userId,
      source: 'manual',
      recordable: recordable || false,
    },
  });
}

async function createIssue(projectId: string, issueNumber: string, type: string, title: string, description: string, priority: string, status: string) {
  return prisma.issue.create({
    data: {
      projectId,
      issueNumber,
      type,
      title,
      description,
      priority,
      status,
      source: 'manual',
      createdBy: userId,
    },
  });
}

async function createEquipment(projectId: string, externalId: string, name: string, type: string, status: string, dailyRate?: number) {
  return prisma.equipment.create({
    data: {
      projectId,
      externalId,
      name,
      type,
      status,
      dailyRate: dailyRate || 0,
    },
  });
}

async function createBaseline(projectId: string, name: string, activities: any[]) {
  const baseline = await prisma.scheduleBaseline.create({
    data: {
      projectId,
      name,
      locked: true,
      baselineDate: new Date(),
      activities: activities as any,
      createdBy: userId,
    },
  });
  return baseline;
}

async function createCostTransaction(projectId: string, budgetLineId: string, type: 'committed' | 'incurred', amount: number, source: string, date: Date) {
  return prisma.costTransaction.create({
    data: {
      projectId,
      budgetLineId,
      type,
      source,
      amount,
      transactionDate: date,
    },
  });
}

async function createChangeOrder(projectId: string, coNumber: string, description: string, status: string, dollarValue: number, scheduleImpact: number) {
  return prisma.changeOrder.create({
    data: {
      projectId,
      coNumber,
      description,
      status,
      dollarValue,
      scheduleImpact,
      date: new Date(),
    },
  });
}

async function main() {
  const existing = await prisma.project.findMany({
    where: {
      name: {
        in: [
          'Underground Communications Infrastructure — Pacific Northwest',
          'Mixed-Use Data Center — Northern Virginia',
          'Residential Subdivision Infrastructure — Phoenix Metro',
        ],
      },
    },
    select: { id: true, name: true },
  });

  if (existing.length > 0) {
    console.log('Some seed projects already exist. Skipping seed.');
    console.log(existing.map((e) => `  ${e.name}`).join('\n'));
    return;
  }

  // ============================================================
  // PROJECT 1: Underground Communications Infrastructure — Pacific Northwest
  // ============================================================
  const p1 = await prisma.project.create({
    data: {
      name: 'Underground Communications Infrastructure — Pacific Northwest',
      status: 'active',
      orgId: 'org-seattle',
      structureType: 'WBS',
      structureLocked: true,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-09-30'),
      contractValue: 3200000,
      trirTarget: 1.0,
      latitude: 47.6062,
      longitude: -122.3321,
      city: 'Seattle',
      state: 'WA',
    },
  });

  await createWbs(p1.id, [
    { code: '1.0', name: 'Civil / Trenching' },
    { code: '2.0', name: 'Conduit Installation' },
    { code: '3.0', name: 'Fiber Optic' },
    { code: '4.0', name: 'Splice Vaults' },
    { code: '5.0', name: 'Restoration' },
  ]);
  const p1WbsItems = await prisma.workBreakdownItem.findMany({ where: { projectId: p1.id } });
  const p1Wbs = new Map(p1WbsItems.map((w) => [w.code, w.id]));

  const p1Acts = await createActivities(p1.id, [
    { name: 'Mobilization', start: new Date('2026-03-01'), end: new Date('2026-03-05'), duration: 4, wbsCode: '1.0', status: 'complete', percentComplete: 100 },
    { name: 'Survey & Staking', start: new Date('2026-03-06'), end: new Date('2026-03-10'), duration: 4, wbsCode: '1.0', status: 'complete', percentComplete: 100 },
    { name: 'Permit Coordination', start: new Date('2026-03-06'), end: new Date('2026-03-20'), duration: 14, wbsCode: '1.0', status: 'complete', percentComplete: 100 },
    { name: 'Trench Excavation Segment A', start: new Date('2026-03-11'), end: new Date('2026-04-10'), duration: 30, wbsCode: '1.0', status: 'in_progress', percentComplete: 65 },
    { name: 'Trench Excavation Segment B', start: new Date('2026-04-11'), end: new Date('2026-05-10'), duration: 29, wbsCode: '1.0', status: 'not_started', percentComplete: 0 },
    { name: 'Bedding & Backfill', start: new Date('2026-04-15'), end: new Date('2026-05-20'), duration: 35, wbsCode: '1.0', status: 'not_started', percentComplete: 0 },
    { name: 'Conduit Delivery', start: new Date('2026-03-15'), end: new Date('2026-03-25'), duration: 10, wbsCode: '2.0', status: 'complete', percentComplete: 100 },
    { name: 'Conduit Install Segment A', start: new Date('2026-04-01'), end: new Date('2026-04-30'), duration: 29, wbsCode: '2.0', status: 'in_progress', percentComplete: 40 },
    { name: 'Conduit Install Segment B', start: new Date('2026-05-01'), end: new Date('2026-05-30'), duration: 29, wbsCode: '2.0', status: 'not_started', percentComplete: 0 },
    { name: 'Conduit Testing', start: new Date('2026-05-15'), end: new Date('2026-06-15'), duration: 31, wbsCode: '2.0', status: 'not_started', percentComplete: 0 },
    { name: 'Fiber Cable Delivery', start: new Date('2026-04-01'), end: new Date('2026-04-15'), duration: 14, wbsCode: '3.0', status: 'in_progress', percentComplete: 80 },
    { name: 'Fiber Pull Segment A', start: new Date('2026-05-01'), end: new Date('2026-05-20'), duration: 19, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
    { name: 'Fiber Pull Segment B', start: new Date('2026-05-21'), end: new Date('2026-06-10'), duration: 20, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
    { name: 'Fiber Splicing', start: new Date('2026-06-01'), end: new Date('2026-06-30'), duration: 29, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
    { name: 'OTDR Testing', start: new Date('2026-06-20'), end: new Date('2026-07-10'), duration: 20, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
    { name: 'Vault Excavation', start: new Date('2026-04-20'), end: new Date('2026-05-15'), duration: 25, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Vault Pour & Cure', start: new Date('2026-05-16'), end: new Date('2026-06-10'), duration: 25, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Vault Equipment Install', start: new Date('2026-06-11'), end: new Date('2026-06-30'), duration: 19, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Pavement Base', start: new Date('2026-07-01'), end: new Date('2026-07-20'), duration: 19, wbsCode: '5.0', status: 'not_started', percentComplete: 0 },
    { name: 'Pavement Surface', start: new Date('2026-07-21'), end: new Date('2026-08-10'), duration: 20, wbsCode: '5.0', status: 'not_started', percentComplete: 0 },
    { name: 'Landscaping Restoration', start: new Date('2026-08-01'), end: new Date('2026-08-31'), duration: 30, wbsCode: '5.0', status: 'not_started', percentComplete: 0 },
    { name: 'Final Inspection', start: new Date('2026-09-01'), end: new Date('2026-09-10'), duration: 9, wbsCode: '5.0', status: 'not_started', percentComplete: 0 },
    { name: 'Punch List & Closeout', start: new Date('2026-09-11'), end: new Date('2026-09-25'), duration: 14, wbsCode: '5.0', status: 'not_started', percentComplete: 0 },
    { name: 'Project Complete', start: new Date('2026-09-26'), end: new Date('2026-09-30'), duration: 4, wbsCode: '5.0', isMilestone: true, status: 'not_started', percentComplete: 0 },
  ], p1Wbs);
  await linkPredecessors(p1Acts, [
    [0, 1], [0, 2], [1, 3], [3, 4], [4, 5], [6, 7], [7, 8], [8, 9],
    [10, 11], [11, 12], [12, 13], [13, 14], [15, 16], [16, 17],
    [18, 19], [19, 20], [21, 22], [22, 23],
  ]);

  const p1Bl = await createBaseline(p1.id, 'Kickoff Baseline', p1Acts.map((a) => ({
    id: a.id,
    name: a.name,
    startDate: a.startDate.toISOString(),
    endDate: a.endDate.toISOString(),
    duration: a.duration,
    percentComplete: 0,
    status: 'not_started',
    isMilestone: false,
    isCritical: false,
    predecessors: null,
    successors: null,
  })));

  const p1Budgets = await Promise.all([
    createBudgetLine(p1.id, p1Wbs.get('1.0'), 'Civil / Trenching', 900000, 520000, 58),
    createBudgetLine(p1.id, p1Wbs.get('2.0'), 'Conduit Installation', 600000, 180000, 30),
    createBudgetLine(p1.id, p1Wbs.get('3.0'), 'Fiber Optic', 850000, 280000, 33),
    createBudgetLine(p1.id, p1Wbs.get('4.0'), 'Splice Vaults', 450000, 90000, 20),
    createBudgetLine(p1.id, p1Wbs.get('5.0'), 'Restoration', 400000, 50000, 12),
  ]);

  await Promise.all([
    createPo(p1.id, 'PO-101', 'Conduit Supply Co', 320000, [
      { materialName: 'PVC Conduit 4"', quantity: 5000, unit: 'ft', unitPrice: 12 },
      { materialName: 'PVC Conduit 6"', quantity: 2000, unit: 'ft', unitPrice: 18 },
    ], '2.0', p1Wbs),
    createPo(p1.id, 'PO-102', 'Fiber Cable Inc', 410000, [
      { materialName: 'Single Mode Fiber 144ct', quantity: 15000, unit: 'ft', unitPrice: 22 },
    ], '3.0', p1Wbs),
    createPo(p1.id, 'PO-103', 'Splice Enclosure LLC', 85000, [
      { materialName: 'Splice Enclosure 48ct', quantity: 40, unit: 'ea', unitPrice: 1200 },
      { materialName: 'Patch Panels', quantity: 40, unit: 'ea', unitPrice: 850 },
    ], '4.0', p1Wbs),
    createPo(p1.id, 'PO-104', 'Traffic Control Rentals', 45000, [
      { materialName: 'Barricades', quantity: 60, unit: 'ea', unitPrice: 350 },
      { materialName: 'Signage', quantity: 30, unit: 'ea', unitPrice: 650 },
    ], '1.0', p1Wbs),
  ]);

  await Promise.all([
    createSubcontract(p1.id, 'Northwest Trenching LLC', 480000),
    createSubcontract(p1.id, 'Fiber Splicing Pros', 220000),
  ]);

  await Promise.all([
    createRfi(p1.id, 'RFI-001', 'Conduit Depth Conflict', 'Utility crossing requires deeper conduit at station 15+00. Recommend 48" minimum per NEC.', 'answered'),
    createRfi(p1.id, 'RFI-002', 'Splice Vault Location', 'Vault spacing per plan is 800ft; fiber vendor recommends 1000ft. Confirm spacing.', 'under_review'),
    createRfi(p1.id, 'RFI-003', 'Permit Revision', 'City revised permit conditions requiring additional erosion control.', 'open'),
  ]);

  await Promise.all([
    createSubmittal(p1.id, 'SUB-001', 'Conduit Specifications', 'PVC Schedule 40 conduit submittal per spec section 27 05 00.', 'approved'),
    createSubmittal(p1.id, 'SUB-002', 'Fiber Optic Cable Spec', 'OS2 single mode fiber submittal per spec section 27 10 00.', 'approved'),
    createSubmittal(p1.id, 'SUB-003', 'Traffic Control Plan', 'TCP per MUTCD standards for urban arterial.', 'pending'),
  ]);

  await Promise.all([
    createRisk(p1.id, 'Permit delay beyond April 1', 'external', 'medium', 'high', 6, 'open'),
    createRisk(p1.id, 'Rain season weather impact', 'external', 'high', 'medium', 6, 'open'),
    createRisk(p1.id, 'Fiber cable damage during pull', 'technical', 'low', 'high', 3, 'open'),
    createRisk(p1.id, 'Utility conflict at vault 3', 'schedule', 'medium', 'medium', 4, 'open'),
  ]);

  await Promise.all([
    createIssue(p1.id, 'ISS-001', 'field_issue', 'Standing water in trench Segment A', 'Groundwater intrusion is slowing bedding placement.', 'medium', 'open'),
    createIssue(p1.id, 'ISS-002', 'field_issue', 'Conduit delivery short 200ft', 'PO-101 delivery was 200ft short on 6" conduit.', 'high', 'open'),
    createIssue(p1.id, 'ISS-003', 'client_issue', 'Client requests additional handholes', 'Owner wants 3 extra handholes not in contract scope.', 'medium', 'open'),
  ]);

  await Promise.all([
    createEquipment(p1.id, 'EQ-101', 'Excavator 20T', 'excavator', 'active', 850),
    createEquipment(p1.id, 'EQ-102', 'Trench Box 8x12', 'safety', 'active', 120),
    createEquipment(p1.id, 'EQ-103', 'Fiber Puller', 'specialty', 'idle', 450),
    createEquipment(p1.id, 'EQ-104', 'Dump Truck', 'haul', 'active', 650),
  ]);

  console.log(`Project 1 seeded: ${p1Acts.length} activities, ${p1Budgets.length} budgets, baseline ${p1Bl.id}`);

  // ============================================================
  // PROJECT 2: Mixed-Use Data Center — Northern Virginia
  // ============================================================
  const p2 = await prisma.project.create({
    data: {
      name: 'Mixed-Use Data Center — Northern Virginia',
      status: 'active',
      orgId: 'org-ashburn',
      structureType: 'WBS',
      structureLocked: true,
      startDate: new Date('2025-11-01'),
      endDate: new Date('2027-01-31'),
      contractValue: 12800000,
      trirTarget: 0.9,
      latitude: 39.0438,
      longitude: -77.4874,
      city: 'Ashburn',
      state: 'VA',
    },
  });

  await createWbs(p2.id, [
    { code: '1.0', name: 'Site Work' },
    { code: '2.0', name: 'Foundation' },
    { code: '3.0', name: 'Steel Structure' },
    { code: '4.0', name: 'MEP' },
    { code: '5.0', name: 'Electrical' },
    { code: '6.0', name: 'Commissioning' },
  ]);
  const p2WbsItems = await prisma.workBreakdownItem.findMany({ where: { projectId: p2.id } });
  const p2Wbs = new Map(p2WbsItems.map((w) => [w.code, w.id]));

  const p2Acts = await createActivities(p2.id, [
    { name: 'Site Clearing', start: new Date('2025-11-01'), end: new Date('2025-11-15'), duration: 14, wbsCode: '1.0', status: 'complete', percentComplete: 100 },
    { name: 'Grading & Utilities Rough', start: new Date('2025-11-10'), end: new Date('2025-12-15'), duration: 35, wbsCode: '1.0', status: 'complete', percentComplete: 100 },
    { name: 'Erosion Control', start: new Date('2025-11-15'), end: new Date('2025-12-20'), duration: 35, wbsCode: '1.0', status: 'complete', percentComplete: 100 },
    { name: 'Permits & Inspections', start: new Date('2025-11-01'), end: new Date('2025-12-01'), duration: 30, wbsCode: '1.0', status: 'complete', percentComplete: 100 },
    { name: 'Foundation Excavation', start: new Date('2025-12-16'), end: new Date('2026-01-15'), duration: 30, wbsCode: '2.0', status: 'complete', percentComplete: 100 },
    { name: 'Footings & Stem Walls', start: new Date('2026-01-16'), end: new Date('2026-02-28'), duration: 43, wbsCode: '2.0', status: 'complete', percentComplete: 100 },
    { name: 'Slab on Grade', start: new Date('2026-03-01'), end: new Date('2026-03-31'), duration: 30, wbsCode: '2.0', status: 'in_progress', percentComplete: 75 },
    { name: 'Underground Plumbing', start: new Date('2026-02-15'), end: new Date('2026-03-30'), duration: 43, wbsCode: '4.0', status: 'in_progress', percentComplete: 60 },
    { name: 'Steel Delivery', start: new Date('2026-03-01'), end: new Date('2026-03-20'), duration: 19, wbsCode: '3.0', status: 'in_progress', percentComplete: 90 },
    { name: 'Steel Erection', start: new Date('2026-03-21'), end: new Date('2026-05-15'), duration: 55, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
    { name: 'Metal Deck & Joists', start: new Date('2026-04-15'), end: new Date('2026-06-15'), duration: 61, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
    { name: 'Roofing', start: new Date('2026-06-01'), end: new Date('2026-07-15'), duration: 44, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
    { name: 'MEP Rough-In', start: new Date('2026-05-01'), end: new Date('2026-08-15'), duration: 106, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Fire Suppression', start: new Date('2026-05-15'), end: new Date('2026-08-01'), duration: 78, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Electrical Rough-In', start: new Date('2026-06-01'), end: new Date('2026-09-15'), duration: 106, wbsCode: '5.0', status: 'not_started', percentComplete: 0 },
    { name: 'Switchgear Install', start: new Date('2026-08-01'), end: new Date('2026-09-30'), duration: 60, wbsCode: '5.0', status: 'not_started', percentComplete: 0 },
    { name: 'Generator Install', start: new Date('2026-09-01'), end: new Date('2026-10-31'), duration: 60, wbsCode: '5.0', status: 'not_started', percentComplete: 0 },
    { name: 'UPS Install', start: new Date('2026-09-15'), end: new Date('2026-11-15'), duration: 61, wbsCode: '5.0', status: 'not_started', percentComplete: 0 },
    { name: 'HVAC Startup', start: new Date('2026-10-01'), end: new Date('2026-11-30'), duration: 60, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Commissioning MEP', start: new Date('2026-11-01'), end: new Date('2026-12-31'), duration: 60, wbsCode: '6.0', status: 'not_started', percentComplete: 0 },
    { name: 'Commissioning Electrical', start: new Date('2026-11-15'), end: new Date('2027-01-15'), duration: 61, wbsCode: '6.0', status: 'not_started', percentComplete: 0 },
    { name: 'Owner Training', start: new Date('2027-01-01'), end: new Date('2027-01-15'), duration: 14, wbsCode: '6.0', status: 'not_started', percentComplete: 0 },
    { name: 'Final Closeout', start: new Date('2027-01-16'), end: new Date('2027-01-31'), duration: 15, wbsCode: '6.0', isMilestone: true, status: 'not_started', percentComplete: 0 },
    { name: 'Interior Walls', start: new Date('2026-07-01'), end: new Date('2026-08-31'), duration: 61, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Ceilings', start: new Date('2026-08-15'), end: new Date('2026-09-30'), duration: 45, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Flooring', start: new Date('2026-09-01'), end: new Date('2026-10-15'), duration: 44, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Doors & Hardware', start: new Date('2026-09-15'), end: new Date('2026-10-31'), duration: 46, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Painting', start: new Date('2026-10-01'), end: new Date('2026-11-15'), duration: 45, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Site Paving', start: new Date('2026-10-15'), end: new Date('2026-11-30'), duration: 46, wbsCode: '1.0', status: 'not_started', percentComplete: 0 },
    { name: 'Landscaping', start: new Date('2026-11-15'), end: new Date('2026-12-31'), duration: 46, wbsCode: '1.0', status: 'not_started', percentComplete: 0 },
    { name: 'Security Install', start: new Date('2026-11-01'), end: new Date('2026-12-15'), duration: 44, wbsCode: '6.0', status: 'not_started', percentComplete: 0 },
    { name: 'IT Rack Layout', start: new Date('2026-11-15'), end: new Date('2026-12-31'), duration: 46, wbsCode: '6.0', status: 'not_started', percentComplete: 0 },
    { name: 'Load Bank Testing', start: new Date('2026-12-15'), end: new Date('2027-01-15'), duration: 31, wbsCode: '6.0', status: 'not_started', percentComplete: 0 },
    { name: 'Test & Balance', start: new Date('2026-12-01'), end: new Date('2027-01-10'), duration: 40, wbsCode: '6.0', status: 'not_started', percentComplete: 0 },
    { name: 'Substantial Completion', start: new Date('2027-01-20'), end: new Date('2027-01-31'), duration: 11, wbsCode: '6.0', isMilestone: true, status: 'not_started', percentComplete: 0 },
  ], p2Wbs);
  await linkPredecessors(p2Acts, [
    [0, 1], [1, 2], [0, 3], [1, 4], [4, 5], [5, 6], [5, 7], [8, 9], [9, 10], [10, 11],
    [9, 12], [12, 13], [12, 14], [14, 15], [15, 16], [16, 17], [13, 18], [18, 19],
    [19, 20], [20, 21], [21, 22], [10, 23], [23, 24], [24, 25], [25, 26], [26, 27],
    [11, 28], [28, 29], [19, 30], [20, 31], [31, 32], [32, 33], [33, 34],
  ]);

  const p2Bl = await createBaseline(p2.id, 'Kickoff Baseline', p2Acts.map((a) => ({
    id: a.id,
    name: a.name,
    startDate: a.startDate.toISOString(),
    endDate: a.endDate.toISOString(),
    duration: a.duration,
    percentComplete: 0,
    status: 'not_started',
    isMilestone: false,
    isCritical: false,
    predecessors: null,
    successors: null,
  })));

  const p2Budgets = await Promise.all([
    createBudgetLine(p2.id, p2Wbs.get('1.0'), 'Site Work', 1800000, 1650000, 92),
    createBudgetLine(p2.id, p2Wbs.get('2.0'), 'Foundation', 2200000, 2100000, 95),
    createBudgetLine(p2.id, p2Wbs.get('3.0'), 'Steel Structure', 3200000, 3100000, 97),
    createBudgetLine(p2.id, p2Wbs.get('4.0'), 'MEP', 2800000, 2650000, 95),
    createBudgetLine(p2.id, p2Wbs.get('5.0'), 'Electrical', 1800000, 1750000, 97),
    createBudgetLine(p2.id, p2Wbs.get('6.0'), 'Commissioning', 800000, 400000, 50),
  ]);

  await Promise.all([
    createPo(p2.id, 'PO-201', 'Steel Supply Corp', 2100000, [
      { materialName: 'Wide Flange Beams W24x68', quantity: 800, unit: 'ft', unitPrice: 85 },
      { materialName: 'Wide Flange Beams W18x50', quantity: 600, unit: 'ft', unitPrice: 65 },
    ], '3.0', p2Wbs),
    createPo(p2.id, 'PO-202', 'MEP Equipment Direct', 1800000, [
      { materialName: 'AHU 50T', quantity: 8, unit: 'ea', unitPrice: 45000 },
      { materialName: 'Chiller 200T', quantity: 2, unit: 'ea', unitPrice: 320000 },
    ], '4.0', p2Wbs),
    createPo(p2.id, 'PO-203', 'Switchgear Solutions', 950000, [
      { materialName: 'Switchgear 480V', quantity: 1, unit: 'set', unitPrice: 650000 },
      { materialName: 'Panelboards', quantity: 12, unit: 'ea', unitPrice: 25000 },
    ], '5.0', p2Wbs),
    createPo(p2.id, 'PO-204', 'Generator Systems Inc', 680000, [
      { materialName: 'Diesel Generator 2MW', quantity: 2, unit: 'ea', unitPrice: 280000 },
    ], '5.0', p2Wbs),
    createPo(p2.id, 'PO-205', 'UPS Direct', 420000, [
      { materialName: 'UPS 500kVA', quantity: 4, unit: 'ea', unitPrice: 85000 },
    ], '5.0', p2Wbs),
  ]);

  await Promise.all([
    createSubcontract(p2.id, 'Premier Steel Erectors', 1450000),
    createSubcontract(p2.id, 'MEP Masters LLC', 1200000),
  ]);

  await Promise.all([
    createRfi(p2.id, 'RFI-201', 'Steel Connection Detail', 'Moment connection detail at grid line C-4 does not match AISC 360.', 'answered'),
    createRfi(p2.id, 'RFI-202', 'MEP Coordination', 'Ductwork conflicts with sprinkler main at corridor 2. Need revised routing.', 'under_review'),
    createRfi(p2.id, 'RFI-203', 'Generator Pad Thickness', 'Generator pad shown 12" thick; manufacturer requires 18" minimum.', 'open'),
    createRfi(p2.id, 'RFI-204', 'Fire Suppression Coverage', 'NFP-13 coverage gap in telecom room. Need additional heads.', 'open'),
    createRfi(p2.id, 'RFI-205', 'Roof Penetrations', 'HVAC curb penetrations exceed warranty flashing limits. Need detail.', 'open'),
  ]);

  await Promise.all([
    createSubmittal(p2.id, 'SUB-201', 'Structural Drawings', 'Structural steel shop drawings and erection plan.', 'approved'),
    createSubmittal(p2.id, 'SUB-202', 'MEP Coordination Drawings', 'Composite MEP coordination drawings for ceiling space.', 'approved'),
    createSubmittal(p2.id, 'SUB-203', 'Generator Submittal', 'Cummins 2MW diesel generator submittal and O&M data.', 'under_review'),
    createSubmittal(p2.id, 'SUB-204', 'Fire Suppression Shop Drawings', 'Victaulic fire suppression shop drawings and hydraulic calc.', 'pending'),
  ]);

  await Promise.all([
    createRisk(p2.id, 'Steel delivery lead time extended to 14 weeks', 'schedule', 'high', 'high', 9, 'open'),
    createRisk(p2.id, 'MEP coordination delays steel erection', 'schedule', 'medium', 'high', 6, 'open'),
    createRisk(p2.id, 'Permit revision for fire marshal comments', 'external', 'medium', 'medium', 4, 'open'),
    createRisk(p2.id, 'Commissioning timeline compressed by 3 weeks', 'schedule', 'medium', 'medium', 4, 'open'),
    createRisk(p2.id, 'Subcontractor capacity constraint in Q2', 'cost', 'medium', 'medium', 4, 'open'),
  ]);

  await Promise.all([
    createIssue(p2.id, 'ISS-004', 'field_issue', 'Foundation rebar cover deficiency', 'Inspector flagged rebar cover at north wall footing.', 'high', 'open'),
    createIssue(p2.id, 'ISS-005', 'field_issue', 'Water infiltration in basement slab', 'Groundwater seepage through cold joints in SOG.', 'medium', 'open'),
    createIssue(p2.id, 'ISS-006', 'field_issue', 'Steel column plumb out of tolerance', 'Column C-3 is 1.5" out of plumb at level 2.', 'medium', 'open'),
    createIssue(p2.id, 'ISS-007', 'client_issue', 'Client requests upgraded lobby finishes', 'Owner wants premium lobby finishes not in spec.', 'low', 'open'),
    createIssue(p2.id, 'ISS-008', 'client_issue', 'Parking count reduction request', 'Owner wants to reduce parking from 120 to 90 spaces.', 'medium', 'open'),
  ]);

  await Promise.all([
    createEquipment(p2.id, 'EQ-201', 'Tower Crane', 'crane', 'active', 3500),
    createEquipment(p2.id, 'EQ-202', 'Concrete Pump', 'concrete', 'active', 1800),
    createEquipment(p2.id, 'EQ-203', 'Welding Rig', 'steel', 'active', 750),
    createEquipment(p2.id, 'EQ-204', 'Scissor Lift 26ft', 'access', 'active', 220),
    createEquipment(p2.id, 'EQ-205', 'Forklift 8K', 'materials', 'idle', 340),
    createEquipment(p2.id, 'EQ-206', 'Manlift 45ft', 'access', 'idle', 280),
  ]);

  await Promise.all([
    createChangeOrder(p2.id, 'CO-001', 'Generator upgrade to 2.5MW units', 'approved', 180000, 120),
    createChangeOrder(p2.id, 'CO-002', 'Additional cooling capacity for high-density racks', 'pending', 95000, 80),
  ]);

  console.log(`Project 2 seeded: ${p2Acts.length} activities, ${p2Budgets.length} budgets, baseline ${p2Bl.id}`);

  // ============================================================
  // PROJECT 3: Residential Subdivision Infrastructure — Phoenix Metro
  // ============================================================
  const p3 = await prisma.project.create({
    data: {
      name: 'Residential Subdivision Infrastructure — Phoenix Metro',
      status: 'active',
      orgId: 'org-phoenix',
      structureType: 'WBS',
      structureLocked: true,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-08-31'),
      contractValue: 2100000,
      trirTarget: 1.2,
      latitude: 33.4942,
      longitude: -111.9261,
      city: 'Scottsdale',
      state: 'AZ',
    },
  });

  await createWbs(p3.id, [
    { code: '1.0', name: 'Grading' },
    { code: '2.0', name: 'Water / Sewer' },
    { code: '3.0', name: 'Dry Utilities' },
    { code: '4.0', name: 'Paving' },
    { code: '5.0', name: 'Landscaping' },
  ]);
  const p3WbsItems = await prisma.workBreakdownItem.findMany({ where: { projectId: p3.id } });
  const p3Wbs = new Map(p3WbsItems.map((w) => [w.code, w.id]));

  const p3Acts = await createActivities(p3.id, [
    { name: 'Mobilization', start: new Date('2026-04-01'), end: new Date('2026-04-07'), duration: 6, wbsCode: '1.0', status: 'complete', percentComplete: 100 },
    { name: 'Rough Grading', start: new Date('2026-04-08'), end: new Date('2026-04-25'), duration: 17, wbsCode: '1.0', status: 'complete', percentComplete: 100 },
    { name: 'Fine Grading', start: new Date('2026-04-20'), end: new Date('2026-05-05'), duration: 15, wbsCode: '1.0', status: 'in_progress', percentComplete: 85 },
    { name: 'Erosion Control', start: new Date('2026-04-15'), end: new Date('2026-05-10'), duration: 25, wbsCode: '1.0', status: 'in_progress', percentComplete: 70 },
    { name: 'Water Main Install', start: new Date('2026-05-01'), end: new Date('2026-05-20'), duration: 19, wbsCode: '2.0', status: 'not_started', percentComplete: 0 },
    { name: 'Sewer Main Install', start: new Date('2026-05-01'), end: new Date('2026-05-25'), duration: 24, wbsCode: '2.0', status: 'not_started', percentComplete: 0 },
    { name: 'Water/Sewer Testing', start: new Date('2026-05-21'), end: new Date('2026-06-05'), duration: 15, wbsCode: '2.0', status: 'not_started', percentComplete: 0 },
    { name: 'Storm Drain Install', start: new Date('2026-05-15'), end: new Date('2026-06-10'), duration: 26, wbsCode: '2.0', status: 'not_started', percentComplete: 0 },
    { name: 'Electrical Trench', start: new Date('2026-05-20'), end: new Date('2026-06-10'), duration: 21, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
    { name: 'Electrical Pull Boxes', start: new Date('2026-06-05'), end: new Date('2026-06-20'), duration: 15, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
    { name: 'Gas Line Install', start: new Date('2026-06-01'), end: new Date('2026-06-20'), duration: 19, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
    { name: 'Utility Backfill', start: new Date('2026-06-15'), end: new Date('2026-07-05'), duration: 20, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
    { name: 'Base Course', start: new Date('2026-06-25'), end: new Date('2026-07-15'), duration: 20, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Prime Coat', start: new Date('2026-07-10'), end: new Date('2026-07-20'), duration: 10, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Asphalt Paving', start: new Date('2026-07-21'), end: new Date('2026-08-10'), duration: 20, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Striping & Signage', start: new Date('2026-08-05'), end: new Date('2026-08-20'), duration: 15, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Irrigation Install', start: new Date('2026-07-15'), end: new Date('2026-08-05'), duration: 21, wbsCode: '5.0', status: 'not_started', percentComplete: 0 },
    { name: 'Sod & Planting', start: new Date('2026-08-01'), end: new Date('2026-08-25'), duration: 24, wbsCode: '5.0', status: 'not_started', percentComplete: 0 },
    { name: 'Final Punch List', start: new Date('2026-08-15'), end: new Date('2026-08-28'), duration: 13, wbsCode: '5.0', status: 'not_started', percentComplete: 0 },
    { name: 'Project Complete', start: new Date('2026-08-29'), end: new Date('2026-08-31'), duration: 2, wbsCode: '5.0', isMilestone: true, status: 'not_started', percentComplete: 0 },
    { name: 'Street Light Bases', start: new Date('2026-06-10'), end: new Date('2026-06-25'), duration: 15, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
    { name: 'Street Light Poles', start: new Date('2026-06-26'), end: new Date('2026-07-10'), duration: 14, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
    { name: 'Street Light Wiring', start: new Date('2026-07-05'), end: new Date('2026-07-20'), duration: 15, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
    { name: 'Mailbox Pads', start: new Date('2026-07-15'), end: new Date('2026-07-25'), duration: 10, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Curb & Gutter', start: new Date('2026-07-01'), end: new Date('2026-07-20'), duration: 19, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Sidewalks', start: new Date('2026-07-15'), end: new Date('2026-08-05'), duration: 21, wbsCode: '4.0', status: 'not_started', percentComplete: 0 },
    { name: 'Retention Wall', start: new Date('2026-05-10'), end: new Date('2026-06-05'), duration: 26, wbsCode: '1.0', status: 'not_started', percentComplete: 0 },
    { name: 'Silt Fence Maintenance', start: new Date('2026-04-10'), end: new Date('2026-08-20'), duration: 132, wbsCode: '1.0', status: 'not_started', percentComplete: 0 },
    { name: 'Dust Control', start: new Date('2026-04-01'), end: new Date('2026-08-31'), duration: 152, wbsCode: '1.0', status: 'not_started', percentComplete: 0 },
    { name: 'Temporary Power', start: new Date('2026-04-01'), end: new Date('2026-08-31'), duration: 152, wbsCode: '3.0', status: 'not_started', percentComplete: 0 },
  ], p3Wbs);
  await linkPredecessors(p3Acts, [
    [0, 1], [1, 2], [1, 3], [2, 4], [2, 5], [4, 6], [5, 6], [5, 7],
    [7, 8], [8, 9], [8, 10], [9, 11], [10, 11], [11, 12], [12, 13], [13, 14],
    [14, 15], [12, 16], [16, 17], [17, 18], [18, 19], [8, 20], [20, 21], [21, 22],
    [14, 23], [12, 24], [24, 25], [2, 26],
  ]);

  const p3Bl = await createBaseline(p3.id, 'Kickoff Baseline', p3Acts.map((a) => ({
    id: a.id,
    name: a.name,
    startDate: a.startDate.toISOString(),
    endDate: a.endDate.toISOString(),
    duration: a.duration,
    percentComplete: 0,
    status: 'not_started',
    isMilestone: false,
    isCritical: false,
    predecessors: null,
    successors: null,
  })));

  const p3Budgets = await Promise.all([
    createBudgetLine(p3.id, p3Wbs.get('1.0'), 'Grading', 450000, 380000, 84),
    createBudgetLine(p3.id, p3Wbs.get('2.0'), 'Water / Sewer', 650000, 520000, 80),
    createBudgetLine(p3.id, p3Wbs.get('3.0'), 'Dry Utilities', 400000, 320000, 80),
    createBudgetLine(p3.id, p3Wbs.get('4.0'), 'Paving', 380000, 310000, 82),
    createBudgetLine(p3.id, p3Wbs.get('5.0'), 'Landscaping', 220000, 170000, 77),
  ]);

  await Promise.all([
    createPo(p3.id, 'PO-301', 'Pipe & Supply Co', 280000, [
      { materialName: 'PVC Water Main 8"', quantity: 3000, unit: 'ft', unitPrice: 18 },
      { materialName: 'PVC Sewer Main 6"', quantity: 2500, unit: 'ft', unitPrice: 14 },
    ], '2.0', p3Wbs),
    createPo(p3.id, 'PO-302', 'Aggregate Direct', 95000, [
      { materialName: 'ABC Base Course', quantity: 1200, unit: 'ton', unitPrice: 45 },
      { materialName: 'Asphalt Mix', quantity: 800, unit: 'ton', unitPrice: 75 },
    ], '4.0', p3Wbs),
    createPo(p3.id, 'PO-303', 'Desert Landscape Supply', 65000, [
      { materialName: 'Sod', quantity: 8000, unit: 'sqft', unitPrice: 1.5 },
      { materialName: 'Desert Plants', quantity: 400, unit: 'ea', unitPrice: 45 },
    ], '5.0', p3Wbs),
  ]);

  await Promise.all([
    createSubcontract(p3.id, 'Desert Utility Contractors', 380000),
    createSubcontract(p3.id, 'Southwest Paving LLC', 220000),
  ]);

  await Promise.all([
    createRfi(p3.id, 'RFI-301', 'Utility Tie-In Location', 'Water tie-in location conflicts with existing gas main per as-built.', 'answered'),
    createRfi(p3.id, 'RFI-302', 'Grade Conflict at Lot 14', 'Existing grade at Lot 14 is 2.5ft above plan. Need revised cut/fill.', 'under_review'),
  ]);

  await Promise.all([
    createSubmittal(p3.id, 'SUB-301', 'Grading Plan', 'Site grading plan with revised contours per survey.', 'approved'),
    createSubmittal(p3.id, 'SUB-302', 'Utility Materials', 'PVC pipe submittal and pressure test results.', 'approved'),
    createSubmittal(p3.id, 'SUB-303', 'Paving Mix Design', 'Asphalt mix design and Marshall test results.', 'pending'),
  ]);

  await Promise.all([
    createRisk(p3.id, 'Monsoon season rain delays', 'external', 'medium', 'medium', 4, 'open'),
    createRisk(p3.id, 'Utility locate errors', 'technical', 'low', 'high', 3, 'open'),
    createRisk(p3.id, 'HOA approval delay for landscaping', 'external', 'medium', 'low', 2, 'open'),
  ]);

  await Promise.all([
    createIssue(p3.id, 'ISS-009', 'field_issue', 'Unexpected rock in sewer trench', 'Hard rock encountered at 4ft depth in sewer main alignment.', 'medium', 'open'),
    createIssue(p3.id, 'ISS-010', 'client_issue', 'Client requests additional street trees', 'HOA wants 12 additional trees not in landscape plan.', 'low', 'open'),
  ]);

  await Promise.all([
    createEquipment(p3.id, 'EQ-301', 'Excavator 20T', 'excavator', 'active', 850),
    createEquipment(p3.id, 'EQ-302', 'Grader', 'earthwork', 'active', 620),
    createEquipment(p3.id, 'EQ-303', 'Paver', 'paving', 'idle', 1200),
  ]);

  console.log(`Project 3 seeded: ${p3Acts.length} activities, ${p3Budgets.length} budgets, baseline ${p3Bl.id}`);

  console.log('\n=== SEED COMPLETE ===');
  console.log(`Projects created: ${[p1.id, p2.id, p3.id].join(', ')}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
