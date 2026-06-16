/**
 * Tests for the documents service — drawing repository foundation.
 * - listDocuments returns the latest revision summary
 * - getDocument enforces tenant isolation
 * - createDocument rejects empty name
 * - presignUpload in dev-stub mode returns a fake URL, devStub=true
 * - presignUpload in production without R2 config throws
 * - confirmUpload flips status to "uploaded" and records sha256/uploader
 * - presigned URL contains the standard SigV4 query params
 */

import * as documents from './documents.service';

const mockProjectFindUnique = jest.fn();
const mockDocumentFindUnique = jest.fn();
const mockDocumentFindMany = jest.fn();
const mockDocumentCreate = jest.fn();
const mockDocumentDelete = jest.fn();
const mockDocumentDeleteMany = jest.fn();
const mockDocumentUpdate = jest.fn();
const mockDocumentRevisionFindFirst = jest.fn();
const mockDocumentRevisionCreate = jest.fn();
const mockDocumentRevisionUpdate = jest.fn();
const mockDocumentRevisionFindMany = jest.fn();
const mockDocumentRevisionDeleteMany = jest.fn();
const mockDocumentDownloadLogCreate = jest.fn();
const mockDrawingAuditLogCreate = jest.fn();

jest.mock('../lib/prisma', () => ({
  getPrismaClient: () => ({
    project: { findUnique: mockProjectFindUnique },
    document: {
      findUnique: mockDocumentFindUnique,
      findMany: mockDocumentFindMany,
      create: mockDocumentCreate,
      delete: mockDocumentDelete,
      deleteMany: mockDocumentDeleteMany,
      update: mockDocumentUpdate,
    },
    documentRevision: {
      findFirst: mockDocumentRevisionFindFirst,
      create: mockDocumentRevisionCreate,
      update: mockDocumentRevisionUpdate,
      findMany: mockDocumentRevisionFindMany,
      deleteMany: mockDocumentRevisionDeleteMany,
    },
    documentDownloadLog: {
      create: mockDocumentDownloadLogCreate,
    },
    drawingAuditLog: {
      create: mockDrawingAuditLogCreate,
    },
  }),
}));

// Mock fetch so the R2 DELETE calls in deleteR2Objects can be
// observed and stubbed. Tests that exercise R2 interaction set
// the env below to enable the real codepath.
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

const originalEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  // Defaults — no R2 config (dev-stub mode)
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.R2_ACCESS_KEY_ID;
  delete process.env.R2_SECRET_ACCESS_KEY;
  delete process.env.R2_BUCKET;
  process.env.NODE_ENV = 'test';
  mockDocumentFindUnique.mockImplementation(async ({ where }: any) => ({
    id: where.id,
    projectId: 'p1',
    name: 'A-101',
    discipline: 'architectural',
    drawingNo: 'A-101',
    status: 'current',
    createdBy: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  mockDocumentRevisionFindFirst.mockResolvedValue(null);
  mockDocumentRevisionCreate.mockImplementation(async ({ data }: any) => ({
    id: 'rev-1',
    ...data,
  }));
  mockDocumentRevisionUpdate.mockImplementation(async ({ where, data }: any) => ({
    id: 'rev-1',
    documentId: where.documentId_revisionNo.documentId,
    revisionNo: where.documentId_revisionNo.revisionNo,
    ...data,
  }));
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('listDocuments', () => {
  it('returns summaries with the latest revision inline', async () => {
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'd1',
        projectId: 'p1',
        name: 'A-101',
        discipline: 'architectural',
        drawingNo: 'A-101',
        status: 'current',
        createdBy: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
        revisions: [
          { revisionNo: 2, uploadedAt: new Date(), sizeBytes: 1234, uploadStatus: 'uploaded' },
        ],
      },
    ]);
    const list = await documents.listDocuments('p1');
    expect(list).toHaveLength(1);
    expect(list[0].latestRevision).toEqual(
      expect.objectContaining({ revisionNo: 2, sizeBytes: 1234, uploadStatus: 'uploaded' })
    );
  });
});

describe('getDocument', () => {
  it('returns null when the document belongs to a different project', async () => {
    mockDocumentFindUnique.mockResolvedValue({ id: 'd1', projectId: 'p2' });
    const result = await documents.getDocument('p1', 'd1');
    expect(result).toBeNull();
  });

  it('returns full detail when project matches', async () => {
    mockDocumentFindUnique.mockResolvedValue({
      id: 'd1',
      projectId: 'p1',
      name: 'A-101',
      discipline: 'architectural',
      drawingNo: 'A-101',
      status: 'current',
      createdBy: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
      revisions: [
        {
          id: 'r1',
          revisionNo: 1,
          contentType: 'application/pdf',
          sizeBytes: 100,
          sha256: 'abc',
          uploadedBy: 'u1',
          uploadedAt: new Date(),
          notes: null,
          uploadStatus: 'uploaded',
        },
      ],
    });
    const result = await documents.getDocument('p1', 'd1');
    expect(result?.revisions).toHaveLength(1);
    expect(result?.revisions[0].sha256).toBe('abc');
  });
});

describe('createDocument', () => {
  it('rejects empty name', async () => {
    await expect(
      documents.createDocument({ projectId: 'p1', name: '', discipline: 'arch', createdBy: 'u1' })
    ).rejects.toThrow(/name/);
  });

  it('creates with the supplied fields', async () => {
    mockDocumentCreate.mockImplementation(async ({ data }: any) => ({ id: 'new-id', ...data }));
    const result = await documents.createDocument({
      projectId: 'p1',
      name: 'A-101',
      discipline: 'architectural',
      drawingNo: 'A-101',
      createdBy: 'u1',
    });
    expect(result.id).toBe('new-id');
    expect(mockDocumentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'A-101', discipline: 'architectural' }),
      })
    );
  });
});

describe('presignUpload', () => {
  it('returns a dev-stub URL in non-prod when R2 is not configured', async () => {
    const result = await documents.presignUpload({
      projectId: 'p1',
      documentId: 'd1',
      filename: 'A-101 rev2.pdf',
      contentType: 'application/pdf',
      sizeBytes: 50000,
    });
    expect(result.devStub).toBe(true);
    expect(result.storageKey).toContain('projects/p1/docs/d1/rev1-A-101_rev2.pdf');
    expect(result.url).toMatch(/^http:\/\/localhost:3000\/dev-stub-upload\//);
  });

  it('throws in production when R2 is not configured', async () => {
    process.env.NODE_ENV = 'production';
    await expect(
      documents.presignUpload({
        projectId: 'p1',
        documentId: 'd1',
        filename: 'x.pdf',
        contentType: 'application/pdf',
        sizeBytes: 100,
      })
    ).rejects.toThrow(/R2 not configured/);
  });

  it('returns a signed R2 URL when R2 is configured', async () => {
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'akid';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'bkt';

    const result = await documents.presignUpload({
      projectId: 'p1',
      documentId: 'd1',
      filename: 'A-101 rev2.pdf',
      contentType: 'application/pdf',
      sizeBytes: 50000,
    });
    expect(result.devStub).toBe(false);
    expect(result.url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(result.url).toContain('X-Amz-Signature=');
    expect(result.url).toMatch(/^https:\/\/acct\.r2\.cloudflarestorage\.com\//);
    // Pending revision row was created
    expect(mockDocumentRevisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ uploadStatus: 'pending' }),
      })
    );
  });
});

describe('confirmUpload', () => {
  it('flips the revision to "uploaded" with sha256 and uploader', async () => {
    await documents.confirmUpload({
      projectId: 'p1',
      documentId: 'd1',
      revisionNo: 1,
      sha256: 'deadbeef',
      sizeBytes: 1234,
      uploadedBy: 'u1',
      notes: 'final',
    });
    expect(mockDocumentRevisionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentId_revisionNo: { documentId: 'd1', revisionNo: 1 } },
        data: expect.objectContaining({
          sha256: 'deadbeef',
          uploadStatus: 'uploaded',
          uploadedBy: 'u1',
        }),
      })
    );
  });
});

describe('generateDownloadUrl', () => {
  it('returns null when the document belongs to a different project (tenant isolation)', async () => {
    mockDocumentFindUnique.mockResolvedValue({
      id: 'd1',
      projectId: 'p2',
      name: 'A-101',
      discipline: 'arch',
      drawingNo: null,
      status: 'current',
      createdBy: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
      revisions: [
        {
          id: 'r1',
          revisionNo: 1,
          storageKey: 'projects/p2/docs/d1/rev1-x.pdf',
          contentType: 'application/pdf',
          sizeBytes: 100,
          sha256: 'abc',
          uploadedBy: 'u1',
          uploadedAt: new Date(),
          notes: null,
          uploadStatus: 'uploaded',
        },
      ],
    });
    const result = await documents.generateDownloadUrl({
      projectId: 'p1',
      documentId: 'd1',
    });
    expect(result).toBeNull();
  });

  it('returns a dev-stub URL with content-disposition inline in non-prod', async () => {
    mockDocumentFindUnique.mockResolvedValue({
      id: 'd1',
      projectId: 'p1',
      name: 'A-101',
      discipline: 'arch',
      drawingNo: 'A-101',
      status: 'current',
      createdBy: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
      revisions: [
        {
          id: 'r1',
          revisionNo: 2,
          storageKey: 'projects/p1/docs/d1/rev2-x.pdf',
          contentType: 'application/pdf',
          sizeBytes: 100,
          sha256: 'abc',
          uploadedBy: 'u1',
          uploadedAt: new Date(),
          notes: null,
          uploadStatus: 'uploaded',
        },
      ],
    });
    const result = await documents.generateDownloadUrl({
      projectId: 'p1',
      documentId: 'd1',
    });
    expect(result?.devStub).toBe(true);
    expect(result?.contentDisposition).toBe('inline');
    expect(result?.contentType).toBe('application/pdf');
    expect(result?.url).toMatch(/disposition=inline/);
    // 60 min TTL — the expiresAt is roughly 60 minutes from now
    const expiresInMs = new Date(result!.expiresAt).getTime() - Date.now();
    expect(expiresInMs).toBeGreaterThan(59 * 60 * 1000);
    expect(expiresInMs).toBeLessThan(61 * 60 * 1000);
  });

  it('returns a signed R2 URL with response-content-disposition when R2 is configured', async () => {
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'akid';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'bkt';
    mockDocumentFindUnique.mockResolvedValue({
      id: 'd1',
      projectId: 'p1',
      name: 'A-101',
      discipline: 'arch',
      drawingNo: 'A-101',
      status: 'current',
      createdBy: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
      revisions: [
        {
          id: 'r1',
          revisionNo: 1,
          storageKey: 'projects/p1/docs/d1/rev1-x.pdf',
          contentType: 'application/pdf',
          sizeBytes: 100,
          sha256: 'abc',
          uploadedBy: 'u1',
          uploadedAt: new Date(),
          notes: null,
          uploadStatus: 'uploaded',
        },
      ],
    });
    const result = await documents.generateDownloadUrl({
      projectId: 'p1',
      documentId: 'd1',
      mode: 'attachment',
    });
    expect(result?.devStub).toBe(false);
    expect(result?.contentDisposition).toBe('attachment');
    // SigV4 query params present
    expect(result?.url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(result?.url).toContain('X-Amz-Signature=');
    // Signed response-content-disposition is present
    expect(result?.url).toMatch(/response-content-disposition/);
    expect(result?.url).toMatch(/attachment/);
  });

  it('skips pending revisions when no explicit revisionId is given', async () => {
    mockDocumentFindUnique.mockResolvedValue({
      id: 'd1',
      projectId: 'p1',
      name: 'A-101',
      discipline: 'arch',
      drawingNo: null,
      status: 'current',
      createdBy: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
      revisions: [
        // Newer but pending — must not be served
        {
          id: 'r2',
          revisionNo: 2,
          storageKey: 'k2',
          contentType: 'application/pdf',
          sizeBytes: 50,
          sha256: null,
          uploadedBy: 'pending',
          uploadedAt: new Date(),
          notes: null,
          uploadStatus: 'pending',
        },
        // Older but uploaded
        {
          id: 'r1',
          revisionNo: 1,
          storageKey: 'k1',
          contentType: 'application/pdf',
          sizeBytes: 100,
          sha256: 'abc',
          uploadedBy: 'u1',
          uploadedAt: new Date(),
          notes: null,
          uploadStatus: 'uploaded',
        },
      ],
    });
    const result = await documents.generateDownloadUrl({
      projectId: 'p1',
      documentId: 'd1',
    });
    expect(result?.url).toMatch(/k1/);
    expect(result?.url).not.toMatch(/k2/);
  });
});

describe('logDownload', () => {
  it('persists an audit row with user, document, and optional ip', async () => {
    mockDocumentDownloadLogCreate.mockImplementation(async ({ data }: any) => ({
      id: 'log-1',
      ...data,
    }));
    await documents.logDownload({
      documentId: 'd1',
      revisionId: 'r1',
      userId: 'u1',
      ipAddress: '203.0.113.5',
    });
    expect(mockDocumentDownloadLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId: 'd1',
        revisionId: 'r1',
        userId: 'u1',
        ipAddress: '203.0.113.5',
      }),
    });
  });
});

describe('deleteDocument (R2 lifecycle)', () => {
  beforeEach(() => {
    // Default: R2 is not configured — we test the DB-only path.
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;
  });

  it('returns not-found when the document does not belong to the project', async () => {
    mockDocumentFindUnique.mockResolvedValueOnce(null);
    const result = await documents.deleteDocument('p1', 'd-foreign');
    expect(result.deleted).toBe(false);
    expect(result.r2ObjectsRemoved).toBe(0);
    expect(mockDocumentDelete).not.toHaveBeenCalled();
  });

  it('returns not-found when the projectId does not match', async () => {
    mockDocumentFindUnique.mockResolvedValueOnce({
      id: 'd-1',
      projectId: 'p-different',
      revisions: [],
    });
    const result = await documents.deleteDocument('p1', 'd-1');
    expect(result.deleted).toBe(false);
    expect(mockDocumentDelete).not.toHaveBeenCalled();
  });

  it('hard-deletes the document, returns deleted=true and r2ObjectsRemoved=0 in dev mode', async () => {
    mockDocumentFindUnique.mockResolvedValueOnce({
      id: 'd-1',
      projectId: 'p1',
      revisions: [
        { id: 'r-1', storageKey: 'projects/p1/docs/d-1/1-abc.pdf' },
        { id: 'r-2', storageKey: 'projects/p1/docs/d-1/2-def.pdf' },
      ],
    });
    mockDocumentDelete.mockResolvedValueOnce({ id: 'd-1' });

    const result = await documents.deleteDocument('p1', 'd-1');
    expect(result.deleted).toBe(true);
    // R2 is unconfigured in dev mode — the dev-stub branch
    // returns 0 removed without calling fetch.
    expect(result.r2ObjectsRemoved).toBe(0);
    expect(mockDocumentDelete).toHaveBeenCalledWith({ where: { id: 'd-1' } });
  });

  it('deletes the R2 objects when R2 is configured and the bucket confirms', async () => {
    process.env.R2_ACCOUNT_ID = 'acct-1';
    process.env.R2_ACCESS_KEY_ID = 'AKID';
    process.env.R2_SECRET_ACCESS_KEY = 'a'.repeat(40);
    process.env.R2_BUCKET = 'docs';

    mockDocumentFindUnique.mockResolvedValueOnce({
      id: 'd-2',
      projectId: 'p1',
      revisions: [
        { id: 'r-1', storageKey: 'projects/p1/docs/d-2/1-a.pdf' },
        { id: 'r-2', storageKey: 'projects/p1/docs/d-2/2-b.pdf' },
      ],
    });
    mockDocumentDelete.mockResolvedValueOnce({ id: 'd-2' });
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    const result = await documents.deleteDocument('p1', 'd-2');
    expect(result.deleted).toBe(true);
    expect(result.r2ObjectsRemoved).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('counts 404s from R2 as removed (already gone is fine)', async () => {
    process.env.R2_ACCOUNT_ID = 'acct-1';
    process.env.R2_ACCESS_KEY_ID = 'AKID';
    process.env.R2_SECRET_ACCESS_KEY = 'a'.repeat(40);
    process.env.R2_BUCKET = 'docs';

    mockDocumentFindUnique.mockResolvedValueOnce({
      id: 'd-3',
      projectId: 'p1',
      revisions: [{ id: 'r-1', storageKey: 'projects/p1/docs/d-3/1-a.pdf' }],
    });
    mockDocumentDelete.mockResolvedValueOnce({ id: 'd-3' });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await documents.deleteDocument('p1', 'd-3');
    expect(result.r2ObjectsRemoved).toBe(1);
  });

  it('does not throw when an R2 delete call returns 5xx (best-effort)', async () => {
    process.env.R2_ACCOUNT_ID = 'acct-1';
    process.env.R2_ACCESS_KEY_ID = 'AKID';
    process.env.R2_SECRET_ACCESS_KEY = 'a'.repeat(40);
    process.env.R2_BUCKET = 'docs';

    mockDocumentFindUnique.mockResolvedValueOnce({
      id: 'd-4',
      projectId: 'p1',
      revisions: [{ id: 'r-1', storageKey: 'projects/p1/docs/d-4/1-a.pdf' }],
    });
    mockDocumentDelete.mockResolvedValueOnce({ id: 'd-4' });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await documents.deleteDocument('p1', 'd-4');
    expect(result.deleted).toBe(true);
    expect(result.r2ObjectsRemoved).toBe(0);
  });
});

describe('cleanupOrphanRevisions', () => {
  beforeEach(() => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;
  });

  it('returns zeros when there are no orphans', async () => {
    mockDocumentRevisionFindMany.mockResolvedValueOnce([]);
    const result = await documents.cleanupOrphanRevisions();
    expect(result).toEqual({ revisionsDeleted: 0, documentsDeleted: 0, r2ObjectsRemoved: 0 });
  });

  it('finds pending revisions older than the cutoff and deletes them', async () => {
    mockDocumentRevisionFindMany
      // First call: the orphan query
      .mockResolvedValueOnce([
        { id: 'r-orphan-1', storageKey: 'k1', documentId: 'd-orphan-1' },
        { id: 'r-orphan-2', storageKey: 'k2', documentId: 'd-orphan-2' },
      ])
      // Second call: the "which documents still have revisions" query
      .mockResolvedValueOnce([]);
    mockDocumentRevisionDeleteMany.mockResolvedValueOnce({ count: 2 });
    mockDocumentDeleteMany.mockResolvedValueOnce({ count: 2 });

    const result = await documents.cleanupOrphanRevisions();
    expect(result.revisionsDeleted).toBe(2);
    expect(result.documentsDeleted).toBe(2);
    expect(result.r2ObjectsRemoved).toBe(0); // dev mode

    // Verify the cutoff was respected — should have queried with
    // `uploadStatus: 'pending'` and an `lt` filter on uploadedAt.
    const orphanCall = mockDocumentRevisionFindMany.mock.calls[0][0];
    expect(orphanCall.where.uploadStatus).toBe('pending');
    expect(orphanCall.where.uploadedAt).toBeDefined();
    expect(orphanCall.where.uploadedAt.lt).toBeInstanceOf(Date);
    expect(orphanCall.take).toBe(500);
  });

  it('keeps documents that still have non-orphan revisions', async () => {
    mockDocumentRevisionFindMany
      .mockResolvedValueOnce([
        { id: 'r-orphan', storageKey: 'k1', documentId: 'd-mixed' },
      ])
      .mockResolvedValueOnce([
        { documentId: 'd-mixed' }, // d-mixed still has revisions
      ]);
    mockDocumentRevisionDeleteMany.mockResolvedValueOnce({ count: 1 });
    mockDocumentDeleteMany.mockResolvedValueOnce({ count: 0 });

    const result = await documents.cleanupOrphanRevisions();
    expect(result.revisionsDeleted).toBe(1);
    expect(result.documentsDeleted).toBe(0);
  });

  it('respects the olderThanHours override', async () => {
    mockDocumentRevisionFindMany.mockResolvedValueOnce([]);
    await documents.cleanupOrphanRevisions({ olderThanHours: 48 });
    const where = mockDocumentRevisionFindMany.mock.calls[0][0].where;
    const cutoff = where.uploadedAt.lt as Date;
    const now = Date.now();
    const hours = (now - cutoff.getTime()) / (60 * 60 * 1000);
    expect(hours).toBeGreaterThan(47.9);
    expect(hours).toBeLessThan(48.1);
  });

  it('respects the maxRows cap', async () => {
    mockDocumentRevisionFindMany.mockResolvedValueOnce([]);
    await documents.cleanupOrphanRevisions({ maxRows: 10 });
    expect(mockDocumentRevisionFindMany.mock.calls[0][0].take).toBe(10);
  });

  it('deletes R2 objects when R2 is configured', async () => {
    process.env.R2_ACCOUNT_ID = 'acct-1';
    process.env.R2_ACCESS_KEY_ID = 'AKID';
    process.env.R2_SECRET_ACCESS_KEY = 'a'.repeat(40);
    process.env.R2_BUCKET = 'docs';

    mockDocumentRevisionFindMany
      .mockResolvedValueOnce([
        { id: 'r-1', storageKey: 'k1', documentId: 'd-1' },
        { id: 'r-2', storageKey: 'k2', documentId: 'd-2' },
      ])
      .mockResolvedValueOnce([]);
    mockDocumentRevisionDeleteMany.mockResolvedValueOnce({ count: 2 });
    mockDocumentDeleteMany.mockResolvedValueOnce({ count: 2 });
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    const result = await documents.cleanupOrphanRevisions();
    expect(result.r2ObjectsRemoved).toBe(2);
  });
});

describe('releaseAsIfc (Sprint 9 Task 1)', () => {
  beforeEach(() => {
    delete process.env.PM_BENCHMARK_WEBHOOK_URL;
    delete process.env.PM_BENCHMARK_WEBHOOK_SECRET;
    mockDrawingAuditLogCreate.mockResolvedValue({ id: 'audit-1' });
  });

  it('returns null when the document does not belong to the project', async () => {
    mockDocumentFindUnique.mockResolvedValueOnce({ id: 'd1', projectId: 'p2' });
    const result = await documents.releaseAsIfc('p1', 'd1', 'u1');
    expect(result).toBeNull();
  });

  it('throws when there is no uploaded revision', async () => {
    mockDocumentFindUnique.mockResolvedValueOnce({
      id: 'd1',
      projectId: 'p1',
      status: 'current',
      currentRevisionId: null,
      name: 'A-101',
      drawingNo: 'A-101',
      discipline: 'arch',
      revisions: [],
    });
    await expect(documents.releaseAsIfc('p1', 'd1', 'u1')).rejects.toThrow(/no uploaded revisions/);
  });

  it('flips status to issued_for_construction and emits the audit log', async () => {
    mockDocumentFindUnique.mockResolvedValueOnce({
      id: 'd1',
      projectId: 'p1',
      status: 'current',
      currentRevisionId: null,
      name: 'A-101 — First Floor',
      drawingNo: 'A-101',
      discipline: 'arch',
      revisions: [{ id: 'r1', revisionNo: 1 }],
    });
    mockDocumentUpdate.mockResolvedValueOnce({ id: 'd1' });

    const result = await documents.releaseAsIfc('p1', 'd1', 'u-pm');
    expect(result?.ok).toBe(true);
    expect(result?.status).toBe('issued_for_construction');
    expect(result?.alreadyReleased).toBe(false);
    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd1' },
        data: expect.objectContaining({ status: 'issued_for_construction', currentRevisionId: 'r1' }),
      })
    );
    expect(mockDrawingAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'drawing_released_ifc', documentId: 'd1' }),
      })
    );
  });

  it('is idempotent: re-releasing the same revision does not emit duplicate notifications', async () => {
    mockDocumentFindUnique.mockResolvedValueOnce({
      id: 'd1',
      projectId: 'p1',
      status: 'issued_for_construction',
      currentRevisionId: 'r1',
      ifcReleasedAt: new Date('2026-06-01'),
      ifcReleasedBy: 'u-pm',
      name: 'A-101',
      drawingNo: 'A-101',
      discipline: 'arch',
      revisions: [{ id: 'r1', revisionNo: 1 }],
    });

    const result = await documents.releaseAsIfc('p1', 'd1', 'u-pm');
    expect(result?.alreadyReleased).toBe(true);
    expect(result?.notificationCount).toBe(0);
    expect(result?.benchmarkWebhookSent).toBe(false);
  });

  it('skips Benchmark webhook gracefully when PM_BENCHMARK_WEBHOOK_URL is not set', async () => {
    mockDocumentFindUnique.mockResolvedValueOnce({
      id: 'd1',
      projectId: 'p1',
      status: 'current',
      currentRevisionId: null,
      name: 'A-101',
      drawingNo: 'A-101',
      discipline: 'arch',
      revisions: [{ id: 'r1', revisionNo: 2 }],
    });
    mockDocumentUpdate.mockResolvedValueOnce({ id: 'd1' });
    const result = await documents.releaseAsIfc('p1', 'd1', 'u1');
    expect(result?.benchmarkWebhookSent).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fires Benchmark webhook when configured and reports sent=true on 200', async () => {
    process.env.PM_BENCHMARK_WEBHOOK_URL = 'https://benchmark.example/webhook';
    process.env.PM_BENCHMARK_WEBHOOK_SECRET = 's3cret';
    mockDocumentFindUnique.mockResolvedValueOnce({
      id: 'd1',
      projectId: 'p1',
      status: 'current',
      currentRevisionId: null,
      name: 'A-101',
      drawingNo: 'A-101',
      discipline: 'arch',
      revisions: [{ id: 'r1', revisionNo: 3 }],
    });
    mockDocumentUpdate.mockResolvedValueOnce({ id: 'd1' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await documents.releaseAsIfc('p1', 'd1', 'u1');
    expect(result?.benchmarkWebhookSent).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('https://benchmark.example/webhook');
    expect(call[1].method).toBe('POST');
    const body = JSON.parse(call[1].body);
    expect(body.event).toBe('drawing.ifc_released');
    expect(body.documentId).toBe('d1');
    expect(body.revision).toBe('3');
    expect(call[1].headers['x-sitedeck-signature']).toMatch(/^sha256=/);
  });

  it('reports benchmarkWebhookSent=false when the receiver returns 5xx', async () => {
    process.env.PM_BENCHMARK_WEBHOOK_URL = 'https://benchmark.example/webhook';
    process.env.PM_BENCHMARK_WEBHOOK_SECRET = 's3cret';
    mockDocumentFindUnique.mockResolvedValueOnce({
      id: 'd1',
      projectId: 'p1',
      status: 'current',
      currentRevisionId: null,
      name: 'A-101',
      drawingNo: 'A-101',
      discipline: 'arch',
      revisions: [{ id: 'r1', revisionNo: 1 }],
    });
    mockDocumentUpdate.mockResolvedValueOnce({ id: 'd1' });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 502 });

    const result = await documents.releaseAsIfc('p1', 'd1', 'u1');
    expect(result?.benchmarkWebhookSent).toBe(false);
  });
});
