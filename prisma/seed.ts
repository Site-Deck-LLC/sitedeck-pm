import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Constants ──
const ORG_ID = 'org-demo-1';
const CREATED_BY = 'seed';
const START = new Date('2026-01-06'); // Monday
const END = new Date('2026-10-02');   // Friday, ~9 months
const AS_OF = new Date('2026-06-04'); // Today in seed world

function d(iso: string): Date {
  return new Date(iso + 'T00:00:00.000Z');
}

function dec(n: number) {
  return String(n);
}

async function main() {
  // ── 1. Clear old demo data ──
  const oldProjects = await prisma.project.findMany({ where: { name: { contains: 'Demo' } } });
  for (const p of oldProjects) {
    await prisma.costTransaction.deleteMany({ where: { projectId: p.id } });
    await prisma.materialDelivery.deleteMany({ where: { projectId: p.id } });
    await prisma.purchaseOrderLineItem.deleteMany({ where: { purchaseOrder: { projectId: p.id } } });
    await prisma.invoice.deleteMany({ where: { projectId: p.id } });
    await prisma.purchaseOrder.deleteMany({ where: { projectId: p.id } });
    await prisma.scheduleActivity.deleteMany({ where: { projectId: p.id } });
    await prisma.scheduleBaseline.deleteMany({ where: { projectId: p.id } });
    await prisma.scheduleChangeRequest.deleteMany({ where: { projectId: p.id } });
    await prisma.budgetLine.deleteMany({ where: { projectId: p.id } });
    await prisma.subcontract.deleteMany({ where: { projectId: p.id } });
    await prisma.scopeStatement.deleteMany({ where: { projectId: p.id } });
    await prisma.changeOrder.deleteMany({ where: { projectId: p.id } });
    await prisma.rfi.deleteMany({ where: { projectId: p.id } });
    await prisma.submittal.deleteMany({ where: { projectId: p.id } });
    await prisma.riskItem.deleteMany({ where: { projectId: p.id } });
    await prisma.issue.deleteMany({ where: { projectId: p.id } });
    await prisma.voiceMemo.deleteMany({ where: { projectId: p.id } });
    await prisma.unifiedChangeLog.deleteMany({ where: { projectId: p.id } });
    await prisma.closeoutChecklist.deleteMany({ where: { projectId: p.id } });
    await prisma.equipment.deleteMany({ where: { projectId: p.id } });
    await prisma.workBreakdownItem.deleteMany({ where: { projectId: p.id } });
    await prisma.meeting.deleteMany({ where: { projectId: p.id } });
    await prisma.project.delete({ where: { id: p.id } });
  }

  // ── 2. Create Project ──
  const project = await prisma.project.create({
    data: {
      name: '100MW BESS — Texas EPC',
      orgId: ORG_ID,
      structureType: 'WBS',
      structureLocked: true,
      startDate: START,
      endDate: END,
      status: 'active',
      trirTarget: 0.8,
      activeMilestones: [
        { name: 'NTP / Notice to Proceed', date: '2026-01-06' },
        { name: 'Substantial Completion', date: '2026-09-25' },
        { name: 'Final Completion', date: '2026-10-02' },
      ],
    },
  });

  // ── 3. Create WBS ──
  const wbsData = [
    { code: '1', name: 'Civil Works', level: 1 },
    { code: '1.1', name: 'Site Prep & Grading', level: 2, parentCode: '1' },
    { code: '1.2', name: 'Foundations', level: 2, parentCode: '1' },
    { code: '1.3', name: 'Roads & Paving', level: 2, parentCode: '1' },
    { code: '2', name: 'Electrical', level: 1 },
    { code: '2.1', name: 'MV Switchgear', level: 2, parentCode: '2' },
    { code: '2.2', name: 'Inverters / PCS', level: 2, parentCode: '2' },
    { code: '2.3', name: 'Transformers', level: 2, parentCode: '2' },
    { code: '2.4', name: 'Grounding & Cabling', level: 2, parentCode: '2' },
    { code: '3', name: 'BESS Equipment', level: 1 },
    { code: '3.1', name: 'Battery Racks', level: 2, parentCode: '3' },
    { code: '3.2', name: 'HVAC', level: 2, parentCode: '3' },
    { code: '3.3', name: 'Fire Suppression', level: 2, parentCode: '3' },
    { code: '3.4', name: 'BMS Integration', level: 2, parentCode: '3' },
    { code: '4', name: 'Commissioning', level: 1 },
    { code: '4.1', name: 'Pre-Commissioning', level: 2, parentCode: '4' },
    { code: '4.2', name: 'Functional Testing', level: 2, parentCode: '4' },
    { code: '4.3', name: 'Grid Connection', level: 2, parentCode: '4' },
    { code: '4.4', name: 'Performance Testing', level: 2, parentCode: '4' },
    { code: '5', name: 'Closeout', level: 1 },
    { code: '5.1', name: 'Punch List', level: 2, parentCode: '5' },
    { code: '5.2', name: 'As-Builts & O&M', level: 2, parentCode: '5' },
    { code: '6', name: 'Contingency', level: 1 },
  ];

  const wbsMap: Record<string, any> = {};
  for (const item of wbsData) {
    const parentId = item.parentCode ? wbsMap[item.parentCode].id : undefined;
    const created = await prisma.workBreakdownItem.create({
      data: {
        projectId: project.id,
        structureType: 'WBS',
        code: item.code,
        name: item.name,
        level: item.level,
        parentId,
      },
    });
    wbsMap[item.code] = created;
  }

  // ── 4. Billing Account ──
  let billing = await prisma.billingAccount.findUnique({ where: { orgId: ORG_ID } });
  if (!billing) {
    billing = await prisma.billingAccount.create({
      data: {
        orgId: ORG_ID,
        stripeCustomerId: `local-${ORG_ID}`,
        planTier: 'professional',
        status: 'active',
        projectLimit: 999,
        currentPeriodEnd: d('2026-12-31'),
      },
    });
  }

  // ── 5. Schedule Activities (45 total) ──
  // First pass: create all without predecessors
  const actDefs: any[] = [
    { name: 'NTP / Notice to Proceed', start: '2026-01-06', end: '2026-01-06', dur: 0, pct: 1, milestone: true, critical: true, wbs: '1' },
    { name: 'Mobilization & Site Setup', start: '2026-01-06', end: '2026-01-10', dur: 5, pct: 1, wbs: '1.1' },
    { name: 'Erosion Control & SWPPP', start: '2026-01-06', end: '2026-01-17', dur: 10, pct: 1, wbs: '1.1' },
    { name: 'Temporary Power Setup', start: '2026-01-13', end: '2026-01-17', dur: 5, pct: 1, wbs: '1.1' },
    { name: 'Site Fencing & Security', start: '2026-01-20', end: '2026-01-24', dur: 5, pct: 1, wbs: '1.1' },
    { name: 'Rough Grade & Clearing', start: '2026-01-13', end: '2026-01-31', dur: 15, pct: 1, wbs: '1.1' },
    { name: 'Storm Drainage Install', start: '2026-02-10', end: '2026-02-20', dur: 8, pct: 1, wbs: '1.1' },
    { name: 'Foundation Layout & Staking', start: '2026-02-03', end: '2026-02-07', dur: 5, pct: 1, wbs: '1.2' },
    { name: 'Excavation Battery Pads', start: '2026-02-10', end: '2026-03-06', dur: 20, pct: 1, wbs: '1.2' },
    { name: 'Underground Rough-in', start: '2026-02-24', end: '2026-03-20', dur: 20, pct: 1, wbs: '1.2' },
    { name: 'Formwork & Rebar Install', start: '2026-03-09', end: '2026-03-27', dur: 15, pct: 0.90, status: 'in_progress', wbs: '1.2' },
    { name: 'Spill Containment (Pads)', start: '2026-03-23', end: '2026-03-27', dur: 5, pct: 0.80, status: 'in_progress', wbs: '1.2' },
    { name: 'Concrete Pour Battery Pads', start: '2026-03-30', end: '2026-04-24', dur: 20, pct: 0.60, status: 'in_progress', wbs: '1.2' },
    { name: 'Concrete Cure & Strip Forms', start: '2026-04-27', end: '2026-05-08', dur: 10, pct: 0.30, status: 'in_progress', wbs: '1.2' },
    { name: 'Road Base & Paving', start: '2026-05-11', end: '2026-05-29', dur: 15, pct: 0, status: 'not_started', wbs: '1.3' },
    { name: 'Pull Boxes & Handholes', start: '2026-04-27', end: '2026-05-08', dur: 10, pct: 0.50, status: 'in_progress', wbs: '1.2' },
    { name: 'MV Switchgear Delivery', start: '2026-04-06', end: '2026-04-06', dur: 0, pct: 1, milestone: true, critical: true, wbs: '2.1' },
    { name: 'MV Switchgear Install', start: '2026-04-13', end: '2026-05-01', dur: 15, pct: 0.40, status: 'in_progress', wbs: '2.1' },
    { name: 'Inverter/PCS Delivery', start: '2026-04-20', end: '2026-04-20', dur: 0, pct: 1, milestone: true, critical: true, wbs: '2.2' },
    { name: 'Inverter/PCS Install', start: '2026-04-27', end: '2026-05-22', dur: 20, pct: 0.25, status: 'in_progress', wbs: '2.2' },
    { name: 'Transformer Delivery', start: '2026-05-04', end: '2026-05-04', dur: 0, pct: 0.10, milestone: true, status: 'in_progress', wbs: '2.3' },
    { name: 'Transformer Install', start: '2026-05-11', end: '2026-05-29', dur: 15, pct: 0.10, status: 'in_progress', wbs: '2.3' },
    { name: 'Grounding System Install', start: '2026-05-18', end: '2026-06-05', dur: 15, pct: 0.05, status: 'in_progress', wbs: '2.4' },
    { name: 'Conduit Runs (underground)', start: '2026-04-06', end: '2026-04-24', dur: 15, pct: 0.80, status: 'in_progress', wbs: '2.4' },
    { name: 'DC Cabling & Terminations', start: '2026-06-01', end: '2026-06-26', dur: 20, pct: 0, status: 'not_started', wbs: '2.4' },
    { name: 'AC Cabling & Terminations', start: '2026-06-15', end: '2026-07-10', dur: 20, pct: 0, status: 'not_started', wbs: '2.4' },
    { name: 'Cable Testing & Commissioning Prep', start: '2026-07-13', end: '2026-07-24', dur: 10, pct: 0, status: 'not_started', wbs: '2.4' },
    { name: 'Battery Rack Delivery', start: '2026-06-08', end: '2026-06-08', dur: 0, pct: 0, milestone: true, status: 'not_started', wbs: '3.1' },
    { name: 'Battery Rack Install', start: '2026-06-15', end: '2026-07-17', dur: 25, pct: 0, status: 'not_started', wbs: '3.1' },
    { name: 'HVAC Unit Delivery', start: '2026-06-22', end: '2026-06-22', dur: 0, pct: 0, milestone: true, status: 'not_started', wbs: '3.2' },
    { name: 'HVAC Install', start: '2026-06-29', end: '2026-07-10', dur: 10, pct: 0, status: 'not_started', wbs: '3.2' },
    { name: 'Fire Suppression Install', start: '2026-07-06', end: '2026-07-17', dur: 10, pct: 0, status: 'not_started', wbs: '3.3' },
    { name: 'BMS Wiring & Integration', start: '2026-07-13', end: '2026-08-07', dur: 20, pct: 0, status: 'not_started', wbs: '3.4' },
    { name: 'Access Platform Install', start: '2026-07-20', end: '2026-07-31', dur: 10, pct: 0, status: 'not_started', wbs: '3.4' },
    { name: 'Pre-Commissioning Checks', start: '2026-08-03', end: '2026-08-14', dur: 10, pct: 0, status: 'not_started', wbs: '4.1' },
    { name: 'Functional Testing', start: '2026-08-17', end: '2026-09-04', dur: 15, pct: 0, status: 'not_started', wbs: '4.2' },
    { name: 'Grid Connection & Sync', start: '2026-09-07', end: '2026-09-11', dur: 5, pct: 0, milestone: true, status: 'not_started', wbs: '4.3' },
    { name: 'Performance Testing', start: '2026-09-14', end: '2026-09-25', dur: 10, pct: 0, status: 'not_started', wbs: '4.4' },
    { name: 'Safety Barriers & Signage', start: '2026-08-03', end: '2026-08-07', dur: 5, pct: 0, status: 'not_started', wbs: '4.4' },
    { name: 'Punch List Resolution', start: '2026-09-21', end: '2026-09-25', dur: 5, pct: 0, status: 'not_started', wbs: '5.1' },
    { name: 'As-Built Drawings & O&M Manuals', start: '2026-09-21', end: '2026-09-25', dur: 5, pct: 0, status: 'not_started', wbs: '5.2' },
    { name: 'Substantial Completion', start: '2026-09-25', end: '2026-09-25', dur: 0, pct: 0, milestone: true, critical: true, status: 'not_started', wbs: '5' },
    { name: 'Final Completion', start: '2026-10-02', end: '2026-10-02', dur: 0, pct: 0, milestone: true, critical: true, status: 'not_started', wbs: '5' },
    { name: 'Interconnection Agreement Exec', start: '2026-01-06', end: '2026-01-06', dur: 0, pct: 1, milestone: true, wbs: '4.3' },
  ];

  const actMap: Record<string, any> = {};
  for (const def of actDefs) {
    const created = await prisma.scheduleActivity.create({
      data: {
        projectId: project.id,
        name: def.name,
        startDate: d(def.start),
        endDate: d(def.end),
        duration: def.dur,
        percentComplete: def.pct,
        status: def.status || (def.pct >= 1 ? 'complete' : def.pct > 0 ? 'in_progress' : 'not_started'),
        isMilestone: def.milestone || false,
        isCritical: def.critical || false,
        wbsItemId: wbsMap[def.wbs]?.id,
      },
    });
    actMap[def.name] = created;
  }

  // Second pass: update JSON predecessors (backward compat)
  const preds: Record<string, { name: string; type: string; lag: number }[]> = {
    'Mobilization & Site Setup': [{ name: 'NTP / Notice to Proceed', type: 'FS', lag: 0 }],
    'Erosion Control & SWPPP': [{ name: 'NTP / Notice to Proceed', type: 'FS', lag: 0 }],
    'Temporary Power Setup': [{ name: 'Mobilization & Site Setup', type: 'FS', lag: 1 }],
    'Site Fencing & Security': [{ name: 'Mobilization & Site Setup', type: 'FS', lag: 1 }],
    'Rough Grade & Clearing': [{ name: 'Erosion Control & SWPPP', type: 'FS', lag: 1 }],
    'Storm Drainage Install': [{ name: 'Rough Grade & Clearing', type: 'FS', lag: 2 }],
    'Foundation Layout & Staking': [{ name: 'Rough Grade & Clearing', type: 'FS', lag: 1 }],
    'Excavation Battery Pads': [{ name: 'Foundation Layout & Staking', type: 'FS', lag: 1 }],
    'Underground Rough-in': [{ name: 'Excavation Battery Pads', type: 'FS', lag: 1 }],
    'Formwork & Rebar Install': [{ name: 'Excavation Battery Pads', type: 'FS', lag: 1 }],
    'Spill Containment (Pads)': [{ name: 'Formwork & Rebar Install', type: 'FS', lag: 1 }],
    'Concrete Pour Battery Pads': [{ name: 'Formwork & Rebar Install', type: 'FS', lag: 1 }],
    'Concrete Cure & Strip Forms': [{ name: 'Concrete Pour Battery Pads', type: 'FS', lag: 3 }], // concrete cure lag
    'Road Base & Paving': [{ name: 'Concrete Cure & Strip Forms', type: 'FS', lag: 1 }],
    'Pull Boxes & Handholes': [{ name: 'Underground Rough-in', type: 'FS', lag: 1 }],
    'MV Switchgear Delivery': [{ name: 'Rough Grade & Clearing', type: 'FS', lag: 2 }],
    'MV Switchgear Install': [{ name: 'MV Switchgear Delivery', type: 'FS', lag: 3 }],
    'Inverter/PCS Delivery': [{ name: 'MV Switchgear Delivery', type: 'FS', lag: 2 }],
    'Inverter/PCS Install': [{ name: 'Inverter/PCS Delivery', type: 'FS', lag: 3 }],
    'Transformer Delivery': [{ name: 'Inverter/PCS Delivery', type: 'FS', lag: 2 }],
    'Transformer Install': [{ name: 'Transformer Delivery', type: 'FS', lag: 3 }],
    'Grounding System Install': [{ name: 'Transformer Install', type: 'FS', lag: 1 }],
    'Conduit Runs (underground)': [{ name: 'Underground Rough-in', type: 'FS', lag: 2 }],
    'DC Cabling & Terminations': [{ name: 'Battery Rack Install', type: 'FS', lag: 1 }],
    'AC Cabling & Terminations': [{ name: 'MV Switchgear Install', type: 'FS', lag: 2 }],
    'Cable Testing & Commissioning Prep': [{ name: 'DC Cabling & Terminations', type: 'FS', lag: 1 }, { name: 'AC Cabling & Terminations', type: 'FS', lag: 1 }],
    'Battery Rack Delivery': [{ name: 'Concrete Cure & Strip Forms', type: 'FS', lag: 1 }],
    'Battery Rack Install': [{ name: 'Battery Rack Delivery', type: 'FS', lag: 3 }],
    'HVAC Unit Delivery': [{ name: 'Battery Rack Delivery', type: 'FS', lag: 2 }],
    'HVAC Install': [{ name: 'HVAC Unit Delivery', type: 'FS', lag: 3 }],
    'Fire Suppression Install': [{ name: 'Battery Rack Install', type: 'FS', lag: 1 }],
    'BMS Wiring & Integration': [{ name: 'Battery Rack Install', type: 'FS', lag: 1 }],
    'Access Platform Install': [{ name: 'Battery Rack Install', type: 'FS', lag: 2 }],
    'Pre-Commissioning Checks': [{ name: 'BMS Wiring & Integration', type: 'FS', lag: 1 }, { name: 'Cable Testing & Commissioning Prep', type: 'FS', lag: 1 }],
    'Functional Testing': [{ name: 'Pre-Commissioning Checks', type: 'FS', lag: 1 }],
    'Grid Connection & Sync': [{ name: 'Functional Testing', type: 'FS', lag: 1 }],
    'Performance Testing': [{ name: 'Grid Connection & Sync', type: 'FS', lag: 1 }],
    'Safety Barriers & Signage': [{ name: 'Functional Testing', type: 'FS', lag: 1 }],
    'Punch List Resolution': [{ name: 'Performance Testing', type: 'FS', lag: 1 }],
    'As-Built Drawings & O&M Manuals': [{ name: 'Performance Testing', type: 'FS', lag: 1 }],
    'Substantial Completion': [{ name: 'Punch List Resolution', type: 'FS', lag: 1 }, { name: 'As-Built Drawings & O&M Manuals', type: 'FS', lag: 1 }],
    'Final Completion': [{ name: 'Substantial Completion', type: 'FS', lag: 3 }],
    'Interconnection Agreement Exec': [{ name: 'NTP / Notice to Proceed', type: 'FS', lag: 0 }],
  };

  for (const [actName, predList] of Object.entries(preds)) {
    const act = actMap[actName];
    if (!act) continue;
    const jsonPreds = predList.map((p) => ({
      activityId: actMap[p.name]?.id,
      type: p.type,
      lag: p.lag,
    })).filter((p) => p.activityId);
    await prisma.scheduleActivity.update({
      where: { id: act.id },
      data: { predecessors: jsonPreds },
    });
  }

  // Third pass: create relational activity_relationships (proper schema)
  const relDefs: { pred: string; succ: string; type: string; lag: number; constraint: string }[] = [
    // ── FS relationships (15+)
    { pred: 'NTP / Notice to Proceed', succ: 'Mobilization & Site Setup', type: 'FS', lag: 0, constraint: 'hard' },
    { pred: 'NTP / Notice to Proceed', succ: 'Erosion Control & SWPPP', type: 'FS', lag: 0, constraint: 'hard' },
    { pred: 'Mobilization & Site Setup', succ: 'Temporary Power Setup', type: 'FS', lag: 1, constraint: 'hard' },
    { pred: 'Mobilization & Site Setup', succ: 'Site Fencing & Security', type: 'FS', lag: 1, constraint: 'hard' },
    { pred: 'Erosion Control & SWPPP', succ: 'Rough Grade & Clearing', type: 'FS', lag: 1, constraint: 'hard' },
    { pred: 'Rough Grade & Clearing', succ: 'Storm Drainage Install', type: 'FS', lag: 2, constraint: 'hard' },
    { pred: 'Rough Grade & Clearing', succ: 'Foundation Layout & Staking', type: 'FS', lag: 1, constraint: 'hard' },
    { pred: 'Foundation Layout & Staking', succ: 'Excavation Battery Pads', type: 'FS', lag: 1, constraint: 'hard' },
    { pred: 'Excavation Battery Pads', succ: 'Formwork & Rebar Install', type: 'FS', lag: 1, constraint: 'hard' },
    { pred: 'Formwork & Rebar Install', succ: 'Concrete Pour Battery Pads', type: 'FS', lag: 1, constraint: 'hard' },
    { pred: 'Concrete Pour Battery Pads', succ: 'Concrete Cure & Strip Forms', type: 'FS', lag: 3, constraint: 'hard' },
    { pred: 'Concrete Cure & Strip Forms', succ: 'Battery Rack Delivery', type: 'FS', lag: 1, constraint: 'hard' },
    { pred: 'Battery Rack Delivery', succ: 'Battery Rack Install', type: 'FS', lag: 3, constraint: 'hard' },
    { pred: 'Battery Rack Install', succ: 'DC Cabling & Terminations', type: 'FS', lag: 1, constraint: 'hard' },
    { pred: 'MV Switchgear Install', succ: 'AC Cabling & Terminations', type: 'FS', lag: 2, constraint: 'hard' },
    { pred: 'Functional Testing', succ: 'Grid Connection & Sync', type: 'FS', lag: 1, constraint: 'hard' },
    { pred: 'Grid Connection & Sync', succ: 'Performance Testing', type: 'FS', lag: 1, constraint: 'hard' },

    // ── SS relationships (parallel starts)
    { pred: 'Excavation Battery Pads', succ: 'Underground Rough-in', type: 'SS', lag: 5, constraint: 'soft' },
    { pred: 'Formwork & Rebar Install', succ: 'Spill Containment (Pads)', type: 'SS', lag: 3, constraint: 'soft' },
    { pred: 'Battery Rack Install', succ: 'BMS Wiring & Integration', type: 'SS', lag: 10, constraint: 'soft' },

    // ── Additional lag relationships
    { pred: 'Transformer Install', succ: 'Grounding System Install', type: 'FS', lag: 2, constraint: 'hard' },
  ];

  for (const r of relDefs) {
    const predAct = actMap[r.pred];
    const succAct = actMap[r.succ];
    if (!predAct || !succAct) continue;
    await prisma.activityRelationship.create({
      data: {
        projectId: project.id,
        predecessorId: predAct.id,
        successorId: succAct.id,
        relationshipType: r.type,
        lagDays: r.lag,
        constraintType: r.constraint,
      },
    });
  }

  // ── 6. Budget Lines ──
  const budgetData = [
    { wbs: '1.1', name: 'Site Prep & Grading', budget: 180000, committed: 180000, incurred: 175000, pct: 0.97 },
    { wbs: '1.2', name: 'Foundations — Concrete', budget: 850000, committed: 850000, incurred: 510000, pct: 0.60 },
    { wbs: '1.2', name: 'Foundations — Rebar', budget: 220000, committed: 220000, incurred: 176000, pct: 0.80 },
    { wbs: '1.2', name: 'Foundations — Formwork', budget: 150000, committed: 150000, incurred: 135000, pct: 0.90 },
    { wbs: '1.3', name: 'Roads & Paving', budget: 280000, committed: 280000, incurred: 0, pct: 0 },
    { wbs: '2.1', name: 'MV Switchgear', budget: 620000, committed: 620000, incurred: 248000, pct: 0.40 },
    { wbs: '2.2', name: 'Inverters / PCS', budget: 1250000, committed: 1250000, incurred: 312500, pct: 0.25 },
    { wbs: '2.3', name: 'Transformers', budget: 420000, committed: 420000, incurred: 42000, pct: 0.10 },
    { wbs: '2.4', name: 'Grounding & Cabling', budget: 460000, committed: 460000, incurred: 184000, pct: 0.40 },
    { wbs: '2.4', name: 'Conduit & Wire', budget: 280000, committed: 280000, incurred: 224000, pct: 0.80 },
    { wbs: '3.1', name: 'Battery Racks', budget: 2050000, committed: 2050000, incurred: 0, pct: 0 },
    { wbs: '3.2', name: 'HVAC Units', budget: 310000, committed: 310000, incurred: 0, pct: 0 },
    { wbs: '3.3', name: 'Fire Suppression', budget: 210000, committed: 210000, incurred: 0, pct: 0 },
    { wbs: '3.4', name: 'BMS Integration', budget: 720000, committed: 720000, incurred: 0, pct: 0 },
    { wbs: '4.1', name: 'Pre-Commissioning', budget: 180000, committed: 180000, incurred: 0, pct: 0 },
    { wbs: '4.2', name: 'Functional Testing', budget: 220000, committed: 220000, incurred: 0, pct: 0 },
    { wbs: '4.3', name: 'Grid Connection', budget: 120000, committed: 120000, incurred: 0, pct: 0 },
    { wbs: '4.4', name: 'Performance Testing', budget: 160000, committed: 160000, incurred: 0, pct: 0 },
    { wbs: '5.1', name: 'Punch List', budget: 80000, committed: 80000, incurred: 0, pct: 0 },
    { wbs: '5.2', name: 'As-Builts & O&M', budget: 120000, committed: 120000, incurred: 0, pct: 0 },
    { wbs: '6', name: 'Contingency', budget: 500000, committed: 0, incurred: 0, pct: 0 },
  ];

  const budgetMap: Record<string, any> = {};
  for (const b of budgetData) {
    const created = await prisma.budgetLine.create({
      data: {
        projectId: project.id,
        wbsItemId: wbsMap[b.wbs]?.id,
        name: b.name,
        budgetAmount: dec(b.budget),
        committedAmount: dec(b.committed),
        incurredAmount: dec(b.incurred),
        percentComplete: b.pct,
        varianceThreshold: 0.1,
        varianceFlag: b.pct >= 0.95 ? 'green' : b.pct >= 0.80 ? 'amber' : 'red',
      },
    });
    budgetMap[b.name] = created;
  }

  // ── 7. Cost Transactions ──
  const txData = [
    { line: 'Site Prep & Grading', amount: 175000, type: 'incurred', source: 'invoice', date: '2026-03-15' },
    { line: 'Foundations — Concrete', amount: 510000, type: 'incurred', source: 'invoice', date: '2026-05-20' },
    { line: 'Foundations — Rebar', amount: 176000, type: 'incurred', source: 'invoice', date: '2026-04-10' },
    { line: 'Foundations — Formwork', amount: 135000, type: 'incurred', source: 'invoice', date: '2026-04-25' },
    { line: 'MV Switchgear', amount: 248000, type: 'incurred', source: 'invoice', date: '2026-05-05' },
    { line: 'Inverters / PCS', amount: 312500, type: 'incurred', source: 'invoice', date: '2026-05-12' },
    { line: 'Transformers', amount: 42000, type: 'incurred', source: 'invoice', date: '2026-05-18' },
    { line: 'Grounding & Cabling', amount: 184000, type: 'incurred', source: 'invoice', date: '2026-05-22' },
    { line: 'Conduit & Wire', amount: 224000, type: 'incurred', source: 'invoice', date: '2026-05-01' },
    { line: 'Battery Racks', amount: 2050000, type: 'committed', source: 'po', date: '2026-05-01' },
    { line: 'HVAC Units', amount: 310000, type: 'committed', source: 'po', date: '2026-05-10' },
    { line: 'Fire Suppression', amount: 210000, type: 'committed', source: 'po', date: '2026-05-15' },
    { line: 'BMS Integration', amount: 720000, type: 'committed', source: 'po', date: '2026-05-20' },
  ];

  for (const tx of txData) {
    const line = budgetMap[tx.line];
    if (!line) continue;
    await prisma.costTransaction.create({
      data: {
        projectId: project.id,
        budgetLineId: line.id,
        type: tx.type,
        source: tx.source,
        amount: dec(tx.amount),
        description: `${tx.type} — ${tx.line}`,
        transactionDate: d(tx.date),
      },
    });
  }

  // ── 8. Purchase Orders ──
  const poDefs = [
    {
      number: 'PO-2026-0001', vendor: 'Tesla Energy — Megapack Division', amount: 2050000, wbs: '3.1',
      lines: [
        { material: 'Megapack 2XL Battery Rack', qty: 40, unit: 'ea', price: 45000, total: 1800000 },
        { material: 'Rack Mounting Hardware', qty: 40, unit: 'kit', price: 1250, total: 50000 },
        { material: 'DC Breaker Assemblies', qty: 80, unit: 'ea', price: 2500, total: 200000 },
      ],
    },
    {
      number: 'PO-2026-0002', vendor: 'Sungrow / SMA America', amount: 1250000, wbs: '2.2',
      lines: [
        { material: 'PCS 2500kW Inverter', qty: 10, unit: 'ea', price: 115000, total: 1150000 },
        { material: 'Inverter Pre-charge Units', qty: 10, unit: 'ea', price: 5000, total: 50000 },
        { material: 'Control Cabinets', qty: 10, unit: 'ea', price: 5000, total: 50000 },
      ],
    },
    {
      number: 'PO-2026-0003', vendor: 'ABB / Schneider Electric', amount: 1040000, wbs: '2.1',
      lines: [
        { material: 'MV Metal-Clad Switchgear 38kV', qty: 2, unit: 'ea', price: 220000, total: 440000 },
        { material: 'Pad-Mounted Transformer 35MVA', qty: 2, unit: 'ea', price: 210000, total: 420000 },
        { material: 'MV Cable 500kcmil XLPE', qty: 5000, unit: 'ft', price: 36, total: 180000 },
      ],
    },
    {
      number: 'PO-2026-0004', vendor: 'Oldcastle Infrastructure', amount: 480000, wbs: '1.2',
      lines: [
        { material: 'Ready-Mix Concrete 4000psi', qty: 2500, unit: 'cy', price: 150, total: 375000 },
        { material: 'Rebar #6 Grade 60', qty: 25000, unit: 'ft', price: 1.25, total: 31250 },
        { material: 'PVC Conduit 6" SCH40', qty: 3000, unit: 'ft', price: 12.5, total: 37500 },
        { material: 'Pull Boxes Precast 48x48', qty: 20, unit: 'ea', price: 1800, total: 36000 },
      ],
    },
  ];

  const poMap: Record<string, any> = {};
  for (const def of poDefs) {
    const po = await prisma.purchaseOrder.create({
      data: {
        projectId: project.id,
        poNumber: def.number,
        vendorName: def.vendor,
        status: 'issued',
        totalAmount: dec(def.amount),
        wbsItemId: wbsMap[def.wbs]?.id,
        createdBy: CREATED_BY,
      },
    });
    poMap[def.number] = po;

    for (const line of def.lines) {
      await prisma.purchaseOrderLineItem.create({
        data: {
          poId: po.id,
          materialName: line.material,
          quantity: dec(line.qty),
          unit: line.unit,
          unitPrice: dec(line.price),
          lineTotal: dec(line.total),
          quantityReceived: dec(0),
        },
      });
    }
  }

  // ── 9. Material Deliveries ──
  // Full delivery for concrete rebar, partial for conduit (shortage)
  const concretePo = poMap['PO-2026-0004'];
  const concreteItems = await prisma.purchaseOrderLineItem.findMany({ where: { poId: concretePo.id } });

  for (const item of concreteItems) {
    let qty = Number(item.quantity);
    if (item.materialName.includes('Concrete')) qty = 2500;
    else if (item.materialName.includes('Rebar')) qty = 25000;
    else if (item.materialName.includes('Conduit')) qty = 1800; // SHORTAGE: ordered 3000, received 1800
    else if (item.materialName.includes('Pull Boxes')) qty = 18;

    await prisma.materialDelivery.create({
      data: {
        projectId: project.id,
        poId: concretePo.id,
        lineItemId: item.id,
        quantityReceived: dec(qty),
        receivedBy: 'field-super-1',
        receivedAt: d('2026-04-15'),
        discrepancies: item.materialName.includes('Conduit') ? 'Shortage: received 1800ft vs ordered 3000ft. Supplier citing supply chain delay. ETA 2 weeks for remainder.' : undefined,
        deliveryReference: `DEL-${concretePo.poNumber}-001`,
      },
    });
  }

  // Update received quantities on PO line items
  for (const item of concreteItems) {
    const received = item.materialName.includes('Conduit') ? 1800 : Number(item.quantity);
    await prisma.purchaseOrderLineItem.update({
      where: { id: item.id },
      data: { quantityReceived: dec(received) },
    });
  }

  // ── 10. Invoices ──
  const invData = [
    { po: 'PO-2026-0004', number: 'INV-OC-2026-001', amount: 180000, status: 'approved' },
    { po: 'PO-2026-0004', number: 'INV-OC-2026-002', amount: 150000, status: 'approved' },
    { po: 'PO-2026-0003', number: 'INV-ABB-2026-001', amount: 440000, status: 'approved' },
    { po: 'PO-2026-0003', number: 'INV-ABB-2026-002', amount: 420000, status: 'pending' },
    { po: 'PO-2026-0002', number: 'INV-SMA-2026-001', amount: 575000, status: 'approved' },
  ];

  for (const inv of invData) {
    const po = poMap[inv.po];
    if (!po) continue;
    await prisma.invoice.create({
      data: {
        projectId: project.id,
        poId: po.id,
        invoiceNumber: inv.number,
        invoiceAmount: dec(inv.amount),
        status: inv.status,
        matchStatus: inv.status === 'approved' ? 'matched' : 'pending',
      },
    });
  }

  // ── 11. Subcontracts ──
  await prisma.subcontract.create({
    data: {
      projectId: project.id,
      subcontractorName: 'Turner Civil Contractors, LLC',
      contractAmount: dec(1200000),
      retentionPercent: 0.1,
      status: 'active',
      scheduleOfValues: [
        { item: 'Site Prep & Grading', value: 180000, billed: 180000, retained: 18000, percentComplete: 1.0 },
        { item: 'Foundations — Concrete', value: 850000, billed: 510000, retained: 51000, percentComplete: 0.60 },
        { item: 'Foundations — Rebar', value: 220000, billed: 176000, retained: 17600, percentComplete: 0.80 },
        { item: 'Roads & Paving', value: 280000, billed: 0, retained: 0, percentComplete: 0 },
        { item: 'Underground Utilities', value: 150000, billed: 120000, retained: 12000, percentComplete: 0.80 },
      ],
    },
  });

  await prisma.subcontract.create({
    data: {
      projectId: project.id,
      subcontractorName: 'PowerGrid Electrical Services, Inc.',
      contractAmount: dec(2000000),
      retentionPercent: 0.1,
      status: 'active',
      scheduleOfValues: [
        { item: 'MV Switchgear Install', value: 620000, billed: 248000, retained: 24800, percentComplete: 0.40 },
        { item: 'Inverter/PCS Install', value: 1250000, billed: 312500, retained: 31250, percentComplete: 0.25 },
        { item: 'Transformer Install', value: 420000, billed: 42000, retained: 4200, percentComplete: 0.10 },
        { item: 'Grounding & Cabling', value: 460000, billed: 184000, retained: 18400, percentComplete: 0.40 },
        { item: 'Cable Testing', value: 120000, billed: 0, retained: 0, percentComplete: 0 },
      ],
    },
  });

  // ── 12. Scope Statement ──
  await prisma.scopeStatement.create({
    data: {
      projectId: project.id,
      content: `100MW / 400MWh Battery Energy Storage System (BESS) EPC project located in ERCOT territory, Texas.

Scope includes:
- Civil: site prep, foundations for 40 Megapack 2XL units, roads, storm drainage, erosion control
- Electrical: 38kV MV switchgear, 10x 2500kW PCS/inverters, 2x 35MVA transformers, grounding, DC/AC cabling
- BESS Equipment: battery rack installation, HVAC, fire suppression per NFPA 855, BMS integration
- Commissioning: pre-commissioning, functional testing, grid sync, performance testing per IEC 62933
- Closeout: punch list, as-builts, O&M manuals, training

Contract value: $8,500,000. Duration: 9 months. NTP: Jan 6, 2026. Substantial Completion: Sep 25, 2026.`,
      version: 1,
      createdBy: CREATED_BY,
    },
  });

  // ── 13. Change Orders ──
  await prisma.changeOrder.create({
    data: {
      projectId: project.id,
      coNumber: 'CO-2026-001',
      date: d('2026-03-15'),
      description: 'Owner-directed increase in transformer size from 35MVA to 50MVA to accommodate future site expansion.',
      status: 'approved',
      dollarValue: dec(85000),
      scheduleImpact: 5,
      approver: 'owner_admin',
      approvedAt: d('2026-03-20'),
      affectedActivityIds: [actMap['Transformer Delivery']?.id, actMap['Transformer Install']?.id],
    },
  });

  await prisma.changeOrder.create({
    data: {
      projectId: project.id,
      coNumber: 'CO-2026-002',
      date: d('2026-04-10'),
      description: 'Additional erosion control measures required after March storm event. SWPPP inspector citation.',
      status: 'pending',
      dollarValue: dec(22000),
      scheduleImpact: 3,
      approver: null,
      approvedAt: null,
    },
  });

  // ── 14. RFIs ──
  const rfiData = [
    {
      number: 'RFI-2026-001',
      subject: 'Soil Bearing Capacity — Battery Pad Design',
      desc: 'Geotechnical report indicates 2,500 psf bearing capacity. Structural drawings call for 3,000 psf. Confirm if 2,500 psf is acceptable or if ground improvement (vibro-replacement) is required.',
      status: 'answered',
      submittedBy: 'civil-pm',
      submittedAt: d('2026-01-20'),
      assignedTo: 'structural-engineer',
      response: '2,500 psf is acceptable with increased pad size per revised detail A-201-R1. No ground improvement needed.',
      answeredAt: d('2026-01-22'),
      hold: null,
    },
    {
      number: 'RFI-2026-002',
      subject: 'MV Switchgear Conduit Routing Conflict',
      desc: 'Existing water line at Sta 15+00 conflicts with proposed 6" PVC conduit run for 38kV feeder. Conflict shown on survey dated 2026-01-15. Request direction: relocate conduit north 8ft or relocate water line?',
      status: 'under_review',
      submittedBy: 'electrical-super',
      submittedAt: d('2026-04-05'),
      assignedTo: 'owner-rep',
      response: null,
      answeredAt: null,
      hold: actMap['Conduit Runs (underground)']?.id,
    },
    {
      number: 'RFI-2026-003',
      subject: 'NFPA 855 — Fire Suppression Coverage per UL 9540A',
      desc: 'NFPA 855-2023 requires fire suppression coverage for all battery enclosures. Current design shows suppression at rack level only. Confirm if pod-level suppression (total flooding) is required given 40-unit configuration.',
      status: 'submitted',
      submittedBy: 'fire-consultant',
      submittedAt: d('2026-05-12'),
      assignedTo: 'fire-marshal',
      response: null,
      answeredAt: null,
      hold: actMap['Fire Suppression Install']?.id,
    },
    {
      number: 'RFI-2026-004',
      subject: 'Battery Rack Spacing — Thermal Management',
      desc: 'Tesla Megapack 2XL installation manual requires 10ft min spacing for thermal management. Site plan shows 8ft spacing in Row C due to property line constraint. Request waiver or revised layout.',
      status: 'draft',
      submittedBy: 'bess-install-lead',
      submittedAt: null,
      assignedTo: null,
      response: null,
      answeredAt: null,
      hold: actMap['Battery Rack Install']?.id,
    },
  ];

  for (const rfi of rfiData) {
    await prisma.rfi.create({
      data: {
        projectId: project.id,
        rfiNumber: rfi.number,
        subject: rfi.subject,
        description: rfi.desc,
        status: rfi.status,
        submittedBy: rfi.submittedBy,
        submittedAt: rfi.submittedAt,
        assignedTo: rfi.assignedTo,
        responseText: rfi.response,
        answeredAt: rfi.answeredAt,
        holdOnActivityId: rfi.hold,
      },
    });
  }

  // ── 15. Submittals ──
  const subData = [
    {
      number: 'SUB-2026-001',
      title: 'Battery Rack Shop Drawings & Seismic Calculations',
      desc: 'Shop drawings for 40x Megapack 2XL rack assemblies. Includes seismic restraint details per ASCE 7-22.',
      status: 'approved',
      spec: '26 32 13',
      by: 'tesla-engineer',
      at: d('2026-02-01'),
      reviewer: 'structural-engineer',
      reviewedAt: d('2026-02-15'),
      hold: actMap['Battery Rack Install']?.id,
    },
    {
      number: 'SUB-2026-002',
      title: 'Fire Suppression System Design — NFPA 855 Compliance',
      desc: 'Total flooding clean agent system design for 40-unit BESS array. Includes hazard analysis, nozzle layout, and control panel wiring diagrams.',
      status: 'under_review',
      spec: '21 30 00',
      by: 'fire-consultant',
      at: d('2026-04-20'),
      reviewer: null,
      reviewedAt: null,
      hold: actMap['Fire Suppression Install']?.id,
    },
    {
      number: 'SUB-2026-003',
      title: 'Inverter Cut Sheets, O&M Data, and Efficiency Curves',
      desc: 'Submittal package for Sungrow PCS2500 including efficiency curves, harmonic spectrum, cooling requirements, and warranty terms.',
      status: 'pending',
      spec: '26 36 00',
      by: 'sungrow-rep',
      at: d('2026-05-05'),
      reviewer: null,
      reviewedAt: null,
      hold: actMap['Inverter/PCS Install']?.id,
    },
  ];

  for (const s of subData) {
    await prisma.submittal.create({
      data: {
        projectId: project.id,
        submittalNumber: s.number,
        title: s.title,
        description: s.desc,
        status: s.status,
        specSection: s.spec,
        submittedBy: s.by,
        submittedAt: s.at,
        reviewedBy: s.reviewer,
        reviewedAt: s.reviewedAt,
        holdOnActivityId: s.hold,
      },
    });
  }

  // ── 16. Risk Register ──
  const riskData = [
    {
      desc: 'ERCOT interconnection queue delays — IA not executed, estimated 6-12 month queue backlog',
      category: 'regulatory',
      prob: 'high',
      impact: 'high',
      score: 9,
      mitigation: 'Engage interconnection consultant. File ERIS request. Parallel-track substation design.',
      owner: 'project_manager',
      status: 'open',
      activity: actMap['Interconnection Agreement Exec']?.id,
    },
    {
      desc: 'Overseas battery delivery delays — Tesla Shanghai port congestion, customs backlog',
      category: 'supply_chain',
      prob: 'medium',
      impact: 'high',
      score: 6,
      mitigation: 'Order 6-week buffer. Charter vessel if needed. Explore domestic inventory transfer.',
      owner: 'procurement_manager',
      status: 'open',
      activity: actMap['Battery Rack Delivery']?.id,
    },
    {
      desc: 'Extreme Texas summer heat — >105°F expected Jul-Aug, concrete cure and labor productivity impact',
      category: 'environmental',
      prob: 'medium',
      impact: 'medium',
      score: 4,
      mitigation: 'Shift concrete pours to early morning. Increase labor crew size 15%. Install shade structures.',
      owner: 'superintendent',
      status: 'open',
      activity: actMap['Concrete Pour Battery Pads']?.id,
    },
    {
      desc: 'Civil subcontractor default — Turner Civil showing cash-flow strain, slow pay apps',
      category: 'contractor',
      prob: 'low',
      impact: 'high',
      score: 3,
      mitigation: 'Bi-weekly financial review. 10% retention held. Backup subcontractor on standby (Lone Star Civil).',
      owner: 'project_manager',
      status: 'open',
      activity: actMap['Formwork & Rebar Install']?.id,
    },
    {
      desc: 'Foundation soil conditions worse than geotech — potential liquefaction risk in SE corner',
      category: 'technical',
      prob: 'low',
      impact: 'medium',
      score: 2,
      mitigation: 'Supplemental geotechnical investigation in Q2. Ground improvement budget reserve $75K.',
      owner: 'civil-pm',
      status: 'open',
      activity: actMap['Excavation Battery Pads']?.id,
    },
  ];

  for (const r of riskData) {
    await prisma.riskItem.create({
      data: {
        projectId: project.id,
        description: r.desc,
        category: r.category,
        probability: r.prob,
        impact: r.impact,
        score: r.score,
        mitigationPlan: r.mitigation,
        owner: r.owner,
        status: r.status,
        linkedActivityId: r.activity,
        source: 'manual',
      },
    });
  }

  // ── 17. Issues ──
  const issueData = [
    {
      number: 'ISS-2026-001',
      type: 'client_issue',
      source: 'owner_request',
      title: 'Owner requesting transformer upsize from 35MVA to 50MVA',
      desc: 'Owner citing future Phase 2 expansion. Requires new transformer specification and delivery lead time assessment.',
      status: 'open',
      priority: 'high',
      assignee: 'electrical-pm',
      due: d('2026-06-15'),
    },
    {
      number: 'ISS-2026-002',
      type: 'client_issue',
      source: 'utility_delay',
      title: 'ERCOT interconnection agreement execution delayed',
      desc: 'Utility has not returned signed IA. Original target was Mar 2026. No response to follow-up emails. Escalation to legal counsel recommended.',
      status: 'open',
      priority: 'critical',
      assignee: 'project_manager',
      due: d('2026-06-30'),
    },
    {
      number: 'ISS-2026-003',
      type: 'field_issue',
      source: 'daily_report',
      title: 'Civil sub behind schedule — foundations 2 weeks late',
      desc: 'Turner Civil reporting formwork crew shortage. Pour #3 delayed from May 1 to May 15. Critical path impact TBD.',
      status: 'open',
      priority: 'high',
      assignee: 'superintendent',
      due: d('2026-05-20'),
      activity: actMap['Concrete Pour Battery Pads']?.id,
    },
    {
      number: 'ISS-2026-004',
      type: 'field_issue',
      source: 'delivery_log',
      title: 'Concrete delivery shortage at pour #3 — 200cy short',
      desc: 'Ready-mix supplier (Oldcastle) shorted 200cy on May 15 pour. Remainder delivered May 16. Cold joint mitigation required per ACI 301.',
      status: 'resolved',
      priority: 'medium',
      assignee: 'civil-super',
      due: d('2026-05-18'),
      resolvedAt: d('2026-05-18'),
      activity: actMap['Concrete Pour Battery Pads']?.id,
    },
    {
      number: 'ISS-2026-005',
      type: 'field_issue',
      source: 'customs_broker',
      title: 'Inverter shipment held at Port of Houston customs',
      desc: 'Sungrow PCS shipment (10 units) detained by CBP for tariff classification review. Expected release 5-7 business days. Delays inverter install start by 1 week.',
      status: 'open',
      priority: 'high',
      assignee: 'procurement_manager',
      due: d('2026-05-25'),
      activity: actMap['Inverter/PCS Delivery']?.id,
    },
    {
      number: 'ISS-2026-006',
      type: 'field_issue',
      source: 'safety_walk',
      title: 'Unauthorized subcontractor on site — unauthorized trenching',
      desc: 'Lone Star Civil (not under contract) observed trenching near existing water line without permit or utility locate. Stop work issued. Safety stand-down required.',
      status: 'open',
      priority: 'critical',
      assignee: 'safety_manager',
      due: d('2026-05-10'),
    },
  ];

  for (const iss of issueData) {
    await prisma.issue.create({
      data: {
        projectId: project.id,
        issueNumber: iss.number,
        type: iss.type,
        source: iss.source,
        title: iss.title,
        description: iss.desc,
        status: iss.status,
        priority: iss.priority,
        assignee: iss.assignee,
        dueDate: iss.due,
        resolvedAt: iss.resolvedAt,
        activityId: iss.activity,
        createdBy: CREATED_BY,
      },
    });
  }

  // ── 17b. Meeting Minutes ──
  const meetingData = [
    {
      title: 'Weekly OAC Meeting — May 27, 2026',
      date: d('2026-05-27'),
      location: 'Site Trailer Conference Room',
      facilitator: 'Robert Chen (SiteDeck PM)',
      attendees: [
        { name: 'Sarah Martinez', role: 'Owner Representative' },
        { name: 'David Kim', role: 'Architect of Record' },
        { name: 'Robert Chen', role: 'General Contractor PM' },
        { name: 'Mike Torres', role: 'Site Superintendent' },
      ],
      agenda: [
        'Safety review and incidents since last meeting',
        'Schedule review — look-ahead 3 weeks',
        'Change order log review (RFI-2026-005, RFI-2026-008)',
        'Owner-furnished equipment delivery status',
        'Substantial completion forecast',
      ],
      minutes: `## Safety
Zero recordable incidents this period. Heat stress protocol in effect — work rest cycles adjusted for >95°F days.

## Schedule
Civil foundations 4 days behind plan due to Oldcastle concrete shortage (see Action Item #2). Mitigation in place: Turner Civil added second crew. Net delay to substantial completion: 3 days.

## Change Orders
- RFI-2026-005: Owner requested transformer upsize. Pending engineering review. No cost impact to date.
- RFI-2026-008: Underground utility conflict at north fence line. Resolution: reroute 150ft of conduit. Cost impact: $12,400, time impact: 2 days. Submitted as PCO-001.

## Owner Furnished Equipment
- PCS inverters: 8 of 10 units received. Remaining 2 units released from customs May 25. Delivery to site Jun 3.
- Battery racks: 35 of 40 units staged. Remainder on vessel ETA Jun 8.

## Substantial Completion Forecast
Currently tracking Sep 28, 2026 (3 days behind original Sep 25). Recovery plan: accelerate BMS commissioning by overlapping with HVAC punch list.`,
      actionItems: [
        {
          description: 'Submit transformer upsize cost analysis to owner',
          assignee: 'Robert Chen',
          dueDate: '2026-05-30',
          status: 'closed',
        },
        {
          description: 'Coordinate Turner Civil pour #4 with Oldcastle — confirm supply before mobilization',
          assignee: 'Mike Torres',
          dueDate: '2026-06-01',
          status: 'closed',
        },
        {
          description: 'File PCO-001 for underground utility conflict',
          assignee: 'Robert Chen',
          dueDate: '2026-06-03',
          status: 'open',
        },
        {
          description: 'Schedule BMS / HVAC overlap meeting with controls sub',
          assignee: 'Mike Torres',
          dueDate: '2026-06-10',
          status: 'open',
        },
        {
          description: 'Owner approval of substantial completion forecast update',
          assignee: 'Sarah Martinez',
          dueDate: '2026-06-15',
          status: 'open',
        },
      ],
      status: 'published',
      createdBy: CREATED_BY,
    },
    {
      title: 'Subcontractor Coordination Meeting — May 30, 2026',
      date: d('2026-05-30'),
      location: 'Site Trailer — Big Room',
      facilitator: 'Mike Torres (Site Superintendent)',
      attendees: [
        { name: 'Mike Torres', role: 'Site Superintendent' },
        { name: 'James Walker', role: 'Turner Civil PM' },
        { name: 'Lisa Patel', role: 'Fire Suppression Sub PM' },
        { name: 'Carlos Diaz', role: 'Electrical Sub Foreman' },
        { name: 'Robert Chen', role: 'GC PM' },
        { name: 'Tom Bradley', role: 'BMS Controls Sub PM' },
      ],
      agenda: [
        'Look-ahead: June work windows per sub',
        'Concrete pour #4 — final coordination',
        'Electrical switchgear delivery and install sequence',
        'Fire suppression tie-in schedule',
        'BMS network and device locations walkdown',
      ],
      minutes: `## Look-ahead
All subs confirmed staffing for June. Turner Civil: 2 crews (12 carpenters). Electrical: 6 IBEW electricians. Fire Suppression: 4 fitters. BMS: 2 techs commissioning.

## Concrete Pour #4
Scheduled Jun 5, 6:00am. Oldcastle confirmed 320cy available. Backup plant (Redi-Mix) on standby. Pump truck reserved. Cylinder break schedule: 3, 7, 28 days.

## Electrical Switchgear
Sungrow PCS units 9-10 arrive Jun 3. MVT-001 transformer delivery Jun 7. Switchgear lineup install Jun 8-12. Coordination needed with fire suppression rough-in (overhead conflict at PCS pad #4).

## Fire Suppression Tie-in
Detection wire pulls Jun 9-11. Agent cylinders staged Jun 13. Pre-test Jun 15. Tie-in to fire alarm panel Jun 18.

## BMS Walkdown
Network topology confirmed: fiber backbone from control house to 4 PCS pads. Device locations marked at 100%. Conduit installation Jun 11-14.`,
      actionItems: [
        {
          description: 'Confirm pump truck and backup concrete plant mobilization for Jun 5 pour',
          assignee: 'James Walker',
          dueDate: '2026-06-04',
          status: 'closed',
        },
        {
          description: 'Resolve overhead conflict between fire suppression piping and PCS pad #4 conduit',
          assignee: 'Lisa Patel',
          dueDate: '2026-06-12',
          status: 'open',
        },
        {
          description: 'Coordinate BMS fiber pull with PCS pad commissioning sequence',
          assignee: 'Tom Bradley',
          dueDate: '2026-06-14',
          status: 'open',
        },
      ],
      status: 'published',
      createdBy: CREATED_BY,
    },
  ];

  for (const m of meetingData) {
    await prisma.meeting.create({
      data: {
        projectId: project.id,
        title: m.title,
        meetingDate: m.date,
        location: m.location,
        facilitator: m.facilitator,
        attendees: m.attendees,
        agenda: m.agenda,
        minutes: m.minutes,
        actionItems: m.actionItems,
        status: m.status,
        createdBy: m.createdBy,
      },
    });
  }

  // ── 18. Equipment ──
  const equipData = [
    { id: 'EQ-001', name: 'CAT 336 Hydraulic Excavator', type: 'earthwork', hours: 420, act: actMap['Excavation Battery Pads']?.id, date: '2026-03-15' },
    { id: 'EQ-002', name: 'Schwing Concrete Pump Truck', type: 'concrete', hours: 180, act: actMap['Concrete Pour Battery Pads']?.id, date: '2026-05-15' },
    { id: 'EQ-003', name: 'Link-Belt 80-Ton Mobile Crane', type: 'crane', hours: 95, act: actMap['MV Switchgear Install']?.id, date: '2026-04-20' },
    { id: 'EQ-004', name: 'JLG 660SJ Boom Lift', type: 'aerial', hours: 240, act: actMap['Formwork & Rebar Install']?.id, date: '2026-03-25' },
    { id: 'EQ-005', name: 'Bobcat S650 Skid Steer', type: 'earthwork', hours: 310, act: actMap['Rough Grade & Clearing']?.id, date: '2026-01-25' },
    { id: 'EQ-006', name: 'Miller XMT 350 Welder', type: 'welding', hours: 60, act: actMap['Grounding System Install']?.id, date: '2026-05-20' },
  ];

  for (const e of equipData) {
    await prisma.equipment.create({
      data: {
        projectId: project.id,
        externalId: e.id,
        name: e.name,
        type: e.type,
        status: 'active',
        currentActivityId: e.act,
        lastUsageDate: e.date ? d(e.date) : null,
        totalHours: e.hours,
      },
    });
  }

  // ── 19. Closeout Checklist ──
  await prisma.closeoutChecklist.create({
    data: {
      projectId: project.id,
      status: 'in_progress',
      items: [
        { item: 'Punch list items resolved', complete: false, count: 0, total: 45 },
        { item: 'As-built drawings submitted', complete: false, count: 0, total: 12 },
        { item: 'O&M manuals delivered', complete: false, count: 0, total: 8 },
        { item: 'Training sessions completed', complete: false, count: 0, total: 3 },
        { item: 'Warranty documents issued', complete: false, count: 0, total: 5 },
        { item: 'Final lien waivers collected', complete: false, count: 0, total: 7 },
        { item: 'Utility interconnection closed', complete: false, count: 0, total: 1 },
      ],
    },
  });

  // ── 20. Baseline ──
  const allActivities = await prisma.scheduleActivity.findMany({ where: { projectId: project.id } });
  await prisma.scheduleBaseline.create({
    data: {
      projectId: project.id,
      name: 'Baseline — Contract Schedule',
      locked: true,
      baselineDate: d('2026-01-06'),
      activities: allActivities.map((a) => ({
        id: a.id,
        name: a.name,
        startDate: a.startDate,
        endDate: a.endDate,
        duration: a.duration,
        isMilestone: a.isMilestone,
        isCritical: a.isCritical,
      })),
      createdBy: CREATED_BY,
    },
  });

  // ── 21. Change Log ──
  const changeLogData = [
    { module: 'schedule', type: 'activity_created', desc: 'Created 45 schedule activities for BESS project', recordId: null, recordType: 'scheduleActivity' },
    { module: 'cost', type: 'budget_set', desc: 'Set 21 budget lines totaling $8.5M', recordId: null, recordType: 'budgetLine' },
    { module: 'procurement', type: 'po_issued', desc: 'Issued 4 purchase orders ($3.78M)', recordId: null, recordType: 'purchaseOrder' },
    { module: 'scope', type: 'statement_created', desc: 'Created project scope statement v1', recordId: null, recordType: 'scopeStatement' },
    { module: 'communications', type: 'rfi_submitted', desc: 'Submitted RFI-2026-001 soil bearing capacity', recordId: null, recordType: 'rfi' },
    { module: 'integration', type: 'issue_logged', desc: 'Logged ISS-2026-003 civil sub behind schedule', recordId: null, recordType: 'issue' },
  ];

  for (const log of changeLogData) {
    await prisma.unifiedChangeLog.create({
      data: {
        projectId: project.id,
        module: log.module,
        changeType: log.type,
        description: log.desc,
        affectedRecordId: log.recordId,
        affectedRecordType: log.recordType,
        changedBy: CREATED_BY,
        changedAt: new Date(),
      },
    });
  }

  console.log(`Seeded project: ${project.id} — 100MW BESS Texas EPC`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
