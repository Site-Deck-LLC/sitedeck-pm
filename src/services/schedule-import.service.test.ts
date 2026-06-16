import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import { importXerSchedule } from './schedule-import.service';
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

const SAMPLE_XER = `ERMHDR\t2.0\t2024-01-15 08:30\n
%T\tPROJECT\n
%F\tproj_id\tproj_short_name\tproj_name\n
%R\t100\tDEMO\tDemo Project\n
%T\tWBS\n
%F\twbs_id\twbs_short_name\twbs_name\tparent_wbs_id\tproj_id\n
%R\t1\t1.0\tProject Root\t\t100\n
%R\t2\t1.1\tSubstructure\t1\t100\n
%T\tTASK\n
%F\ttask_id\ttask_code\ttask_name\twbs_id\tproj_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tact_start_date\tact_end_date\ttask_type\ttotal_float_hr_cnt\tfree_float_hr_cnt\n
%R\t10\tA100\tExcavation\t2\t100\t2024-02-01 08:00\t2024-02-10 17:00\t80\t\t\tTT_Task\t0\t0\n
%R\t20\tA200\tConcrete Pour\t2\t100\t2024-02-11 08:00\t2024-02-20 17:00\t80\t\t\tTT_Task\t0\t0\n
%R\t30\tA300\tFoundation Complete\t2\t100\t2024-02-20 08:00\t2024-02-20 17:00\t0\t\t\tTT_FinMile\t0\t0\n
%T\tTASKPRED\n
%F\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt\tproj_id\n
%R\t20\t10\tPR_FS\t0\t100\n
%R\t30\t20\tPR_FS\t0\t100\n
%E\n`;

describe('schedule-import.service', () => {
  test('importXerSchedule creates activities, WBS, and relationships', async () => {
    mockProjectFindUnique.mockResolvedValue({ structureType: 'wbs', structureLocked: false });

    // WBS: first not found, second found after first created
    mockWorkBreakdownItemFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'wbs-1' })
      .mockResolvedValueOnce({ id: 'wbs-2' });

    mockWorkBreakdownItemCreate
      .mockResolvedValueOnce({ id: 'wbs-1' })
      .mockResolvedValueOnce({ id: 'wbs-2' });

    mockScheduleActivityCreate
      .mockResolvedValueOnce({ id: 'act-10' })
      .mockResolvedValueOnce({ id: 'act-20' })
      .mockResolvedValueOnce({ id: 'act-30' });

    mockActivityRelationshipCreate
      .mockResolvedValueOnce({ id: 'rel-1' })
      .mockResolvedValueOnce({ id: 'rel-2' });

    const result = await importXerSchedule('proj-1', SAMPLE_XER);

    expect(result.projectId).toBe('proj-1');
    expect(result.importedActivities).toBe(3);
    expect(result.importedRelationships).toBe(2);
    expect(result.importedWbsItems).toBe(2);
    expect(result.xerProjectName).toBe('Demo Project');

    expect(mockScheduleActivityCreate).toHaveBeenCalledTimes(3);
    expect(mockActivityRelationshipCreate).toHaveBeenCalledTimes(2);
    expect(recalculateSchedule).toHaveBeenCalledWith('proj-1');
  });

  test('importXerSchedule creates milestone with zero duration', async () => {
    mockProjectFindUnique.mockResolvedValue({ structureType: 'wbs', structureLocked: false });
    mockWorkBreakdownItemFindFirst.mockResolvedValue({ id: 'wbs-2' });
    mockScheduleActivityCreate.mockResolvedValue({ id: 'act-30' });
    mockActivityRelationshipCreate.mockResolvedValue({ id: 'rel-1' });

    await importXerSchedule('proj-1', SAMPLE_XER);

    const milestoneCall = mockScheduleActivityCreate.mock.calls[2];
    expect(milestoneCall[0].data.isMilestone).toBe(true);
    expect(milestoneCall[0].data.duration).toBe(0);
  });

  test('importXerSchedule skips duplicate relationships', async () => {
    mockProjectFindUnique.mockResolvedValue({ structureType: 'wbs', structureLocked: false });
    mockWorkBreakdownItemFindFirst.mockResolvedValue({ id: 'wbs-2' });
    mockScheduleActivityCreate
      .mockResolvedValueOnce({ id: 'act-10' })
      .mockResolvedValueOnce({ id: 'act-20' })
      .mockResolvedValueOnce({ id: 'act-30' });

    // First relationship succeeds, second throws unique constraint
    mockActivityRelationshipCreate
      .mockResolvedValueOnce({ id: 'rel-1' })
      .mockRejectedValueOnce(new Error('Unique constraint failed on the fields: (`predecessorId`,`successorId`,`relationshipType`)'));

    const result = await importXerSchedule('proj-1', SAMPLE_XER);

    expect(result.importedRelationships).toBe(1);
  });

  test('importXerSchedule handles missing project gracefully', async () => {
    mockProjectFindUnique.mockResolvedValue(null);
    mockWorkBreakdownItemFindFirst.mockResolvedValue(null);
    mockWorkBreakdownItemCreate.mockResolvedValue({ id: 'wbs-1' });
    mockScheduleActivityCreate.mockResolvedValue({ id: 'act-1' });
    mockActivityRelationshipCreate.mockResolvedValue({ id: 'rel-1' });

    const result = await importXerSchedule('proj-1', SAMPLE_XER);
    expect(result.importedActivities).toBe(3);
  });
});
