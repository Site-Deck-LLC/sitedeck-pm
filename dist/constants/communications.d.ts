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
//# sourceMappingURL=communications.d.ts.map