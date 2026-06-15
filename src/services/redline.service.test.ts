import * as redlines from './redline.service';

const mockDocumentFindUnique = jest.fn();
const mockDocumentFindMany = jest.fn();
const mockRedlineCreate = jest.fn();
const mockRedlineFindUnique = jest.fn();
const mockRedlineFindMany = jest.fn();
const mockRedlineUpdate = jest.fn();
const mockRfiCreate = jest.fn();
const mockUnifiedChangeLogCreate = jest.fn();
const mockNotificationCreate = jest.fn();
const mockProjectFindUnique = jest.fn();

jest.mock('./notifications.service', () => ({
  createNotificationSafe: jest.fn(async (input) => mockNotificationCreate(input)),
}));

jest.mock('../lib/prisma', () => ({
  getPrismaClient: () => ({
    project: { findUnique: mockProjectFindUnique },
    document: { findUnique: mockDocumentFindUnique, findMany: mockDocumentFindMany },
    drawingRedline: {
      create: mockRedlineCreate,
      findUnique: mockRedlineFindUnique,
      findMany: mockRedlineFindMany,
      update: mockRedlineUpdate,
    },
    rfi: { create: mockRfiCreate },
    unifiedChangeLog: { create: mockUnifiedChangeLogCreate },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockDocumentFindUnique.mockResolvedValue({
    id: 'd1',
    projectId: 'p1',
    name: 'A-101',
    drawingNo: 'A-101',
  });
  mockRedlineCreate.mockImplementation(async ({ data }: any) => ({
    id: 'r-new',
    ...data,
    submittedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  mockRedlineUpdate.mockImplementation(async ({ where, data }: any) => ({
    id: where.id,
    projectId: 'p1',
    documentId: 'd1',
    revisionId: 'rev-1',
    submittedBy: 'u1',
    submittedAt: new Date(),
    description: 'old',
    redlineType: 'conflict',
    photoUrl: null,
    linkedRfiId: null,
    linkedActivityId: null,
    ...data,
    reviewedAt: data.reviewedAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
});

describe('submitRedline', () => {
  it('rejects empty description', async () => {
    await expect(
      redlines.submitRedline({
        projectId: 'p1',
        documentId: 'd1',
        description: '   ',
        redlineType: 'conflict',
        submittedBy: 'u1',
      })
    ).rejects.toThrow(/description/);
  });

  it('rejects unknown redline type', async () => {
    await expect(
      redlines.submitRedline({
        projectId: 'p1',
        documentId: 'd1',
        description: 'd',
        redlineType: 'unknown' as any,
        submittedBy: 'u1',
      })
    ).rejects.toThrow(/redlineType/);
  });

  it('rejects when document is not in the project (tenant isolation)', async () => {
    mockDocumentFindUnique.mockResolvedValueOnce({ id: 'd1', projectId: 'p-other' });
    await expect(
      redlines.submitRedline({
        projectId: 'p1',
        documentId: 'd1',
        description: 'd',
        redlineType: 'conflict',
        submittedBy: 'u1',
      })
    ).rejects.toThrow(/not found/);
  });

  it('creates the redline with status=pending', async () => {
    const row = await redlines.submitRedline({
      projectId: 'p1',
      documentId: 'd1',
      description: 'Conflict at grid B-3',
      redlineType: 'conflict',
      submittedBy: 'u-field',
    });
    expect(row.id).toBe('r-new');
    expect(row.status).toBe('pending');
    expect(mockRedlineCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'p1',
          description: 'Conflict at grid B-3',
          redlineType: 'conflict',
        }),
      })
    );
  });
});

describe('reviewRedline', () => {
  it('returns 404-equivalent error when the redline is missing', async () => {
    mockRedlineFindUnique.mockResolvedValueOnce(null);
    await expect(
      redlines.reviewRedline('p1', 'r1', { decision: 'incorporate', reviewerId: 'u1' })
    ).rejects.toThrow(/Redline not found/);
  });

  it('rejects terminal-state redlines', async () => {
    mockRedlineFindUnique.mockResolvedValueOnce({
      id: 'r1',
      projectId: 'p1',
      status: 'incorporated',
    });
    await expect(
      redlines.reviewRedline('p1', 'r1', { decision: 'incorporate', reviewerId: 'u1' })
    ).rejects.toThrow(/terminal/);
  });

  it('escalate_rfi creates a draft RFI and links it', async () => {
    mockRedlineFindUnique.mockResolvedValueOnce({
      id: 'r1',
      projectId: 'p1',
      documentId: 'd1',
      status: 'pending',
      description: 'Conflict at grid B-3',
      redlineType: 'conflict',
      linkedRfiId: null,
    });
    mockRfiCreate.mockResolvedValueOnce({ id: 'rfi-draft-1' });

    const row = await redlines.reviewRedline('p1', 'r1', {
      decision: 'escalate_rfi',
      reviewerId: 'u-pm',
    });
    expect(row.status).toBe('escalated_to_rfi');
    expect(mockRfiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'p1',
          sourceReference: 'redline:r1',
          status: 'draft',
        }),
      })
    );
    expect(mockRedlineUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ linkedRfiId: 'rfi-draft-1' }),
      })
    );
  });

  it('field_decision logs to the unified change log', async () => {
    mockRedlineFindUnique.mockResolvedValueOnce({
      id: 'r1',
      projectId: 'p1',
      documentId: 'd1',
      status: 'pending',
      description: 'Conflict at grid B-3',
      redlineType: 'conflict',
      linkedRfiId: null,
    });
    const row = await redlines.reviewRedline('p1', 'r1', {
      decision: 'field_decision',
      reviewerId: 'u-pm',
    });
    expect(row.status).toBe('accepted_field_decision');
    expect(mockUnifiedChangeLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          module: 'drawings',
          changeType: 'redline_field_decision',
        }),
      })
    );
  });

  it('incorporate sets status=incorporated without creating an RFI', async () => {
    mockRedlineFindUnique.mockResolvedValueOnce({
      id: 'r1',
      projectId: 'p1',
      documentId: 'd1',
      status: 'pending',
      description: 'd',
      redlineType: 'clarification',
      linkedRfiId: null,
    });
    const row = await redlines.reviewRedline('p1', 'r1', {
      decision: 'incorporate',
      reviewerId: 'u-pm',
    });
    expect(row.status).toBe('incorporated');
    expect(mockRfiCreate).not.toHaveBeenCalled();
  });
});

describe('getRedlines', () => {
  it('filters by documentId', async () => {
    mockRedlineFindMany.mockResolvedValueOnce([]);
    await redlines.getRedlines('p1', { documentId: 'd1' });
    const where = mockRedlineFindMany.mock.calls[0][0].where;
    expect(where.documentId).toBe('d1');
  });

  it('filters by status', async () => {
    mockRedlineFindMany.mockResolvedValueOnce([]);
    await redlines.getRedlines('p1', { status: 'pending' });
    const where = mockRedlineFindMany.mock.calls[0][0].where;
    expect(where.status).toBe('pending');
  });
});

describe('asBuiltExportStub', () => {
  it('returns the Sprint-10 deferred stub', async () => {
    const result = await redlines.asBuiltExportStub('p1');
    expect(result.stub).toBe(true);
    expect(result.message).toMatch(/Sprint 10/);
    expect(result.projectId).toBe('p1');
  });
});

describe('asBuiltExportData', () => {
  it('returns an empty structure (no drawings) so the PDF can still render the cert block', async () => {
    mockProjectFindUnique.mockResolvedValueOnce({
      id: 'p1',
      name: 'Empty Project',
      startDate: new Date('2026-01-01'),
    });
    mockDocumentFindMany.mockResolvedValueOnce([]);
    const result = await redlines.asBuiltExportData('p1');
    expect(result.projectName).toBe('Empty Project');
    expect(result.drawings).toEqual([]);
    expect(result.exportDate).toMatch(/T/);
  });

  it('groups drawings by discipline and flags redlines submitted after IFC lock', async () => {
    const ifcDate = new Date('2026-04-15T12:00:00Z');
    mockProjectFindUnique.mockResolvedValueOnce({
      id: 'p1',
      name: 'Substation 12',
      startDate: new Date('2026-02-01'),
    });
    mockDocumentFindMany.mockResolvedValueOnce([
      {
        id: 'doc-1',
        projectId: 'p1',
        name: 'Site Plan',
        drawingNo: 'A-101',
        discipline: 'architectural',
        ifcReleasedAt: ifcDate,
        revisions: [{ revisionNo: 2 }],
      },
      {
        id: 'doc-2',
        projectId: 'p1',
        name: 'Foundation Plan',
        drawingNo: 'S-201',
        discipline: 'structural',
        ifcReleasedAt: ifcDate,
        revisions: [{ revisionNo: 1 }],
      },
    ]);
    mockRedlineFindMany
      .mockResolvedValueOnce([
        // doc-1: one redline submitted AFTER IFC
        {
          id: 'rl-1',
          documentId: 'doc-1',
          projectId: 'p1',
          description: 'Late flag',
          redlineType: 'as_built_deviation',
          submittedBy: 'field',
          submittedAt: new Date('2026-05-01T12:00:00Z'),
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
        },
      ])
      .mockResolvedValueOnce([]); // doc-2: no redlines

    const result = await redlines.asBuiltExportData('p1');
    expect(result.drawings).toHaveLength(2);
    const archDoc = result.drawings.find((d) => d.documentId === 'doc-1')!;
    expect(archDoc.discipline).toBe('architectural');
    expect(archDoc.redlines).toHaveLength(1);
    expect(archDoc.redlines[0].submittedAfterLock).toBe(true);
    expect(archDoc.currentRevisionNo).toBe(2);

    const structDoc = result.drawings.find((d) => d.documentId === 'doc-2')!;
    expect(structDoc.redlines).toEqual([]);
  });

  it('flags redlines submitted BEFORE the IFC date as not-after-lock', async () => {
    const ifcDate = new Date('2026-04-15T12:00:00Z');
    mockProjectFindUnique.mockResolvedValueOnce({
      id: 'p1',
      name: 'P',
      startDate: new Date('2026-01-01'),
    });
    mockDocumentFindMany.mockResolvedValueOnce([
      {
        id: 'doc-1',
        projectId: 'p1',
        name: 'A',
        drawingNo: 'A-1',
        discipline: 'arch',
        ifcReleasedAt: ifcDate,
        revisions: [{ revisionNo: 1 }],
      },
    ]);
    mockRedlineFindMany.mockResolvedValueOnce([
      {
        id: 'rl-1',
        documentId: 'doc-1',
        projectId: 'p1',
        description: 'Old',
        redlineType: 'clarification',
        submittedBy: 'u',
        submittedAt: new Date('2026-04-01T00:00:00Z'),
        status: 'reviewed',
        reviewedBy: 'pm',
        reviewedAt: new Date(),
        reviewNotes: 'OK',
      },
    ]);
    const result = await redlines.asBuiltExportData('p1');
    expect(result.drawings[0].redlines[0].submittedAfterLock).toBe(false);
  });
});
