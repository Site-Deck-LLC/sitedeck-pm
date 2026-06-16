import {
  parseExcelSchedule,
} from './excel-schedule-parser.service';

function makeCsv(rows: string[][]): Buffer {
  const lines = rows.map((r) => r.map((c) => {
    if (c.includes(',') || c.includes('"') || c.includes('\n')) {
      return `"${c.replace(/"/g, '""')}"`;
    }
    return c;
  }).join(','));
  return Buffer.from(lines.join('\n'), 'utf-8');
}

describe('excel-schedule-parser.service', () => {
  test('parseExcelSchedule parses CSV with standard headers', () => {
    const csv = makeCsv([
      ['Activity Name', 'WBS Code', 'Start Date', 'End Date', 'Duration', 'Percent Complete', 'Status', 'Milestone', 'Predecessors', 'Relationship Type', 'Lag (days)'],
      ['Site Prep', '1.1', '2024-03-01', '2024-03-05', '5', '50', 'in_progress', 'FALSE', '', '', '0'],
      ['Foundation', '1.2', '2024-03-06', '2024-03-15', '10', '0', 'not_started', 'FALSE', 'Site Prep', 'FS', '0'],
      ['Milestone', '1.3', '2024-03-15', '2024-03-15', '0', '0', 'not_started', 'TRUE', 'Foundation', 'FS', '0'],
    ]);

    const result = parseExcelSchedule(csv, 'schedule.csv');
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Site Prep');
    expect(result[0].wbsCode).toBe('1.1');
    expect(result[0].startDate).toBe('2024-03-01');
    expect(result[0].duration).toBe(5);
    expect(result[0].percentComplete).toBe(0.5);
    expect(result[0].status).toBe('in_progress');
    expect(result[0].milestone).toBe(false);

    expect(result[1].predecessors).toBe('Site Prep');
    expect(result[1].relationshipType).toBe('FS');

    expect(result[2].milestone).toBe(true);
    expect(result[2].duration).toBe(0);
  });

  test('parseExcelSchedule skips empty rows', () => {
    const csv = makeCsv([
      ['Name', 'Start Date', 'End Date', 'Duration'],
      ['', '', '', ''],
      ['Task A', '2024-01-01', '2024-01-05', '4'],
    ]);
    const result = parseExcelSchedule(csv, 'schedule.csv');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Task A');
  });

  test('parseExcelSchedule normalizes various date formats', () => {
    const csv = makeCsv([
      ['Name', 'Start Date', 'End Date', 'Duration'],
      ['Task A', '2024-01-15', '2024-01-20', '5'],
      ['Task B', '01/15/2024', '01/20/2024', '5'],
      ['Task C', '01-15-2024', '01-20-2024', '5'],
    ]);
    const result = parseExcelSchedule(csv, 'schedule.csv');
    expect(result[0].startDate).toBe('2024-01-15');
    expect(result[1].startDate).toBe('2024-01-15');
    expect(result[2].startDate).toBe('2024-01-15');
  });

  test('parseExcelSchedule normalizes percent complete to fraction', () => {
    const csv = makeCsv([
      ['Name', 'Start Date', 'End Date', 'Duration', 'Percent Complete'],
      ['Task A', '2024-01-01', '2024-01-05', '4', '75'],
    ]);
    const result = parseExcelSchedule(csv, 'schedule.csv');
    expect(result[0].percentComplete).toBe(0.75);
  });

  test('parseExcelSchedule infers status from percent complete', () => {
    const csv = makeCsv([
      ['Name', 'Start Date', 'End Date', 'Duration', 'Percent Complete'],
      ['Task A', '2024-01-01', '2024-01-05', '4', '100'],
      ['Task B', '2024-01-01', '2024-01-05', '4', '50'],
      ['Task C', '2024-01-01', '2024-01-05', '4', '0'],
    ]);
    const result = parseExcelSchedule(csv, 'schedule.csv');
    expect(result[0].status).toBe('complete');
    expect(result[1].status).toBe('in_progress');
    expect(result[2].status).toBe('not_started');
  });

  test('parseExcelSchedule handles missing optional columns', () => {
    const csv = makeCsv([
      ['Name', 'Start Date', 'End Date', 'Duration'],
      ['Task A', '2024-01-01', '2024-01-05', '4'],
    ]);
    const result = parseExcelSchedule(csv, 'schedule.csv');
    expect(result).toHaveLength(1);
    expect(result[0].wbsCode).toBeUndefined();
    expect(result[0].percentComplete).toBe(0);
    expect(result[0].milestone).toBe(false);
  });
});
