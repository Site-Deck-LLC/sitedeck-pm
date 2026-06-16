export declare const RFI_STATUSES: {
    readonly DRAFT: "draft";
    readonly SUBMITTED: "submitted";
    readonly UNDER_REVIEW: "under_review";
    readonly ANSWERED: "answered";
    readonly CLOSED: "closed";
};
export type RfiStatus = (typeof RFI_STATUSES)[keyof typeof RFI_STATUSES];
export declare const RFI_STATUS_LABELS: Record<RfiStatus, string>;
export declare const SUBMITTAL_STATUSES: {
    readonly PENDING: "pending";
    readonly SUBMITTED: "submitted";
    readonly UNDER_REVIEW: "under_review";
    readonly APPROVED: "approved";
    readonly REJECTED: "rejected";
    readonly REVISION_REQUIRED: "revision_required";
};
export type SubmittalStatus = (typeof SUBMITTAL_STATUSES)[keyof typeof SUBMITTAL_STATUSES];
export declare const SUBMITTAL_STATUS_LABELS: Record<SubmittalStatus, string>;
export declare const MEETING_STATUSES: {
    readonly DRAFT: "draft";
    readonly PUBLISHED: "published";
};
export type MeetingStatus = (typeof MEETING_STATUSES)[keyof typeof MEETING_STATUSES];
export declare const MEETING_STATUS_LABELS: Record<MeetingStatus, string>;
export declare const ACTION_ITEM_STATUSES: {
    readonly OPEN: "open";
    readonly IN_PROGRESS: "in_progress";
    readonly CLOSED: "closed";
};
export type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[keyof typeof ACTION_ITEM_STATUSES];
export declare const ACTION_ITEM_STATUS_LABELS: Record<ActionItemStatus, string>;
//# sourceMappingURL=communications.d.ts.map