import { getPrismaClient } from '../lib/prisma';

export interface SafetyPerformance {
  projectId: string;
  trirTarget: number;
  trirActual: number;
  status: 'green' | 'amber' | 'red';
  recordableIncidents: number;
  totalHoursWorked: number;
  series: SafetyPoint[];
}

export interface SafetyPoint {
  date: string;
  monthLabel: string;
  trirActual: number;
  trirTarget: number;
  hours: number;
  incidents: number;
}

export function getSafetyStatus(trirActual: number, trirTarget: number): 'green' | 'amber' | 'red' {
  const ratio = trirTarget > 0 ? trirActual / trirTarget : 0;
  const EPS = 1e-12;
  if (ratio <= 0.5 + EPS) return 'green';
  if (ratio < 0.8 - EPS) return 'amber';
  return 'red';
}

function getMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function parseMonthKey(key: string): { year: number; month: number } {
  const [year, month] = key.split('-').map(Number);
  return { year, month };
}

function monthLabel(year: number, month: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${year}`;
}

function* monthRange(start: Date, end: Date): Generator<{ year: number; month: number }> {
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const limit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= limit) {
    yield { year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 };
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
}

export async function getSafetyPerformance(projectId: string): Promise<SafetyPerformance> {
  const prisma = getPrismaClient();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { trirTarget: true, startDate: true, endDate: true },
  });
  if (!project) {
    throw new Error('Project not found');
  }

  const trirTarget = project.trirTarget ?? 1.0;

  // Count recordable incidents from risk items created via safety webhook
  const recordableIncidents = await prisma.riskItem.count({
    where: {
      projectId,
      source: 'safety_incident_webhook',
      recordable: true,
    },
  });

  // Sum total hours worked from attendance records
  const attendances = await prisma.attendance.findMany({
    where: { projectId },
    select: { hours: true, date: true },
  });
  const totalHoursWorked = attendances.reduce((sum, a) => sum + a.hours, 0);

  // TRIR = (recordable incidents × 200,000) / total hours worked
  const trirActual = totalHoursWorked > 0 ? (recordableIncidents * 200_000) / totalHoursWorked : 0;

  // ── Build monthly running TRIR series ──
  // Project window: project startDate -> today (or endDate if sooner)
  const start = project.startDate ? new Date(project.startDate) : new Date();
  const today = new Date();
  const end = project.endDate ? new Date(project.endDate) : today;
  const seriesEnd = today < end ? today : end;

  // Aggregate hours and incidents by month
  const hoursByMonth = new Map<string, number>();
  for (const a of attendances) {
    const key = getMonthKey(new Date(a.date));
    hoursByMonth.set(key, (hoursByMonth.get(key) || 0) + a.hours);
  }

  const incidentsByMonth = new Map<string, number>();
  if (recordableIncidents > 0) {
    // Distribute incidents across months using the most recent risk item dates
    // so the TRIR running line steps up over time.
    const riskItems = await prisma.riskItem.findMany({
      where: {
        projectId,
        source: 'safety_incident_webhook',
        recordable: true,
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const r of riskItems) {
      const key = getMonthKey(new Date(r.createdAt));
      incidentsByMonth.set(key, (incidentsByMonth.get(key) || 0) + 1);
    }
  }

  // Build cumulative series: TRIR computed as (cumulative incidents * 200,000) / cumulative hours through each month
  const series: SafetyPoint[] = [];
  let cumHours = 0;
  let cumIncidents = 0;
  for (const { year, month } of monthRange(start, seriesEnd)) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    cumHours += hoursByMonth.get(key) || 0;
    cumIncidents += incidentsByMonth.get(key) || 0;
    const trir = cumHours > 0 ? (cumIncidents * 200_000) / cumHours : 0;
    series.push({
      date: `${year}-${String(month).padStart(2, '0')}-01`,
      monthLabel: monthLabel(year, month),
      trirActual: Math.round(trir * 100) / 100,
      trirTarget,
      hours: cumHours,
      incidents: cumIncidents,
    });
  }

  return {
    projectId,
    trirTarget,
    trirActual: Math.round(trirActual * 100) / 100,
    status: getSafetyStatus(trirActual, trirTarget),
    recordableIncidents,
    totalHoursWorked,
    series,
  };
}

// re-export helpers for testing
export { getMonthKey, parseMonthKey, monthLabel, monthRange };
