export declare const RISK_CATEGORIES: {
    readonly SAFETY: "safety";
    readonly SCHEDULE: "schedule";
    readonly COST: "cost";
    readonly QUALITY: "quality";
    readonly ENVIRONMENTAL: "environmental";
    readonly OTHER: "other";
};
export type RiskCategory = (typeof RISK_CATEGORIES)[keyof typeof RISK_CATEGORIES];
export declare const RISK_CATEGORY_LABELS: Record<RiskCategory, string>;
export declare const RISK_PROBABILITY: {
    readonly LOW: "low";
    readonly MEDIUM: "medium";
    readonly HIGH: "high";
};
export type RiskProbability = (typeof RISK_PROBABILITY)[keyof typeof RISK_PROBABILITY];
export declare const RISK_PROBABILITY_LABELS: Record<RiskProbability, string>;
export declare const RISK_IMPACT: {
    readonly LOW: "low";
    readonly MEDIUM: "medium";
    readonly HIGH: "high";
};
export type RiskImpact = (typeof RISK_IMPACT)[keyof typeof RISK_IMPACT];
export declare const RISK_IMPACT_LABELS: Record<RiskImpact, string>;
export declare const RISK_STATUSES: {
    readonly OPEN: "open";
    readonly MITIGATED: "mitigated";
    readonly CLOSED: "closed";
    readonly ACCEPTED: "accepted";
};
export type RiskStatus = (typeof RISK_STATUSES)[keyof typeof RISK_STATUSES];
export declare const RISK_STATUS_LABELS: Record<RiskStatus, string>;
export declare const RISK_SOURCES: {
    readonly MANUAL: "manual";
    readonly SAFETY_INCIDENT_WEBHOOK: "safety_incident_webhook";
};
export type RiskSource = (typeof RISK_SOURCES)[keyof typeof RISK_SOURCES];
export declare const RISK_SOURCE_LABELS: Record<RiskSource, string>;
export declare const PROBABILITY_VALUES: Record<string, number>;
export declare const IMPACT_VALUES: Record<string, number>;
export declare function getRiskScore(probability: string, impact: string): number;
export declare function getRiskColor(score: number): 'green' | 'amber' | 'red';
//# sourceMappingURL=risk.d.ts.map