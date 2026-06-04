export const ISSUE_TYPES = {
  CLIENT_ISSUE: 'client_issue',
  FIELD_ISSUE: 'field_issue',
} as const;

export type IssueType = (typeof ISSUE_TYPES)[keyof typeof ISSUE_TYPES];

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  [ISSUE_TYPES.CLIENT_ISSUE]: 'Client Issue',
  [ISSUE_TYPES.FIELD_ISSUE]: 'Field Issue',
};

export const ISSUE_SOURCES = {
  MANUAL: 'manual',
  VOICE_MEMO: 'voice_memo',
  SELF_MEMO: 'self_memo',
  PRO_WEBHOOK: 'pro_webhook',
} as const;

export type IssueSource = (typeof ISSUE_SOURCES)[keyof typeof ISSUE_SOURCES];

export const ISSUE_SOURCE_LABELS: Record<IssueSource, string> = {
  [ISSUE_SOURCES.MANUAL]: 'Manual',
  [ISSUE_SOURCES.VOICE_MEMO]: 'Voice Memo',
  [ISSUE_SOURCES.SELF_MEMO]: 'Self Memo',
  [ISSUE_SOURCES.PRO_WEBHOOK]: 'Pro Webhook',
};

export const ISSUE_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[keyof typeof ISSUE_STATUSES];

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  [ISSUE_STATUSES.OPEN]: 'Open',
  [ISSUE_STATUSES.IN_PROGRESS]: 'In Progress',
  [ISSUE_STATUSES.RESOLVED]: 'Resolved',
  [ISSUE_STATUSES.CLOSED]: 'Closed',
};

export const ISSUE_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type IssuePriority = (typeof ISSUE_PRIORITIES)[keyof typeof ISSUE_PRIORITIES];

export const ISSUE_PRIORITY_LABELS: Record<IssuePriority, string> = {
  [ISSUE_PRIORITIES.LOW]: 'Low',
  [ISSUE_PRIORITIES.MEDIUM]: 'Medium',
  [ISSUE_PRIORITIES.HIGH]: 'High',
};

export const VOICE_MEMO_STATUSES = {
  PENDING: 'pending',
  PROCESSED: 'processed',
  FAILED: 'failed',
} as const;

export type VoiceMemoStatus = (typeof VOICE_MEMO_STATUSES)[keyof typeof VOICE_MEMO_STATUSES];

export const VOICE_MEMO_STATUS_LABELS: Record<VoiceMemoStatus, string> = {
  [VOICE_MEMO_STATUSES.PENDING]: 'Pending',
  [VOICE_MEMO_STATUSES.PROCESSED]: 'Processed',
  [VOICE_MEMO_STATUSES.FAILED]: 'Failed',
};

export const CHANGE_LOG_MODULES = {
  SCHEDULE: 'schedule',
  COST: 'cost',
  SCOPE: 'scope',
  PROCUREMENT: 'procurement',
  COMMUNICATIONS: 'communications',
  RISK: 'risk',
} as const;

export type ChangeLogModule = (typeof CHANGE_LOG_MODULES)[keyof typeof CHANGE_LOG_MODULES];

export const CHANGE_LOG_MODULE_LABELS: Record<ChangeLogModule, string> = {
  [CHANGE_LOG_MODULES.SCHEDULE]: 'Schedule',
  [CHANGE_LOG_MODULES.COST]: 'Cost',
  [CHANGE_LOG_MODULES.SCOPE]: 'Scope',
  [CHANGE_LOG_MODULES.PROCUREMENT]: 'Procurement',
  [CHANGE_LOG_MODULES.COMMUNICATIONS]: 'Communications',
  [CHANGE_LOG_MODULES.RISK]: 'Risk',
};

export const CHANGE_LOG_TYPES = {
  BASELINE_CHANGE: 'baseline_change',
  APPROVAL: 'approval',
  STATUS_CHANGE: 'status_change',
  DATA_ENTRY: 'data_entry',
} as const;

export type ChangeLogType = (typeof CHANGE_LOG_TYPES)[keyof typeof CHANGE_LOG_TYPES];

export const CHANGE_LOG_TYPE_LABELS: Record<ChangeLogType, string> = {
  [CHANGE_LOG_TYPES.BASELINE_CHANGE]: 'Baseline Change',
  [CHANGE_LOG_TYPES.APPROVAL]: 'Approval',
  [CHANGE_LOG_TYPES.STATUS_CHANGE]: 'Status Change',
  [CHANGE_LOG_TYPES.DATA_ENTRY]: 'Data Entry',
};

export const CLOSEOUT_CATEGORIES = {
  ADMINISTRATIVE: 'ADMINISTRATIVE',
  TECHNICAL: 'TECHNICAL',
  FINANCIAL: 'FINANCIAL',
  CONTRACTUAL: 'CONTRACTUAL',
} as const;

export type CloseoutCategory = (typeof CLOSEOUT_CATEGORIES)[keyof typeof CLOSEOUT_CATEGORIES];

export const CLOSEOUT_CATEGORY_LABELS: Record<CloseoutCategory, string> = {
  [CLOSEOUT_CATEGORIES.ADMINISTRATIVE]: 'Administrative',
  [CLOSEOUT_CATEGORIES.TECHNICAL]: 'Technical',
  [CLOSEOUT_CATEGORIES.FINANCIAL]: 'Financial',
  [CLOSEOUT_CATEGORIES.CONTRACTUAL]: 'Contractual',
};
