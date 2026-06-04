import { Prisma } from '@prisma/client';
export interface CreateLineItemInput {
    materialName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
}
export interface CreatePurchaseOrderInput {
    projectId: string;
    poNumber: string;
    vendorName: string;
    wbsItemId?: string;
    activityId?: string;
    createdBy: string;
    lineItems: CreateLineItemInput[];
}
export interface RecordDeliveryInput {
    projectId: string;
    poId: string;
    lineItemId: string;
    quantityReceived: number;
    receivedBy: string;
    receivedAt: Date;
    discrepancies?: string;
    deliveryReference?: string;
}
export interface CreateInvoiceInput {
    projectId: string;
    poId: string;
    invoiceNumber: string;
    invoiceAmount: number;
}
export interface CreateSubcontractInput {
    projectId: string;
    subcontractorName: string;
    contractAmount: number;
    scheduleOfValues?: {
        description: string;
        value: number;
    }[];
    retentionPercent?: number;
}
export declare function createPurchaseOrder(data: CreatePurchaseOrderInput): Promise<{
    lineItems: {
        id: string;
        createdAt: Date;
        materialName: string;
        quantity: Prisma.Decimal;
        unit: string;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        quantityReceived: Prisma.Decimal;
        poId: string;
    }[];
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    wbsItemId: string | null;
    createdBy: string;
    activityId: string | null;
    poNumber: string;
    vendorName: string;
    totalAmount: Prisma.Decimal;
}>;
export declare function getPurchaseOrderById(id: string): Promise<({
    lineItems: {
        id: string;
        createdAt: Date;
        materialName: string;
        quantity: Prisma.Decimal;
        unit: string;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        quantityReceived: Prisma.Decimal;
        poId: string;
    }[];
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    wbsItemId: string | null;
    createdBy: string;
    activityId: string | null;
    poNumber: string;
    vendorName: string;
    totalAmount: Prisma.Decimal;
}) | null>;
export declare function getPurchaseOrdersByProject(projectId: string): Promise<({
    lineItems: {
        id: string;
        createdAt: Date;
        materialName: string;
        quantity: Prisma.Decimal;
        unit: string;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        quantityReceived: Prisma.Decimal;
        poId: string;
    }[];
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    wbsItemId: string | null;
    createdBy: string;
    activityId: string | null;
    poNumber: string;
    vendorName: string;
    totalAmount: Prisma.Decimal;
})[]>;
export declare function issuePurchaseOrder(id: string): Promise<{
    lineItems: {
        id: string;
        createdAt: Date;
        materialName: string;
        quantity: Prisma.Decimal;
        unit: string;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        quantityReceived: Prisma.Decimal;
        poId: string;
    }[];
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    wbsItemId: string | null;
    createdBy: string;
    activityId: string | null;
    poNumber: string;
    vendorName: string;
    totalAmount: Prisma.Decimal;
}>;
export declare function closePurchaseOrder(id: string): Promise<{
    lineItems: {
        id: string;
        createdAt: Date;
        materialName: string;
        quantity: Prisma.Decimal;
        unit: string;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        quantityReceived: Prisma.Decimal;
        poId: string;
    }[];
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    wbsItemId: string | null;
    createdBy: string;
    activityId: string | null;
    poNumber: string;
    vendorName: string;
    totalAmount: Prisma.Decimal;
}>;
export declare function addLineItemToPO(poId: string, item: CreateLineItemInput): Promise<{
    lineItems: {
        id: string;
        createdAt: Date;
        materialName: string;
        quantity: Prisma.Decimal;
        unit: string;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        quantityReceived: Prisma.Decimal;
        poId: string;
    }[];
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    wbsItemId: string | null;
    createdBy: string;
    activityId: string | null;
    poNumber: string;
    vendorName: string;
    totalAmount: Prisma.Decimal;
}>;
export declare function recordMaterialDelivery(data: RecordDeliveryInput): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    quantityReceived: Prisma.Decimal;
    receivedBy: string;
    receivedAt: Date;
    discrepancies: string | null;
    deliveryReference: string | null;
    poId: string;
    lineItemId: string;
}>;
export declare function getDeliveriesByPO(poId: string): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    quantityReceived: Prisma.Decimal;
    receivedBy: string;
    receivedAt: Date;
    discrepancies: string | null;
    deliveryReference: string | null;
    poId: string;
    lineItemId: string;
}[]>;
export declare function getDeliveriesByProject(projectId: string): Promise<{
    id: string;
    createdAt: Date;
    projectId: string;
    quantityReceived: Prisma.Decimal;
    receivedBy: string;
    receivedAt: Date;
    discrepancies: string | null;
    deliveryReference: string | null;
    poId: string;
    lineItemId: string;
}[]>;
export declare function createInvoice(data: CreateInvoiceInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    poId: string;
    invoiceNumber: string;
    invoiceAmount: Prisma.Decimal;
    matchStatus: string | null;
    matchNotes: string | null;
}>;
export declare function performThreeWayMatch(invoiceId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    poId: string;
    invoiceNumber: string;
    invoiceAmount: Prisma.Decimal;
    matchStatus: string | null;
    matchNotes: string | null;
}>;
export declare function approveInvoice(invoiceId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    poId: string;
    invoiceNumber: string;
    invoiceAmount: Prisma.Decimal;
    matchStatus: string | null;
    matchNotes: string | null;
}>;
export declare function getInvoicesByProject(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    poId: string;
    invoiceNumber: string;
    invoiceAmount: Prisma.Decimal;
    matchStatus: string | null;
    matchNotes: string | null;
}[]>;
export declare function getInvoicesByPO(poId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    poId: string;
    invoiceNumber: string;
    invoiceAmount: Prisma.Decimal;
    matchStatus: string | null;
    matchNotes: string | null;
}[]>;
export declare function getMaterialsAlertStatus(projectId: string): Promise<{
    status: 'green' | 'amber' | 'red';
    summary: string;
    count: number;
}>;
export declare function createSubcontract(data: CreateSubcontractInput): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    subcontractorName: string;
    contractAmount: Prisma.Decimal;
    scheduleOfValues: Prisma.JsonValue | null;
    retentionPercent: number;
}>;
export declare function getSubcontractById(id: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    subcontractorName: string;
    contractAmount: Prisma.Decimal;
    scheduleOfValues: Prisma.JsonValue | null;
    retentionPercent: number;
} | null>;
export declare function getSubcontractsByProject(projectId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    subcontractorName: string;
    contractAmount: Prisma.Decimal;
    scheduleOfValues: Prisma.JsonValue | null;
    retentionPercent: number;
}[]>;
export declare function updateSubcontractStatus(id: string, status: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    subcontractorName: string;
    contractAmount: Prisma.Decimal;
    scheduleOfValues: Prisma.JsonValue | null;
    retentionPercent: number;
}>;
export declare function recordProgressBilling(subcontractId: string, amount: number, description: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    subcontractorName: string;
    contractAmount: Prisma.Decimal;
    scheduleOfValues: Prisma.JsonValue | null;
    retentionPercent: number;
}>;
//# sourceMappingURL=procurement.service.d.ts.map