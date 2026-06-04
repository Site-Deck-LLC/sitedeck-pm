"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMPACT_VALUES = exports.PROBABILITY_VALUES = exports.RISK_SOURCE_LABELS = exports.RISK_SOURCES = exports.RISK_STATUS_LABELS = exports.RISK_STATUSES = exports.RISK_IMPACT_LABELS = exports.RISK_IMPACT = exports.RISK_PROBABILITY_LABELS = exports.RISK_PROBABILITY = exports.RISK_CATEGORY_LABELS = exports.RISK_CATEGORIES = void 0;
exports.getRiskScore = getRiskScore;
exports.getRiskColor = getRiskColor;
exports.RISK_CATEGORIES = {
    SAFETY: 'safety',
    SCHEDULE: 'schedule',
    COST: 'cost',
    QUALITY: 'quality',
    ENVIRONMENTAL: 'environmental',
    OTHER: 'other',
};
exports.RISK_CATEGORY_LABELS = {
    [exports.RISK_CATEGORIES.SAFETY]: 'Safety',
    [exports.RISK_CATEGORIES.SCHEDULE]: 'Schedule',
    [exports.RISK_CATEGORIES.COST]: 'Cost',
    [exports.RISK_CATEGORIES.QUALITY]: 'Quality',
    [exports.RISK_CATEGORIES.ENVIRONMENTAL]: 'Environmental',
    [exports.RISK_CATEGORIES.OTHER]: 'Other',
};
exports.RISK_PROBABILITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
};
exports.RISK_PROBABILITY_LABELS = {
    [exports.RISK_PROBABILITY.LOW]: 'Low',
    [exports.RISK_PROBABILITY.MEDIUM]: 'Medium',
    [exports.RISK_PROBABILITY.HIGH]: 'High',
};
exports.RISK_IMPACT = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
};
exports.RISK_IMPACT_LABELS = {
    [exports.RISK_IMPACT.LOW]: 'Low',
    [exports.RISK_IMPACT.MEDIUM]: 'Medium',
    [exports.RISK_IMPACT.HIGH]: 'High',
};
exports.RISK_STATUSES = {
    OPEN: 'open',
    MITIGATED: 'mitigated',
    CLOSED: 'closed',
    ACCEPTED: 'accepted',
};
exports.RISK_STATUS_LABELS = {
    [exports.RISK_STATUSES.OPEN]: 'Open',
    [exports.RISK_STATUSES.MITIGATED]: 'Mitigated',
    [exports.RISK_STATUSES.CLOSED]: 'Closed',
    [exports.RISK_STATUSES.ACCEPTED]: 'Accepted',
};
exports.RISK_SOURCES = {
    MANUAL: 'manual',
    SAFETY_INCIDENT_WEBHOOK: 'safety_incident_webhook',
};
exports.RISK_SOURCE_LABELS = {
    [exports.RISK_SOURCES.MANUAL]: 'Manual',
    [exports.RISK_SOURCES.SAFETY_INCIDENT_WEBHOOK]: 'Safety Incident Webhook',
};
exports.PROBABILITY_VALUES = {
    [exports.RISK_PROBABILITY.LOW]: 1,
    [exports.RISK_PROBABILITY.MEDIUM]: 2,
    [exports.RISK_PROBABILITY.HIGH]: 3,
};
exports.IMPACT_VALUES = {
    [exports.RISK_IMPACT.LOW]: 1,
    [exports.RISK_IMPACT.MEDIUM]: 2,
    [exports.RISK_IMPACT.HIGH]: 3,
};
function getRiskScore(probability, impact) {
    const p = exports.PROBABILITY_VALUES[probability] ?? 1;
    const i = exports.IMPACT_VALUES[impact] ?? 1;
    return p * i;
}
function getRiskColor(score) {
    if (score >= 7)
        return 'red';
    if (score >= 4)
        return 'amber';
    return 'green';
}
//# sourceMappingURL=risk.js.map