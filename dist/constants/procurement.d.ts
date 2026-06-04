export declare const PO_STATUSES: {
    readonly DRAFT: "draft";
    readonly ISSUED: "issued";
    readonly PARTIALLY_RECEIVED: "partially_received";
    readonly FULLY_RECEIVED: "fully_received";
    readonly CLOSED: "closed";
};
export type PoStatus = (typeof PO_STATUSES)[keyof typeof PO_STATUSES];
export declare const PO_STATUS_LABELS: Record<PoStatus, string>;
export declare const INVOICE_STATUSES: {
    readonly PENDING: "pending";
    readonly MATCHED: "matched";
    readonly APPROVED: "approved";
    readonly PAID: "paid";
    readonly DISPUTED: "disputed";
};
export type InvoiceStatus = (typeof INVOICE_STATUSES)[keyof typeof INVOICE_STATUSES];
export declare const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string>;
export declare const MATCH_STATUSES: {
    readonly PASS: "pass";
    readonly PARTIAL: "partial";
    readonly FAIL: "fail";
};
export type MatchStatus = (typeof MATCH_STATUSES)[keyof typeof MATCH_STATUSES];
export declare const MATCH_STATUS_LABELS: Record<MatchStatus, string>;
export declare const SUBCONTRACT_STATUSES: {
    readonly ACTIVE: "active";
    readonly COMPLETED: "completed";
    readonly CLOSED: "closed";
};
export type SubcontractStatus = (typeof SUBCONTRACT_STATUSES)[keyof typeof SUBCONTRACT_STATUSES];
export declare const SUBCONTRACT_STATUS_LABELS: Record<SubcontractStatus, string>;
//# sourceMappingURL=procurement.d.ts.map