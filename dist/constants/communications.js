"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBMITTAL_STATUS_LABELS = exports.SUBMITTAL_STATUSES = exports.RFI_STATUS_LABELS = exports.RFI_STATUSES = void 0;
exports.RFI_STATUSES = {
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
    UNDER_REVIEW: 'under_review',
    ANSWERED: 'answered',
    CLOSED: 'closed',
};
exports.RFI_STATUS_LABELS = {
    [exports.RFI_STATUSES.DRAFT]: 'Draft',
    [exports.RFI_STATUSES.SUBMITTED]: 'Submitted',
    [exports.RFI_STATUSES.UNDER_REVIEW]: 'Under Review',
    [exports.RFI_STATUSES.ANSWERED]: 'Answered',
    [exports.RFI_STATUSES.CLOSED]: 'Closed',
};
exports.SUBMITTAL_STATUSES = {
    PENDING: 'pending',
    SUBMITTED: 'submitted',
    UNDER_REVIEW: 'under_review',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    REVISION_REQUIRED: 'revision_required',
};
exports.SUBMITTAL_STATUS_LABELS = {
    [exports.SUBMITTAL_STATUSES.PENDING]: 'Pending',
    [exports.SUBMITTAL_STATUSES.SUBMITTED]: 'Submitted',
    [exports.SUBMITTAL_STATUSES.UNDER_REVIEW]: 'Under Review',
    [exports.SUBMITTAL_STATUSES.APPROVED]: 'Approved',
    [exports.SUBMITTAL_STATUSES.REJECTED]: 'Rejected',
    [exports.SUBMITTAL_STATUSES.REVISION_REQUIRED]: 'Revision Required',
};
//# sourceMappingURL=communications.js.map