"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTION_ITEM_STATUS_LABELS = exports.ACTION_ITEM_STATUSES = exports.MEETING_STATUS_LABELS = exports.MEETING_STATUSES = exports.SUBMITTAL_STATUS_LABELS = exports.SUBMITTAL_STATUSES = exports.RFI_STATUS_LABELS = exports.RFI_STATUSES = void 0;
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
exports.MEETING_STATUSES = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
};
exports.MEETING_STATUS_LABELS = {
    [exports.MEETING_STATUSES.DRAFT]: 'Draft',
    [exports.MEETING_STATUSES.PUBLISHED]: 'Published',
};
exports.ACTION_ITEM_STATUSES = {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    CLOSED: 'closed',
};
exports.ACTION_ITEM_STATUS_LABELS = {
    [exports.ACTION_ITEM_STATUSES.OPEN]: 'Open',
    [exports.ACTION_ITEM_STATUSES.IN_PROGRESS]: 'In Progress',
    [exports.ACTION_ITEM_STATUSES.CLOSED]: 'Closed',
};
//# sourceMappingURL=communications.js.map