"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBCONTRACT_STATUS_LABELS = exports.SUBCONTRACT_STATUSES = exports.MATCH_STATUS_LABELS = exports.MATCH_STATUSES = exports.INVOICE_STATUS_LABELS = exports.INVOICE_STATUSES = exports.PO_STATUS_LABELS = exports.PO_STATUSES = void 0;
exports.PO_STATUSES = {
    DRAFT: 'draft',
    ISSUED: 'issued',
    PARTIALLY_RECEIVED: 'partially_received',
    FULLY_RECEIVED: 'fully_received',
    CLOSED: 'closed',
};
exports.PO_STATUS_LABELS = {
    [exports.PO_STATUSES.DRAFT]: 'Draft',
    [exports.PO_STATUSES.ISSUED]: 'Issued',
    [exports.PO_STATUSES.PARTIALLY_RECEIVED]: 'Partially Received',
    [exports.PO_STATUSES.FULLY_RECEIVED]: 'Fully Received',
    [exports.PO_STATUSES.CLOSED]: 'Closed',
};
exports.INVOICE_STATUSES = {
    PENDING: 'pending',
    MATCHED: 'matched',
    APPROVED: 'approved',
    PAID: 'paid',
    DISPUTED: 'disputed',
};
exports.INVOICE_STATUS_LABELS = {
    [exports.INVOICE_STATUSES.PENDING]: 'Pending',
    [exports.INVOICE_STATUSES.MATCHED]: 'Matched',
    [exports.INVOICE_STATUSES.APPROVED]: 'Approved',
    [exports.INVOICE_STATUSES.PAID]: 'Paid',
    [exports.INVOICE_STATUSES.DISPUTED]: 'Disputed',
};
exports.MATCH_STATUSES = {
    PASS: 'pass',
    PARTIAL: 'partial',
    FAIL: 'fail',
};
exports.MATCH_STATUS_LABELS = {
    [exports.MATCH_STATUSES.PASS]: 'Pass',
    [exports.MATCH_STATUSES.PARTIAL]: 'Partial',
    [exports.MATCH_STATUSES.FAIL]: 'Fail',
};
exports.SUBCONTRACT_STATUSES = {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CLOSED: 'closed',
};
exports.SUBCONTRACT_STATUS_LABELS = {
    [exports.SUBCONTRACT_STATUSES.ACTIVE]: 'Active',
    [exports.SUBCONTRACT_STATUSES.COMPLETED]: 'Completed',
    [exports.SUBCONTRACT_STATUSES.CLOSED]: 'Closed',
};
//# sourceMappingURL=procurement.js.map