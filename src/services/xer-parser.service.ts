export interface XerTable {
  name: string;
  fields: string[];
  rows: Record<string, string>[];
}

export interface ParsedXer {
  header: Record<string, string>;
  tables: Map<string, XerTable>;
}

export interface XerActivity {
  taskId: string;
  taskCode: string;
  taskName: string;
  wbsId: string;
  projId: string;
  targetStartDate: string;
  targetEndDate: string;
  targetDurationHours: number;
  actualStartDate?: string;
  actualEndDate?: string;
  taskType: string;
  totalFloatHours?: number;
  freeFloatHours?: number;
}

export interface XerRelationship {
  taskId: string; // successor
  predTaskId: string; // predecessor
  predType: string; // PR_FS, PR_SS, PR_FF, PR_SF
  lagHours: number;
  projId: string;
}

export interface XerWbs {
  wbsId: string;
  wbsShortName: string;
  wbsName: string;
  parentWbsId?: string;
  projId: string;
}

export interface XerProject {
  projId: string;
  projShortName: string;
  projName: string;
}

const XER_HOURS_PER_DAY = 8;

/**
 * Parse a P6 XER file (text format) into structured tables.
 * XER format uses %T (table name), %F (field list), %R (row data), %E (end).
 */
export function parseXer(content: string): ParsedXer {
  const lines = content.split(/\r?\n/);
  const tables = new Map<string, XerTable>();
  let header: Record<string, string> = {};
  let currentTable: XerTable | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('%T')) {
      const rest = line.slice(2).trim();
      const parts = rest.split('\t');
      const tableName = parts[0] || rest;
      currentTable = { name: tableName, fields: [], rows: [] };
      tables.set(tableName, currentTable);
    } else if (line.startsWith('%F')) {
      if (currentTable) {
        currentTable.fields = line.slice(2).trim().split('\t');
      }
    } else if (line.startsWith('%R')) {
      if (currentTable && currentTable.fields.length > 0) {
        const values = line.slice(2).trim().split('\t');
        const row: Record<string, string> = {};
        for (let i = 0; i < currentTable.fields.length; i++) {
          row[currentTable.fields[i]] = values[i] || '';
        }
        currentTable.rows.push(row);
      }
    } else if (line.startsWith('%E')) {
      currentTable = null;
    } else if (line.startsWith('ERMHDR')) {
      // Header line: ERMHDR\tversion\t... (not critical for our parsing)
      const parts = line.split('\t');
      header = { version: parts[1] || '', exportDate: parts[2] || '' };
    }
  }

  return { header, tables };
}

export function getXerProject(parsed: ParsedXer): XerProject | null {
  const table = parsed.tables.get('PROJECT');
  if (!table || table.rows.length === 0) return null;
  const row = table.rows[0];
  return {
    projId: row.proj_id || row.proj_id || '',
    projShortName: row.proj_short_name || '',
    projName: row.proj_name || '',
  };
}

export function getXerWbsItems(parsed: ParsedXer, projId?: string): XerWbs[] {
  const table = parsed.tables.get('WBS');
  if (!table) return [];
  return table.rows
    .filter((r) => !projId || r.proj_id === projId)
    .map((r) => ({
      wbsId: r.wbs_id || '',
      wbsShortName: r.wbs_short_name || '',
      wbsName: r.wbs_name || '',
      parentWbsId: r.parent_wbs_id || undefined,
      projId: r.proj_id || '',
    }));
}

export function getXerActivities(parsed: ParsedXer, projId?: string): XerActivity[] {
  const table = parsed.tables.get('TASK');
  if (!table) return [];
  return table.rows
    .filter((r) => !projId || r.proj_id === projId)
    .map((r) => ({
      taskId: r.task_id || '',
      taskCode: r.task_code || '',
      taskName: r.task_name || '',
      wbsId: r.wbs_id || '',
      projId: r.proj_id || '',
      targetStartDate: r.target_start_date || '',
      targetEndDate: r.target_end_date || '',
      targetDurationHours: parseFloat(r.target_drtn_hr_cnt || '0'),
      actualStartDate: r.act_start_date || undefined,
      actualEndDate: r.act_end_date || undefined,
      taskType: r.task_type || '',
      totalFloatHours: r.total_float_hr_cnt ? parseFloat(r.total_float_hr_cnt) : undefined,
      freeFloatHours: r.free_float_hr_cnt ? parseFloat(r.free_float_hr_cnt) : undefined,
    }));
}

export function getXerRelationships(parsed: ParsedXer, projId?: string): XerRelationship[] {
  const table = parsed.tables.get('TASKPRED');
  if (!table) return [];
  return table.rows
    .filter((r) => !projId || r.proj_id === projId)
    .map((r) => ({
      taskId: r.task_id || '',
      predTaskId: r.pred_task_id || '',
      predType: r.pred_type || 'PR_FS',
      lagHours: parseFloat(r.lag_hr_cnt || '0'),
      projId: r.proj_id || '',
    }));
}

export function xerDateToDate(xerDate: string): Date {
  if (!xerDate) return new Date();
  // XER dates are typically YYYY-MM-DD HH:MM or YYYY-MM-DD
  const clean = xerDate.trim();
  if (clean.includes(' ')) {
    return new Date(clean.replace(' ', 'T'));
  }
  return new Date(clean);
}

export function xerHoursToDays(hours: number): number {
  return Math.ceil(hours / XER_HOURS_PER_DAY);
}

export function xerLagHoursToDays(hours: number): number {
  return Math.round(hours / XER_HOURS_PER_DAY);
}

export function xerPredTypeToInternal(predType: string): 'FS' | 'SS' | 'FF' | 'SF' {
  const map: Record<string, 'FS' | 'SS' | 'FF' | 'SF'> = {
    PR_FS: 'FS',
    PR_SS: 'SS',
    PR_FF: 'FF',
    PR_SF: 'SF',
  };
  return map[predType] || 'FS';
}

export function isXerMilestone(taskType: string): boolean {
  return taskType === 'TT_FinMile' || taskType === 'TT_Mile' || taskType === 'TT_StartMile';
}

export function isXerCritical(totalFloatHours?: number): boolean {
  if (totalFloatHours === undefined || totalFloatHours === null) return false;
  return totalFloatHours <= 0.001;
}
