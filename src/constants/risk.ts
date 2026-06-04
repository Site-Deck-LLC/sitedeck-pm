export const RISK_CATEGORIES = {
  SAFETY: 'safety',
  SCHEDULE: 'schedule',
  COST: 'cost',
  QUALITY: 'quality',
  ENVIRONMENTAL: 'environmental',
  OTHER: 'other',
} as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[keyof typeof RISK_CATEGORIES];

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  [RISK_CATEGORIES.SAFETY]: 'Safety',
  [RISK_CATEGORIES.SCHEDULE]: 'Schedule',
  [RISK_CATEGORIES.COST]: 'Cost',
  [RISK_CATEGORIES.QUALITY]: 'Quality',
  [RISK_CATEGORIES.ENVIRONMENTAL]: 'Environmental',
  [RISK_CATEGORIES.OTHER]: 'Other',
};

export const RISK_PROBABILITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type RiskProbability = (typeof RISK_PROBABILITY)[keyof typeof RISK_PROBABILITY];

export const RISK_PROBABILITY_LABELS: Record<RiskProbability, string> = {
  [RISK_PROBABILITY.LOW]: 'Low',
  [RISK_PROBABILITY.MEDIUM]: 'Medium',
  [RISK_PROBABILITY.HIGH]: 'High',
};

export const RISK_IMPACT = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type RiskImpact = (typeof RISK_IMPACT)[keyof typeof RISK_IMPACT];

export const RISK_IMPACT_LABELS: Record<RiskImpact, string> = {
  [RISK_IMPACT.LOW]: 'Low',
  [RISK_IMPACT.MEDIUM]: 'Medium',
  [RISK_IMPACT.HIGH]: 'High',
};

export const RISK_STATUSES = {
  OPEN: 'open',
  MITIGATED: 'mitigated',
  CLOSED: 'closed',
  ACCEPTED: 'accepted',
} as const;

export type RiskStatus = (typeof RISK_STATUSES)[keyof typeof RISK_STATUSES];

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  [RISK_STATUSES.OPEN]: 'Open',
  [RISK_STATUSES.MITIGATED]: 'Mitigated',
  [RISK_STATUSES.CLOSED]: 'Closed',
  [RISK_STATUSES.ACCEPTED]: 'Accepted',
};

export const RISK_SOURCES = {
  MANUAL: 'manual',
  SAFETY_INCIDENT_WEBHOOK: 'safety_incident_webhook',
} as const;

export type RiskSource = (typeof RISK_SOURCES)[keyof typeof RISK_SOURCES];

export const RISK_SOURCE_LABELS: Record<RiskSource, string> = {
  [RISK_SOURCES.MANUAL]: 'Manual',
  [RISK_SOURCES.SAFETY_INCIDENT_WEBHOOK]: 'Safety Incident Webhook',
};

export const PROBABILITY_VALUES: Record<string, number> = {
  [RISK_PROBABILITY.LOW]: 1,
  [RISK_PROBABILITY.MEDIUM]: 2,
  [RISK_PROBABILITY.HIGH]: 3,
};

export const IMPACT_VALUES: Record<string, number> = {
  [RISK_IMPACT.LOW]: 1,
  [RISK_IMPACT.MEDIUM]: 2,
  [RISK_IMPACT.HIGH]: 3,
};

export function getRiskScore(probability: string, impact: string): number {
  const p = PROBABILITY_VALUES[probability] ?? 1;
  const i = IMPACT_VALUES[impact] ?? 1;
  return p * i;
}

export function getRiskColor(score: number): 'green' | 'amber' | 'red' {
  if (score >= 7) return 'red';
  if (score >= 4) return 'amber';
  return 'green';
}
