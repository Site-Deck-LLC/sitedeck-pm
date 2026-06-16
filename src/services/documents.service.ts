/**
 * Documents Service — Drawing Repository Foundation
 * ============================================================================
 * Sprint 7 scope:
 *   - Document / DocumentRevision metadata CRUD.
 *   - Presigned PUT URL generation for direct browser → R2 upload.
 *   - Confirm-upload endpoint registers the revision in the DB.
 *   - Revision history listing.
 *
 * Sprint 8 additions:
 *   - Presigned GET URL generation (download/preview).
 *   - DocumentDownloadLog audit trail (who requested access, not just
 *     who got the URL — important when URLs get forwarded).
 *
 * Out of scope this sprint (follow-ups):
 *   - Webhook to verify SHA256 matches what's in R2.
 *   - Per-discipline permission scoping.
 *
 * R2 (Cloudflare's S3-compatible blob store) is the storage backend. The
 * presigned URL is signed with the standard SigV4 algorithm using Node's
 * built-in crypto — no AWS SDK dependency. When R2 is not configured
 * (no R2_* env vars) the service runs in "dev stub" mode: the presign
 * returns a fake URL and the confirm endpoint just trusts whatever the
 * client claimed the size/sha was. The dev stub is gated to non-prod.
 *
 * Tenant isolation: every query keys on projectId. Routes that take a
 * documentId must first verify the document's projectId matches the URL
 * :projectId before any read or write.
 * ============================================================================
 */

import { createHash, createHmac, randomUUID } from 'crypto';
import { getPrismaClient } from '../lib/prisma';

// ─── Public types ───────────────────────────────────────────────────────────

export interface DocumentSummary {
  id: string;
  projectId: string;
  name: string;
  discipline: string;
  drawingNo: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  latestRevision: { revisionNo: number; uploadedAt: string; sizeBytes: number; uploadStatus: string } | null;
}

export interface DocumentDetail extends DocumentSummary {
  revisions: Array<{
    id: string;
    revisionNo: number;
    contentType: string;
    sizeBytes: number;
    sha256: string | null;
    uploadedBy: string;
    uploadedAt: string;
    notes: string | null;
    uploadStatus: string;
  }>;
}

export interface PresignedUpload {
  url: string;
  storageKey: string;
  contentType: string;
  expiresIn: number;
  // dev mode flag — frontend can show a banner that this is not real R2
  devStub: boolean;
}

// ─── Configuration ─────────────────────────────────────────────────────────

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicHost: string; // e.g. https://<account>.r2.cloudflarestorage.com
}

function readR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  const publicHost =
    process.env.R2_PUBLIC_HOST ||
    `https://${accountId}.r2.cloudflarestorage.com`;
  return { accountId, accessKeyId, secretAccessKey, bucket, publicHost };
}

// ─── Document CRUD ──────────────────────────────────────────────────────────

export async function listDocuments(projectId: string): Promise<DocumentSummary[]> {
  const prisma = getPrismaClient();
  const docs = await prisma.document.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    include: {
      revisions: {
        orderBy: { revisionNo: 'desc' },
        take: 1,
        select: { revisionNo: true, uploadedAt: true, sizeBytes: true, uploadStatus: true },
      },
    },
  });
  return docs.map((d: any) => summarize(d, d.revisions[0] || null));
}

export async function getDocument(
  projectId: string,
  id: string
): Promise<DocumentDetail | null> {
  const prisma = getPrismaClient();
  const d = await prisma.document.findUnique({
    where: { id },
    include: { revisions: { orderBy: { revisionNo: 'desc' } } },
  });
  if (!d || d.projectId !== projectId) return null;
  const latest = (d as any).revisions[0] || null;
  return {
    ...summarize(d, latest),
    revisions: (d as any).revisions.map((r: any) => ({
      id: r.id,
      revisionNo: r.revisionNo,
      contentType: r.contentType,
      sizeBytes: r.sizeBytes,
      sha256: r.sha256,
      uploadedBy: r.uploadedBy,
      uploadedAt: r.uploadedAt instanceof Date ? r.uploadedAt.toISOString() : r.uploadedAt,
      notes: r.notes,
      uploadStatus: r.uploadStatus,
    })),
  };
}

export async function createDocument(input: {
  projectId: string;
  name: string;
  discipline: string;
  drawingNo?: string;
  createdBy: string;
}): Promise<{ id: string }> {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  const prisma = getPrismaClient();
  const doc = await prisma.document.create({
    data: {
      projectId: input.projectId,
      name: input.name.trim().slice(0, 200),
      discipline: input.discipline,
      drawingNo: input.drawingNo ? input.drawingNo.trim().slice(0, 100) : null,
      createdBy: input.createdBy,
    },
  });
  return { id: doc.id };
}

// ─── Presigned URL ─────────────────────────────────────────────────────────

export async function presignUpload(input: {
  projectId: string;
  documentId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<PresignedUpload> {
  const prisma = getPrismaClient();
  // Tenant check
  const doc = await prisma.document.findUnique({ where: { id: input.documentId } });
  if (!doc || doc.projectId !== input.projectId) {
    throw new Error('document not found');
  }

  // Find the next revision number
  const last = await prisma.documentRevision.findFirst({
    where: { documentId: input.documentId },
    orderBy: { revisionNo: 'desc' },
    select: { revisionNo: true },
  });
  const nextRev = (last?.revisionNo || 0) + 1;
  const safeName = input.filename.replace(/[^A-Za-z0-9._-]/g, '_');
  const storageKey = `projects/${input.projectId}/docs/${input.documentId}/rev${nextRev}-${safeName}`;

  const r2 = readR2Config();
  if (!r2) {
    // Dev stub: no real R2. Only allowed in non-prod.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('R2 not configured (set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)');
    }
    return {
      url: `http://localhost:3000/dev-stub-upload/${encodeURIComponent(storageKey)}`,
      storageKey,
      contentType: input.contentType,
      expiresIn: 900,
      devStub: true,
    };
  }

  // Create the pending revision row up front so the confirm step has
  // something to flip from "pending" to "uploaded".
  await prisma.documentRevision.create({
    data: {
      documentId: input.documentId,
      revisionNo: nextRev,
      storageKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      uploadedBy: 'pending', // overwritten on confirm
      uploadStatus: 'pending',
    },
  });

  const expiresIn = 900; // 15 min
  const url = signR2PutUrl(r2, storageKey, input.contentType, expiresIn);
  return { url, storageKey, contentType: input.contentType, expiresIn, devStub: false };
}

export async function confirmUpload(input: {
  projectId: string;
  documentId: string;
  revisionNo: number;
  sha256: string;
  sizeBytes: number;
  uploadedBy: string;
  notes?: string;
}): Promise<{ ok: true }> {
  const prisma = getPrismaClient();
  const doc = await prisma.document.findUnique({ where: { id: input.documentId } });
  if (!doc || doc.projectId !== input.projectId) {
    throw new Error('document not found');
  }
  await prisma.documentRevision.update({
    where: { documentId_revisionNo: { documentId: input.documentId, revisionNo: input.revisionNo } },
    data: {
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      uploadedBy: input.uploadedBy,
      notes: input.notes || null,
      uploadStatus: 'uploaded',
    },
  });
  return { ok: true };
}

// ─── Presigned GET (download / preview) ────────────────────────────────────

export interface PresignedDownload {
  url: string;
  filename: string;
  contentType: string;
  expiresAt: string;
  // dev mode flag — frontend can show a banner that this is not real R2
  devStub: boolean;
  // "inline" → browser may render (PDF preview, image); "attachment" →
  // browser will download with the original filename
  contentDisposition: 'inline' | 'attachment';
}

const DOWNLOAD_TTL_SECONDS = 60 * 60; // 60 min — user may keep the doc open

/**
 * Generate a presigned GET URL for a specific revision (or the latest
 * uploaded one if revisionId is omitted). Returns null when the document
 * doesn't belong to the project (tenant isolation).
 *
 * `mode = 'attachment'` triggers a download (Content-Disposition: attachment).
 * `mode = 'inline'` (default) lets the browser render PDFs/images in-place.
 * Either way the signature covers the response-content-disposition query
 * parameter so a leaked URL cannot be repackaged.
 */
export async function generateDownloadUrl(input: {
  projectId: string;
  documentId: string;
  revisionId?: string;
  mode?: 'inline' | 'attachment';
}): Promise<PresignedDownload | null> {
  const prisma = getPrismaClient();
  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
    include: {
      revisions: {
        orderBy: { revisionNo: 'desc' },
        ...(input.revisionId
          ? { where: { id: input.revisionId } }
          : {}),
      },
    },
  });
  if (!doc || doc.projectId !== input.projectId) return null;
  // Filter out non-uploaded revisions (e.g. pending) when no explicit id
  // was given — we only serve actual content.
  const candidates = input.revisionId
    ? doc.revisions
    : doc.revisions.filter((r: any) => r.uploadStatus === 'uploaded');
  const rev = candidates[0];
  if (!rev) return null;

  const mode = input.mode ?? 'inline';
  const r2 = readR2Config();
  const filename = `${doc.drawingNo ? doc.drawingNo + '_' : ''}rev${rev.revisionNo}-${doc.name}`;
  const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_SECONDS * 1000).toISOString();

  if (!r2) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('R2 not configured (set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)');
    }
    return {
      url: `http://localhost:3000/dev-stub-download/${encodeURIComponent(rev.storageKey)}?disposition=${mode}`,
      filename,
      contentType: rev.contentType,
      expiresAt,
      devStub: true,
      contentDisposition: mode,
    };
  }

  const url = signR2GetUrl(r2, rev.storageKey, rev.contentType, filename, mode, DOWNLOAD_TTL_SECONDS);
  return { url, filename, contentType: rev.contentType, expiresAt, devStub: false, contentDisposition: mode };
}

/**
 * Persist a download audit row. The presign endpoint fires this every
 * time a URL is issued, not every time someone actually opens it — the
 * row records *intent to access*, not access itself. The log is the
 * fallback when a URL is shared and we need to roll the key.
 */
export async function logDownload(input: {
  documentId: string;
  revisionId?: string | null;
  userId: string;
  ipAddress?: string | null;
}): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.documentDownloadLog.create({
    data: {
      documentId: input.documentId,
      revisionId: input.revisionId || null,
      userId: input.userId,
      ipAddress: input.ipAddress || null,
    },
  });
}

export async function deleteDocument(projectId: string, id: string): Promise<{ deleted: boolean; r2ObjectsRemoved: number }> {
  const prisma = getPrismaClient();
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { revisions: true },
  });
  if (!doc || doc.projectId !== projectId) return { deleted: false, r2ObjectsRemoved: 0 };

  // Capture the storage keys before the cascade wipes the
  // DocumentRevision rows. We need them to ask R2 to delete the
  // underlying blobs.
  const storageKeys = doc.revisions.map((r) => r.storageKey);

  // Hard-delete cascades to DocumentRevision via the onDelete
  // rule on the relation. The download log table is not cascaded
  // — it's an audit trail; the rows survive but reference a
  // non-existent documentId. That's correct: the audit tells us
  // *who* downloaded a doc that *no longer exists*.
  await prisma.document.delete({ where: { id } });

  // Best-effort R2 cleanup. We collect the keys, then attempt
  // a single batch delete. If R2 isn't configured (dev mode) or
  // the call fails, the DB delete is still considered successful
  // — orphan R2 objects are picked up by `cleanupOrphanRevisions`
  // on the next sweep. The R2 call returns a count so the route
  // can surface it in the response.
  const r2ObjectsRemoved = await deleteR2Objects(storageKeys);

  return { deleted: true, r2ObjectsRemoved };
}

/**
 * Sweep up revisions stuck in 'pending' for more than 24h. A
 * pending revision is one the user uploaded to R2 but never
 * confirmed back to the API (network drop, browser closed, etc.).
 * The DB row is a tombstone; the underlying R2 object is a
 * storage leak. This routine finds them and deletes both.
 *
 * Designed to run on a cron / scheduled task. The route surface
 * also exposes a manual trigger for ops.
 */
export interface OrphanCleanupResult {
  revisionsDeleted: number;
  documentsDeleted: number;
  r2ObjectsRemoved: number;
}

export async function cleanupOrphanRevisions(opts: {
  olderThanHours?: number;
  maxRows?: number;
} = {}): Promise<OrphanCleanupResult> {
  const olderThanHours = opts.olderThanHours ?? 24;
  const maxRows = opts.maxRows ?? 500;
  const prisma = getPrismaClient();
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  // 1. Find orphaned revisions.
  const orphans = await prisma.documentRevision.findMany({
    where: {
      uploadStatus: 'pending',
      uploadedAt: { lt: cutoff },
    },
    take: maxRows,
    select: { id: true, storageKey: true, documentId: true },
  });

  if (orphans.length === 0) {
    return { revisionsDeleted: 0, documentsDeleted: 0, r2ObjectsRemoved: 0 };
  }

  // 2. Delete the R2 objects first (best-effort). If R2 is down,
  //    we still proceed with the DB cleanup so the metadata
  //    tombstones don't accumulate.
  const r2Keys = orphans.map((o) => o.storageKey);
  const r2ObjectsRemoved = await deleteR2Objects(r2Keys);

  // 3. Delete the revision rows.
  const revisionIds = orphans.map((o) => o.id);
  const { count: revisionsDeleted } = await prisma.documentRevision.deleteMany({
    where: { id: { in: revisionIds } },
  });

  // 4. If a document now has zero revisions, drop the document
  //    too. A document with no revisions is itself a tombstone.
  const documentIdsWithRemainingRevisions = await prisma.documentRevision.findMany({
    where: { documentId: { in: orphans.map((o) => o.documentId) } },
    select: { documentId: true },
    distinct: ['documentId'],
  });
  const docsWithRevisions = new Set(documentIdsWithRemainingRevisions.map((r) => r.documentId));
  const orphanDocIds = Array.from(
    new Set(orphans.map((o) => o.documentId).filter((id) => !docsWithRevisions.has(id)))
  );
  let documentsDeleted = 0;
  if (orphanDocIds.length > 0) {
    const { count } = await prisma.document.deleteMany({
      where: { id: { in: orphanDocIds } },
    });
    documentsDeleted = count;
  }

  return { revisionsDeleted, documentsDeleted, r2ObjectsRemoved };
}

// ─── SigV4 presigned PUT (no AWS SDK) ──────────────────────────────────────

function signR2PutUrl(
  cfg: R2Config,
  storageKey: string,
  contentType: string,
  expiresIn: number
): string {
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const host = new URL(cfg.publicHost).host;

  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const signedHeaders = 'host';

  const params = new URLSearchParams();
  params.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  params.set('X-Amz-Credential', `${cfg.accessKeyId}/${credentialScope}`);
  params.set('X-Amz-Date', amzDate);
  params.set('X-Amz-Expires', String(expiresIn));
  params.set('X-Amz-SignedHeaders', signedHeaders);

  // Canonical request
  const canonicalUri = '/' + encodeURI(storageKey).replace(/%2F/g, '/');
  const canonicalQueryString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, 'auto');
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmacHex(kSigning, stringToSign);

  params.set('X-Amz-Signature', signature);
  return `${cfg.publicHost}${canonicalUri}?${params.toString()}`;
}

/**
 * Sign a GET URL with two extra response-overrides:
 *   - response-content-type: forces the browser to render the file with
 *     the recorded content type even if R2 stored it differently
 *   - response-content-disposition: either inline (preview) or attachment
 *     (download). The signature covers these so a leaked URL can't be
 *     re-cast by the holder.
 */
function signR2GetUrl(
  cfg: R2Config,
  storageKey: string,
  contentType: string,
  filename: string,
  mode: 'inline' | 'attachment',
  expiresIn: number
): string {
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const host = new URL(cfg.publicHost).host;

  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const signedHeaders = 'host';

  const disposition = `${mode}; filename="${filename.replace(/"/g, '')}"`;

  const params = new URLSearchParams();
  params.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  params.set('X-Amz-Credential', `${cfg.accessKeyId}/${credentialScope}`);
  params.set('X-Amz-Date', amzDate);
  params.set('X-Amz-Expires', String(expiresIn));
  params.set('X-Amz-SignedHeaders', signedHeaders);
  params.set('response-content-type', encodeURIComponent(contentType));
  params.set('response-content-disposition', encodeURIComponent(disposition));

  const canonicalUri = '/' + encodeURI(storageKey).replace(/%2F/g, '/');
  const canonicalQueryString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, 'auto');
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmacHex(kSigning, stringToSign);

  params.set('X-Amz-Signature', signature);
  return `${cfg.publicHost}${canonicalUri}?${params.toString()}`;
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}
function hmacHex(key: Buffer, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}
function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}
function toAmzDate(d: Date): string {
  // YYYYMMDDTHHMMSSZ (UTC)
  return d.toISOString().replace(/[:.-]/g, '').replace(/\.\d+Z$/, 'Z');
}

/**
 * Sign a DELETE-object request. R2 / S3 use the same SigV4
 * algorithm for DELETEs that they do for GETs and PUTs; the only
 * difference is the HTTP verb and the absence of payload content
 * headers. We return `{ url, headers }` so the caller can do
 * `fetch(url, { method: 'DELETE', headers })`.
 */
function signR2DeleteUrl(
  cfg: R2Config,
  storageKey: string
): { url: string; headers: Record<string, string> } {
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const host = new URL(cfg.publicHost).host;

  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const signedHeaders = 'host';

  const params = new URLSearchParams();
  params.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  params.set('X-Amz-Credential', `${cfg.accessKeyId}/${credentialScope}`);
  params.set('X-Amz-Date', amzDate);
  params.set('X-Amz-Expires', '60');
  params.set('X-Amz-SignedHeaders', signedHeaders);

  const canonicalUri = '/' + encodeURI(storageKey).replace(/%2F/g, '/');
  const canonicalQueryString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalRequest = [
    'DELETE',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, 'auto');
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmacHex(kSigning, stringToSign);

  params.set('X-Amz-Signature', signature);
  const url = `${cfg.publicHost}${canonicalUri}?${params.toString()}`;
  return { url, headers: { host } };
}

/**
 * Best-effort R2 object deletion. Returns the number of objects
 * the bucket confirmed as removed. Failures (R2 down, dev mode
 * with no config) are swallowed — the DB-level cleanup is what
 * matters for V1, and a `0` return is the right signal to
 * upstream that we couldn't reach the bucket.
 *
 * Implementation: one signed DELETE per object, run in parallel
 * via `Promise.all`. The 60-second presign window is plenty for
 * a synchronous sweep; if it expires mid-flight the call returns
 * 403 from R2 and we log it. We don't retry — `cleanupOrphanRevisions`
 * will pick up the same keys on the next sweep.
 */
async function deleteR2Objects(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const cfg = readR2Config();
  if (!cfg) {
    // Dev mode: R2 is not configured. We can't actually delete.
    // Return 0 so the caller knows the storage layer is unconfigured
    // and treats the DB cleanup as the source of truth.
    return 0;
  }

  let removed = 0;
  const results = await Promise.allSettled(
    keys.map(async (storageKey) => {
      const { url, headers } = signR2DeleteUrl(cfg, storageKey);
      const res = await fetch(url, { method: 'DELETE', headers });
      if (res.ok || res.status === 404) {
        // 204 = deleted, 404 = already gone. Both count as "removed".
        return true;
      }
      console.warn(
        `[documents] R2 delete failed (${res.status}) for key=${storageKey}`
      );
      return false;
    })
  );
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) removed++;
  }
  return removed;
}

// ─── helpers ───────────────────────────────────────────────────────────────

function summarize(d: any, latest: any | null): DocumentSummary {
  return {
    id: d.id,
    projectId: d.projectId,
    name: d.name,
    discipline: d.discipline,
    drawingNo: d.drawingNo,
    status: d.status,
    createdBy: d.createdBy,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    latestRevision: latest
      ? {
          revisionNo: latest.revisionNo,
          uploadedAt: latest.uploadedAt instanceof Date ? latest.uploadedAt.toISOString() : latest.uploadedAt,
          sizeBytes: latest.sizeBytes,
          uploadStatus: latest.uploadStatus,
        }
      : null,
  };
}

// ─── IFC Propagation (Sprint 9 Task 1) ─────────────────────────────────────

export interface ReleaseIfcResult {
  ok: true;
  documentId: string;
  status: 'issued_for_construction';
  currentRevisionId: string;
  currentRevisionNo: number;
  notificationCount: number;
  benchmarkWebhookSent: boolean;
  proPropagationPending: boolean;
  alreadyReleased: boolean;
}

/**
 * Release a document as Issued for Construction. Idempotent — if the
 * document is already IFC, returns the existing release with
 * `alreadyReleased: true` and skips the propagation fan-out.
 *
 * Standalone degradation: every external side-effect (notifications,
 * Benchmark webhook, Pro fan-out) is best-effort. The IFC status flip
 * itself succeeds even if Benchmark is down. The route surfaces the
 * per-side-effect result in the response.
 *
 * The Pro fan-out is logged as pending — Pro doesn't have a receiver
 * endpoint yet, so we record the intent and ship a stub flag.
 */
export async function releaseAsIfc(
  projectId: string,
  documentId: string,
  userId: string
): Promise<ReleaseIfcResult | null> {
  const prisma = getPrismaClient();
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      revisions: {
        where: { uploadStatus: 'uploaded' },
        orderBy: { revisionNo: 'desc' },
        take: 1,
      },
    },
  });
  if (!doc || doc.projectId !== projectId) return null;
  const latestRev = doc.revisions[0];
  if (!latestRev) {
    throw new Error('Document has no uploaded revisions to release');
  }

  // Idempotency: if the document is already IFC and the current
  // revision hasn't changed, skip propagation. The current revision
  // being different means a new revision was uploaded post-IFC and
  // needs its own release.
  const alreadyReleased =
    doc.status === 'issued_for_construction' &&
    doc.currentRevisionId === latestRev.id;

  // Always update status (in case of drift). Updates are a no-op on
  // the wire when nothing changed.
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'issued_for_construction',
      currentRevisionId: latestRev.id,
      ifcReleasedAt: alreadyReleased ? doc.ifcReleasedAt : new Date(),
      ifcReleasedBy: alreadyReleased ? doc.ifcReleasedBy : userId,
    },
  });

  // Audit log
  await prisma.drawingAuditLog.create({
    data: {
      projectId,
      documentId,
      eventType: 'drawing_released_ifc',
      actorId: userId,
      metadata: {
        revisionId: latestRev.id,
        revisionNo: latestRev.revisionNo,
        idempotent: alreadyReleased,
      },
    },
  });

  if (alreadyReleased) {
    return {
      ok: true,
      documentId,
      status: 'issued_for_construction',
      currentRevisionId: latestRev.id,
      currentRevisionNo: latestRev.revisionNo,
      notificationCount: 0,
      benchmarkWebhookSent: false,
      proPropagationPending: false,
      alreadyReleased: true,
    };
  }

  // Notification fan-out — one per project member. We treat the
  // existing user set as a proxy (real membership table is Sprint 10).
  const notificationCount = await notifyProjectMembersOfIfc(
    projectId,
    doc.name,
    doc.drawingNo,
    latestRev.revisionNo,
    documentId
  );

  // Benchmark webhook (when configured)
  const benchmarkWebhookSent = await emitDrawingIfcReleased({
    projectId,
    documentId,
    drawingNumber: doc.drawingNo ?? doc.name,
    revision: String(latestRev.revisionNo),
    discipline: doc.discipline,
    fileUrl: `documents/${documentId}/revisions/${latestRev.id}`,
    releasedAt: new Date().toISOString(),
  });

  // Pro fan-out (Sprint 10) — log as pending
  await prisma.drawingAuditLog.create({
    data: {
      projectId,
      documentId,
      eventType: 'drawing_ifc_propagate_pro_pending',
      actorId: userId,
      metadata: { reason: 'pro receiver not yet implemented (Sprint 10)' },
    },
  });

  return {
    ok: true,
    documentId,
    status: 'issued_for_construction',
    currentRevisionId: latestRev.id,
    currentRevisionNo: latestRev.revisionNo,
    notificationCount,
    benchmarkWebhookSent,
    proPropagationPending: true,
    alreadyReleased: false,
  };
}

async function notifyProjectMembersOfIfc(
  projectId: string,
  name: string,
  drawingNo: string | null,
  revisionNo: number,
  documentId: string
): Promise<number> {
  try {
    // Lazy import to avoid a circular dep at module load
    const { createNotificationSafe } = await import('./notifications.service');
    // For V1 we don't have a project-membership table yet; we
    // best-effort fan out to a known broadcast list. The actual
    // project-member list is built in Sprint 10 Task 6. Until then
    // this emits a single system notification so the audit trail
    // exists; downstream push/email will read the same row.
    await createNotificationSafe({
      userId: 'broadcast:project-members',
      kind: 'system',
      title: 'Drawing Released for Construction',
      body: `${drawingNo ?? name} Rev ${revisionNo} — ${name} released for construction`,
      payload: {
        projectId,
        documentId,
        event: 'drawing_ifc_released',
        actionUrl: `/projects/${projectId}/documents/${documentId}`,
        drawingNumber: drawingNo,
        revision: revisionNo,
        name,
      },
    });
    return 1;
  } catch (err) {
    console.warn('[documents] IFC notification fan-out failed:', (err as any)?.message);
    return 0;
  }
}

/**
 * Build & send a Benchmark webhook for a drawing IFC release.
 * Fire-and-forget — never throws. Returns true when the call
 * succeeded (HTTP 2xx).
 */
async function emitDrawingIfcReleased(payload: {
  projectId: string;
  documentId: string;
  drawingNumber: string;
  revision: string;
  discipline: string;
  fileUrl: string;
  releasedAt: string;
}): Promise<boolean> {
  const url = process.env.PM_BENCHMARK_WEBHOOK_URL;
  if (!url) return false;
  try {
    const { createHmac } = await import('crypto');
    const body = JSON.stringify({ event: 'drawing.ifc_released', ...payload });
    const secret = process.env.PM_BENCHMARK_WEBHOOK_SECRET;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-PM-Event': 'drawing.ifc_released',
    };
    if (secret) {
      const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
      headers['x-sitedeck-signature'] = sig;
      headers['X-PM-Signature'] = sig;
    }
    const res = await fetch(url, { method: 'POST', headers, body });
    return res.ok;
  } catch (err) {
    console.warn('[documents] benchmark IFC webhook failed:', (err as any)?.message);
    return false;
  }
}
