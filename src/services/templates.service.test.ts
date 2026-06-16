/**
 * Tests for the project templates service. Verifies save / list / get /
 * delete and apply — including tenant isolation and the idempotent
 * re-apply behavior.
 */

import * as templates from './templates.service';
import { getPrismaClient } from '../lib/prisma';

const mockProjectFindUnique = jest.fn();
const mockWorkBreakdownItemFindMany = jest.fn();
const mockWorkBreakdownItemCreate = jest.fn();
const mockProjectTemplateFindMany = jest.fn();
const mockProjectTemplateFindUnique = jest.fn();
const mockProjectTemplateCreate = jest.fn();
const mockProjectTemplateDelete = jest.fn();

jest.mock('../lib/prisma', () => ({
  getPrismaClient: () => ({
    project: { findUnique: mockProjectFindUnique },
    workBreakdownItem: { findMany: mockWorkBreakdownItemFindMany, create: mockWorkBreakdownItemCreate },
    projectTemplate: {
      findMany: mockProjectTemplateFindMany,
      findUnique: mockProjectTemplateFindUnique,
      create: mockProjectTemplateCreate,
      delete: mockProjectTemplateDelete,
    },
  }),
}));

const m = {
  project: { findUnique: mockProjectFindUnique },
  workBreakdownItem: { findMany: mockWorkBreakdownItemFindMany, create: mockWorkBreakdownItemCreate },
  projectTemplate: {
    findMany: mockProjectTemplateFindMany,
    findUnique: mockProjectTemplateFindUnique,
    create: mockProjectTemplateCreate,
    delete: mockProjectTemplateDelete,
  },
};

describe('templates.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveTemplate', () => {
    it('rejects an empty name', async () => {
      await expect(
        templates.saveTemplate({ orgId: 'o1', name: '', projectId: 'p1', createdBy: 'u1' })
      ).rejects.toThrow(/name/);
    });

    it('rejects when the source project does not exist', async () => {
      m.project.findUnique.mockResolvedValue(null);
      await expect(
        templates.saveTemplate({ orgId: 'o1', name: 'X', projectId: 'p1', createdBy: 'u1' })
      ).rejects.toThrow(/not found/);
    });

    it('rejects when the project belongs to a different org', async () => {
      m.project.findUnique.mockResolvedValue({ orgId: 'o2', structureType: 'wbs' });
      await expect(
        templates.saveTemplate({ orgId: 'o1', name: 'X', projectId: 'p1', createdBy: 'u1' })
      ).rejects.toThrow(/does not belong/);
    });

    it('saves a snapshot with code-name-level items (no project ids)', async () => {
      m.project.findUnique.mockResolvedValue({ orgId: 'o1', structureType: 'wbs' });
      m.workBreakdownItem.findMany.mockResolvedValue([
        { id: 'a', code: '01', name: 'Engineering', parentId: null, level: 1 },
        { id: 'b', code: '01.01', name: 'Detail', parentId: 'a', level: 2 },
      ]);
      m.projectTemplate.create.mockImplementation(async ({ data }: any) => ({
        id: 't1',
        ...data,
        createdAt: new Date(),
        snapshot: data.snapshot,
      }));

      const result = await templates.saveTemplate({ orgId: 'o1', name: 'Office', projectId: 'p1', createdBy: 'u1' });
      expect(result.id).toBe('t1');
      expect(result.itemCount).toBe(2);
      // Verify the snapshot has no project ids
      const createArg = m.projectTemplate.create.mock.calls[0][0].data;
      expect(createArg.snapshot).toEqual([
        { code: '01', name: 'Engineering', parentCode: null, level: 1, responsibleParty: null, budget: null },
        { code: '01.01', name: 'Detail', parentCode: '01', level: 2, responsibleParty: null, budget: null },
      ]);
    });
  });

  describe('listTemplates', () => {
    it('returns summaries for an org', async () => {
      m.projectTemplate.findMany.mockResolvedValue([
        { id: 't1', orgId: 'o1', name: 'X', description: null, structureType: 'wbs', snapshot: [{code:'01'}], sourceProjectId: null, createdBy: 'u1', createdAt: new Date('2026-06-12') },
      ]);
      const list = await templates.listTemplates('o1');
      expect(list).toHaveLength(1);
      expect(list[0].itemCount).toBe(1);
    });
  });

  describe('getTemplate', () => {
    it('returns detail with items', async () => {
      m.projectTemplate.findUnique.mockResolvedValue({
        id: 't1', orgId: 'o1', name: 'X', description: 'desc', structureType: 'wbs',
        snapshot: [{code:'01', name:'Eng', parentCode:null, level:1}],
        sourceProjectId: 'p1', createdBy: 'u1', createdAt: new Date('2026-06-12'),
      });
      const t = await templates.getTemplate('t1');
      expect(t!.items).toHaveLength(1);
      expect(t!.items[0].code).toBe('01');
    });

    it('returns null when not found', async () => {
      m.projectTemplate.findUnique.mockResolvedValue(null);
      expect(await templates.getTemplate('missing')).toBeNull();
    });
  });

  describe('deleteTemplate', () => {
    it('refuses to delete a template from another org', async () => {
      m.projectTemplate.findUnique.mockResolvedValue({ id: 't1', orgId: 'o2' });
      await expect(templates.deleteTemplate('t1', 'o1')).rejects.toThrow(/does not belong/);
    });

    it('deletes when the org matches', async () => {
      m.projectTemplate.findUnique.mockResolvedValue({ id: 't1', orgId: 'o1' });
      m.projectTemplate.delete.mockResolvedValue({ id: 't1' });
      const result = await templates.deleteTemplate('t1', 'o1');
      expect(result.deleted).toBe(true);
    });
  });

  describe('applyTemplate', () => {
    it('rejects when template is from another org', async () => {
      m.projectTemplate.findUnique.mockResolvedValue({ id: 't1', orgId: 'o2', structureType: 'wbs', snapshot: [] });
      await expect(
        templates.applyTemplate({ templateId: 't1', projectId: 'p1', orgId: 'o1' })
      ).rejects.toThrow(/does not belong/);
    });

    it('rejects when target project is from another org', async () => {
      m.projectTemplate.findUnique.mockResolvedValue({ id: 't1', orgId: 'o1', structureType: 'wbs', snapshot: [] });
      m.project.findUnique.mockResolvedValue({ orgId: 'o2', structureType: 'wbs' });
      await expect(
        templates.applyTemplate({ templateId: 't1', projectId: 'p1', orgId: 'o1' })
      ).rejects.toThrow(/does not belong/);
    });

    it('rejects when structure types do not match', async () => {
      m.projectTemplate.findUnique.mockResolvedValue({ id: 't1', orgId: 'o1', structureType: 'wbs', snapshot: [] });
      m.project.findUnique.mockResolvedValue({ orgId: 'o1', structureType: 'cost_code' });
      await expect(
        templates.applyTemplate({ templateId: 't1', projectId: 'p1', orgId: 'o1' })
      ).rejects.toThrow(/structure type/i);
    });

    it('creates items in level order, skipping existing codes', async () => {
      m.projectTemplate.findUnique.mockResolvedValue({
        id: 't1', orgId: 'o1', structureType: 'wbs',
        snapshot: [
          { code: '01', name: 'Eng', parentCode: null, level: 1 },
          { code: '01.01', name: 'Detail', parentCode: '01', level: 2 },
        ],
        createdAt: new Date(),
      });
      m.project.findUnique.mockResolvedValue({ orgId: 'o1', structureType: 'wbs' });
      // 01 already exists in target
      m.workBreakdownItem.findMany.mockResolvedValue([{ code: '01' }]);
      let i = 100;
      m.workBreakdownItem.create.mockImplementation(async ({ data }: any) => ({
        id: `id-${i++}`, ...data,
      }));

      const result = await templates.applyTemplate({ templateId: 't1', projectId: 'p1', orgId: 'o1' });
      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      // The one create call should be for the child
      const createdCodes = m.workBreakdownItem.create.mock.calls.map((c: any) => c[0].data.code);
      expect(createdCodes).toEqual(['01.01']);
    });

    it('re-apply is idempotent — no duplicates on second call', async () => {
      m.projectTemplate.findUnique.mockResolvedValue({
        id: 't1', orgId: 'o1', structureType: 'wbs',
        snapshot: [{ code: '01', name: 'Eng', parentCode: null, level: 1 }],
        createdAt: new Date(),
      });
      m.project.findUnique.mockResolvedValue({ orgId: 'o1', structureType: 'wbs' });
      // First call: nothing exists; second call: 01 exists
      m.workBreakdownItem.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ code: '01' }]);
      m.workBreakdownItem.create.mockResolvedValue({ id: 'new1' });

      const first = await templates.applyTemplate({ templateId: 't1', projectId: 'p1', orgId: 'o1' });
      const second = await templates.applyTemplate({ templateId: 't1', projectId: 'p1', orgId: 'o1' });
      expect(first.created).toBe(1);
      expect(second.created).toBe(0);
      expect(second.skipped).toBe(1);
    });
  });
});
