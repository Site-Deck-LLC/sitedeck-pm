export const PO_STATUSES = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  PARTIALLY_RECEIVED: 'partially_received',
  FULLY_RECEIVED: 'fully_received',
  CLOSED: 'closed',
} as const;

export type PoStatus = (typeof PO_STATUSES)[keyof typeof PO_STATUSES];

export const PO_STATUS_LABELS: Record<PoStatus, string> = {
  [PO_STATUSES.DRAFT]: 'Draft',
  [PO_STATUSES.ISSUED]: 'Issued',
  [PO_STATUSES.PARTIALLY_RECEIVED]: 'Partially Received',
  [PO_STATUSES.FULLY_RECEIVED]: 'Fully Received',
  [PO_STATUSES.CLOSED]: 'Closed',
};

export const INVOICE_STATUSES = {
  PENDING: 'pending',
  MATCHED: 'matched',
  APPROVED: 'approved',
  PAID: 'paid',
  DISPUTED: 'disputed',
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[keyof typeof INVOICE_STATUSES];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  [INVOICE_STATUSES.PENDING]: 'Pending',
  [INVOICE_STATUSES.MATCHED]: 'Matched',
  [INVOICE_STATUSES.APPROVED]: 'Approved',
  [INVOICE_STATUSES.PAID]: 'Paid',
  [INVOICE_STATUSES.DISPUTED]: 'Disputed',
};

export const MATCH_STATUSES = {
  PASS: 'pass',
  PARTIAL: 'partial',
  FAIL: 'fail',
} as const;

export type MatchStatus = (typeof MATCH_STATUSES)[keyof typeof MATCH_STATUSES];

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  [MATCH_STATUSES.PASS]: 'Pass',
  [MATCH_STATUSES.PARTIAL]: 'Partial',
  [MATCH_STATUSES.FAIL]: 'Fail',
};

export const SUBCONTRACT_STATUSES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CLOSED: 'closed',
} as const;

export type SubcontractStatus = (typeof SUBCONTRACT_STATUSES)[keyof typeof SUBCONTRACT_STATUSES];

export const SUBCONTRACT_STATUS_LABELS: Record<SubcontractStatus, string> = {
  [SUBCONTRACT_STATUSES.ACTIVE]: 'Active',
  [SUBCONTRACT_STATUSES.COMPLETED]: 'Completed',
  [SUBCONTRACT_STATUSES.CLOSED]: 'Closed',
};
