export declare const ISSUE_TYPES: {
    readonly CLIENT_ISSUE: "client_issue";
    readonly FIELD_ISSUE: "field_issue";
};
export type IssueType = (typeof ISSUE_TYPES)[keyof typeof ISSUE_TYPES];
export declare const ISSUE_TYPE_LABELS: Record<IssueType, string>;
export declare const ISSUE_SOURCES: {
    readonly MANUAL: "manual";
    readonly VOICE_MEMO: "voice_memo";
    readonly SELF_MEMO: "self_memo";
    readonly PRO_WEBHOOK: "pro_webhook";
};
export type IssueSource = (typeof ISSUE_SOURCES)[keyof typeof ISSUE_SOURCES];
export declare const ISSUE_SOURCE_LABELS: Record<IssueSource, string>;
export declare const ISSUE_STATUSES: {
    readonly OPEN: "open";
    readonly IN_PROGRESS: "in_progress";
    readonly RESOLVED: "resolved";
    readonly CLOSED: "closed";
};
export type IssueStatus = (typeof ISSUE_STATUSES)[keyof typeof ISSUE_STATUSES];
export declare const ISSUE_STATUS_LABELS: Record<IssueStatus, string>;
export declare const ISSUE_PRIORITIES: {
    readonly LOW: "low";
    readonly MEDIUM: "medium";
    readonly HIGH: "high";
};
export type IssuePriority = (typeof ISSUE_PRIORITIES)[keyof typeof ISSUE_PRIORITIES];
export declare const ISSUE_PRIORITY_LABELS: Record<IssuePriority, string>;
export declare const VOICE_MEMO_STATUSES: {
    readonly PENDING: "pending";
    readonly PROCESSED: "processed";
    readonly FAILED: "failed";
};
export type VoiceMemoStatus = (typeof VOICE_MEMO_STATUSES)[keyof typeof VOICE_MEMO_STATUSES];
export declare const VOICE_MEMO_STATUS_LABELS: Record<VoiceMemoStatus, string>;
export declare const CHANGE_LOG_MODULES: {
    readonly SCHEDULE: "schedule";
    readonly COST: "cost";
    readonly SCOPE: "scope";
    readonly PROCUREMENT: "procurement";
    readonly COMMUNICATIONS: "communications";
    readonly RISK: "risk";
};
export type ChangeLogModule = (typeof CHANGE_LOG_MODULES)[keyof typeof CHANGE_LOG_MODULES];
export declare const CHANGE_LOG_MODULE_LABELS: Record<ChangeLogModule, string>;
export declare const CHANGE_LOG_TYPES: {
    readonly BASELINE_CHANGE: "baseline_change";
    readonly APPROVAL: "approval";
    readonly STATUS_CHANGE: "status_change";
    readonly DATA_ENTRY: "data_entry";
};
export type ChangeLogType = (typeof CHANGE_LOG_TYPES)[keyof typeof CHANGE_LOG_TYPES];
export declare const CHANGE_LOG_TYPE_LABELS: Record<ChangeLogType, string>;
export declare const CLOSEOUT_CATEGORIES: {
    readonly ADMINISTRATIVE: "ADMINISTRATIVE";
    readonly TECHNICAL: "TECHNICAL";
    readonly FINANCIAL: "FINANCIAL";
    readonly CONTRACTUAL: "CONTRACTUAL";
};
export type CloseoutCategory = (typeof CLOSEOUT_CATEGORIES)[keyof typeof CLOSEOUT_CATEGORIES];
export declare const CLOSEOUT_CATEGORY_LABELS: Record<CloseoutCategory, string>;
//# sourceMappingURL=integration.d.ts.map