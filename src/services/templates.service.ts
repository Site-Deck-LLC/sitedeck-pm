/**
 * Project Templates Service
 * ============================================================================
 * Saves a snapshot of a project's WBS / cost-code structure as a reusable
 * template, and applies a template to a new project. The snapshot stores
 * items as code-name-level triples (not Prisma ids) so a template can be
 * applied to any project without FK gymnastics.
 *
 *   - saveTemplate({ orgId, projectId, name, description, createdBy })
 *       → reads the project's WBS items, builds a snapshot, writes a row.
 *   - applyTemplate({ templateId, projectId, userId })
 *       → creates WorkBreakdownItem rows for the target project from the
 *         snapshot. Idempotent: if any item already exists with the same
 *         code, it is skipped (not overwritten). The PM can run apply
 *         twice without fear of duplicating the tree.
 *   - listTemplates(orgId) — paginated list
 *   - getTemplate(id) — single template, including snapshot
 *   - deleteTemplate(id) — only the org that owns the template can delete
 *
 * Templates are org-scoped. Two orgs can each have a template named
 * "Standard Office Buildout" with different contents; no cross-org lookup.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { addWbsItem } from './wbs.service';

export interface TemplateItemSnapshot {
  code: string;
  name: string;
  parentCode: string | null;
  level: number;
  responsibleParty?: string | null;
  budget?: number | null;
}

export interface TemplateSummary {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  structureType: string;
  itemCount: number;
  sourceProjectId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface TemplateDetail extends TemplateSummary {
  items: TemplateItemSnapshot[];
}

export async function saveTemplate(input: {
  orgId: string;
  name: string;
  description?: string;
  projectId: string;
  createdBy: string;
}): Promise<TemplateSummary> {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('Template name is required');
  }
  const prisma = getPrismaClient();

  // Verify the source project belongs to the org (tenant isolation).
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { orgId: true, structureType: true },
  });
  if (!project) {
    throw new Error('Source project not found');
  }
  if (project.orgId !== input.orgId) {
    throw new Error('Project does not belong to the specified org');
  }

  // Read WBS items for the project.
  const items = await prisma.workBreakdownItem.findMany({
    where: { projectId: input.projectId, structureType: project.structureType || 'wbs' },
    orderBy: [{ level: 'asc' }, { code: 'asc' }],
  });

  // Build the snapshot. We need parentCode, so first build a code→item map.
  const codeToItem = new Map(items.map((i) => [i.id, i]));
  const snapshot: TemplateItemSnapshot[] = items.map((i) => ({
    code: i.code,
    name: i.name,
    parentCode: i.parentId ? codeToItem.get(i.parentId)?.code || null : null,
    level: i.level,
    responsibleParty: (i as any).responsibleParty || null,
    budget: (i as any).budget ? Number((i as any).budget) : null,
  }));

  const created = await prisma.projectTemplate.create({
    data: {
      orgId: input.orgId,
      name: input.name,
      description: input.description || null,
      structureType: project.structureType || 'wbs',
      snapshot: snapshot as any,
      sourceProjectId: input.projectId,
      createdBy: input.createdBy,
    },
  });

  return summarize(created);
}

export async function listTemplates(orgId: string): Promise<TemplateSummary[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.projectTemplate.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(summarize);
}

export async function getTemplate(id: string): Promise<TemplateDetail | null> {
  const prisma = getPrismaClient();
  const row = await prisma.projectTemplate.findUnique({ where: { id } });
  if (!row) return null;
  return {
    ...summarize(row),
    items: Array.isArray(row.snapshot) ? (row.snapshot as unknown as TemplateItemSnapshot[]) : [],
  };
}

export async function deleteTemplate(id: string, orgId: string): Promise<{ deleted: boolean }> {
  const prisma = getPrismaClient();
  const row = await prisma.projectTemplate.findUnique({ where: { id } });
  if (!row) {
    return { deleted: false };
  }
  if (row.orgId !== orgId) {
    throw new Error('Template does not belong to the specified org');
  }
  await prisma.projectTemplate.delete({ where: { id } });
  return { deleted: true };
}

export async function applyTemplate(input: {
  templateId: string;
  projectId: string;
  orgId: string;
}): Promise<{ created: number; skipped: number }> {
  const prisma = getPrismaClient();

  const template = await prisma.projectTemplate.findUnique({ where: { id: input.templateId } });
  if (!template) {
    throw new Error('Template not found');
  }
  if (template.orgId !== input.orgId) {
    throw new Error('Template does not belong to the specified org');
  }

  // Verify target project is in the same org and matches the template's
  // structure type (so a WBS template doesn't accidentally apply to a
  // cost-code project, which would produce silently-misnamed items).
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { orgId: true, structureType: true },
  });
  if (!project) {
    throw new Error('Target project not found');
  }
  if (project.orgId !== input.orgId) {
    throw new Error('Target project does not belong to the specified org');
  }
  if ((project.structureType || 'wbs') !== template.structureType) {
    throw new Error(
      `Template structure type "${template.structureType}" does not match project structure type "${project.structureType || 'wbs'}"`
    );
  }

  const items = Array.isArray(template.snapshot) ? (template.snapshot as unknown as TemplateItemSnapshot[]) : [];
  if (items.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // Pre-load existing items for the target project so we can dedupe by code.
  const existing = await prisma.workBreakdownItem.findMany({
    where: { projectId: input.projectId, structureType: template.structureType },
    select: { code: true },
  });
  const existingCodes = new Set(existing.map((e) => e.code));

  // Build a code→parentId map as we go, so child items can reference parents
  // that were just created in this loop.
  const codeToId = new Map<string, string>();
  for (const e of existing) {
    // Existing items aren't useful as parent refs (we'd overwrite) but the
    // dedupe is what matters. We don't try to graft new items into a tree
    // that has unknown structure.
  }

  // Process in level order so parents are created before children. Sort by
  // level asc, code asc.
  const sorted = [...items].sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));

  let created = 0;
  let skipped = 0;
  for (const item of sorted) {
    if (existingCodes.has(item.code)) {
      skipped++;
      continue;
    }
    const parentId = item.parentCode ? codeToId.get(item.parentCode) || null : null;
    const newItem = await addWbsItem({
      projectId: input.projectId,
      code: item.code,
      name: item.name,
      parentId,
      level: item.level,
      responsibleParty: item.responsibleParty || null,
      budget: item.budget || null,
    });
    codeToId.set(item.code, newItem.id);
    created++;
  }

  return { created, skipped };
}

function summarize(row: any): TemplateSummary {
  const snapshot = Array.isArray(row.snapshot) ? row.snapshot : [];
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    description: row.description,
    structureType: row.structureType,
    itemCount: snapshot.length,
    sourceProjectId: row.sourceProjectId,
    createdBy: row.createdBy,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}
