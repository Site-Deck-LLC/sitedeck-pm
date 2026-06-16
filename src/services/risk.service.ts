import { getPrismaClient } from '../lib/prisma';
import {
  getRiskScore,
  getRiskColor,
  RISK_STATUSES,
  RISK_SOURCES,
  RISK_CATEGORIES,
} from '../constants/risk';

export interface CreateRiskItemInput {
  projectId: string;
  description: string;
  category: string;
  probability: string;
  impact: string;
  mitigationPlan?: string;
  owner: string;
  linkedActivityId?: string;
  linkedBudgetLineId?: string;
}

export interface UpdateRiskItemInput {
  description?: string;
  category?: string;
  probability?: string;
  impact?: string;
  mitigationPlan?: string;
  owner?: string;
  status?: string;
  linkedActivityId?: string;
  linkedBudgetLineId?: string;
}

export interface SafetyIncidentData {
  incidentType: string;
  severity: number;
  recordable: boolean;
  description: string;
}

export interface RiskMatrixCell {
  probability: string;
  impact: string;
  score: number;
  color: 'green' | 'amber' | 'red';
  risks: { id: string; description: string; owner: string; status: string }[];
}

export interface RiskMatrixResult {
  projectId: string;
  cells: RiskMatrixCell[];
  highRisks: { id: string; description: string; owner: string; status: string; score: number }[];
  totalOpen: number;
}

export async function createRiskItem(data: CreateRiskItemInput) {
  const prisma = getPrismaClient();
  const score = getRiskScore(data.probability, data.impact);

  return prisma.riskItem.create({
    data: {
      projectId: data.projectId,
      description: data.description,
      category: data.category,
      probability: data.probability,
      impact: data.impact,
      score,
      mitigationPlan: data.mitigationPlan,
      owner: data.owner,
      status: RISK_STATUSES.OPEN,
      linkedActivityId: data.linkedActivityId,
      linkedBudgetLineId: data.linkedBudgetLineId,
      source: RISK_SOURCES.MANUAL,
    },
  });
}

export async function getRiskItemById(id: string) {
  const prisma = getPrismaClient();
  return prisma.riskItem.findUnique({
    where: { id },
    include: { project: true },
  });
}

export async function getRiskItemsByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.riskItem.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getOpenRisksByProject(projectId: string) {
  const prisma = getPrismaClient();
  return prisma.riskItem.findMany({
    where: { projectId, status: RISK_STATUSES.OPEN },
    orderBy: { score: 'desc' },
  });
}

export async function updateRiskItem(id: string, data: UpdateRiskItemInput) {
  const prisma = getPrismaClient();
  const existing = await prisma.riskItem.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new Error('Risk item not found');
  }

  const probability = data.probability ?? existing.probability;
  const impact = data.impact ?? existing.impact;
  const score = getRiskScore(probability, impact);

  return prisma.riskItem.update({
    where: { id },
    data: {
      ...data,
      score,
    },
  });
}

export async function closeRiskItem(id: string, notes?: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.riskItem.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new Error('Risk item not found');
  }

  return prisma.riskItem.update({
    where: { id },
    data: {
      status: RISK_STATUSES.CLOSED,
      mitigationPlan: notes ? `${existing.mitigationPlan ?? ''}\nClose notes: ${notes}`.trim() : existing.mitigationPlan,
    },
  });
}

export async function acceptRiskItem(id: string, notes?: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.riskItem.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new Error('Risk item not found');
  }

  return prisma.riskItem.update({
    where: { id },
    data: {
      status: RISK_STATUSES.ACCEPTED,
      mitigationPlan: notes ? `${existing.mitigationPlan ?? ''}\nAccept notes: ${notes}`.trim() : existing.mitigationPlan,
    },
  });
}

export async function mitigateRiskItem(id: string, mitigationPlan: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.riskItem.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new Error('Risk item not found');
  }

  return prisma.riskItem.update({
    where: { id },
    data: {
      status: RISK_STATUSES.MITIGATED,
      mitigationPlan,
    },
  });
}

export async function getRiskMatrix(projectId: string): Promise<RiskMatrixResult> {
  const prisma = getPrismaClient();
  const risks = await prisma.riskItem.findMany({
    where: { projectId },
  });

  const probabilities = ['low', 'medium', 'high'];
  const impacts = ['low', 'medium', 'high'];

  const cells: RiskMatrixCell[] = [];
  for (const probability of probabilities) {
    for (const impact of impacts) {
      const score = getRiskScore(probability, impact);
      const color = getRiskColor(score);
      const cellRisks = risks
        .filter((r) => r.probability === probability && r.impact === impact)
        .map((r) => ({
          id: r.id,
          description: r.description,
          owner: r.owner,
          status: r.status,
        }));

      cells.push({
        probability,
        impact,
        score,
        color,
        risks: cellRisks,
      });
    }
  }

  const highRisks = risks
    .filter((r) => r.score >= 7)
    .map((r) => ({
      id: r.id,
      description: r.description,
      owner: r.owner,
      status: r.status,
      score: r.score,
    }));

  const totalOpen = risks.filter((r) => r.status === RISK_STATUSES.OPEN).length;

  return {
    projectId,
    cells,
    highRisks,
    totalOpen,
  };
}

export async function getRiskDashboardStatus(
  projectId: string
): Promise<{ status: 'green' | 'amber' | 'red'; summary: string; count: number }> {
  const prisma = getPrismaClient();
  const openRisks = await prisma.riskItem.findMany({
    where: { projectId, status: RISK_STATUSES.OPEN },
  });

  if (openRisks.length === 0) {
    return {
      status: 'green',
      summary: '0 open risks',
      count: 0,
    };
  }

  const highRisks = openRisks.filter((r) => r.score >= 7);
  if (highRisks.length > 0) {
    return {
      status: 'red',
      summary: `${highRisks.length} open high-risk item${highRisks.length !== 1 ? 's' : ''}`,
      count: highRisks.length,
    };
  }

  const mediumRisks = openRisks.filter((r) => r.score >= 4 && r.score <= 6);
  if (mediumRisks.length > 0) {
    return {
      status: 'amber',
      summary: `${mediumRisks.length} open medium-risk item${mediumRisks.length !== 1 ? 's' : ''}`,
      count: mediumRisks.length,
    };
  }

  return {
    status: 'green',
    summary: `${openRisks.length} open low-risk item${openRisks.length !== 1 ? 's' : ''}`,
    count: openRisks.length,
  };
}

function mapSeverityToProbabilityAndImpact(
  severity: number,
  recordable: boolean
): { probability: string; impact: string } {
  let probability: string;
  let impact: string;

  if (severity <= 2) {
    probability = 'low';
    impact = 'low';
  } else if (severity <= 4) {
    probability = 'medium';
    impact = 'medium';
  } else {
    probability = 'high';
    impact = 'high';
  }

  if (recordable && impact === 'low') {
    impact = 'medium';
  }

  return { probability, impact };
}

export async function autoCreateRiskFromSafetyIncident(
  projectId: string,
  incidentData: SafetyIncidentData,
  incidentReference: string
) {
  const prisma = getPrismaClient();

  const existing = await prisma.riskItem.findFirst({
    where: {
      projectId,
      incidentReference,
    },
  });

  if (existing) {
    return existing;
  }

  const { probability, impact } = mapSeverityToProbabilityAndImpact(
    incidentData.severity,
    incidentData.recordable
  );
  const score = getRiskScore(probability, impact);

  return prisma.riskItem.create({
    data: {
      projectId,
      description: `Safety incident: ${incidentData.incidentType}. ${incidentData.description}`,
      category: RISK_CATEGORIES.SAFETY,
      probability,
      impact,
      score,
      owner: 'safety_system',
      source: RISK_SOURCES.SAFETY_INCIDENT_WEBHOOK,
      incidentReference,
      recordable: incidentData.recordable,
    },
  });
}
