import * as XLSX from 'xlsx';

export interface ExcelScheduleRow {
  name: string;
  wbsCode?: string;
  startDate: string;
  endDate: string;
  duration: number;
  percentComplete?: number;
  status?: string;
  milestone?: boolean;
  predecessors?: string; // comma-separated predecessor names/codes
  relationshipType?: string;
  lagDays?: number;
}

const HEADER_MAP: Record<string, string> = {
  'activity name': 'name',
  'name': 'name',
  'task name': 'name',
  'wbs': 'wbsCode',
  'wbs code': 'wbsCode',
  'wbsCode': 'wbsCode',
  'start': 'startDate',
  'start date': 'startDate',
  'startDate': 'startDate',
  'finish': 'endDate',
  'end': 'endDate',
  'end date': 'endDate',
  'finish date': 'endDate',
  'endDate': 'endDate',
  'duration': 'duration',
  'duration (days)': 'duration',
  '% complete': 'percentComplete',
  'percent complete': 'percentComplete',
  'percentComplete': 'percentComplete',
  'status': 'status',
  'milestone': 'milestone',
  'predecessors': 'predecessors',
  'pred': 'predecessors',
  'relationship type': 'relationshipType',
  'relationshipType': 'relationshipType',
  'lag': 'lagDays',
  'lag (days)': 'lagDays',
  'lagDays': 'lagDays',
};

function normalizeHeader(header: string): string {
  return header.toString().trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

function parseDate(value: string | number): string {
  if (!value) return '';
  if (typeof value === 'number') {
    // Excel serial date
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + value * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  }
  const str = String(value).trim();
  // Try common formats
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const [m, d, y] = str.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{1,2}-\d{1,2}-\d{4}/.test(str)) {
    const [m, d, y] = str.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return str;
}

function parseNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseBoolean(value: string | number): boolean {
  if (typeof value === 'boolean') return value;
  if (!value) return false;
  const str = String(value).trim().toLowerCase();
  return str === '1' || str === 'true' || str === 'yes' || str === 'y';
}

export function parseExcelSchedule(buffer: Buffer, filename: string): ExcelScheduleRow[] {
  const isCsv = filename.toLowerCase().endsWith('.csv');
  const workbook = isCsv
    ? XLSX.read(buffer.toString('utf-8'), { type: 'string', raw: true })
    : XLSX.read(buffer, { type: 'buffer' });

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const jsonRows: Array<Record<string, string | number>> = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as Array<Record<string, string | number>>;

  if (jsonRows.length < 2) return [];

  const rawHeaders = jsonRows[0] as unknown as string[];
  const mappedHeaders = rawHeaders.map((h) => {
    const norm = normalizeHeader(h);
    return HEADER_MAP[norm] || norm;
  });

  const rows: ExcelScheduleRow[] = [];

  for (let i = 1; i < jsonRows.length; i++) {
    const rawRow = jsonRows[i] as unknown as (string | number)[];
    const row: Record<string, string | number> = {};
    for (let j = 0; j < mappedHeaders.length; j++) {
      row[mappedHeaders[j]] = rawRow[j] || '';
    }

    const name = String(row.name || '').trim();
    if (!name) continue;

    const startDate = parseDate(row.startDate || '');
    const endDate = parseDate(row.endDate || '');
    if (!startDate || !endDate) continue;

    const duration = Math.max(0, parseNumber(row.duration || 0));
    const rawPct = parseNumber(row.percentComplete || 0);
    const percentComplete = rawPct > 1 ? rawPct / 100 : rawPct;
    const status = String(row.status || '').trim().toLowerCase();
    const milestone = parseBoolean(row.milestone || 'false');

    rows.push({
      name,
      wbsCode: row.wbsCode ? String(row.wbsCode).trim() : undefined,
      startDate,
      endDate,
      duration: milestone ? 0 : Math.max(1, duration),
      percentComplete,
      status: status || (percentComplete >= 1 ? 'complete' : percentComplete > 0 ? 'in_progress' : 'not_started'),
      milestone,
      predecessors: row.predecessors ? String(row.predecessors).trim() : undefined,
      relationshipType: row.relationshipType ? String(row.relationshipType).trim().toUpperCase() : undefined,
      lagDays: parseNumber(row.lagDays || 0),
    });
  }

  return rows;
}
