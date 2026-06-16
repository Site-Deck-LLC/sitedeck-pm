/**
 * WBS / Cost Code Tree Service
 * ============================================================================
 * Builds the hierarchical WBS tree for a project, with derived % complete
 * from activities linked to each WBS element. Supports both 'wbs' and
 * 'cost_code' structure types — the difference is purely cosmetic (labels).
 *
 * Tree shape per node:
 *   {
 *     id, code, name, level, parentId,
 *     budget, budgetedCost, actualCost, percentComplete,
 *     colorStatus: 'green' | 'amber' | 'red' (based on cost vs budget),
 *     children: [...]
 *   }
 *
 * The tree is built by:
 *   1. Load all WBS elements for the project
 *   2. Load all activities for the project (for % complete)
 *   3. Load all budget lines and join to WBS by code (for budget)
 *   4. Recursively aggregate from leaves to root
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';

export interface WbsTreeNode {
  id: string;
  code: string;
  name: string;
  level: number;
  parentId: string | null;
  budget: number; // cents
  actualCost: number; // cents
  percentComplete: number; // 0..1
  costVariance: number; // cents (budget - actual)
  colorStatus: 'green' | 'amber' | 'red' | 'gray';
  childCount: number;
  children: WbsTreeNode[];
}

export interface WbsAddInput {
  projectId: string;
  code: string;
  name: string;
  parentId?: string | null;
  level?: number;
  responsibleParty?: string | null;
  budget?: number | null; // dollars; converted to cents
}

export interface WbsUpdateInput {
  code?: string;
  name?: string;
  responsibleParty?: string | null;
  budget?: number | null;
}

export interface CrosswalkEntry {
  id: string;
  gcItemId: string;
  gcItemCode: string;
  gcItemName: string;
  subItemId: string;
  subItemCode: string;
  subItemName: string;
}

export interface WbsBlockerInfo {
  activityCount: number;
  costLineCount: number;
  poCount: number;
}

export async function getWbsTree(projectId: string): Promise<WbsTreeNode[]> {
  const prisma = getPrismaClient();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { structureType: true },
  });
  if (!project) {
    throw new Error('Project not found');
  }
  const structureType = project.structureType || 'wbs';

  const items = await prisma.workBreakdownItem.findMany({
    where: { projectId, structureType },
    orderBy: [{ level: 'asc' }, { code: 'asc' }],
  });

  if (items.length === 0) {
    return [];
  }

  // Load activities for percent complete
  const activities = await prisma.scheduleActivity.findMany({
    where: { projectId },
    select: { wbsItemId: true, percentComplete: true },
  });
  const pctByWbs = new Map<string, number[]>();
  for (const a of activities) {
    if (!a.wbsItemId) continue;
    const arr = pctByWbs.get(a.wbsItemId) || [];
    arr.push(a.percentComplete);
    pctByWbs.set(a.wbsItemId, arr);
  }

  // Load budget lines for budgetedCost (join on code is approximate;
  // in practice, the cost-code column in budget_line is the join key)
  const budgetLines = await prisma.budgetLine.findMany({
    where: { projectId },
    select: { costCode: true, budgetAmount: true, incurredAmount: true },
  });
  const budgetByCode = new Map<string, { budget: number; actual: number }>();
  for (const bl of budgetLines) {
    if (!bl.costCode) continue;
    budgetByCode.set(bl.costCode, {
      budget: Number(bl.budgetAmount || 0),
      actual: Number(bl.incurredAmount || 0),
    });
  }

  // Build a node map with per-node derived values
  const nodeMap = new Map<string, WbsTreeNode>();
  for (const it of items) {
    const bl = budgetByCode.get(it.code);
    const pcts = pctByWbs.get(it.id) || [];
    const avgPct = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length / 100 : 0;
    const budgetCents = Math.round((bl?.budget || 0) * 100);
    const actualCents = Math.round((bl?.actual || 0) * 100);
    const variance = budgetCents - actualCents;
    let colorStatus: 'green' | 'amber' | 'red' | 'gray' = 'gray';
    if (budgetCents > 0) {
      const ratio = actualCents / budgetCents;
      if (ratio > 1.1) colorStatus = 'red';
      else if (ratio > 1.0) colorStatus = 'amber';
      else colorStatus = 'green';
    }
    nodeMap.set(it.id, {
      id: it.id,
      code: it.code,
      name: it.name,
      level: it.level,
      parentId: it.parentId,
      budget: budgetCents,
      actualCost: actualCents,
      percentComplete: Math.round(avgPct * 100) / 100,
      costVariance: variance,
      colorStatus,
      childCount: 0,
      children: [],
    });
  }

  // Assemble the tree (children → parent)
  const roots: WbsTreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId)!;
      parent.children.push(node);
      parent.childCount += 1;
    } else {
      roots.push(node);
    }
  }

  // Roll up from leaves to roots
  function rollup(node: WbsTreeNode): void {
    if (node.children.length === 0) return;
    for (const c of node.children) rollup(c);
    node.budget = node.children.reduce((s, c) => s + c.budget, 0);
    node.actualCost = node.children.reduce((s, c) => s + c.actualCost, 0);
    node.costVariance = node.budget - node.actualCost;
    // Weighted percent complete by budget
    if (node.budget > 0) {
      const totalPct = node.children.reduce(
        (s, c) => s + c.percentComplete * c.budget,
        0
      );
      node.percentComplete = Math.round((totalPct / node.budget) * 100) / 100;
    } else {
      const avg = node.children.reduce((s, c) => s + c.percentComplete, 0) / node.children.length;
      node.percentComplete = Math.round(avg * 100) / 100;
    }
    if (node.budget > 0) {
      const ratio = node.actualCost / node.budget;
      if (ratio > 1.1) node.colorStatus = 'red';
      else if (ratio > 1.0) node.colorStatus = 'amber';
      else node.colorStatus = 'green';
    }
  }
  for (const r of roots) rollup(r);

  // Sort children at each level
  function sortChildren(node: WbsTreeNode): void {
    node.children.sort((a, b) => a.code.localeCompare(b.code));
    for (const c of node.children) sortChildren(c);
  }
  for (const r of roots) sortChildren(r);

  return roots;
}

export async function addWbsItem(input: WbsAddInput) {
  const prisma = getPrismaClient();
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { structureType: true },
  });
  if (!project) {
    throw new Error('Project not found');
  }
  const structureType = project.structureType || 'wbs';

  // Compute level from parent if not given
  let level = input.level || 1;
  if (input.parentId) {
    const parent = await prisma.workBreakdownItem.findUnique({
      where: { id: input.parentId },
    });
    if (parent) {
      level = parent.level + 1;
    }
  }
  if (level > 4) {
    throw new Error('WBS tree is limited to 4 levels deep');
  }

  return prisma.workBreakdownItem.create({
    data: {
      projectId: input.projectId,
      structureType,
      code: input.code,
      name: input.name,
      parentId: input.parentId || null,
      level,
    },
  });
}

export async function updateWbsItem(wbsId: string, input: WbsUpdateInput) {
  const prisma = getPrismaClient();
  const existing = await prisma.workBreakdownItem.findUnique({ where: { id: wbsId } });
  if (!existing) {
    throw new Error('WBS element not found');
  }
  // If changing code, check that no activities reference it
  if (input.code !== undefined && input.code !== existing.code) {
    const linked = await prisma.scheduleActivity.count({
      where: { wbsItemId: wbsId },
    });
    if (linked > 0) {
      throw new Error(`Cannot change code — ${linked} activities reference this WBS element`);
    }
  }
  const data: any = {};
  if (input.code !== undefined) data.code = input.code;
  if (input.name !== undefined) data.name = input.name;
  return prisma.workBreakdownItem.update({
    where: { id: wbsId },
    data,
  });
}

export async function getWbsBlockerInfo(wbsId: string): Promise<WbsBlockerInfo> {
  const prisma = getPrismaClient();
  const wbs = await prisma.workBreakdownItem.findUnique({ where: { id: wbsId } });
  if (!wbs) {
    return { activityCount: 0, costLineCount: 0, poCount: 0 };
  }
  const [activityCount, costLineCount, poCount] = await Promise.all([
    prisma.scheduleActivity.count({ where: { wbsItemId: wbsId } }),
    prisma.budgetLine.count({ where: { projectId: wbs.projectId, costCode: wbs.code } }),
    prisma.purchaseOrder.count({ where: { projectId: wbs.projectId, wbsItemId: wbsId } }),
  ]);
  return { activityCount, costLineCount, poCount };
}

export async function deleteWbsItem(wbsId: string): Promise<{ deleted: boolean; blockers: WbsBlockerInfo }> {
  const prisma = getPrismaClient();
  const blockers = await getWbsBlockerInfo(wbsId);
  const totalBlockers = blockers.activityCount + blockers.costLineCount + blockers.poCount;
  if (totalBlockers > 0) {
    return { deleted: false, blockers };
  }
  // Check children
  const childCount = await prisma.workBreakdownItem.count({ where: { parentId: wbsId } });
  if (childCount > 0) {
    return {
      deleted: false,
      blockers: { ...blockers, activityCount: blockers.activityCount + childCount },
    };
  }
  await prisma.workBreakdownItem.delete({ where: { id: wbsId } });
  return { deleted: true, blockers: { activityCount: 0, costLineCount: 0, poCount: 0 } };
}

/**
 * Crosswalk: GC structure → Sub structure mapping
 */
export async function getCrosswalk(projectId: string): Promise<CrosswalkEntry[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.wbsCostCodeCrosswalk.findMany({
    where: { projectId },
  });
  if (rows.length === 0) return [];

  const itemIds = new Set<string>();
  for (const r of rows) {
    itemIds.add(r.gcItemId);
    itemIds.add(r.subItemId);
  }
  const items = await prisma.workBreakdownItem.findMany({
    where: { id: { in: Array.from(itemIds) } },
  });
  const itemMap = new Map(items.map((i) => [i.id, i]));

  return rows.map((r) => {
    const gc = itemMap.get(r.gcItemId);
    const sub = itemMap.get(r.subItemId);
    return {
      id: r.id,
      gcItemId: r.gcItemId,
      gcItemCode: gc?.code || '',
      gcItemName: gc?.name || '',
      subItemId: r.subItemId,
      subItemCode: sub?.code || '',
      subItemName: sub?.name || '',
    };
  });
}

export async function addCrosswalkEntry(projectId: string, gcItemId: string, subItemId: string) {
  const prisma = getPrismaClient();
  return prisma.wbsCostCodeCrosswalk.create({
    data: { projectId, gcItemId, subItemId },
  });
}

export async function updateCrosswalkEntry(id: string, gcItemId: string, subItemId: string) {
  const prisma = getPrismaClient();
  return prisma.wbsCostCodeCrosswalk.update({
    where: { id },
    data: { gcItemId, subItemId },
  });
}

export async function deleteCrosswalkEntry(id: string) {
  const prisma = getPrismaClient();
  return prisma.wbsCostCodeCrosswalk.delete({ where: { id } });
}
