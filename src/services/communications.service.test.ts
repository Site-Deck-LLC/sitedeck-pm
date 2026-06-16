import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '../lib/prisma';
import {
  createRfi,
  getRfiById,
  getRfiByProject,
  submitRfi,
  answerRfi,
  closeRfi,
  getRfiPdfData,
  createSubmittal,
  getSubmittalById,
  getSubmittalsByProject,
  submitSubmittal,
  reviewSubmittal,
  getSubmittalPdfData,
  createMeeting,
  getMeetingsByProject,
  getMeetingById,
  updateMeeting,
  updateMeetingActionItemStatus,
  deleteMeeting,
  getMeetingPdfData,
} from './communications.service';

const mockRfiCreate = jest.fn();
const mockRfiFindUnique = jest.fn();
const mockRfiFindFirst = jest.fn();
const mockRfiFindMany = jest.fn();
const mockRfiCount = jest.fn();
const mockRfiUpdate = jest.fn();

const mockSubmittalCreate = jest.fn();
const mockSubmittalFindUnique = jest.fn();
const mockSubmittalFindMany = jest.fn();
const mockSubmittalCount = jest.fn();
const mockSubmittalUpdate = jest.fn();

const mockMeetingCreate = jest.fn();
const mockMeetingFindUnique = jest.fn();
const mockMeetingFindMany = jest.fn();
const mockMeetingUpdate = jest.fn();
const mockMeetingDelete = jest.fn();

const mockPrisma = {
  rfi: {
    create: mockRfiCreate,
    findUnique: mockRfiFindUnique,
    findFirst: mockRfiFindFirst,
    findMany: mockRfiFindMany,
    count: mockRfiCount,
    update: mockRfiUpdate,
  },
  submittal: {
    create: mockSubmittalCreate,
    findUnique: mockSubmittalFindUnique,
    findMany: mockSubmittalFindMany,
    count: mockSubmittalCount,
    update: mockSubmittalUpdate,
  },
  meeting: {
    create: mockMeetingCreate,
    findUnique: mockMeetingFindUnique,
    findMany: mockMeetingFindMany,
    update: mockMeetingUpdate,
    delete: mockMeetingDelete,
  },
} as unknown as PrismaClient;

beforeEach(() => {
  jest.clearAllMocks();
  setPrismaClient(mockPrisma);
});

describe('communications.service', () => {
  describe('RFI log', () => {
    it('creates an RFI with auto-numbered rfiNumber', async () => {
      mockRfiCount.mockResolvedValue(2);
      const created = {
        id: 'rfi-1',
        rfiNumber: `RFI-${new Date().getFullYear()}-0003`,
        projectId: 'proj-1',
        subject: 'Foundation depth',
        description: 'What is the required depth?',
        status: 'draft',
        submittedBy: 'user-1',
      };
      mockRfiCreate.mockResolvedValue(created);

      const result = await createRfi({
        projectId: 'proj-1',
        subject: 'Foundation depth',
        description: 'What is the required depth?',
        submittedBy: 'user-1',
      });

      expect(mockRfiCount).toHaveBeenCalledWith({ where: { projectId: 'proj-1' } });
      expect(mockRfiCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          rfiNumber: `RFI-${new Date().getFullYear()}-0003`,
          subject: 'Foundation depth',
          description: 'What is the required depth?',
          status: 'draft',
          submittedBy: 'user-1',
        }),
      });
      expect(result.rfiNumber).toBe(`RFI-${new Date().getFullYear()}-0003`);
    });

    it('creates an RFI with optional fields', async () => {
      mockRfiCount.mockResolvedValue(0);
      const created = {
        id: 'rfi-1',
        rfiNumber: `RFI-${new Date().getFullYear()}-0001`,
        projectId: 'proj-1',
        subject: 'Rebar spec',
        description: 'Grade required?',
        status: 'draft',
        submittedBy: 'user-1',
        assignedTo: 'user-2',
        holdOnActivityId: 'act-1',
      };
      mockRfiCreate.mockResolvedValue(created);

      const result = await createRfi({
        projectId: 'proj-1',
        subject: 'Rebar spec',
        description: 'Grade required?',
        submittedBy: 'user-1',
        assignedTo: 'user-2',
        holdOnActivityId: 'act-1',
      });

      expect(mockRfiCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assignedTo: 'user-2',
          holdOnActivityId: 'act-1',
        }),
      });
      expect(result).toEqual(created);
    });

    it('returns existing RFI when sourceReference already exists (idempotency)', async () => {
      const existing = {
        id: 'rfi-existing',
        rfiNumber: `RFI-${new Date().getFullYear()}-0001`,
        projectId: 'proj-1',
        subject: 'Existing',
        description: 'Existing desc',
        status: 'draft',
        submittedBy: 'user-1',
        sourceReference: 'webhook-123',
      };
      mockRfiFindFirst.mockResolvedValue(existing);

      const result = await createRfi({
        projectId: 'proj-1',
        subject: 'New subject',
        description: 'New desc',
        submittedBy: 'user-1',
        sourceReference: 'webhook-123',
      });

      expect(mockRfiFindFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          sourceReference: 'webhook-123',
        },
      });
      expect(mockRfiCreate).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });

    it('creates RFI when sourceReference is unique', async () => {
      mockRfiFindFirst.mockResolvedValue(null);
      mockRfiCount.mockResolvedValue(0);
      const created = {
        id: 'rfi-1',
        rfiNumber: `RFI-${new Date().getFullYear()}-0001`,
        projectId: 'proj-1',
        subject: 'New',
        description: 'New desc',
        status: 'draft',
        submittedBy: 'user-1',
        sourceReference: 'webhook-456',
      };
      mockRfiCreate.mockResolvedValue(created);

      const result = await createRfi({
        projectId: 'proj-1',
        subject: 'New',
        description: 'New desc',
        submittedBy: 'user-1',
        sourceReference: 'webhook-456',
      });

      expect(mockRfiFindFirst).toHaveBeenCalled();
      expect(mockRfiCreate).toHaveBeenCalled();
      expect(result).toEqual(created);
    });

    it('returns RFI by id', async () => {
      const rfi = { id: 'rfi-1', rfiNumber: 'RFI-2026-0001' };
      mockRfiFindUnique.mockResolvedValue(rfi);

      const result = await getRfiById('rfi-1');
      expect(mockRfiFindUnique).toHaveBeenCalledWith({ where: { id: 'rfi-1' } });
      expect(result).toEqual(rfi);
    });

    it('returns RFIs by project ordered by createdAt desc', async () => {
      const rfis = [
        { id: 'rfi-2', createdAt: new Date('2026-06-02') },
        { id: 'rfi-1', createdAt: new Date('2026-06-01') },
      ];
      mockRfiFindMany.mockResolvedValue(rfis);

      const result = await getRfiByProject('proj-1');
      expect(mockRfiFindMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(rfis);
    });

    it('submits an RFI', async () => {
      const updated = { id: 'rfi-1', status: 'submitted', submittedAt: new Date() };
      mockRfiFindUnique.mockResolvedValue({ id: 'rfi-1', status: 'draft' });
      mockRfiUpdate.mockResolvedValue(updated);

      const result = await submitRfi('rfi-1');
      expect(mockRfiUpdate).toHaveBeenCalledWith({
        where: { id: 'rfi-1' },
        data: expect.objectContaining({
          status: 'submitted',
          submittedAt: expect.any(Date),
        }),
      });
      expect(result.status).toBe('submitted');
    });

    it('answers an RFI', async () => {
      const updated = {
        id: 'rfi-1',
        status: 'answered',
        responseText: 'Use grade 60 rebar',
        answeredAt: new Date(),
        assignedTo: 'pm-1',
      };
      mockRfiFindUnique.mockResolvedValue({ id: 'rfi-1', status: 'submitted' });
      mockRfiUpdate.mockResolvedValue(updated);

      const result = await answerRfi('rfi-1', 'Use grade 60 rebar', 'pm-1');
      expect(mockRfiUpdate).toHaveBeenCalledWith({
        where: { id: 'rfi-1' },
        data: expect.objectContaining({
          status: 'answered',
          responseText: 'Use grade 60 rebar',
          answeredAt: expect.any(Date),
          assignedTo: 'pm-1',
        }),
      });
      expect(result.status).toBe('answered');
    });

    it('closes an RFI', async () => {
      const updated = { id: 'rfi-1', status: 'closed' };
      mockRfiFindUnique.mockResolvedValue({ id: 'rfi-1', status: 'answered' });
      mockRfiUpdate.mockResolvedValue(updated);

      const result = await closeRfi('rfi-1');
      expect(mockRfiUpdate).toHaveBeenCalledWith({
        where: { id: 'rfi-1' },
        data: expect.objectContaining({
          status: 'closed',
        }),
      });
      expect(result.status).toBe('closed');
    });

    it('updateRfi updates fields without status change', async () => {
      const existing = { id: 'rfi-1', status: 'submitted', statusHistory: [] };
      mockRfiFindUnique.mockResolvedValue(existing);
      mockRfiUpdate.mockResolvedValue({ id: 'rfi-1', ballInCourt: 'EOR' });

      await import('./communications.service').then((m) => m.updateRfi('rfi-1', { ballInCourt: 'EOR' }));
      expect(mockRfiUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rfi-1' },
          data: expect.objectContaining({ ballInCourt: 'EOR' }),
        })
      );
    });

    it('updateRfi appends history when status changes', async () => {
      const existing = { id: 'rfi-1', status: 'draft', statusHistory: [] };
      mockRfiFindUnique.mockResolvedValue(existing);
      mockRfiUpdate.mockResolvedValue({ id: 'rfi-1', status: 'submitted' });

      await import('./communications.service').then((m) => m.updateRfi('rfi-1', { status: 'submitted' }));
      const call = mockRfiUpdate.mock.calls[0][0];
      const history = call.data.statusHistory as any[];
      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('submitted');
    });

    it('returns PDF data for an RFI', async () => {
      const rfi = {
        id: 'rfi-1',
        rfiNumber: 'RFI-2026-0001',
        subject: 'Foundation depth',
        description: 'What is the required depth?',
        status: 'answered',
        submittedBy: 'user-1',
        submittedAt: new Date('2026-06-01'),
        responseText: '5 feet minimum',
        answeredAt: new Date('2026-06-02'),
        project: { name: 'Test Project' },
      };
      mockRfiFindUnique.mockResolvedValue(rfi);

      const result = await getRfiPdfData('rfi-1');
      expect(mockRfiFindUnique).toHaveBeenCalledWith({
        where: { id: 'rfi-1' },
        include: { project: true },
      });
      expect(result).toEqual({
        rfiNumber: 'RFI-2026-0001',
        subject: 'Foundation depth',
        description: 'What is the required depth?',
        status: 'answered',
        submittedBy: 'user-1',
        submittedAt: new Date('2026-06-01'),
        responseText: '5 feet minimum',
        answeredAt: new Date('2026-06-02'),
        projectName: 'Test Project',
      });
    });

    it('throws when PDF data requested for non-existent RFI', async () => {
      mockRfiFindUnique.mockResolvedValue(null);
      await expect(getRfiPdfData('rfi-1')).rejects.toThrow('RFI not found');
    });
  });

  describe('Submittal register', () => {
    it('creates a submittal with auto-numbered submittalNumber', async () => {
      mockSubmittalCount.mockResolvedValue(2);
      const created = {
        id: 'sub-1',
        submittalNumber: `SUB-${new Date().getFullYear()}-0003`,
        projectId: 'proj-1',
        title: 'Concrete mix design',
        description: 'Submit mix design for review',
        status: 'pending',
        submittedBy: 'user-1',
      };
      mockSubmittalCreate.mockResolvedValue(created);

      const result = await createSubmittal({
        projectId: 'proj-1',
        title: 'Concrete mix design',
        description: 'Submit mix design for review',
        submittedBy: 'user-1',
      });

      expect(mockSubmittalCount).toHaveBeenCalledWith({ where: { projectId: 'proj-1' } });
      expect(mockSubmittalCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          submittalNumber: `SUB-${new Date().getFullYear()}-0003`,
          title: 'Concrete mix design',
          description: 'Submit mix design for review',
          status: 'pending',
          submittedBy: 'user-1',
        }),
      });
      expect(result.submittalNumber).toBe(`SUB-${new Date().getFullYear()}-0003`);
    });

    it('creates a submittal with optional fields', async () => {
      mockSubmittalCount.mockResolvedValue(0);
      const created = {
        id: 'sub-1',
        submittalNumber: `SUB-${new Date().getFullYear()}-0001`,
        projectId: 'proj-1',
        title: 'Steel certification',
        description: 'Mill certs',
        status: 'pending',
        specSection: '03400',
        submittedBy: 'user-1',
        holdOnActivityId: 'act-1',
      };
      mockSubmittalCreate.mockResolvedValue(created);

      const result = await createSubmittal({
        projectId: 'proj-1',
        title: 'Steel certification',
        description: 'Mill certs',
        submittedBy: 'user-1',
        specSection: '03400',
        holdOnActivityId: 'act-1',
      });

      expect(mockSubmittalCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          specSection: '03400',
          holdOnActivityId: 'act-1',
        }),
      });
      expect(result).toEqual(created);
    });

    it('returns submittal by id', async () => {
      const submittal = { id: 'sub-1', submittalNumber: 'SUB-2026-0001' };
      mockSubmittalFindUnique.mockResolvedValue(submittal);

      const result = await getSubmittalById('sub-1');
      expect(mockSubmittalFindUnique).toHaveBeenCalledWith({ where: { id: 'sub-1' } });
      expect(result).toEqual(submittal);
    });

    it('returns submittals by project ordered by createdAt desc', async () => {
      const submittals = [
        { id: 'sub-2', createdAt: new Date('2026-06-02') },
        { id: 'sub-1', createdAt: new Date('2026-06-01') },
      ];
      mockSubmittalFindMany.mockResolvedValue(submittals);

      const result = await getSubmittalsByProject('proj-1');
      expect(mockSubmittalFindMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(submittals);
    });

    it('submits a submittal', async () => {
      const existing = { id: 'sub-1', statusHistory: [] };
      mockSubmittalFindUnique.mockResolvedValue(existing);
      const updated = { id: 'sub-1', status: 'submitted', submittedAt: new Date() };
      mockSubmittalUpdate.mockResolvedValue(updated);

      const result = await submitSubmittal('sub-1');
      expect(mockSubmittalUpdate).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          status: 'submitted',
          submittedAt: expect.any(Date),
        }),
      });
      expect(result.status).toBe('submitted');
    });

    it('reviews a submittal as approved', async () => {
      const existing = { id: 'sub-1', description: 'Original desc', statusHistory: [] };
      mockSubmittalFindUnique.mockResolvedValue(existing);
      const updated = { id: 'sub-1', status: 'approved', reviewedBy: 'pm-1', reviewedAt: new Date() };
      mockSubmittalUpdate.mockResolvedValue(updated);

      const result = await reviewSubmittal('sub-1', 'approved', 'pm-1');
      expect(mockSubmittalUpdate).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          status: 'approved',
          reviewedBy: 'pm-1',
          reviewedAt: expect.any(Date),
        }),
      });
      expect(result.status).toBe('approved');
    });

    it('reviews a submittal as rejected with notes', async () => {
      const existing = { id: 'sub-1', description: 'Original desc', statusHistory: [] };
      mockSubmittalFindUnique.mockResolvedValue(existing);
      const updated = {
        id: 'sub-1',
        status: 'rejected',
        reviewedBy: 'pm-1',
        reviewedAt: new Date(),
        reviewComments: 'Missing test data',
      };
      mockSubmittalUpdate.mockResolvedValue(updated);

      const result = await reviewSubmittal('sub-1', 'rejected', 'pm-1', 'Missing test data');
      expect(mockSubmittalUpdate).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          status: 'rejected',
          reviewedBy: 'pm-1',
          reviewedAt: expect.any(Date),
          reviewComments: 'Missing test data',
        }),
      });
      expect(result.status).toBe('rejected');
    });

    it('reviews a submittal as revision_required', async () => {
      const existing = { id: 'sub-1', description: null, statusHistory: [] };
      mockSubmittalFindUnique.mockResolvedValue(existing);
      const updated = {
        id: 'sub-1',
        status: 'revision_required',
        reviewedBy: 'pm-1',
        reviewedAt: new Date(),
        reviewComments: 'Revise and resubmit',
      };
      mockSubmittalUpdate.mockResolvedValue(updated);

      const result = await reviewSubmittal('sub-1', 'revision_required', 'pm-1', 'Revise and resubmit');
      expect(mockSubmittalUpdate).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          status: 'revision_required',
          reviewedBy: 'pm-1',
          reviewedAt: expect.any(Date),
          reviewComments: 'Revise and resubmit',
        }),
      });
      expect(result.status).toBe('revision_required');
    });

    it('throws when reviewing non-existent submittal', async () => {
      mockSubmittalFindUnique.mockResolvedValue(null);
      await expect(reviewSubmittal('sub-1', 'approved', 'pm-1')).rejects.toThrow('Submittal not found');
    });

    it('returns PDF data for a submittal', async () => {
      const submittal = {
        id: 'sub-1',
        submittalNumber: 'SUB-2026-0001',
        title: 'Concrete mix design',
        description: 'Submit mix design',
        status: 'approved',
        specSection: '03400',
        submittedBy: 'user-1',
        submittedAt: new Date('2026-06-01'),
        reviewedBy: 'pm-1',
        reviewedAt: new Date('2026-06-03'),
        project: { name: 'Test Project' },
      };
      mockSubmittalFindUnique.mockResolvedValue(submittal);

      const result = await getSubmittalPdfData('sub-1');
      expect(mockSubmittalFindUnique).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        include: { project: true },
      });
      expect(result).toEqual({
        submittalNumber: 'SUB-2026-0001',
        title: 'Concrete mix design',
        description: 'Submit mix design',
        status: 'approved',
        specSection: '03400',
        submittedBy: 'user-1',
        submittedAt: new Date('2026-06-01'),
        reviewedBy: 'pm-1',
        reviewedAt: new Date('2026-06-03'),
        projectName: 'Test Project',
      });
    });

    it('throws when PDF data requested for non-existent submittal', async () => {
      mockSubmittalFindUnique.mockResolvedValue(null);
      await expect(getSubmittalPdfData('sub-1')).rejects.toThrow('Submittal not found');
    });
  });

  describe('Meeting minutes', () => {
    it('creates a meeting with all fields', async () => {
      mockMeetingCreate.mockResolvedValue({ id: 'meet-1' });
      const result = await createMeeting({
        projectId: 'proj-1',
        title: 'Weekly OAC',
        meetingDate: new Date('2026-06-01'),
        location: 'Site trailer',
        facilitator: 'Bob',
        attendees: [
          { name: 'Alice', role: 'Owner' },
          { name: 'Bob', role: 'PM' },
        ],
        agenda: ['Safety', 'Schedule', 'Change Orders'],
        minutes: '## Safety\nNo incidents.',
        actionItems: [
          { description: 'Submit RFI-12', assignee: 'Alice', status: 'open' },
        ],
        createdBy: 'user-1',
        status: 'draft',
      });

      expect(result).toEqual({ id: 'meet-1' });
      expect(mockMeetingCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          title: 'Weekly OAC',
          status: 'draft',
        }),
      });
    });

    it('returns meetings for a project ordered by date desc', async () => {
      mockMeetingFindMany.mockResolvedValue([{ id: 'meet-2' }, { id: 'meet-1' }]);
      const result = await getMeetingsByProject('proj-1');
      expect(result).toHaveLength(2);
      expect(mockMeetingFindMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { meetingDate: 'desc' },
      });
    });

    it('filters meetings by date range when provided', async () => {
      mockMeetingFindMany.mockResolvedValue([]);
      const start = new Date('2026-06-01');
      const end = new Date('2026-06-30');
      await getMeetingsByProject('proj-1', start, end);
      expect(mockMeetingFindMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          meetingDate: { gte: start, lte: end },
        },
        orderBy: { meetingDate: 'desc' },
      });
    });

    it('returns a single meeting by id', async () => {
      mockMeetingFindUnique.mockResolvedValue({ id: 'meet-1', title: 'Weekly OAC' });
      const result = await getMeetingById('meet-1');
      expect(result?.title).toBe('Weekly OAC');
    });

    it('updates meeting fields', async () => {
      mockMeetingUpdate.mockResolvedValue({ id: 'meet-1', status: 'published' });
      const result = await updateMeeting('meet-1', { status: 'published' });
      expect(result.status).toBe('published');
    });

    it('updates a single action item status by index', async () => {
      mockMeetingFindUnique.mockResolvedValue({
        id: 'meet-1',
        actionItems: [
          { description: 'Task A', status: 'open' },
          { description: 'Task B', status: 'open' },
        ],
      });
      mockMeetingUpdate.mockResolvedValue({ id: 'meet-1' });
      await updateMeetingActionItemStatus('meet-1', 1, 'closed');
      expect(mockMeetingUpdate).toHaveBeenCalledWith({
        where: { id: 'meet-1' },
        data: {
          actionItems: [
            { description: 'Task A', status: 'open' },
            { description: 'Task B', status: 'closed' },
          ],
        },
      });
    });

    it('throws when action item index is out of range', async () => {
      mockMeetingFindUnique.mockResolvedValue({ id: 'meet-1', actionItems: [{ description: 'A' }] });
      await expect(updateMeetingActionItemStatus('meet-1', 5, 'closed')).rejects.toThrow(
        'Action item index out of range'
      );
    });

    it('throws when updating action item on non-existent meeting', async () => {
      mockMeetingFindUnique.mockResolvedValue(null);
      await expect(updateMeetingActionItemStatus('meet-x', 0, 'closed')).rejects.toThrow(
        'Meeting not found'
      );
    });

    it('deletes a meeting', async () => {
      mockMeetingDelete.mockResolvedValue({ id: 'meet-1' });
      await deleteMeeting('meet-1');
      expect(mockMeetingDelete).toHaveBeenCalledWith({ where: { id: 'meet-1' } });
    });

    it('returns meeting PDF data with project name', async () => {
      mockMeetingFindUnique.mockResolvedValue({
        id: 'meet-1',
        title: 'OAC',
        meetingDate: new Date('2026-06-01'),
        location: 'Site trailer',
        facilitator: 'Bob',
        attendees: [{ name: 'Alice' }],
        agenda: ['Safety'],
        minutes: 'Minutes text',
        actionItems: [{ description: 'A', status: 'open' }],
        status: 'published',
        project: { name: 'BESS Texas' },
      });
      const result = await getMeetingPdfData('meet-1');
      expect(result.projectName).toBe('BESS Texas');
      expect(result.title).toBe('OAC');
    });

    it('throws when PDF data requested for non-existent meeting', async () => {
      mockMeetingFindUnique.mockResolvedValue(null);
      await expect(getMeetingPdfData('meet-x')).rejects.toThrow('Meeting not found');
    });
  });
});
