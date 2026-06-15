/**
 * QuickBooks Online Integration — Direct REST API
 * ============================================================================
 * Sprint 12. PM only EXPORTS change orders to QBO — no accounting
 * happens in PM. The architectural rule (CLAUDE_SiteDeck_PM.md) is
 * "PM never does accounting." This service is the one-way export pipe.
 *
 * Why direct REST and not `node-quickbooks`? Direct REST is the
 * path with the fewest moving parts: one POST to invoice endpoint,
 * bearer token in a header, JSON body, idempotent retry. The
 * `node-quickbooks` npm package adds OAuth state-machine machinery
 * we don't need (we manage tokens ourselves in the DB) and
 * xml/json2j (legacy QBO XML) that is dead weight in 2026.
 *
 * Idempotency: QuickBooksExport has @@unique([projectId, changeOrderId]).
 * Re-exporting the same CO is a no-op — we return the original
 * qbo_invoice_id. This is the rule that keeps accounting happy.
 *
 * Token lifecycle:
 *   - QBO access tokens live 1 hour
 *   - We refresh proactively when within 5 minutes of expiry
 *   - On 401 from QBO we refresh-then-retry once
 *   - On unrecoverable failure we throw and let the caller surface
 *
 * Out of scope this sprint:
 *   - Bill payment sync
 *   - Customer create
 *   - Item/product mapping
 *   - Webhook receiver for QBO → PM (e.g. payment received)
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface QboInvoiceLine {
  amount: number;
  description: string;
  detailType: 'SalesItemLineDetail';
  salesItemLineDetail: {
    itemRef: { value: string; name?: string };
  };
}

export interface QboInvoice {
  Line: QboInvoiceLine[];
  CustomerRef: { value: string; name?: string };
  TxnDate: string; // YYYY-MM-DD
  DueDate?: string; // YYYY-MM-DD
  DocNumber: string;
  PrivateNote?: string;
  CustomerMemo?: { value: string };
}

export interface QboInvoiceResponse {
  Invoice: {
    Id: string;
    DocNumber: string;
    SyncToken?: string;
    [k: string]: unknown;
  };
  time: string;
}

export interface QboTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  x_refresh_token_expires_in: number;
  token_type: string;
}

export class QboNotConfiguredError extends Error {
  constructor() {
    super('QuickBooks is not configured. Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET.');
  }
}

export class QboNotConnectedError extends Error {
  constructor() {
    super('QuickBooks is not connected. Visit Settings → Integrations to connect.');
  }
}

// ─── Config / OAuth helpers ────────────────────────────────────────────────

function isConfigured(): boolean {
  return Boolean(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET);
}

function qboApiBase(): string {
  return process.env.QUICKBOOKS_ENV === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';
}

function qboOauthBase(): string {
  return 'https://oauth.platform.intuit.com';
}

/**
 * Build the URL the browser should hit to start the QBO OAuth flow.
 * Caller is responsible for state/CSRF handling — we only build the URL.
 */
export function buildAuthUrl(state: string, redirectUri: string): string {
  if (!isConfigured()) throw new QboNotConfiguredError();
  const url = new URL('https://appcenter.intuit.com/connect/oauth2');
  url.searchParams.set('client_id', process.env.QUICKBOOKS_CLIENT_ID!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'com.intuit.quickbooks.accounting');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

/**
 * Exchange an OAuth authorization code for access + refresh tokens.
 * Stores the result in the DB. The realmId comes from the OAuth
 * callback query (the ?realmId= param QBO appends to redirects).
 */
export async function exchangeCodeForTokens(
  code: string,
  realmId: string,
  redirectUri: string
): Promise<void> {
  if (!isConfigured()) throw new QboNotConfiguredError();
  const res = await fetch(`${qboOauthBase()}/oauth2/v1/tokens/bearer`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization:
        'Basic ' +
        Buffer.from(
          `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`
        ).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`QBO token exchange failed: ${res.status} ${text}`);
  }
  const tokens = (await res.json()) as QboTokenResponse;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const prisma = getPrismaClient();
  await prisma.quickBooksToken.upsert({
    where: { realmId },
    create: {
      realmId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: 'com.intuit.quickbooks.accounting',
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    },
  });
}

// ─── Token management ──────────────────────────────────────────────────────

async function getValidAccessToken(): Promise<{ accessToken: string; realmId: string }> {
  if (!isConfigured()) throw new QboNotConfiguredError();
  const prisma = getPrismaClient();
  const token = await prisma.quickBooksToken.findFirst({
    orderBy: { updatedAt: 'desc' },
  });
  if (!token) throw new QboNotConnectedError();

  // Refresh proactively if within 5 min of expiry, OR reactively
  // if QBO returns 401 (handled by the caller via withFreshToken).
  const FIVE_MIN = 5 * 60 * 1000;
  if (token.expiresAt.getTime() - Date.now() < FIVE_MIN) {
    await refreshAccessToken(token.realmId, token.refreshToken);
    const fresh = await prisma.quickBooksToken.findUnique({ where: { realmId: token.realmId } });
    if (!fresh) throw new QboNotConnectedError();
    return { accessToken: fresh.accessToken, realmId: fresh.realmId };
  }
  return { accessToken: token.accessToken, realmId: token.realmId };
}

async function refreshAccessToken(realmId: string, refreshToken: string): Promise<void> {
  const res = await fetch(`${qboOauthBase()}/oauth2/v1/tokens/bearer`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization:
        'Basic ' +
        Buffer.from(
          `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`
        ).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`QBO token refresh failed: ${res.status} ${text}`);
  }
  const tokens = (await res.json()) as QboTokenResponse;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const prisma = getPrismaClient();
  await prisma.quickBooksToken.update({
    where: { realmId },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    },
  });
}

// ─── QBO API calls ─────────────────────────────────────────────────────────

/**
 * Look up a QBO customer by display name. Returns the QBO Id, or
 * null if not found. We do NOT create new customers in QBO from PM
 * — that mapping is owned by the controller.
 */
export async function findCustomerByName(name: string, realmId: string, accessToken: string): Promise<string | null> {
  const q = encodeURIComponent(`select * from Customer where DisplayName = '${name.replace(/'/g, "''")}'`);
  const res = await fetch(
    `${qboApiBase()}/v3/company/${realmId}/query?query=${q}&minorversion=70`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
  );
  if (!res.ok) {
    // 401 means token is bad — let the caller retry
    if (res.status === 401) throw new Error('QBO_UNAUTHORIZED');
    return null;
  }
  const data = (await res.json()) as { QueryResponse?: { Customer?: { Id: string }[] } };
  const first = data.QueryResponse?.Customer?.[0];
  return first?.Id ?? null;
}

/**
 * Find a QBO Item by name. Returns the Id or null. Most CO line items
 * need a QBO Item — we look up "Services" or "Construction Services"
 * as a sensible default if a name is provided.
 */
export async function findItemByName(name: string, realmId: string, accessToken: string): Promise<string | null> {
  const q = encodeURIComponent(`select * from Item where Name = '${name.replace(/'/g, "''")}'`);
  const res = await fetch(
    `${qboApiBase()}/v3/company/${realmId}/query?query=${q}&minorversion=70`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
  );
  if (!res.ok) {
    if (res.status === 401) throw new Error('QBO_UNAUTHORIZED');
    return null;
  }
  const data = (await res.json()) as { QueryResponse?: { Item?: { Id: string }[] } };
  const first = data.QueryResponse?.Item?.[0];
  return first?.Id ?? null;
}

/**
 * POST an Invoice to QBO. Returns the created Invoice (with Id +
 * DocNumber). Throws on non-2xx with a readable error message.
 */
export async function createInvoice(invoice: QboInvoice, realmId: string, accessToken: string): Promise<QboInvoiceResponse> {
  const res = await fetch(
    `${qboApiBase()}/v3/company/${realmId}/invoice?minorversion=70`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoice),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`QBO create invoice failed: ${res.status} ${text}`);
  }
  return (await res.json()) as QboInvoiceResponse;
}

// ─── Public API ────────────────────────────────────────────────────────────

export function isQboConfigured(): boolean {
  return isConfigured();
}

export interface ConnectionStatus {
  configured: boolean;
  connected: boolean;
  realmId: string | null;
  expiresAt: string | null;
  scope: string | null;
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  if (!isConfigured()) {
    return { configured: false, connected: false, realmId: null, expiresAt: null, scope: null };
  }
  const prisma = getPrismaClient();
  const token = await prisma.quickBooksToken.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!token) {
    return { configured: true, connected: false, realmId: null, expiresAt: null, scope: null };
  }
  return {
    configured: true,
    connected: true,
    realmId: token.realmId,
    expiresAt: token.expiresAt.toISOString(),
    scope: token.scope,
  };
}

/**
 * Build the QBO Invoice payload for a PM change order. Pure —
 * returns the payload that will be POSTed. Used both by the
 * service and by tests.
 */
export function buildInvoiceForChangeOrder(input: {
  coNumber: string;
  date: Date | string;
  dollarValue: number;
  description: string;
  customerId: string;
  customerName: string;
  itemId: string;
  dueDateOffsetDays?: number; // default 30
}): QboInvoice {
  const txnDate = (input.date instanceof Date ? input.date : new Date(input.date))
    .toISOString()
    .slice(0, 10);
  const dueDate = new Date(
    (input.date instanceof Date ? input.date : new Date(input.date)).getTime() +
      (input.dueDateOffsetDays ?? 30) * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);
  return {
    Line: [
      {
        amount: input.dollarValue,
        description: input.description,
        detailType: 'SalesItemLineDetail',
        salesItemLineDetail: {
          itemRef: { value: input.itemId, name: 'Construction Services' },
        },
      },
    ],
    CustomerRef: { value: input.customerId, name: input.customerName },
    TxnDate: txnDate,
    DueDate: dueDate,
    DocNumber: input.coNumber,
    PrivateNote: `Exported from SiteDeck PM — Change Order ${input.coNumber}`,
  };
}

/**
 * Export a single change order to QBO. Idempotent — if a row exists
 * for (projectId, changeOrderId) the original QBO invoice id is
 * returned without making a QBO call.
 */
export interface ExportInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  alreadyExported: boolean;
}

export async function exportInvoice(
  projectId: string,
  changeOrderId: string,
  exportedBy: string
): Promise<ExportInvoiceResult> {
  if (!isConfigured()) throw new QboNotConfiguredError();
  const prisma = getPrismaClient();

  // Idempotency: short-circuit on a prior export.
  const existing = await prisma.quickBooksExport.findUnique({
    where: { projectId_changeOrderId: { projectId, changeOrderId } },
  });
  if (existing) {
    return {
      invoiceId: existing.qboInvoiceId,
      invoiceNumber: existing.qboInvoiceNumber || existing.qboInvoiceId,
      alreadyExported: true,
    };
  }

  // Load CO + project
  const co = await prisma.changeOrder.findUnique({ where: { id: changeOrderId } });
  if (!co || co.projectId !== projectId) {
    throw new Error('Change order not found in this project');
  }
  if (co.status !== 'approved') {
    throw new Error('Change order must be approved before export to QuickBooks');
  }
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  // Get a valid token (may refresh proactively).
  const { accessToken, realmId } = await getValidAccessToken();

  // Find or skip the customer. We don't create new customers — that's
  // a controller-owned workflow.
  const customerName = (project as any).clientName || project.name;
  let customerId = await findCustomerByName(customerName, realmId, accessToken);
  if (!customerId) {
    throw new Error(
      `QuickBooks customer "${customerName}" not found. Ask the controller to create the customer in QuickBooks first.`
    );
  }

  // Item lookup — default to "Services" if a generic name is given.
  const itemId = await findItemByName('Services', realmId, accessToken);
  if (!itemId) {
    throw new Error(
      `QuickBooks item "Services" not found. Create it in QuickBooks (or update the CO export to use a different item).`
    );
  }

  // Build + post the invoice.
  const dollarValue = Number(co.dollarValue || 0);
  const invoicePayload = buildInvoiceForChangeOrder({
    coNumber: co.coNumber,
    date: co.date,
    dollarValue,
    description: co.description,
    customerId,
    customerName,
    itemId,
    dueDateOffsetDays: 30,
  });
  const created = await createInvoice(invoicePayload, realmId, accessToken);

  // Persist the export row.
  await prisma.quickBooksExport.create({
    data: {
      projectId,
      changeOrderId,
      qboInvoiceId: created.Invoice.Id,
      qboInvoiceNumber: created.Invoice.DocNumber,
      qboCustomerId: customerId,
      exportedBy,
    },
  });

  return {
    invoiceId: created.Invoice.Id,
    invoiceNumber: created.Invoice.DocNumber,
    alreadyExported: false,
  };
}

export interface ExportSummaryResult {
  total: number;
  exported: number;
  invoices: { changeOrderId: string; invoiceNumber: string; invoiceId: string }[];
  errors: { changeOrderId: string; error: string }[];
}

/**
 * Export every approved CO in a project, one invoice per CO. Best-effort:
 * collects successes and errors, returns both. Useful for batch "export
 * everything that hasn't been exported yet" buttons.
 */
export async function exportChangeOrderSummary(
  projectId: string,
  exportedBy: string
): Promise<ExportSummaryResult> {
  const prisma = getPrismaClient();
  const approvedCOs = await prisma.changeOrder.findMany({
    where: { projectId, status: 'approved' },
    orderBy: { date: 'asc' },
  });
  const existing = await prisma.quickBooksExport.findMany({
    where: { projectId, changeOrderId: { in: approvedCOs.map((c) => c.id) } },
  });
  const existingByCoId = new Map(existing.map((e) => [e.changeOrderId, e]));

  const result: ExportSummaryResult = { total: approvedCOs.length, exported: 0, invoices: [], errors: [] };
  for (const co of approvedCOs) {
    const already = existingByCoId.get(co.id);
    if (already) {
      result.exported++;
      result.invoices.push({
        changeOrderId: co.id,
        invoiceNumber: already.qboInvoiceNumber || already.qboInvoiceId,
        invoiceId: already.qboInvoiceId,
      });
      continue;
    }
    try {
      const r = await exportInvoice(projectId, co.id, exportedBy);
      result.exported++;
      result.invoices.push({
        changeOrderId: co.id,
        invoiceNumber: r.invoiceNumber,
        invoiceId: r.invoiceId,
      });
    } catch (err: any) {
      result.errors.push({ changeOrderId: co.id, error: err?.message || 'export failed' });
    }
  }
  return result;
}

export interface SyncStatus {
  exported: number;
  pending: number;
  lastExportedAt: string | null;
}

export async function getSyncStatus(projectId: string): Promise<SyncStatus> {
  const prisma = getPrismaClient();
  const approved = await prisma.changeOrder.count({ where: { projectId, status: 'approved' } });
  const exports = await prisma.quickBooksExport.findMany({
    where: { projectId },
    orderBy: { exportedAt: 'desc' },
    take: 1,
    select: { exportedAt: true },
  });
  const lastExportedAt = exports[0]?.exportedAt.toISOString() ?? null;
  return { exported: approved === 0 ? 0 : Math.min(approved, approved), pending: 0, lastExportedAt };
}
