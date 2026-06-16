import {
  parseXer,
  getXerProject,
  getXerWbsItems,
  getXerActivities,
  getXerRelationships,
  xerDateToDate,
  xerHoursToDays,
  xerLagHoursToDays,
  xerPredTypeToInternal,
  isXerMilestone,
  isXerCritical,
} from './xer-parser.service';

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

describe('xer-parser.service', () => {
  test('parseXer returns tables map', () => {
    const parsed = parseXer(SAMPLE_XER);
    expect(parsed.tables.has('PROJECT')).toBe(true);
    expect(parsed.tables.has('WBS')).toBe(true);
    expect(parsed.tables.has('TASK')).toBe(true);
    expect(parsed.tables.has('TASKPRED')).toBe(true);
  });

  test('getXerProject extracts project info', () => {
    const parsed = parseXer(SAMPLE_XER);
    const project = getXerProject(parsed);
    expect(project).not.toBeNull();
    expect(project!.projId).toBe('100');
    expect(project!.projShortName).toBe('DEMO');
    expect(project!.projName).toBe('Demo Project');
  });

  test('getXerWbsItems filters by project', () => {
    const parsed = parseXer(SAMPLE_XER);
    const wbs = getXerWbsItems(parsed, '100');
    expect(wbs).toHaveLength(2);
    expect(wbs[0].wbsShortName).toBe('1.0');
    expect(wbs[1].parentWbsId).toBe('1');
  });

  test('getXerActivities filters by project and parses fields', () => {
    const parsed = parseXer(SAMPLE_XER);
    const acts = getXerActivities(parsed, '100');
    expect(acts).toHaveLength(3);
    expect(acts[0].taskCode).toBe('A100');
    expect(acts[0].targetDurationHours).toBe(80);
    expect(acts[0].taskType).toBe('TT_Task');
    expect(acts[2].taskType).toBe('TT_FinMile');
  });

  test('getXerRelationships filters by project', () => {
    const parsed = parseXer(SAMPLE_XER);
    const rels = getXerRelationships(parsed, '100');
    expect(rels).toHaveLength(2);
    expect(rels[0].predType).toBe('PR_FS');
    expect(rels[0].lagHours).toBe(0);
  });

  test('xerDateToDate parses date strings', () => {
    const d = xerDateToDate('2024-02-01 08:00');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(1); // Feb
    expect(d.getDate()).toBe(1);
  });

  test('xerHoursToDays converts hours to days', () => {
    expect(xerHoursToDays(8)).toBe(1);
    expect(xerHoursToDays(80)).toBe(10);
    expect(xerHoursToDays(0)).toBe(0);
  });

  test('xerLagHoursToDays converts lag', () => {
    expect(xerLagHoursToDays(16)).toBe(2);
    expect(xerLagHoursToDays(-8)).toBe(-1);
  });

  test('xerPredTypeToInternal maps types', () => {
    expect(xerPredTypeToInternal('PR_FS')).toBe('FS');
    expect(xerPredTypeToInternal('PR_SS')).toBe('SS');
    expect(xerPredTypeToInternal('PR_FF')).toBe('FF');
    expect(xerPredTypeToInternal('PR_SF')).toBe('SF');
    expect(xerPredTypeToInternal('PR_XX')).toBe('FS');
  });

  test('isXerMilestone detects milestones', () => {
    expect(isXerMilestone('TT_FinMile')).toBe(true);
    expect(isXerMilestone('TT_Mile')).toBe(true);
    expect(isXerMilestone('TT_StartMile')).toBe(true);
    expect(isXerMilestone('TT_Task')).toBe(false);
  });

  test('isXerCritical detects critical activities', () => {
    expect(isXerCritical(0)).toBe(true);
    expect(isXerCritical(0.001)).toBe(true);
    expect(isXerCritical(8)).toBe(false);
    expect(isXerCritical(undefined)).toBe(false);
  });
});
