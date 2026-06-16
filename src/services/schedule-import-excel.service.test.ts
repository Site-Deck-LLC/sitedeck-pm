import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import { importExcelSchedule } from './schedule-import-excel.service';
import { recalculateSchedule } from './schedule.service';

jest.mock('./schedule.service', () => ({
  ...jest.requireActual('./schedule.service'),
  recalculateSchedule: jest.fn().mockResolvedValue(undefined),
}));

const mockProjectFindUnique = jest.fn();
const mockWorkBreakdownItemFindFirst = jest.fn();
const mockWorkBreakdownItemCreate = jest.fn();
const mockScheduleActivityCreate = jest.fn();
const mockActivityRelationshipCreate = jest.fn();

const mockPrisma = {
  project: {
    findUnique: mockProjectFindUnique,
  },
  workBreakdownItem: {
    findFirst: mockWorkBreakdownItemFindFirst,
    create: mockWorkBreakdownItemCreate,
  },
  scheduleActivity: {
    create: mockScheduleActivityCreate,
  },
  activityRelationship: {
    create: mockActivityRelationshipCreate,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.clearAllMocks();
  setPrismaClient(mockPrisma);
});

function makeCsv(rows: string[][]): Buffer {
  const lines = rows.map((r) => r.map((c) => {
    if (c.includes(',') || c.includes('"') || c.includes('\n')) {
      return `"${c.replace(/"/g, '""')}"`;
    }
    return c;
  }).join(','));
  return Buffer.from(lines.join('\n'), 'utf-8');
}

describe('schedule-import-excel.service', () => {
  test('importExcelSchedule creates activities, WBS, and relationships from CSV', async () => {
    mockProjectFindUnique.mockResolvedValue({ structureType: 'wbs', structureLocked: false });
    mockWorkBreakdownItemFindFirst.mockResolvedValue({ id: 'wbs-1' });
    mockScheduleActivityCreate
      .mockResolvedValueOnce({ id: 'act-1' })
      .mockResolvedValueOnce({ id: 'act-2' })
      .mockResolvedValueOnce({ id: 'act-3' });
    mockActivityRelationshipCreate.mockResolvedValue({ id: 'rel-1' });

    const csv = makeCsv([
      ['Activity Name', 'WBS Code', 'Start Date', 'End Date', 'Duration', 'Percent Complete', 'Status', 'Milestone', 'Predecessors', 'Relationship Type', 'Lag (days)'],
      ['Site Prep', '1.1', '2024-03-01', '2024-03-05', '5', '50', 'in_progress', 'FALSE', '', '', '0'],
      ['Foundation', '1.2', '2024-03-06', '2024-03-15', '10', '0', 'not_started', 'FALSE', 'Site Prep', 'FS', '0'],
      ['Milestone', '1.3', '2024-03-15', '2024-03-15', '0', '0', 'not_started', 'TRUE', 'Foundation', 'FS', '0'],
    ]);

    const result = await importExcelSchedule('proj-1', csv, 'schedule.csv');

    expect(result.projectId).toBe('proj-1');
    expect(result.importedActivities).toBe(3);
    expect(result.importedRelationships).toBe(2);
    expect(result.importedWbsItems).toBe(3);
    expect(recalculateSchedule).toHaveBeenCalledWith('proj-1');
  });

  test('importExcelSchedule skips duplicate relationships', async () => {
    mockProjectFindUnique.mockResolvedValue({ structureType: 'wbs', structureLocked: false });
    mockWorkBreakdownItemFindFirst.mockResolvedValue({ id: 'wbs-1' });
    mockScheduleActivityCreate
      .mockResolvedValueOnce({ id: 'act-1' })
      .mockResolvedValueOnce({ id: 'act-2' });

    mockActivityRelationshipCreate
      .mockResolvedValueOnce({ id: 'rel-1' })
      .mockRejectedValueOnce(new Error('Unique constraint failed'));

    const csv = makeCsv([
      ['Activity Name', 'Start Date', 'End Date', 'Duration', 'Predecessors'],
      ['Task A', '2024-01-01', '2024-01-05', '4', ''],
      ['Task B', '2024-01-06', '2024-01-10', '4', 'Task A'],
    ]);

    const result = await importExcelSchedule('proj-1', csv, 'schedule.csv');
    expect(result.importedRelationships).toBe(1);
  });

  test('importExcelSchedule handles empty file gracefully', async () => {
    mockProjectFindUnique.mockResolvedValue({ structureType: 'wbs', structureLocked: false });
    const csv = Buffer.from('Name,Start Date,End Date,Duration\n', 'utf-8');
    const result = await importExcelSchedule('proj-1', csv, 'schedule.csv');
    expect(result.importedActivities).toBe(0);
    expect(result.importedRelationships).toBe(0);
  });
});
