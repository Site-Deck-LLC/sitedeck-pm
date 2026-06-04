export const RFI_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  ANSWERED: 'answered',
  CLOSED: 'closed',
} as const;

export type RfiStatus = (typeof RFI_STATUSES)[keyof typeof RFI_STATUSES];

export const RFI_STATUS_LABELS: Record<RfiStatus, string> = {
  [RFI_STATUSES.DRAFT]: 'Draft',
  [RFI_STATUSES.SUBMITTED]: 'Submitted',
  [RFI_STATUSES.UNDER_REVIEW]: 'Under Review',
  [RFI_STATUSES.ANSWERED]: 'Answered',
  [RFI_STATUSES.CLOSED]: 'Closed',
};

export const SUBMITTAL_STATUSES = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVISION_REQUIRED: 'revision_required',
} as const;

export type SubmittalStatus = (typeof SUBMITTAL_STATUSES)[keyof typeof SUBMITTAL_STATUSES];

export const SUBMITTAL_STATUS_LABELS: Record<SubmittalStatus, string> = {
  [SUBMITTAL_STATUSES.PENDING]: 'Pending',
  [SUBMITTAL_STATUSES.SUBMITTED]: 'Submitted',
  [SUBMITTAL_STATUSES.UNDER_REVIEW]: 'Under Review',
  [SUBMITTAL_STATUSES.APPROVED]: 'Approved',
  [SUBMITTAL_STATUSES.REJECTED]: 'Rejected',
  [SUBMITTAL_STATUSES.REVISION_REQUIRED]: 'Revision Required',
};
