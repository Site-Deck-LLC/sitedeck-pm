/**
 * Project Template Service (full project snapshot)
 * ============================================================================
 * Sprint 7: extends the WBS-only template from Sprint 6 with a full
 * project snapshot — schedule activity shells, budget structure, risk
 * register, and lessons-learned where `addedToTemplate = true`.
 *
 * The existing `templates.service.ts` keeps working unchanged: WBS-only
 * templates still apply via `applyTemplate()`. This service is the
 * "save the whole project as a starter for the next one" path.
 *
 *   - saveProjectAsTemplate({ orgId, projectId, name, description, createdBy })
 *       → captures WBS + activity shells (name + planned duration, no
 *         dates) + budget line names + risk register + lessons with
 *         addedToTemplate=true. Dates are stripped — the new project
 *         starts from "today".
 *   - applyProjectTemplate({ templateId, projectId, orgId, userId })
 *       → WBS via the existing apply path, then activities, budget
 *         shells, risks, and lessons. Idempotent: same dedupe-by-code
 *         strategy on activities and budget lines, same title-based
 *         dedupe on lessons.
 *   - listProjectTemplates / getProjectTemplate — wrapper over the
 *     existing model, returns the snapshot sizes.
 *   - deleteProjectTemplate — tenant-isolated delete.
 *
 * Tenant isolation: every read and write checks `template.orgId` and
 * `project.orgId` match the caller's org.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { applyTemplate } from './templates.service';

export interface ActivityShell {
  name: string;
  description?: string | null;
  wbsItemCode: string | null;
  plannedDurationDays: number;
}

export interface BudgetShell {
  wbsItemCode: string | null;
  name: string;
  budgetAmount: number;
}

export interface RiskShell {
  description: string;
  category: string;
  probability: string;
  impact: string;
  score: number;
  mitigationPlan?: string | null;
  owner?: string | null;
}

export interface LessonShell {
  title: string;
  description: string | null;
  category: string;
  impact: string | null;
  recommendation: string | null;
  dfowRef: string | null;
}

export interface FullProjectTemplateSummary {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  structureType: string;
  sourceProjectId: string | null;
  counts: { wbs: number; activities: number; budget: number; risks: number; lessons: number };
  createdBy: string;
  createdAt: string;
}

export interface FullProjectTemplateDetail extends FullProjectTemplateSummary {
  activities: ActivityShell[];
  budget: BudgetShell[];
  risks: RiskShell[];
  lessons: LessonShell[];
}

export async function saveProjectAsTemplate(input: {
  orgId: string;
  projectId: string;
  name: string;
  description?: string;
  createdBy: string;
}): Promise<FullProjectTemplateSummary> {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('Template name is required');
  }
  const prisma = getPrismaClient();

  // Tenant isolation: source project must belong to the org.
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { orgId: true, structureType: true },
  });
  if (!project) throw new Error('Source project not found');
  if (project.orgId !== input.orgId) {
    throw new Error('Project does not belong to the specified org');
  }

  // WBS snapshot (reuses the Sprint 6 builder logic by calling the same
  // findMany, then writes the full snapshot shape).
  const wbsItems = await prisma.workBreakdownItem.findMany({
    where: { projectId: input.projectId, structureType: project.structureType || 'wbs' },
    orderBy: [{ level: 'asc' }, { code: 'asc' }],
  });
  const codeById = new Map(wbsItems.map((i) => [i.id, i.code]));
  const wbsSnapshot = wbsItems.map((i) => ({
    code: i.code,
    name: i.name,
    parentCode: i.parentId ? codeById.get(i.parentId) || null : null,
    level: i.level,
    responsibleParty: (i as any).responsibleParty || null,
    budget: (i as any).budget ? Number((i as any).budget) : null,
  }));

  // Activity shells — name + planned duration, no dates.
  const activities = await prisma.scheduleActivity.findMany({
    where: { projectId: input.projectId },
    select: {
      name: true,
      description: true,
      wbsItemId: true,
      startDate: true,
      endDate: true,
    },
  });
  const activitiesSnapshot: ActivityShell[] = activities.map((a) => {
    const start = a.startDate instanceof Date ? a.startDate : new Date(a.startDate);
    const end = a.endDate instanceof Date ? a.endDate : new Date(a.endDate);
    const durationMs = end.getTime() - start.getTime();
    const plannedDurationDays = Math.max(1, Math.round(durationMs / 86_400_000));
    const wbsCode = a.wbsItemId ? codeById.get(a.wbsItemId) || null : null;
    return {
      name: a.name,
      description: a.description,
      wbsItemCode: wbsCode,
      plannedDurationDays,
    };
  });

  // Budget line names + amounts — no actuals, no committed values.
  const budgetLines = await prisma.budgetLine.findMany({
    where: { projectId: input.projectId },
    select: { wbsItemId: true, name: true, budgetAmount: true },
  });
  const budgetSnapshot: BudgetShell[] = budgetLines.map((b) => ({
    wbsItemCode: b.wbsItemId ? codeById.get(b.wbsItemId) || null : null,
    name: b.name,
    budgetAmount: Number(b.budgetAmount),
  }));

  // Risk register — current open items, scored matrix metadata preserved.
  const riskRows = await prisma.riskItem.findMany({
    where: { projectId: input.projectId },
    select: {
      description: true,
      category: true,
      probability: true,
      impact: true,
      score: true,
      mitigationPlan: true,
      owner: true,
    },
  });
  const risksSnapshot: RiskShell[] = riskRows.map((r) => ({
    description: r.description,
    category: r.category,
    probability: r.probability,
    impact: r.impact,
    score: r.score,
    mitigationPlan: r.mitigationPlan,
    owner: r.owner,
  }));

  // Lessons — only those the PM flagged with addedToTemplate=true.
  const lessonRows = await prisma.lessonLearned.findMany({
    where: { projectId: input.projectId, addedToTemplate: true },
    select: {
      title: true,
      description: true,
      category: true,
      impact: true,
      recommendation: true,
      dfowRef: true,
    },
  });
  const lessonsSnapshot: LessonShell[] = lessonRows.map((l) => ({
    title: l.title,
    description: l.description,
    category: l.category,
    impact: l.impact,
    recommendation: l.recommendation,
    dfowRef: l.dfowRef,
  }));

  const created = await prisma.projectTemplate.create({
    data: {
      orgId: input.orgId,
      name: input.name,
      description: input.description || null,
      structureType: project.structureType || 'wbs',
      snapshot: wbsSnapshot as any,
      activitiesSnapshot: activitiesSnapshot as any,
      budgetSnapshot: budgetSnapshot as any,
      risksSnapshot: risksSnapshot as any,
      lessonsSnapshot: lessonsSnapshot as any,
      sourceProjectId: input.projectId,
      createdBy: input.createdBy,
    },
  });

  return summarizeFull(created);
}

export async function applyProjectTemplate(input: {
  templateId: string;
  projectId: string;
  orgId: string;
  userId: string;
}): Promise<{
  wbs: { created: number; skipped: number };
  activities: { created: number; skipped: number };
  budget: { created: number; skipped: number };
  risks: { created: number; skipped: number };
  lessons: { created: number; skipped: number };
}> {
  const prisma = getPrismaClient();

  const template = await prisma.projectTemplate.findUnique({ where: { id: input.templateId } });
  if (!template) throw new Error('Template not found');
  if (template.orgId !== input.orgId) {
    throw new Error('Template does not belong to the specified org');
  }
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { orgId: true, structureType: true },
  });
  if (!project) throw new Error('Target project not found');
  if (project.orgId !== input.orgId) {
    throw new Error('Target project does not belong to the specified org');
  }
  if ((project.structureType || 'wbs') !== template.structureType) {
    throw new Error(
      `Template structure type "${template.structureType}" does not match project structure type "${project.structureType || 'wbs'}"`
    );
  }

  // 1. WBS — delegate to the existing idempotent path.
  const wbs = await applyTemplate({
    templateId: input.templateId,
    projectId: input.projectId,
    orgId: input.orgId,
  });

  // Build code → id map of all WBS items in the target project (newly
  // created WBS + any pre-existing ones) so the activity/budget shells
  // can resolve wbsItemCode → wbsItemId.
  const wbsRows = await prisma.workBreakdownItem.findMany({
    where: { projectId: input.projectId, structureType: template.structureType },
    select: { id: true, code: true },
  });
  const codeToId = new Map(wbsRows.map((r) => [r.code, r.id]));

  // 2. Activities — per-item existence check (name within the target project).
  const activitiesSnapshot = (template.activitiesSnapshot as unknown as ActivityShell[] | null) || [];
  let aCreated = 0;
  let aSkipped = 0;
  for (const a of activitiesSnapshot) {
    const existing = await prisma.scheduleActivity.findFirst({
      where: { projectId: input.projectId, name: a.name },
      select: { id: true },
    });
    if (existing) {
      aSkipped++;
      continue;
    }
    const wbsItemId = a.wbsItemCode ? codeToId.get(a.wbsItemCode) || null : null;
    const start = new Date();
    const end = new Date(start.getTime() + a.plannedDurationDays * 86_400_000);
    await prisma.scheduleActivity.create({
      data: {
        projectId: input.projectId,
        name: a.name,
        description: a.description || null,
        wbsItemId,
        startDate: start,
        endDate: end,
        duration: a.plannedDurationDays,
      } as any,
    });
    aCreated++;
  }

  // 3. Budget lines — per-item existence check (name within the target project).
  const budgetSnapshot = (template.budgetSnapshot as unknown as BudgetShell[] | null) || [];
  let bCreated = 0;
  let bSkipped = 0;
  for (const b of budgetSnapshot) {
    const existing = await prisma.budgetLine.findFirst({
      where: { projectId: input.projectId, name: b.name },
      select: { id: true },
    });
    if (existing) {
      bSkipped++;
      continue;
    }
    const wbsItemId = b.wbsItemCode ? codeToId.get(b.wbsItemCode) || null : null;
    await prisma.budgetLine.create({
      data: {
        projectId: input.projectId,
        name: b.name,
        wbsItemId,
        budgetAmount: b.budgetAmount,
      } as any,
    });
    bCreated++;
  }

  // 4. Risks.
  const risksSnapshot = (template.risksSnapshot as unknown as RiskShell[] | null) || [];
  let rCreated = 0;
  let rSkipped = 0;
  for (const r of risksSnapshot) {
    const exists = await prisma.riskItem.findFirst({
      where: { projectId: input.projectId, description: r.description },
      select: { id: true },
    });
    if (exists) {
      rSkipped++;
      continue;
    }
    await prisma.riskItem.create({
      data: {
        projectId: input.projectId,
        description: r.description,
        category: r.category,
        probability: r.probability,
        impact: r.impact,
        score: r.score,
        mitigationPlan: r.mitigationPlan || null,
        owner: r.owner || input.userId,
        source: 'template',
      } as any,
    });
    rCreated++;
  }

  // 5. Lessons.
  const lessonsSnapshot = (template.lessonsSnapshot as unknown as LessonShell[] | null) || [];
  let lCreated = 0;
  let lSkipped = 0;
  for (const l of lessonsSnapshot) {
    const exists = await prisma.lessonLearned.findFirst({
      where: { projectId: input.projectId, title: l.title },
      select: { id: true },
    });
    if (exists) {
      lSkipped++;
      continue;
    }
    await prisma.lessonLearned.create({
      data: {
        projectId: input.projectId,
        title: l.title,
        description: l.description,
        category: l.category,
        source: 'pm_entered',
        impact: l.impact,
        recommendation: l.recommendation,
        dfowRef: l.dfowRef,
        createdBy: input.userId,
        addedToTemplate: true, // rides along on the next save
      },
    });
    lCreated++;
  }

  return {
    wbs,
    activities: { created: aCreated, skipped: aSkipped },
    budget: { created: bCreated, skipped: bSkipped },
    risks: { created: rCreated, skipped: rSkipped },
    lessons: { created: lCreated, skipped: lSkipped },
  };
}

export async function listProjectTemplates(orgId: string): Promise<FullProjectTemplateSummary[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.projectTemplate.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(summarizeFull);
}

export async function getProjectTemplate(
  id: string,
  orgId: string
): Promise<FullProjectTemplateDetail | null> {
  const prisma = getPrismaClient();
  const row = await prisma.projectTemplate.findUnique({ where: { id } });
  if (!row) return null;
  if (row.orgId !== orgId) return null; // tenant isolation
  return {
    ...summarizeFull(row),
    activities: (row.activitiesSnapshot as unknown as ActivityShell[] | null) || [],
    budget: (row.budgetSnapshot as unknown as BudgetShell[] | null) || [],
    risks: (row.risksSnapshot as unknown as RiskShell[] | null) || [],
    lessons: (row.lessonsSnapshot as unknown as LessonShell[] | null) || [],
  };
}

export async function deleteProjectTemplate(
  id: string,
  orgId: string
): Promise<{ deleted: boolean }> {
  const prisma = getPrismaClient();
  const row = await prisma.projectTemplate.findUnique({ where: { id } });
  if (!row) return { deleted: false };
  if (row.orgId !== orgId) {
    throw new Error('Template does not belong to the specified org');
  }
  await prisma.projectTemplate.delete({ where: { id } });
  return { deleted: true };
}

function summarizeFull(row: any): FullProjectTemplateSummary {
  const wbs = Array.isArray(row.snapshot) ? row.snapshot : [];
  const activities = Array.isArray(row.activitiesSnapshot) ? row.activitiesSnapshot : [];
  const budget = Array.isArray(row.budgetSnapshot) ? row.budgetSnapshot : [];
  const risks = Array.isArray(row.risksSnapshot) ? row.risksSnapshot : [];
  const lessons = Array.isArray(row.lessonsSnapshot) ? row.lessonsSnapshot : [];
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    description: row.description,
    structureType: row.structureType,
    sourceProjectId: row.sourceProjectId,
    counts: {
      wbs: wbs.length,
      activities: activities.length,
      budget: budget.length,
      risks: risks.length,
      lessons: lessons.length,
    },
    createdBy: row.createdBy,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}
