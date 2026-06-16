import { XMLParser } from 'fast-xml-parser';

export interface MspProject {
  name: string;
  startDate: string;
  finishDate: string;
}

export interface MspTask {
  uid: string;
  id: string;
  name: string;
  wbs: string;
  startDate: string;
  finishDate: string;
  durationDays: number;
  percentComplete: number;
  milestone: boolean;
  summary: boolean;
  outlineLevel: number;
}

export interface MspRelationship {
  successorUid: string;
  predecessorUid: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lagDays: number;
}

function parseDurationToDays(duration: string): number {
  if (!duration) return 1;
  // ISO 8601 duration: P10DT0H0M0S or P1DT8H0M0S
  const match = duration.match(/P(\d+)D/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 1;
}

function parseLagToDays(lag: number, lagFormat: number): number {
  // MS Project stores lag in tenths of a minute by default.
  // LagFormat: 3=minutes, 4=hours, 5=days, 7=elapsed days, 8=weeks, 9=elapsed weeks, etc.
  // Simplification for V1: treat everything as days or elapsed days.
  const minutes = lag / 10;
  switch (lagFormat) {
    case 3:
      return Math.round(minutes / (8 * 60));
    case 4:
      return Math.round(minutes / 60 / 8);
    case 5:
    case 7:
      return Math.round(minutes / (8 * 60));
    case 8:
    case 9:
      return Math.round((minutes / (8 * 60)) * 5);
    default:
      return Math.round(minutes / (8 * 60));
  }
}

function mspTypeToInternal(type: number): 'FS' | 'SS' | 'FF' | 'SF' {
  // MS Project XML Type values:
  // 0 = FF, 1 = FS, 2 = SF, 3 = SS
  const map: Record<number, 'FS' | 'SS' | 'FF' | 'SF'> = {
    0: 'FF',
    1: 'FS',
    2: 'SF',
    3: 'SS',
  };
  return map[type] || 'FS';
}

function normalizeDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  // MS Project dates are typically YYYY-MM-DDTHH:MM:SS
  return new Date(dateStr);
}

export function parseMsProjectXml(content: string): {
  project: MspProject;
  tasks: MspTask[];
  relationships: MspRelationship[];
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
    trimValues: true,
  });

  const parsed = parser.parse(content);
  const proj = parsed.Project || {};

  const project: MspProject = {
    name: proj.Name || 'Untitled Project',
    startDate: proj.StartDate || '',
    finishDate: proj.FinishDate || '',
  };

  const tasks: MspTask[] = [];
  const taskMap = new Map<string, MspTask>();

  const rawTasks = proj.Tasks?.Task || [];
  const taskArray = Array.isArray(rawTasks) ? rawTasks : [rawTasks];

  for (const t of taskArray) {
    if (!t.UID) continue;

    const task: MspTask = {
      uid: String(t.UID),
      id: String(t.ID || t.UID),
      name: t.Name || 'Untitled Task',
      wbs: t.WBS || '',
      startDate: t.Start || '',
      finishDate: t.Finish || '',
      durationDays: parseDurationToDays(t.Duration || 'P1D'),
      percentComplete: parseFloat(t.PercentComplete || '0') / 100,
      milestone: String(t.Milestone || '0') === '1',
      summary: String(t.Summary || '0') === '1',
      outlineLevel: parseInt(t.OutlineLevel || '1', 10),
    };

    tasks.push(task);
    taskMap.set(task.uid, task);
  }

  const relationships: MspRelationship[] = [];

  for (const t of taskArray) {
    const preds = t.PredecessorLink || [];
    const predArray = Array.isArray(preds) ? preds : preds ? [preds] : [];
    for (const p of predArray) {
      if (!p.PredecessorUID) continue;
      relationships.push({
        successorUid: String(t.UID),
        predecessorUid: String(p.PredecessorUID),
        type: mspTypeToInternal(parseInt(p.Type || '1', 10)),
        lagDays: parseLagToDays(parseFloat(p.LinkLag || '0'), parseInt(p.LagFormat || '5', 10)),
      });
    }
  }

  return { project, tasks, relationships };
}
