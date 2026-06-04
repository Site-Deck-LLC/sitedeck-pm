"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const procurement_service_1 = require("./procurement.service");
const prisma_1 = require("../lib/prisma");
describe('procurement.service', () => {
    describe('PO lifecycle', () => {
        const mockPurchaseOrderCreate = jest.fn();
        const mockPurchaseOrderFindUnique = jest.fn();
        const mockPurchaseOrderFindMany = jest.fn();
        const mockPurchaseOrderUpdate = jest.fn();
        const mockPrisma = {
            purchaseOrder: {
                create: mockPurchaseOrderCreate,
                findUnique: mockPurchaseOrderFindUnique,
                findMany: mockPurchaseOrderFindMany,
                update: mockPurchaseOrderUpdate,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('creates a PO with line items and computed total', async () => {
            mockPurchaseOrderCreate.mockResolvedValue({
                id: 'po-1',
                poNumber: 'PO-001',
                vendorName: 'Acme Supply',
                totalAmount: 15_000,
                status: 'draft',
                lineItems: [
                    { id: 'li-1', materialName: 'Steel', quantity: 100, unitPrice: 100, lineTotal: 10_000 },
                    { id: 'li-2', materialName: 'Concrete', quantity: 50, unitPrice: 100, lineTotal: 5_000 },
                ],
            });
            const result = await (0, procurement_service_1.createPurchaseOrder)({
                projectId: 'proj-1',
                poNumber: 'PO-001',
                vendorName: 'Acme Supply',
                createdBy: 'user-1',
                lineItems: [
                    { materialName: 'Steel', quantity: 100, unit: 'ft', unitPrice: 100 },
                    { materialName: 'Concrete', quantity: 50, unit: 'yd', unitPrice: 100 },
                ],
            });
            expect(mockPurchaseOrderCreate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    totalAmount: 15_000,
                    status: 'draft',
                    lineItems: {
                        create: expect.arrayContaining([
                            expect.objectContaining({ lineTotal: 10_000 }),
                            expect.objectContaining({ lineTotal: 5_000 }),
                        ]),
                    },
                }),
            }));
            expect(result.totalAmount).toBe(15_000);
            expect(result.lineItems).toHaveLength(2);
        });
        it('gets a PO by id with line items', async () => {
            mockPurchaseOrderFindUnique.mockResolvedValue({
                id: 'po-1',
                poNumber: 'PO-001',
                lineItems: [],
            });
            const result = await (0, procurement_service_1.getPurchaseOrderById)('po-1');
            expect(mockPurchaseOrderFindUnique).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'po-1' },
                include: { lineItems: true },
            }));
            expect(result?.poNumber).toBe('PO-001');
        });
        it('gets POs by project', async () => {
            mockPurchaseOrderFindMany.mockResolvedValue([{ id: 'po-1' }]);
            const result = await (0, procurement_service_1.getPurchaseOrdersByProject)('proj-1');
            expect(mockPurchaseOrderFindMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { projectId: 'proj-1' },
                include: { lineItems: true },
                orderBy: { createdAt: 'desc' },
            }));
            expect(result).toHaveLength(1);
        });
        it('issues a PO', async () => {
            mockPurchaseOrderUpdate.mockResolvedValue({ id: 'po-1', status: 'issued' });
            const result = await (0, procurement_service_1.issuePurchaseOrder)('po-1');
            expect(mockPurchaseOrderUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'po-1' },
                data: { status: 'issued' },
                include: { lineItems: true },
            }));
            expect(result.status).toBe('issued');
        });
        it('closes a PO', async () => {
            mockPurchaseOrderUpdate.mockResolvedValue({ id: 'po-1', status: 'closed' });
            const result = await (0, procurement_service_1.closePurchaseOrder)('po-1');
            expect(mockPurchaseOrderUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'po-1' },
                data: { status: 'closed' },
                include: { lineItems: true },
            }));
            expect(result.status).toBe('closed');
        });
    });
    describe('addLineItemToPO', () => {
        const mockPurchaseOrderFindUnique = jest.fn();
        const mockPurchaseOrderUpdate = jest.fn();
        const mockPurchaseOrderLineItemCreate = jest.fn();
        const mockPrisma = {
            $transaction: jest.fn((queries) => Promise.all(queries)),
            purchaseOrder: {
                findUnique: mockPurchaseOrderFindUnique,
                update: mockPurchaseOrderUpdate,
            },
            purchaseOrderLineItem: {
                create: mockPurchaseOrderLineItemCreate,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('adds a line item and updates total', async () => {
            mockPurchaseOrderFindUnique.mockResolvedValue({
                id: 'po-1',
                totalAmount: 10_000,
                lineItems: [{ id: 'li-1' }],
            });
            mockPurchaseOrderUpdate.mockResolvedValue({
                id: 'po-1',
                totalAmount: 13_000,
                lineItems: [{ id: 'li-1' }, { id: 'li-2' }],
            });
            mockPurchaseOrderLineItemCreate.mockResolvedValue({ id: 'li-2' });
            const result = await (0, procurement_service_1.addLineItemToPO)('po-1', {
                materialName: 'Rebar',
                quantity: 30,
                unit: 'ft',
                unitPrice: 100,
            });
            expect(mockPurchaseOrderUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'po-1' },
                data: { totalAmount: 13_000 },
            }));
            expect(result.totalAmount).toBe(13_000);
        });
        it('throws if PO not found', async () => {
            mockPurchaseOrderFindUnique.mockResolvedValue(null);
            await expect((0, procurement_service_1.addLineItemToPO)('po-1', { materialName: 'X', quantity: 1, unit: 'ea', unitPrice: 1 })).rejects.toThrow('Purchase order not found');
        });
    });
    describe('recordMaterialDelivery', () => {
        const mockMaterialDeliveryCreate = jest.fn();
        const mockMaterialDeliveryFindFirst = jest.fn();
        const mockPurchaseOrderLineItemFindUnique = jest.fn();
        const mockPurchaseOrderLineItemUpdate = jest.fn();
        const mockPurchaseOrderFindUnique = jest.fn();
        const mockPurchaseOrderUpdate = jest.fn();
        const mockPrisma = {
            $transaction: jest.fn((queries) => Promise.all(queries)),
            materialDelivery: {
                create: mockMaterialDeliveryCreate,
                findFirst: mockMaterialDeliveryFindFirst,
            },
            purchaseOrderLineItem: {
                findUnique: mockPurchaseOrderLineItemFindUnique,
                update: mockPurchaseOrderLineItemUpdate,
            },
            purchaseOrder: {
                findUnique: mockPurchaseOrderFindUnique,
                update: mockPurchaseOrderUpdate,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('creates a delivery and updates line item quantityReceived', async () => {
            mockPurchaseOrderLineItemFindUnique.mockResolvedValue({
                id: 'li-1',
                quantity: 100,
                quantityReceived: 20,
            });
            mockMaterialDeliveryCreate.mockResolvedValue({
                id: 'del-1',
                quantityReceived: 30,
            });
            mockPurchaseOrderLineItemUpdate.mockResolvedValue({ id: 'li-1', quantityReceived: 50 });
            mockPurchaseOrderFindUnique.mockResolvedValue({
                id: 'po-1',
                status: 'issued',
                lineItems: [{ id: 'li-1', quantity: 100, quantityReceived: 50 }],
            });
            const result = await (0, procurement_service_1.recordMaterialDelivery)({
                projectId: 'proj-1',
                poId: 'po-1',
                lineItemId: 'li-1',
                quantityReceived: 30,
                receivedBy: 'user-1',
                receivedAt: new Date('2026-06-01'),
            });
            expect(mockMaterialDeliveryCreate).toHaveBeenCalled();
            expect(mockPurchaseOrderLineItemUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'li-1' },
                data: { quantityReceived: 50 },
            }));
            expect(result.quantityReceived).toBe(30);
        });
        it('updates PO status to fully_received when all items complete', async () => {
            mockPurchaseOrderLineItemFindUnique.mockResolvedValue({
                id: 'li-1',
                quantity: 100,
                quantityReceived: 0,
            });
            mockMaterialDeliveryCreate.mockResolvedValue({ id: 'del-1' });
            mockPurchaseOrderLineItemUpdate.mockResolvedValue({ id: 'li-1', quantityReceived: 100 });
            mockPurchaseOrderFindUnique.mockResolvedValue({
                id: 'po-1',
                status: 'issued',
                lineItems: [{ id: 'li-1', quantity: 100, quantityReceived: 100 }],
            });
            await (0, procurement_service_1.recordMaterialDelivery)({
                projectId: 'proj-1',
                poId: 'po-1',
                lineItemId: 'li-1',
                quantityReceived: 100,
                receivedBy: 'user-1',
                receivedAt: new Date('2026-06-01'),
            });
            expect(mockPurchaseOrderUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'po-1' },
                data: { status: 'fully_received' },
            }));
        });
        it('updates PO status to partially_received when some items incomplete', async () => {
            mockPurchaseOrderLineItemFindUnique.mockResolvedValue({
                id: 'li-1',
                quantity: 100,
                quantityReceived: 0,
            });
            mockMaterialDeliveryCreate.mockResolvedValue({ id: 'del-1' });
            mockPurchaseOrderLineItemUpdate.mockResolvedValue({ id: 'li-1', quantityReceived: 50 });
            mockPurchaseOrderFindUnique.mockResolvedValue({
                id: 'po-1',
                status: 'issued',
                lineItems: [
                    { id: 'li-1', quantity: 100, quantityReceived: 50 },
                    { id: 'li-2', quantity: 100, quantityReceived: 0 },
                ],
            });
            await (0, procurement_service_1.recordMaterialDelivery)({
                projectId: 'proj-1',
                poId: 'po-1',
                lineItemId: 'li-1',
                quantityReceived: 50,
                receivedBy: 'user-1',
                receivedAt: new Date('2026-06-01'),
            });
            expect(mockPurchaseOrderUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'po-1' },
                data: { status: 'partially_received' },
            }));
        });
        it('is idempotent when deliveryReference is provided', async () => {
            mockMaterialDeliveryFindFirst.mockResolvedValue({
                id: 'del-1',
                deliveryReference: 'ref-abc',
            });
            const result = await (0, procurement_service_1.recordMaterialDelivery)({
                projectId: 'proj-1',
                poId: 'po-1',
                lineItemId: 'li-1',
                quantityReceived: 30,
                receivedBy: 'user-1',
                receivedAt: new Date('2026-06-01'),
                deliveryReference: 'ref-abc',
            });
            expect(mockMaterialDeliveryFindFirst).toHaveBeenCalledWith(expect.objectContaining({
                where: { poId: 'po-1', deliveryReference: 'ref-abc' },
            }));
            expect(mockMaterialDeliveryCreate).not.toHaveBeenCalled();
            expect(result.id).toBe('del-1');
        });
        it('throws if line item not found', async () => {
            mockPurchaseOrderLineItemFindUnique.mockResolvedValue(null);
            await expect((0, procurement_service_1.recordMaterialDelivery)({
                projectId: 'proj-1',
                poId: 'po-1',
                lineItemId: 'li-1',
                quantityReceived: 10,
                receivedBy: 'user-1',
                receivedAt: new Date(),
            })).rejects.toThrow('Line item not found');
        });
    });
    describe('getDeliveries', () => {
        const mockMaterialDeliveryFindMany = jest.fn();
        const mockPrisma = {
            materialDelivery: {
                findMany: mockMaterialDeliveryFindMany,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('gets deliveries by PO', async () => {
            mockMaterialDeliveryFindMany.mockResolvedValue([{ id: 'del-1' }]);
            const result = await (0, procurement_service_1.getDeliveriesByPO)('po-1');
            expect(mockMaterialDeliveryFindMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { poId: 'po-1' },
                orderBy: { receivedAt: 'desc' },
            }));
            expect(result).toHaveLength(1);
        });
        it('gets deliveries by project', async () => {
            mockMaterialDeliveryFindMany.mockResolvedValue([{ id: 'del-1' }]);
            const result = await (0, procurement_service_1.getDeliveriesByProject)('proj-1');
            expect(mockMaterialDeliveryFindMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { projectId: 'proj-1' },
                orderBy: { receivedAt: 'desc' },
            }));
            expect(result).toHaveLength(1);
        });
    });
    describe('3-way match', () => {
        const mockInvoiceCreate = jest.fn();
        const mockInvoiceFindUnique = jest.fn();
        const mockInvoiceFindMany = jest.fn();
        const mockInvoiceUpdate = jest.fn();
        const mockPrisma = {
            invoice: {
                create: mockInvoiceCreate,
                findUnique: mockInvoiceFindUnique,
                findMany: mockInvoiceFindMany,
                update: mockInvoiceUpdate,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('creates an invoice with pending status', async () => {
            mockInvoiceCreate.mockResolvedValue({
                id: 'inv-1',
                invoiceNumber: 'INV-001',
                status: 'pending',
            });
            const result = await (0, procurement_service_1.createInvoice)({
                projectId: 'proj-1',
                poId: 'po-1',
                invoiceNumber: 'INV-001',
                invoiceAmount: 10_000,
            });
            expect(mockInvoiceCreate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    invoiceNumber: 'INV-001',
                    invoiceAmount: 10_000,
                    status: 'pending',
                }),
            }));
            expect(result.status).toBe('pending');
        });
        it('passes 3-way match when all checks align', async () => {
            mockInvoiceFindUnique.mockResolvedValue({
                id: 'inv-1',
                invoiceAmount: 10_000,
                purchaseOrder: {
                    id: 'po-1',
                    totalAmount: 10_000,
                    lineItems: [
                        { id: 'li-1', materialName: 'Steel', quantity: 100, unitPrice: 100, quantityReceived: 100 },
                    ],
                },
            });
            mockInvoiceUpdate.mockResolvedValue({
                id: 'inv-1',
                matchStatus: 'pass',
                status: 'matched',
            });
            const result = await (0, procurement_service_1.performThreeWayMatch)('inv-1');
            expect(result.matchStatus).toBe('pass');
            expect(result.status).toBe('matched');
        });
        it('fails 3-way match when PO total mismatches invoice', async () => {
            mockInvoiceFindUnique.mockResolvedValue({
                id: 'inv-1',
                invoiceAmount: 12_000,
                purchaseOrder: {
                    id: 'po-1',
                    totalAmount: 10_000,
                    lineItems: [
                        { id: 'li-1', materialName: 'Steel', quantity: 100, unitPrice: 100, quantityReceived: 100 },
                    ],
                },
            });
            mockInvoiceUpdate.mockResolvedValue({
                id: 'inv-1',
                matchStatus: 'fail',
                status: 'matched',
            });
            const result = await (0, procurement_service_1.performThreeWayMatch)('inv-1');
            expect(result.matchStatus).toBe('fail');
        });
        it('partial 3-way match when quantities short but some received', async () => {
            mockInvoiceFindUnique.mockResolvedValue({
                id: 'inv-1',
                invoiceAmount: 5_000,
                purchaseOrder: {
                    id: 'po-1',
                    totalAmount: 10_000,
                    lineItems: [
                        { id: 'li-1', materialName: 'Steel', quantity: 100, unitPrice: 100, quantityReceived: 50 },
                    ],
                },
            });
            mockInvoiceUpdate.mockResolvedValue({
                id: 'inv-1',
                matchStatus: 'partial',
                status: 'matched',
            });
            const result = await (0, procurement_service_1.performThreeWayMatch)('inv-1');
            expect(result.matchStatus).toBe('partial');
        });
        it('throws when invoice not found for match', async () => {
            mockInvoiceFindUnique.mockResolvedValue(null);
            await expect((0, procurement_service_1.performThreeWayMatch)('inv-1')).rejects.toThrow('Invoice not found');
        });
        it('approves invoice when match is pass', async () => {
            mockInvoiceFindUnique.mockResolvedValue({
                id: 'inv-1',
                matchStatus: 'pass',
                status: 'matched',
            });
            mockInvoiceUpdate.mockResolvedValue({
                id: 'inv-1',
                status: 'approved',
            });
            const result = await (0, procurement_service_1.approveInvoice)('inv-1');
            expect(result.status).toBe('approved');
        });
        it('approves invoice when match is partial', async () => {
            mockInvoiceFindUnique.mockResolvedValue({
                id: 'inv-1',
                matchStatus: 'partial',
                status: 'matched',
            });
            mockInvoiceUpdate.mockResolvedValue({
                id: 'inv-1',
                status: 'approved',
            });
            const result = await (0, procurement_service_1.approveInvoice)('inv-1');
            expect(result.status).toBe('approved');
        });
        it('throws when approving failed match', async () => {
            mockInvoiceFindUnique.mockResolvedValue({
                id: 'inv-1',
                matchStatus: 'fail',
                status: 'matched',
            });
            await expect((0, procurement_service_1.approveInvoice)('inv-1')).rejects.toThrow('Cannot approve invoice with failed 3-way match');
        });
        it('throws when approving before match is performed', async () => {
            mockInvoiceFindUnique.mockResolvedValue({
                id: 'inv-1',
                matchStatus: null,
                status: 'pending',
            });
            await expect((0, procurement_service_1.approveInvoice)('inv-1')).rejects.toThrow('3-way match must be performed before approval');
        });
        it('gets invoices by project', async () => {
            mockInvoiceFindMany.mockResolvedValue([{ id: 'inv-1' }]);
            const result = await (0, procurement_service_1.getInvoicesByProject)('proj-1');
            expect(mockInvoiceFindMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { projectId: 'proj-1' },
                orderBy: { createdAt: 'desc' },
            }));
            expect(result).toHaveLength(1);
        });
        it('gets invoices by PO', async () => {
            mockInvoiceFindMany.mockResolvedValue([{ id: 'inv-1' }]);
            const result = await (0, procurement_service_1.getInvoicesByPO)('po-1');
            expect(mockInvoiceFindMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { poId: 'po-1' },
                orderBy: { createdAt: 'desc' },
            }));
            expect(result).toHaveLength(1);
        });
    });
    describe('48-hour alert logic', () => {
        const mockPurchaseOrderFindMany = jest.fn();
        const mockScheduleActivityFindMany = jest.fn();
        const mockPrisma = {
            purchaseOrder: {
                findMany: mockPurchaseOrderFindMany,
            },
            scheduleActivity: {
                findMany: mockScheduleActivityFindMany,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('returns green when no POs linked to activities', async () => {
            mockPurchaseOrderFindMany.mockResolvedValue([]);
            const result = await (0, procurement_service_1.getMaterialsAlertStatus)('proj-1');
            expect(result.status).toBe('green');
            expect(result.count).toBe(0);
        });
        it('returns green when all critical materials received', async () => {
            const now = new Date();
            const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            mockPurchaseOrderFindMany.mockResolvedValue([
                {
                    id: 'po-1',
                    activityId: 'act-1',
                    lineItems: [{ quantity: 100, quantityReceived: 100 }],
                },
            ]);
            mockScheduleActivityFindMany.mockResolvedValue([
                { id: 'act-1', isCritical: true, startDate: soon },
            ]);
            const result = await (0, procurement_service_1.getMaterialsAlertStatus)('proj-1');
            expect(result.status).toBe('green');
            expect(result.summary).toContain('All required materials received');
        });
        it('returns red when critical path material is short', async () => {
            const now = new Date();
            const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            mockPurchaseOrderFindMany.mockResolvedValue([
                {
                    id: 'po-1',
                    activityId: 'act-1',
                    lineItems: [{ quantity: 100, quantityReceived: 50 }],
                },
            ]);
            mockScheduleActivityFindMany.mockResolvedValue([
                { id: 'act-1', isCritical: true, startDate: soon },
            ]);
            const result = await (0, procurement_service_1.getMaterialsAlertStatus)('proj-1');
            expect(result.status).toBe('red');
            expect(result.count).toBe(1);
        });
        it('returns amber when non-critical material is short within 48h', async () => {
            const now = new Date();
            const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            mockPurchaseOrderFindMany.mockResolvedValue([
                {
                    id: 'po-1',
                    activityId: 'act-1',
                    lineItems: [{ quantity: 100, quantityReceived: 50 }],
                },
            ]);
            mockScheduleActivityFindMany.mockResolvedValue([
                { id: 'act-1', isCritical: false, startDate: soon },
            ]);
            const result = await (0, procurement_service_1.getMaterialsAlertStatus)('proj-1');
            expect(result.status).toBe('amber');
            expect(result.count).toBe(1);
        });
        it('ignores activities outside 48h window', async () => {
            mockPurchaseOrderFindMany.mockResolvedValue([
                {
                    id: 'po-1',
                    activityId: 'act-1',
                    lineItems: [{ quantity: 100, quantityReceived: 50 }],
                },
            ]);
            mockScheduleActivityFindMany.mockResolvedValue([]);
            const result = await (0, procurement_service_1.getMaterialsAlertStatus)('proj-1');
            expect(result.status).toBe('green');
        });
    });
    describe('subcontract management', () => {
        const mockSubcontractCreate = jest.fn();
        const mockSubcontractFindUnique = jest.fn();
        const mockSubcontractFindMany = jest.fn();
        const mockSubcontractUpdate = jest.fn();
        const mockPrisma = {
            subcontract: {
                create: mockSubcontractCreate,
                findUnique: mockSubcontractFindUnique,
                findMany: mockSubcontractFindMany,
                update: mockSubcontractUpdate,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('creates a subcontract', async () => {
            mockSubcontractCreate.mockResolvedValue({
                id: 'sub-1',
                subcontractorName: 'ABC Concrete',
                contractAmount: 50_000,
                status: 'active',
            });
            const result = await (0, procurement_service_1.createSubcontract)({
                projectId: 'proj-1',
                subcontractorName: 'ABC Concrete',
                contractAmount: 50_000,
            });
            expect(mockSubcontractCreate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    subcontractorName: 'ABC Concrete',
                    contractAmount: 50_000,
                    status: 'active',
                }),
            }));
            expect(result.status).toBe('active');
        });
        it('gets a subcontract by id', async () => {
            mockSubcontractFindUnique.mockResolvedValue({ id: 'sub-1' });
            const result = await (0, procurement_service_1.getSubcontractById)('sub-1');
            expect(mockSubcontractFindUnique).toHaveBeenCalledWith({ where: { id: 'sub-1' } });
            expect(result?.id).toBe('sub-1');
        });
        it('gets subcontracts by project', async () => {
            mockSubcontractFindMany.mockResolvedValue([{ id: 'sub-1' }]);
            const result = await (0, procurement_service_1.getSubcontractsByProject)('proj-1');
            expect(mockSubcontractFindMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { projectId: 'proj-1' },
                orderBy: { createdAt: 'desc' },
            }));
            expect(result).toHaveLength(1);
        });
        it('updates subcontract status', async () => {
            mockSubcontractUpdate.mockResolvedValue({ id: 'sub-1', status: 'completed' });
            const result = await (0, procurement_service_1.updateSubcontractStatus)('sub-1', 'completed');
            expect(mockSubcontractUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'sub-1' },
                data: { status: 'completed' },
            }));
            expect(result.status).toBe('completed');
        });
        it('throws on invalid subcontract status', async () => {
            await expect((0, procurement_service_1.updateSubcontractStatus)('sub-1', 'invalid')).rejects.toThrow('Invalid subcontract status: invalid');
        });
        it('records progress billing to schedule of values', async () => {
            mockSubcontractFindUnique.mockResolvedValue({
                id: 'sub-1',
                scheduleOfValues: [{ description: 'Mobilization', value: 10_000 }],
            });
            mockSubcontractUpdate.mockResolvedValue({
                id: 'sub-1',
                scheduleOfValues: [
                    { description: 'Mobilization', value: 10_000 },
                    { description: 'Phase 1', value: 20_000 },
                ],
            });
            const result = await (0, procurement_service_1.recordProgressBilling)('sub-1', 20_000, 'Phase 1');
            expect(mockSubcontractUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'sub-1' },
                data: {
                    scheduleOfValues: [
                        { description: 'Mobilization', value: 10_000 },
                        { description: 'Phase 1', value: 20_000 },
                    ],
                },
            }));
            const sov = result.scheduleOfValues;
            expect(sov).toHaveLength(2);
        });
        it('throws when recording billing for non-existent subcontract', async () => {
            mockSubcontractFindUnique.mockResolvedValue(null);
            await expect((0, procurement_service_1.recordProgressBilling)('sub-1', 5_000, 'X')).rejects.toThrow('Subcontract not found');
        });
    });
});
//# sourceMappingURL=procurement.service.test.js.map