/**
 * Tests for the QuickBooks export service.
 * - buildInvoiceForChangeOrder: shapes a QBO Invoice correctly
 * - exportInvoice: idempotent (re-export returns same invoice, no
 *   QBO call)
 * - exportInvoice: rejects when not configured
 * - exportInvoice: rejects CO not in project (tenant isolation)
 * - exportInvoice: rejects CO that is not yet approved
 * - exportInvoice: requires a QBO customer
 * - getConnectionStatus: returns the right shape
 * - exportChangeOrderSummary: collects errors per CO
 */

import * as qbo from './quickbooks.service';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;
let fetchMock: jest.Mock;

const mockTokenFindFirst = jest.fn();
const mockTokenUpsert = jest.fn();
const mockTokenUpdate = jest.fn();
const mockTokenDeleteMany = jest.fn();
const mockExportFindUnique = jest.fn();
const mockExportFindMany = jest.fn();
const mockExportCreate = jest.fn();
const mockCOFindUnique = jest.fn();
const mockProjectFindUnique = jest.fn();
const mockCOFindMany = jest.fn();

jest.mock('../lib/prisma', () => ({
  getPrismaClient: () => ({
    quickBooksToken: {
      findFirst: mockTokenFindFirst,
      findUnique: (args: any) => mockTokenFindFirst(args),
      upsert: mockTokenUpsert,
      update: mockTokenUpdate,
      deleteMany: mockTokenDeleteMany,
    },
    quickBooksExport: {
      findUnique: mockExportFindUnique,
      findMany: mockExportFindMany,
      create: mockExportCreate,
    },
    changeOrder: {
      findUnique: mockCOFindUnique,
      findMany: mockCOFindMany,
    },
    project: {
      findUnique: mockProjectFindUnique,
    },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock = jest.fn();
  (global as any).fetch = fetchMock;
  process.env.QUICKBOOKS_CLIENT_ID = 'test_client_id';
  process.env.QUICKBOOKS_CLIENT_SECRET = 'test_client_secret';
  process.env.QUICKBOOKS_REALM_ID = '';
  process.env.QUICKBOOKS_ACCESS_TOKEN = '';
  process.env.QUICKBOOKS_REFRESH_TOKEN = '';
  // Token comes from the DB; the find result determines the flow.
  mockTokenFindFirst.mockResolvedValue({
    realmId: 'r1',
    accessToken: 'old_access',
    refreshToken: 'old_refresh',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
    scope: 'com.intuit.quickbooks.accounting',
  });
  mockExportCreate.mockImplementation(async ({ data }: any) => ({ id: 'qe1', ...data }));
});

afterEach(() => {
  process.env = { ...originalEnv };
  (global as any).fetch = originalFetch;
});

describe('buildInvoiceForChangeOrder', () => {
  it('shapes a QBO Invoice payload correctly', () => {
    const inv = qbo.buildInvoiceForChangeOrder({
      coNumber: 'CO-2026-0001',
      date: new Date('2026-06-05T15:00:00Z'),
      dollarValue: 4500,
      description: 'Add 200ft of conduit',
      customerId: 'cust-1',
      customerName: 'Acme Electric',
      itemId: 'item-1',
      dueDateOffsetDays: 30,
    });
    expect(inv.DocNumber).toBe('CO-2026-0001');
    expect(inv.CustomerRef.value).toBe('cust-1');
    expect(inv.Line[0].amount).toBe(4500);
    expect(inv.Line[0].detailType).toBe('SalesItemLineDetail');
    expect(inv.Line[0].salesItemLineDetail.itemRef.value).toBe('item-1');
    expect(inv.TxnDate).toMatch(/^2026-06-0/);
    // 30 days after 2026-06-05 → 2026-07-05
    expect(inv.DueDate).toMatch(/^2026-07-0/);
  });
});

describe('exportInvoice', () => {
  it('returns the existing QBO invoice id without calling QBO (idempotent)', async () => {
    mockExportFindUnique.mockResolvedValueOnce({
      id: 'qe1',
      projectId: 'p1',
      changeOrderId: 'co-1',
      qboInvoiceId: 'qbo-inv-99',
      qboInvoiceNumber: 'INV-99',
      qboCustomerId: 'cust-1',
      exportedAt: new Date(),
      exportedBy: 'u1',
    });
    const r = await qbo.exportInvoice('p1', 'co-1', 'u1');
    expect(r.invoiceId).toBe('qbo-inv-99');
    expect(r.invoiceNumber).toBe('INV-99');
    expect(r.alreadyExported).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockExportCreate).not.toHaveBeenCalled();
  });

  it('throws QboNotConfiguredError when env is missing', async () => {
    delete process.env.QUICKBOOKS_CLIENT_ID;
    await expect(qbo.exportInvoice('p1', 'co-1', 'u1')).rejects.toBeInstanceOf(qbo.QboNotConfiguredError);
  });

  it('throws when the CO is not in the project (tenant isolation)', async () => {
    mockExportFindUnique.mockResolvedValueOnce(null);
    mockCOFindUnique.mockResolvedValueOnce({ id: 'co-1', projectId: 'OTHER', status: 'approved', dollarValue: 100, date: new Date(), coNumber: 'CO-1', description: 'x' });
    await expect(qbo.exportInvoice('p1', 'co-1', 'u1')).rejects.toThrow(/not found in this project/);
  });

  it('throws when the CO is not approved', async () => {
    mockExportFindUnique.mockResolvedValueOnce(null);
    mockCOFindUnique.mockResolvedValueOnce({ id: 'co-1', projectId: 'p1', status: 'pending', dollarValue: 100, date: new Date(), coNumber: 'CO-1', description: 'x' });
    await expect(qbo.exportInvoice('p1', 'co-1', 'u1')).rejects.toThrow(/must be approved/);
  });

  it('returns a useful error when the QBO customer is missing', async () => {
    mockExportFindUnique.mockResolvedValueOnce(null);
    mockCOFindUnique.mockResolvedValueOnce({ id: 'co-1', projectId: 'p1', status: 'approved', dollarValue: 100, date: new Date(), coNumber: 'CO-1', description: 'x' });
    mockProjectFindUnique.mockResolvedValueOnce({ id: 'p1', name: 'Project X' });
    // customer query returns empty
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ QueryResponse: {} }) });
    await expect(qbo.exportInvoice('p1', 'co-1', 'u1')).rejects.toThrow(/customer "Project X" not found/);
  });

  it('exports the CO end-to-end on the happy path', async () => {
    mockExportFindUnique.mockResolvedValueOnce(null);
    mockCOFindUnique.mockResolvedValueOnce({ id: 'co-1', projectId: 'p1', status: 'approved', dollarValue: 1500, date: new Date('2026-06-01'), coNumber: 'CO-1', description: 'Add 200ft conduit' });
    mockProjectFindUnique.mockResolvedValueOnce({ id: 'p1', name: 'Acme BESS' });
    // Customer query
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ QueryResponse: { Customer: [{ Id: 'cust-1' }] } }) });
    // Item query
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ QueryResponse: { Item: [{ Id: 'item-1' }] } }) });
    // Create invoice
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ Invoice: { Id: 'qbo-inv-1', DocNumber: 'CO-1' }, time: '2026-06-15T00:00:00Z' }),
    });
    const r = await qbo.exportInvoice('p1', 'co-1', 'u1');
    expect(r.invoiceId).toBe('qbo-inv-1');
    expect(r.invoiceNumber).toBe('CO-1');
    expect(r.alreadyExported).toBe(false);
    expect(mockExportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: 'p1', changeOrderId: 'co-1', qboInvoiceId: 'qbo-inv-1' }),
      })
    );
  });
});

describe('getConnectionStatus', () => {
  it('returns configured:false when env is missing', async () => {
    delete process.env.QUICKBOOKS_CLIENT_ID;
    delete process.env.QUICKBOOKS_CLIENT_SECRET;
    const s = await qbo.getConnectionStatus();
    expect(s.configured).toBe(false);
    expect(s.connected).toBe(false);
  });

  it('returns connected:true with realmId when a token row exists', async () => {
    const s = await qbo.getConnectionStatus();
    expect(s.configured).toBe(true);
    expect(s.connected).toBe(true);
    expect(s.realmId).toBe('r1');
  });
});

describe('exportChangeOrderSummary', () => {
  it('skips already-exported COs and reports errors per failed CO', async () => {
    mockCOFindMany.mockResolvedValueOnce([
      { id: 'co-1', projectId: 'p1', status: 'approved' },
      { id: 'co-2', projectId: 'p1', status: 'approved' },
      { id: 'co-3', projectId: 'p1', status: 'approved' },
    ]);
    mockExportFindMany.mockResolvedValueOnce([
      { id: 'qe1', projectId: 'p1', changeOrderId: 'co-1', qboInvoiceId: 'qbo-1', qboInvoiceNumber: 'INV-1' },
    ]);
    // exportInvoice for co-2: happy path
    mockExportFindUnique.mockResolvedValueOnce(null);
    mockCOFindUnique.mockResolvedValueOnce({ id: 'co-2', projectId: 'p1', status: 'approved', dollarValue: 100, date: new Date(), coNumber: 'CO-2', description: 'x' });
    mockProjectFindUnique.mockResolvedValueOnce({ id: 'p1', name: 'P' });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ QueryResponse: { Customer: [{ Id: 'c1' }] } }) });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ QueryResponse: { Item: [{ Id: 'i1' }] } }) });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ Invoice: { Id: 'qbo-2', DocNumber: 'CO-2' } }) });
    // exportInvoice for co-3: customer missing
    mockExportFindUnique.mockResolvedValueOnce(null);
    mockCOFindUnique.mockResolvedValueOnce({ id: 'co-3', projectId: 'p1', status: 'approved', dollarValue: 100, date: new Date(), coNumber: 'CO-3', description: 'x' });
    mockProjectFindUnique.mockResolvedValueOnce({ id: 'p1', name: 'P' });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ QueryResponse: {} }) });
    const r = await qbo.exportChangeOrderSummary('p1', 'u1');
    expect(r.total).toBe(3);
    expect(r.invoices).toHaveLength(2);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].changeOrderId).toBe('co-3');
  });
});
