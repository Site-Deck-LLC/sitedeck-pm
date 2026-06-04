"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLOSEOUT_CATEGORY_LABELS = exports.CLOSEOUT_CATEGORIES = exports.CHANGE_LOG_TYPE_LABELS = exports.CHANGE_LOG_TYPES = exports.CHANGE_LOG_MODULE_LABELS = exports.CHANGE_LOG_MODULES = exports.VOICE_MEMO_STATUS_LABELS = exports.VOICE_MEMO_STATUSES = exports.ISSUE_PRIORITY_LABELS = exports.ISSUE_PRIORITIES = exports.ISSUE_STATUS_LABELS = exports.ISSUE_STATUSES = exports.ISSUE_SOURCE_LABELS = exports.ISSUE_SOURCES = exports.ISSUE_TYPE_LABELS = exports.ISSUE_TYPES = void 0;
exports.ISSUE_TYPES = {
    CLIENT_ISSUE: 'client_issue',
    FIELD_ISSUE: 'field_issue',
};
exports.ISSUE_TYPE_LABELS = {
    [exports.ISSUE_TYPES.CLIENT_ISSUE]: 'Client Issue',
    [exports.ISSUE_TYPES.FIELD_ISSUE]: 'Field Issue',
};
exports.ISSUE_SOURCES = {
    MANUAL: 'manual',
    VOICE_MEMO: 'voice_memo',
    SELF_MEMO: 'self_memo',
    PRO_WEBHOOK: 'pro_webhook',
};
exports.ISSUE_SOURCE_LABELS = {
    [exports.ISSUE_SOURCES.MANUAL]: 'Manual',
    [exports.ISSUE_SOURCES.VOICE_MEMO]: 'Voice Memo',
    [exports.ISSUE_SOURCES.SELF_MEMO]: 'Self Memo',
    [exports.ISSUE_SOURCES.PRO_WEBHOOK]: 'Pro Webhook',
};
exports.ISSUE_STATUSES = {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    RESOLVED: 'resolved',
    CLOSED: 'closed',
};
exports.ISSUE_STATUS_LABELS = {
    [exports.ISSUE_STATUSES.OPEN]: 'Open',
    [exports.ISSUE_STATUSES.IN_PROGRESS]: 'In Progress',
    [exports.ISSUE_STATUSES.RESOLVED]: 'Resolved',
    [exports.ISSUE_STATUSES.CLOSED]: 'Closed',
};
exports.ISSUE_PRIORITIES = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
};
exports.ISSUE_PRIORITY_LABELS = {
    [exports.ISSUE_PRIORITIES.LOW]: 'Low',
    [exports.ISSUE_PRIORITIES.MEDIUM]: 'Medium',
    [exports.ISSUE_PRIORITIES.HIGH]: 'High',
};
exports.VOICE_MEMO_STATUSES = {
    PENDING: 'pending',
    PROCESSED: 'processed',
    FAILED: 'failed',
};
exports.VOICE_MEMO_STATUS_LABELS = {
    [exports.VOICE_MEMO_STATUSES.PENDING]: 'Pending',
    [exports.VOICE_MEMO_STATUSES.PROCESSED]: 'Processed',
    [exports.VOICE_MEMO_STATUSES.FAILED]: 'Failed',
};
exports.CHANGE_LOG_MODULES = {
    SCHEDULE: 'schedule',
    COST: 'cost',
    SCOPE: 'scope',
    PROCUREMENT: 'procurement',
    COMMUNICATIONS: 'communications',
    RISK: 'risk',
};
exports.CHANGE_LOG_MODULE_LABELS = {
    [exports.CHANGE_LOG_MODULES.SCHEDULE]: 'Schedule',
    [exports.CHANGE_LOG_MODULES.COST]: 'Cost',
    [exports.CHANGE_LOG_MODULES.SCOPE]: 'Scope',
    [exports.CHANGE_LOG_MODULES.PROCUREMENT]: 'Procurement',
    [exports.CHANGE_LOG_MODULES.COMMUNICATIONS]: 'Communications',
    [exports.CHANGE_LOG_MODULES.RISK]: 'Risk',
};
exports.CHANGE_LOG_TYPES = {
    BASELINE_CHANGE: 'baseline_change',
    APPROVAL: 'approval',
    STATUS_CHANGE: 'status_change',
    DATA_ENTRY: 'data_entry',
};
exports.CHANGE_LOG_TYPE_LABELS = {
    [exports.CHANGE_LOG_TYPES.BASELINE_CHANGE]: 'Baseline Change',
    [exports.CHANGE_LOG_TYPES.APPROVAL]: 'Approval',
    [exports.CHANGE_LOG_TYPES.STATUS_CHANGE]: 'Status Change',
    [exports.CHANGE_LOG_TYPES.DATA_ENTRY]: 'Data Entry',
};
exports.CLOSEOUT_CATEGORIES = {
    ADMINISTRATIVE: 'ADMINISTRATIVE',
    TECHNICAL: 'TECHNICAL',
    FINANCIAL: 'FINANCIAL',
    CONTRACTUAL: 'CONTRACTUAL',
};
exports.CLOSEOUT_CATEGORY_LABELS = {
    [exports.CLOSEOUT_CATEGORIES.ADMINISTRATIVE]: 'Administrative',
    [exports.CLOSEOUT_CATEGORIES.TECHNICAL]: 'Technical',
    [exports.CLOSEOUT_CATEGORIES.FINANCIAL]: 'Financial',
    [exports.CLOSEOUT_CATEGORIES.CONTRACTUAL]: 'Contractual',
};
//# sourceMappingURL=integration.js.map