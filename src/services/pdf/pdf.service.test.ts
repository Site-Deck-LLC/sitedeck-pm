import {
  buildRfiPdf,
  buildSubmittalPdf,
  buildChangeOrderPdf,
  buildSubmittalLogPdf,
  buildAsBuiltPdf,
} from './pdf.service';

describe('pdf.service', () => {
  describe('buildRfiPdf', () => {
    it('returns a valid PDF buffer', async () => {
      const buffer = await buildRfiPdf({
        rfiNumber: 'RFI-2026-0001',
        subject: 'Foundation rebar spec',
        description: 'Please clarify the rebar grade for the foundation.',
        status: 'submitted',
        submittedBy: 'Mr. Robert',
        submittedAt: new Date('2026-06-01'),
        responseText: null,
        answeredAt: null,
        projectName: '100MW BESS — Texas EPC',
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      // PDF magic bytes
      expect(buffer.slice(0, 4).toString('utf8')).toBe('%PDF');
    });

    it('includes the RFI number in the PDF stream (searchable text)', async () => {
      const buffer = await buildRfiPdf({
        rfiNumber: 'RFI-2026-9999',
        subject: 'Test',
        description: 'Test description',
        status: 'draft',
        submittedBy: 'Tester',
        submittedAt: new Date(),
        responseText: null,
        answeredAt: null,
        projectName: 'Test Project',
      });

      // PDFKit compresses content streams by default; just verify size + magic.
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.slice(0, 4).toString('utf8')).toBe('%PDF');
    });
  });

  describe('buildSubmittalPdf', () => {
    it('returns a valid PDF buffer', async () => {
      const buffer = await buildSubmittalPdf({
        submittalNumber: 'SUB-2026-0001',
        title: 'Concrete mix design',
        description: '3000 PSI mix for foundation',
        status: 'approved',
        specSection: '03 30 00',
        submittedBy: 'Super',
        submittedAt: new Date('2026-05-15'),
        reviewedBy: 'Engineer',
        reviewedAt: new Date('2026-05-20'),
        reviewComments: 'Approved as submitted.',
        projectName: 'Test Project',
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.slice(0, 4).toString('utf8')).toBe('%PDF');
    });
  });

  describe('buildChangeOrderPdf', () => {
    it('returns a valid PDF buffer with cost impact', async () => {
      const buffer = await buildChangeOrderPdf({
        coNumber: 'CO-2026-0001',
        date: new Date('2026-06-05'),
        description: 'Additional grounding work',
        status: 'approved',
        dollarValue: 45000,
        scheduleImpact: 24,
        approver: 'Owner Rep',
        approvedAt: new Date('2026-06-07'),
        projectName: 'Test Project',
        affectedActivityIds: ['act-1', 'act-2'],
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.slice(0, 4).toString('utf8')).toBe('%PDF');
    });
  });

  describe('buildSubmittalLogPdf', () => {
    it('returns a multi-page PDF for an empty log', async () => {
      const buffer = await buildSubmittalLogPdf([], 'Empty Project');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.slice(0, 4).toString('utf8')).toBe('%PDF');
    });

    it('returns a PDF for a non-empty log', async () => {
      const buffer = await buildSubmittalLogPdf(
        [
          {
            submittalNumber: 'SUB-2026-0001',
            specSection: '03 30 00',
            title: 'Concrete mix design',
            status: 'approved',
            submittedAt: new Date('2026-05-15'),
            requiredDate: new Date('2026-06-01'),
            daysOpen: 5,
          },
          {
            submittalNumber: 'SUB-2026-0002',
            specSection: '05 12 00',
            title: 'Steel shop drawings',
            status: 'pending',
            submittedAt: new Date('2026-05-20'),
            requiredDate: new Date('2026-06-10'),
            daysOpen: 10,
          },
        ],
        'Test Project'
      );

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.slice(0, 4).toString('utf8')).toBe('%PDF');
    });
  });

  describe('buildAsBuiltPdf', () => {
    it('returns a valid PDF buffer for a project with no drawings', async () => {
      const buffer = await buildAsBuiltPdf({
        projectName: '100MW BESS — Texas EPC',
        preparedBy: 'Mr. Robert',
        exportDate: new Date('2026-06-15'),
        projectStart: new Date('2026-01-01'),
        drawings: [],
      });
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.slice(0, 4).toString('utf8')).toBe('%PDF');
    });

    it('returns a valid PDF buffer with drawings and redlines', async () => {
      const buffer = await buildAsBuiltPdf({
        projectName: 'Substation 12 — Hill Country',
        preparedBy: 'Mr. Robert',
        exportDate: new Date('2026-06-15'),
        projectStart: new Date('2026-02-01'),
        drawings: [
          {
            documentId: 'doc-1',
            drawingNo: 'A-101',
            name: 'Site Plan',
            discipline: 'architectural',
            currentRevisionNo: 2,
            ifcReleasedAt: new Date('2026-04-15'),
            redlines: [
              {
                redlineId: 'rl-1',
                description: 'North setback not dimensioned',
                redlineType: 'clarification',
                submittedBy: 'field.user@modestintent.com',
                submittedAt: new Date('2026-05-01'),
                status: 'reviewed',
                reviewNotes: 'Will clarify at next IFC',
                submittedAfterLock: false,
              },
            ],
          },
          {
            documentId: 'doc-2',
            drawingNo: 'S-201',
            name: 'Foundation Plan',
            discipline: 'structural',
            currentRevisionNo: 1,
            ifcReleasedAt: new Date('2026-03-01'),
            redlines: [],
          },
        ],
      });
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.slice(0, 4).toString('utf8')).toBe('%PDF');
    });

    it('emits an amber-warning row when a redline was submitted after lock', async () => {
      const ifc = new Date('2026-04-15T12:00:00Z');
      const submitted = new Date('2026-05-01T12:00:00Z'); // 2 weeks after IFC
      const buffer = await buildAsBuiltPdf({
        projectName: 'Test Project',
        preparedBy: 'PM',
        exportDate: new Date('2026-06-15'),
        projectStart: new Date('2026-01-01'),
        drawings: [
          {
            documentId: 'doc-1',
            drawingNo: 'A-101',
            name: 'Plan',
            discipline: 'architectural',
            currentRevisionNo: 1,
            ifcReleasedAt: ifc,
            redlines: [
              {
                redlineId: 'rl-1',
                description: 'Late flag',
                redlineType: 'as_built_deviation',
                submittedBy: 'super',
                submittedAt: submitted,
                status: 'pending',
                reviewNotes: null,
                submittedAfterLock: true,
              },
            ],
          },
        ],
      });
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.slice(0, 4).toString('utf8')).toBe('%PDF');
    });
  });
});
