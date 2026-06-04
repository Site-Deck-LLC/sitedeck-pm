"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPurchaseOrder = createPurchaseOrder;
exports.getPurchaseOrderById = getPurchaseOrderById;
exports.getPurchaseOrdersByProject = getPurchaseOrdersByProject;
exports.issuePurchaseOrder = issuePurchaseOrder;
exports.closePurchaseOrder = closePurchaseOrder;
exports.addLineItemToPO = addLineItemToPO;
exports.recordMaterialDelivery = recordMaterialDelivery;
exports.getDeliveriesByPO = getDeliveriesByPO;
exports.getDeliveriesByProject = getDeliveriesByProject;
exports.createInvoice = createInvoice;
exports.performThreeWayMatch = performThreeWayMatch;
exports.approveInvoice = approveInvoice;
exports.getInvoicesByProject = getInvoicesByProject;
exports.getInvoicesByPO = getInvoicesByPO;
exports.getMaterialsAlertStatus = getMaterialsAlertStatus;
exports.createSubcontract = createSubcontract;
exports.getSubcontractById = getSubcontractById;
exports.getSubcontractsByProject = getSubcontractsByProject;
exports.updateSubcontractStatus = updateSubcontractStatus;
exports.recordProgressBilling = recordProgressBilling;
const prisma_1 = require("../lib/prisma");
const procurement_1 = require("../constants/procurement");
const AMOUNT_TOLERANCE = 0.01; // 1%
const QUANTITY_TOLERANCE = 0.001; // 0.1%
function decimalToNumber(value) {
    if (value === null || value === undefined)
        return 0;
    if (typeof value === 'number')
        return value;
    return value.toNumber();
}
function computeLineTotal(item) {
    return item.quantity * item.unitPrice;
}
async function createPurchaseOrder(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const totalAmount = data.lineItems.reduce((sum, item) => sum + computeLineTotal(item), 0);
    return prisma.purchaseOrder.create({
        data: {
            projectId: data.projectId,
            poNumber: data.poNumber,
            vendorName: data.vendorName,
            status: procurement_1.PO_STATUSES.DRAFT,
            totalAmount,
            wbsItemId: data.wbsItemId,
            activityId: data.activityId,
            createdBy: data.createdBy,
            lineItems: {
                create: data.lineItems.map((item) => ({
                    materialName: item.materialName,
                    quantity: item.quantity,
                    unit: item.unit,
                    unitPrice: item.unitPrice,
                    lineTotal: computeLineTotal(item),
                    quantityReceived: 0,
                })),
            },
        },
        include: { lineItems: true },
    });
}
async function getPurchaseOrderById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.purchaseOrder.findUnique({
        where: { id },
        include: { lineItems: true },
    });
}
async function getPurchaseOrdersByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.purchaseOrder.findMany({
        where: { projectId },
        include: { lineItems: true },
        orderBy: { createdAt: 'desc' },
    });
}
async function issuePurchaseOrder(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.purchaseOrder.update({
        where: { id },
        data: { status: procurement_1.PO_STATUSES.ISSUED },
        include: { lineItems: true },
    });
}
async function closePurchaseOrder(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.purchaseOrder.update({
        where: { id },
        data: { status: procurement_1.PO_STATUSES.CLOSED },
        include: { lineItems: true },
    });
}
async function addLineItemToPO(poId, item) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        include: { lineItems: true },
    });
    if (!po) {
        throw new Error('Purchase order not found');
    }
    const lineTotal = computeLineTotal(item);
    const newTotal = decimalToNumber(po.totalAmount) + lineTotal;
    const [updatedPo] = await prisma.$transaction([
        prisma.purchaseOrder.update({
            where: { id: poId },
            data: { totalAmount: newTotal },
            include: { lineItems: true },
        }),
        prisma.purchaseOrderLineItem.create({
            data: {
                poId,
                materialName: item.materialName,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice,
                lineTotal,
                quantityReceived: 0,
            },
        }),
    ]);
    return updatedPo;
}
async function recordMaterialDelivery(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    // Idempotency: skip if deliveryReference already exists for this PO
    if (data.deliveryReference) {
        const existing = await prisma.materialDelivery.findFirst({
            where: {
                poId: data.poId,
                deliveryReference: data.deliveryReference,
            },
        });
        if (existing) {
            return existing;
        }
    }
    const lineItem = await prisma.purchaseOrderLineItem.findUnique({
        where: { id: data.lineItemId },
    });
    if (!lineItem) {
        throw new Error('Line item not found');
    }
    const newQuantityReceived = decimalToNumber(lineItem.quantityReceived) + data.quantityReceived;
    const [delivery] = await prisma.$transaction([
        prisma.materialDelivery.create({
            data: {
                projectId: data.projectId,
                poId: data.poId,
                lineItemId: data.lineItemId,
                quantityReceived: data.quantityReceived,
                receivedBy: data.receivedBy,
                receivedAt: data.receivedAt,
                discrepancies: data.discrepancies,
                deliveryReference: data.deliveryReference,
            },
        }),
        prisma.purchaseOrderLineItem.update({
            where: { id: data.lineItemId },
            data: { quantityReceived: newQuantityReceived },
        }),
    ]);
    // Update PO status based on aggregate receipt
    await updatePOStatusFromDeliveries(data.poId);
    return delivery;
}
async function updatePOStatusFromDeliveries(poId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        include: { lineItems: true },
    });
    if (!po)
        return;
    const allItems = po.lineItems;
    if (allItems.length === 0)
        return;
    const fullyReceived = allItems.every((item) => {
        const qty = decimalToNumber(item.quantity);
        const received = decimalToNumber(item.quantityReceived);
        return received >= qty - qty * QUANTITY_TOLERANCE;
    });
    const partiallyReceived = allItems.some((item) => {
        const received = decimalToNumber(item.quantityReceived);
        return received > 0;
    });
    let newStatus = po.status;
    if (fullyReceived) {
        newStatus = procurement_1.PO_STATUSES.FULLY_RECEIVED;
    }
    else if (partiallyReceived) {
        newStatus = procurement_1.PO_STATUSES.PARTIALLY_RECEIVED;
    }
    if (newStatus !== po.status) {
        await prisma.purchaseOrder.update({
            where: { id: poId },
            data: { status: newStatus },
        });
    }
}
async function getDeliveriesByPO(poId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.materialDelivery.findMany({
        where: { poId },
        orderBy: { receivedAt: 'desc' },
    });
}
async function getDeliveriesByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.materialDelivery.findMany({
        where: { projectId },
        orderBy: { receivedAt: 'desc' },
    });
}
async function createInvoice(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.invoice.create({
        data: {
            projectId: data.projectId,
            poId: data.poId,
            invoiceNumber: data.invoiceNumber,
            invoiceAmount: data.invoiceAmount,
            status: procurement_1.INVOICE_STATUSES.PENDING,
        },
    });
}
async function performThreeWayMatch(invoiceId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { purchaseOrder: { include: { lineItems: true } } },
    });
    if (!invoice) {
        throw new Error('Invoice not found');
    }
    const po = invoice.purchaseOrder;
    const poTotal = decimalToNumber(po.totalAmount);
    const invoiceAmount = decimalToNumber(invoice.invoiceAmount);
    // Check 1: PO amount vs invoice amount (within tolerance)
    const amountDiff = Math.abs(poTotal - invoiceAmount);
    const amountMatch = amountDiff <= poTotal * AMOUNT_TOLERANCE;
    // Check 2 & 3: per-line-item quantity and value checks
    const lineItems = po.lineItems;
    let allLinesPass = true;
    let anyLinePass = false;
    const notes = [];
    for (const item of lineItems) {
        const qty = decimalToNumber(item.quantity);
        const received = decimalToNumber(item.quantityReceived);
        const unitPrice = decimalToNumber(item.unitPrice);
        const expectedValue = received * unitPrice;
        const qtyMatch = received >= qty - qty * QUANTITY_TOLERANCE;
        const valueMatch = Math.abs(expectedValue - invoiceAmount) <= invoiceAmount * AMOUNT_TOLERANCE;
        // Note: for multi-line POs, the invoice amount check against each line is not ideal,
        // but for V1 we flag partial if any line is short or the total doesn't match.
        if (!qtyMatch) {
            notes.push(`Line ${item.materialName}: ordered ${qty}, received ${received} (short)`);
        }
        if (qtyMatch) {
            anyLinePass = true;
        }
        else {
            allLinesPass = false;
        }
    }
    // For V1, the third check is: invoice amount vs sum of received quantities * unit price
    const totalReceivedValue = lineItems.reduce((sum, item) => {
        const received = decimalToNumber(item.quantityReceived);
        const unitPrice = decimalToNumber(item.unitPrice);
        return sum + received * unitPrice;
    }, 0);
    const totalValueMatch = Math.abs(totalReceivedValue - invoiceAmount) <= invoiceAmount * AMOUNT_TOLERANCE;
    if (!totalValueMatch) {
        notes.push(`Total received value (${totalReceivedValue.toFixed(2)}) does not match invoice amount (${invoiceAmount.toFixed(2)})`);
    }
    if (!amountMatch) {
        notes.push(`PO total (${poTotal.toFixed(2)}) does not match invoice amount (${invoiceAmount.toFixed(2)})`);
    }
    const overallPass = amountMatch && totalValueMatch && allLinesPass;
    const overallPartial = anyLinePass && (!totalValueMatch || !allLinesPass);
    let matchStatus;
    if (overallPass) {
        matchStatus = procurement_1.MATCH_STATUSES.PASS;
    }
    else if (overallPartial) {
        matchStatus = procurement_1.MATCH_STATUSES.PARTIAL;
    }
    else {
        matchStatus = procurement_1.MATCH_STATUSES.FAIL;
    }
    return prisma.invoice.update({
        where: { id: invoiceId },
        data: {
            matchStatus,
            matchNotes: notes.join('; ') || undefined,
            status: procurement_1.INVOICE_STATUSES.MATCHED,
        },
    });
}
async function approveInvoice(invoiceId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
        throw new Error('Invoice not found');
    }
    if (invoice.matchStatus === procurement_1.MATCH_STATUSES.FAIL) {
        throw new Error('Cannot approve invoice with failed 3-way match');
    }
    if (!invoice.matchStatus) {
        throw new Error('3-way match must be performed before approval');
    }
    return prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: procurement_1.INVOICE_STATUSES.APPROVED },
    });
}
async function getInvoicesByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.invoice.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
    });
}
async function getInvoicesByPO(poId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.invoice.findMany({
        where: { poId },
        orderBy: { createdAt: 'desc' },
    });
}
async function getMaterialsAlertStatus(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const now = new Date();
    const lookAhead = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    // Find all activities starting within 48h that have linked POs
    const pos = await prisma.purchaseOrder.findMany({
        where: {
            projectId,
            activityId: { not: null },
        },
        include: { lineItems: true },
    });
    if (pos.length === 0) {
        return { status: 'green', summary: 'No material requirements for next 48 hours', count: 0 };
    }
    const activityIds = pos.map((po) => po.activityId).filter((id) => id !== null);
    const activities = await prisma.scheduleActivity.findMany({
        where: {
            id: { in: activityIds },
            startDate: { lte: lookAhead },
        },
    });
    const criticalActivityIds = new Set(activities.filter((a) => a.isCritical).map((a) => a.id));
    const nonCriticalActivityIds = new Set(activities.filter((a) => !a.isCritical).map((a) => a.id));
    let criticalShort = 0;
    let nonCriticalShort = 0;
    for (const po of pos) {
        if (!po.activityId)
            continue;
        const isCritical = criticalActivityIds.has(po.activityId);
        const isNonCritical = nonCriticalActivityIds.has(po.activityId);
        if (!isCritical && !isNonCritical)
            continue;
        const hasShortage = po.lineItems.some((item) => {
            const qty = decimalToNumber(item.quantity);
            const received = decimalToNumber(item.quantityReceived);
            return received < qty - qty * QUANTITY_TOLERANCE;
        });
        if (hasShortage) {
            if (isCritical) {
                criticalShort++;
            }
            else {
                nonCriticalShort++;
            }
        }
    }
    if (criticalShort > 0) {
        return {
            status: 'red',
            summary: `${criticalShort} critical path material requirement${criticalShort !== 1 ? 's' : ''} short for next 48 hours`,
            count: criticalShort,
        };
    }
    if (nonCriticalShort > 0) {
        return {
            status: 'amber',
            summary: `${nonCriticalShort} non-critical material requirement${nonCriticalShort !== 1 ? 's' : ''} short for next 48 hours`,
            count: nonCriticalShort,
        };
    }
    return {
        status: 'green',
        summary: 'All required materials received and allocated for next 48 hours',
        count: 0,
    };
}
async function createSubcontract(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.subcontract.create({
        data: {
            projectId: data.projectId,
            subcontractorName: data.subcontractorName,
            contractAmount: data.contractAmount,
            scheduleOfValues: data.scheduleOfValues ?? [],
            retentionPercent: data.retentionPercent ?? 0.1,
            status: procurement_1.SUBCONTRACT_STATUSES.ACTIVE,
        },
    });
}
async function getSubcontractById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.subcontract.findUnique({
        where: { id },
    });
}
async function getSubcontractsByProject(projectId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.subcontract.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
    });
}
async function updateSubcontractStatus(id, status) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const validStatuses = Object.values(procurement_1.SUBCONTRACT_STATUSES);
    if (!validStatuses.includes(status)) {
        throw new Error(`Invalid subcontract status: ${status}`);
    }
    return prisma.subcontract.update({
        where: { id },
        data: { status },
    });
}
async function recordProgressBilling(subcontractId, amount, description) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const subcontract = await prisma.subcontract.findUnique({
        where: { id: subcontractId },
    });
    if (!subcontract) {
        throw new Error('Subcontract not found');
    }
    const currentSov = subcontract.scheduleOfValues || [];
    const updatedSov = [...currentSov, { description, value: amount }];
    return prisma.subcontract.update({
        where: { id: subcontractId },
        data: { scheduleOfValues: updatedSov },
    });
}
//# sourceMappingURL=procurement.service.js.map