import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import { importMsProjectSchedule } from './schedule-import-msproject.service';
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

const SAMPLE_MSP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Demo MSP</Name>
  <Tasks>
    <Task>
      <UID>1</UID>
      <ID>1</ID>
      <Name>Site Prep</Name>
      <WBS>1.1</WBS>
      <Start>2024-03-01T08:00:00</Start>
      <Finish>2024-03-05T17:00:00</Finish>
      <Duration>P5DT0H0M0S</Duration>
      <PercentComplete>50</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>0</Summary>
      <OutlineLevel>2</OutlineLevel>
    </Task>
    <Task>
      <UID>2</UID>
      <ID>2</ID>
      <Name>Foundation</Name>
      <WBS>1.2</WBS>
      <Start>2024-03-06T08:00:00</Start>
      <Finish>2024-03-15T17:00:00</Finish>
      <Duration>P10DT0H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>0</Summary>
      <OutlineLevel>2</OutlineLevel>
    </Task>
    <Task>
      <UID>3</UID>
      <ID>3</ID>
      <Name>Milestone</Name>
      <WBS>1.3</WBS>
      <Start>2024-03-15T08:00:00</Start>
      <Finish>2024-03-15T17:00:00</Finish>
      <Duration>P0DT0H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
      <Milestone>1</Milestone>
      <Summary>0</Summary>
      <OutlineLevel>2</OutlineLevel>
      <PredecessorLink>
        <PredecessorUID>2</PredecessorUID>
        <Type>1</Type>
        <LinkLag>0</LinkLag>
        <LagFormat>5</LagFormat>
      </PredecessorLink>
    </Task>
    <Task>
      <UID>4</UID>
      <ID>4</ID>
      <Name>Phase 1 Summary</Name>
      <WBS>1</WBS>
      <Start>2024-03-01T08:00:00</Start>
      <Finish>2024-03-15T17:00:00</Finish>
      <Duration>P15DT0H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>1</Summary>
      <OutlineLevel>1</OutlineLevel>
    </Task>
  </Tasks>
</Project>`;

describe('schedule-import-msproject.service', () => {
  test('importMsProjectSchedule creates activities and relationships', async () => {
    mockProjectFindUnique.mockResolvedValue({ structureType: 'wbs', structureLocked: false });
    mockWorkBreakdownItemFindFirst.mockResolvedValue({ id: 'wbs-1' });
    mockScheduleActivityCreate
      .mockResolvedValueOnce({ id: 'act-1' })
      .mockResolvedValueOnce({ id: 'act-2' })
      .mockResolvedValueOnce({ id: 'act-3' });
    mockActivityRelationshipCreate.mockResolvedValue({ id: 'rel-1' });

    const result = await importMsProjectSchedule('proj-1', SAMPLE_MSP_XML);

    expect(result.projectId).toBe('proj-1');
    expect(result.importedActivities).toBe(3); // excludes summary task
    expect(result.importedRelationships).toBe(1);
    expect(result.mspProjectName).toBe('Demo MSP');
    expect(recalculateSchedule).toHaveBeenCalledWith('proj-1');
  });

  test('importMsProjectSchedule maps status from percent complete', async () => {
    mockProjectFindUnique.mockResolvedValue({ structureType: 'wbs', structureLocked: false });
    mockWorkBreakdownItemFindFirst.mockResolvedValue({ id: 'wbs-1' });
    mockScheduleActivityCreate.mockResolvedValue({ id: 'act-1' });
    mockActivityRelationshipCreate.mockResolvedValue({ id: 'rel-1' });

    await importMsProjectSchedule('proj-1', SAMPLE_MSP_XML);

    const sitePrepCall = mockScheduleActivityCreate.mock.calls[0];
    expect(sitePrepCall[0].data.percentComplete).toBe(0.5);
    expect(sitePrepCall[0].data.status).toBe('in_progress');
  });

  test('importMsProjectSchedule skips duplicate relationships', async () => {
    mockProjectFindUnique.mockResolvedValue({ structureType: 'wbs', structureLocked: false });
    mockWorkBreakdownItemFindFirst.mockResolvedValue({ id: 'wbs-1' });
    mockScheduleActivityCreate
      .mockResolvedValueOnce({ id: 'act-1' })
      .mockResolvedValueOnce({ id: 'act-2' })
      .mockResolvedValueOnce({ id: 'act-3' });

    mockActivityRelationshipCreate
      .mockResolvedValueOnce({ id: 'rel-1' })
      .mockRejectedValueOnce(new Error('Unique constraint failed'));

    const result = await importMsProjectSchedule('proj-1', SAMPLE_MSP_XML);
    expect(result.importedRelationships).toBe(1);
  });
});
