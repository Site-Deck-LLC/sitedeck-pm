import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.create({
    data: {
      name: 'Demo BESS Project',
      orgId: 'org-demo-1',
      structureType: 'WBS',
      structureLocked: false,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'active',
    },
  });

  const wbsRoot = await prisma.workBreakdownItem.create({
    data: {
      projectId: project.id,
      structureType: 'WBS',
      code: '1',
      name: 'BESS Installation',
      level: 1,
    },
  });

  const wbsFoundation = await prisma.workBreakdownItem.create({
    data: {
      projectId: project.id,
      structureType: 'WBS',
      code: '1.1',
      name: 'Foundation',
      parentId: wbsRoot.id,
      level: 2,
    },
  });

  const act1 = await prisma.scheduleActivity.create({
    data: {
      projectId: project.id,
      name: 'Site Preparation',
      description: 'Clear and grade site',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-10'),
      duration: 8,
      status: 'complete',
      percentComplete: 1,
      isMilestone: false,
      isCritical: true,
    },
  });

  const act2 = await prisma.scheduleActivity.create({
    data: {
      projectId: project.id,
      name: 'Foundation Pour',
      description: 'Concrete foundation for BESS pad',
      startDate: new Date('2026-01-11'),
      endDate: new Date('2026-01-25'),
      duration: 12,
      status: 'in_progress',
      percentComplete: 0.3,
      isMilestone: false,
      isCritical: true,
      predecessors: [{ activityId: act1.id, type: 'FS', lag: 0 }],
    },
  });

  const budgetLine = await prisma.budgetLine.create({
    data: {
      projectId: project.id,
      wbsItemId: wbsFoundation.id,
      name: 'Concrete & Rebar',
      budgetAmount: 250000,
      committedAmount: 200000,
      incurredAmount: 75000,
      percentComplete: 0.3,
      varianceThreshold: 0.1,
      varianceFlag: 'green',
    },
  });

  const po = await prisma.purchaseOrder.create({
    data: {
      projectId: project.id,
      poNumber: 'PO-2026-0001',
      vendorName: 'Acme Concrete Supply',
      status: 'issued',
      totalAmount: 200000,
      activityId: act2.id,
      createdBy: 'seed',
    },
  });

  await prisma.purchaseOrderLineItem.create({
    data: {
      poId: po.id,
      materialName: 'Ready-Mix Concrete',
      quantity: 500,
      unit: 'cy',
      unitPrice: 150,
      lineTotal: 75000,
      quantityReceived: 150,
    },
  });

  await prisma.purchaseOrderLineItem.create({
    data: {
      poId: po.id,
      materialName: 'Rebar #6',
      quantity: 10000,
      unit: 'ft',
      unitPrice: 1.25,
      lineTotal: 12500,
      quantityReceived: 10000,
    },
  });

  await prisma.rfi.create({
    data: {
      projectId: project.id,
      rfiNumber: 'RFI-2026-0001',
      subject: 'Foundation depth confirmation',
      description: 'Confirm 48" depth per geotech report.',
      status: 'answered',
      submittedBy: 'seed',
      submittedAt: new Date('2026-01-05'),
      responseText: 'Confirmed 48" per drawing A-101.',
      answeredAt: new Date('2026-01-06'),
    },
  });

  await prisma.riskItem.create({
    data: {
      projectId: project.id,
      description: 'Weather delay risk — rainy season',
      category: 'external',
      probability: 'medium',
      impact: 'high',
      score: 6,
      mitigationPlan: 'Accelerate site prep by 1 week.',
      owner: 'seed',
      status: 'open',
    },
  });

  await prisma.issue.create({
    data: {
      projectId: project.id,
      issueNumber: 'ISS-2026-0001',
      type: 'field_issue',
      source: 'manual',
      title: 'Access road muddy after rain',
      description: 'Truck access compromised. Need gravel.',
      status: 'open',
      priority: 'high',
      createdBy: 'seed',
    },
  });

  console.log(`Seeded project: ${project.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
