"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../lib/prisma");
const integration_service_1 = require("./integration.service");
const mockIssueCreate = jest.fn();
const mockIssueFindUnique = jest.fn();
const mockIssueFindFirst = jest.fn();
const mockIssueFindMany = jest.fn();
const mockIssueUpdate = jest.fn();
const mockVoiceMemoCreate = jest.fn();
const mockVoiceMemoFindUnique = jest.fn();
const mockVoiceMemoFindMany = jest.fn();
const mockVoiceMemoUpdate = jest.fn();
const mockUnifiedChangeLogCreate = jest.fn();
const mockUnifiedChangeLogFindMany = jest.fn();
const mockCloseoutChecklistCreate = jest.fn();
const mockCloseoutChecklistFindFirst = jest.fn();
const mockCloseoutChecklistFindUnique = jest.fn();
const mockCloseoutChecklistUpdate = jest.fn();
const mockPrisma = {
    issue: {
        create: mockIssueCreate,
        findUnique: mockIssueFindUnique,
        findFirst: mockIssueFindFirst,
        findMany: mockIssueFindMany,
        update: mockIssueUpdate,
    },
    voiceMemo: {
        create: mockVoiceMemoCreate,
        findUnique: mockVoiceMemoFindUnique,
        findMany: mockVoiceMemoFindMany,
        update: mockVoiceMemoUpdate,
    },
    unifiedChangeLog: {
        create: mockUnifiedChangeLogCreate,
        findMany: mockUnifiedChangeLogFindMany,
    },
    closeoutChecklist: {
        create: mockCloseoutChecklistCreate,
        findFirst: mockCloseoutChecklistFindFirst,
        findUnique: mockCloseoutChecklistFindUnique,
        update: mockCloseoutChecklistUpdate,
    },
};
beforeEach(() => {
    jest.clearAllMocks();
    (0, prisma_1.setPrismaClient)(mockPrisma);
});
describe('integration.service', () => {
    describe('createIssue', () => {
        it('creates an issue with auto-generated issue number', async () => {
            mockIssueFindFirst.mockResolvedValue(null);
            const created = {
                id: 'issue-1',
                projectId: 'proj-1',
                issueNumber: 'ISS-2026-0001',
                type: 'client_issue',
                source: 'manual',
                title: 'Test issue',
                description: 'Description',
                status: 'open',
                priority: 'medium',
                createdBy: 'user-1',
            };
            mockIssueCreate.mockResolvedValue(created);
            const result = await (0, integration_service_1.createIssue)({
                projectId: 'proj-1',
                type: 'client_issue',
                source: 'manual',
                title: 'Test issue',
                description: 'Description',
                createdBy: 'user-1',
            });
            expect(mockIssueCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    projectId: 'proj-1',
                    issueNumber: expect.stringMatching(/^ISS-\d{4}-\d{4}$/),
                    type: 'client_issue',
                    source: 'manual',
                    title: 'Test issue',
                    description: 'Description',
                    status: 'open',
                    priority: 'medium',
                    createdBy: 'user-1',
                }),
            });
            expect(result.issueNumber).toBe('ISS-2026-0001');
        });
        it('increments issue number sequence', async () => {
            mockIssueFindFirst.mockResolvedValue({ issueNumber: 'ISS-2026-0005' });
            mockIssueCreate.mockResolvedValue({ issueNumber: 'ISS-2026-0006' });
            await (0, integration_service_1.createIssue)({
                projectId: 'proj-1',
                type: 'field_issue',
                source: 'manual',
                title: 'Another',
                description: 'Desc',
                createdBy: 'user-1',
            });
            expect(mockIssueCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    issueNumber: 'ISS-2026-0006',
                }),
            });
        });
    });
    describe('getIssueById', () => {
        it('returns issue with project', async () => {
            const issue = { id: 'issue-1', title: 'Test' };
            mockIssueFindUnique.mockResolvedValue(issue);
            const result = await (0, integration_service_1.getIssueById)('issue-1');
            expect(mockIssueFindUnique).toHaveBeenCalledWith({
                where: { id: 'issue-1' },
                include: { project: true },
            });
            expect(result).toEqual(issue);
        });
    });
    describe('getIssuesByProject', () => {
        it('returns issues ordered by createdAt desc', async () => {
            const issues = [
                { id: 'issue-2', createdAt: new Date('2026-06-02') },
                { id: 'issue-1', createdAt: new Date('2026-06-01') },
            ];
            mockIssueFindMany.mockResolvedValue(issues);
            const result = await (0, integration_service_1.getIssuesByProject)('proj-1');
            expect(mockIssueFindMany).toHaveBeenCalledWith({
                where: { projectId: 'proj-1' },
                orderBy: { createdAt: 'desc' },
            });
            expect(result).toEqual(issues);
        });
    });
    describe('getIssuesByType', () => {
        it('filters by type', async () => {
            const issues = [{ id: 'issue-1', type: 'client_issue' }];
            mockIssueFindMany.mockResolvedValue(issues);
            const result = await (0, integration_service_1.getIssuesByType)('proj-1', 'client_issue');
            expect(mockIssueFindMany).toHaveBeenCalledWith({
                where: { projectId: 'proj-1', type: 'client_issue' },
                orderBy: { createdAt: 'desc' },
            });
            expect(result).toEqual(issues);
        });
    });
    describe('updateIssue', () => {
        it('updates an issue', async () => {
            const existing = { id: 'issue-1', status: 'open' };
            const updated = { id: 'issue-1', status: 'in_progress' };
            mockIssueFindUnique.mockResolvedValue(existing);
            mockIssueUpdate.mockResolvedValue(updated);
            const result = await (0, integration_service_1.updateIssue)('issue-1', { status: 'in_progress' });
            expect(mockIssueUpdate).toHaveBeenCalledWith({
                where: { id: 'issue-1' },
                data: expect.objectContaining({ status: 'in_progress' }),
            });
            expect(result.status).toBe('in_progress');
        });
        it('throws when updating non-existent issue', async () => {
            mockIssueFindUnique.mockResolvedValue(null);
            await expect((0, integration_service_1.updateIssue)('issue-1', { title: 'New' })).rejects.toThrow('Issue not found');
        });
    });
    describe('resolveIssue', () => {
        it('sets status to resolved and resolvedAt', async () => {
            const existing = { id: 'issue-1', status: 'open' };
            mockIssueFindUnique.mockResolvedValue(existing);
            mockIssueUpdate.mockResolvedValue({ ...existing, status: 'resolved', resolvedAt: new Date() });
            const result = await (0, integration_service_1.resolveIssue)('issue-1', 'user-1');
            expect(mockIssueUpdate).toHaveBeenCalledWith({
                where: { id: 'issue-1' },
                data: { status: 'resolved', resolvedAt: expect.any(Date) },
            });
            expect(result.status).toBe('resolved');
        });
        it('throws when resolving non-existent issue', async () => {
            mockIssueFindUnique.mockResolvedValue(null);
            await expect((0, integration_service_1.resolveIssue)('issue-1', 'user-1')).rejects.toThrow('Issue not found');
        });
    });
    describe('closeIssue', () => {
        it('sets status to closed', async () => {
            const existing = { id: 'issue-1', status: 'resolved' };
            mockIssueFindUnique.mockResolvedValue(existing);
            mockIssueUpdate.mockResolvedValue({ ...existing, status: 'closed' });
            const result = await (0, integration_service_1.closeIssue)('issue-1');
            expect(mockIssueUpdate).toHaveBeenCalledWith({
                where: { id: 'issue-1' },
                data: { status: 'closed' },
            });
            expect(result.status).toBe('closed');
        });
        it('throws when closing non-existent issue', async () => {
            mockIssueFindUnique.mockResolvedValue(null);
            await expect((0, integration_service_1.closeIssue)('issue-1')).rejects.toThrow('Issue not found');
        });
    });
    describe('getIssuePdfData', () => {
        it('returns structured data for PDF export', async () => {
            const issue = {
                id: 'issue-1',
                issueNumber: 'ISS-2026-0001',
                project: { name: 'Test Project' },
                type: 'client_issue',
                source: 'manual',
                title: 'Title',
                description: 'Desc',
                status: 'open',
                priority: 'high',
                assignee: 'user-1',
                dueDate: new Date('2026-06-10'),
                resolvedAt: null,
                createdBy: 'user-1',
                createdAt: new Date('2026-06-01'),
                updatedAt: new Date('2026-06-01'),
            };
            mockIssueFindUnique.mockResolvedValue(issue);
            const result = await (0, integration_service_1.getIssuePdfData)('issue-1');
            expect(result.issueNumber).toBe('ISS-2026-0001');
            expect(result.projectName).toBe('Test Project');
            expect(result.title).toBe('Title');
        });
        it('throws when issue not found', async () => {
            mockIssueFindUnique.mockResolvedValue(null);
            await expect((0, integration_service_1.getIssuePdfData)('issue-1')).rejects.toThrow('Issue not found');
        });
    });
    describe('createVoiceMemo', () => {
        it('creates a voice memo with pending status', async () => {
            const created = {
                id: 'memo-1',
                projectId: 'proj-1',
                audioUrl: 'https://audio.url/1',
                transcription: 'Test memo',
                status: 'pending',
                createdBy: 'user-1',
            };
            mockVoiceMemoCreate.mockResolvedValue(created);
            const result = await (0, integration_service_1.createVoiceMemo)({
                projectId: 'proj-1',
                audioUrl: 'https://audio.url/1',
                transcription: 'Test memo',
                createdBy: 'user-1',
            });
            expect(mockVoiceMemoCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    projectId: 'proj-1',
                    audioUrl: 'https://audio.url/1',
                    transcription: 'Test memo',
                    status: 'pending',
                    createdBy: 'user-1',
                }),
            });
            expect(result.status).toBe('pending');
        });
    });
    describe('processVoiceMemo', () => {
        it('updates status to processed without structured data', async () => {
            const memo = {
                id: 'memo-1',
                projectId: 'proj-1',
                transcription: 'Test',
                structuredData: null,
                createdBy: 'user-1',
            };
            mockVoiceMemoFindUnique.mockResolvedValue(memo);
            mockVoiceMemoUpdate.mockResolvedValue({ ...memo, status: 'processed' });
            const result = await (0, integration_service_1.processVoiceMemo)('memo-1');
            expect(mockVoiceMemoUpdate).toHaveBeenCalledWith({
                where: { id: 'memo-1' },
                data: { status: 'processed' },
            });
            expect(result.memo.status).toBe('processed');
            expect(result.issue).toBeNull();
        });
        it('creates an issue when structured data has type and description', async () => {
            const memo = {
                id: 'memo-1',
                projectId: 'proj-1',
                transcription: 'There is a safety hazard near the transformer',
                structuredData: {
                    type: 'field_issue',
                    description: 'Safety hazard near transformer',
                    activityLink: 'act-1',
                    assignee: 'super-1',
                    priority: 'high',
                },
                createdBy: 'user-1',
            };
            mockVoiceMemoFindUnique.mockResolvedValue(memo);
            mockVoiceMemoUpdate.mockResolvedValue({ ...memo, status: 'processed' });
            mockIssueFindFirst.mockResolvedValue(null);
            mockIssueCreate.mockResolvedValue({ id: 'issue-memo-1', type: 'field_issue' });
            const result = await (0, integration_service_1.processVoiceMemo)('memo-1');
            expect(mockIssueCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    projectId: 'proj-1',
                    type: 'field_issue',
                    source: 'voice_memo',
                    title: expect.stringContaining('Voice memo'),
                    description: 'Safety hazard near transformer',
                    activityId: 'act-1',
                    assignee: 'super-1',
                    priority: 'high',
                    createdBy: 'user-1',
                }),
            });
            expect(result.issue).not.toBeNull();
        });
        it('throws when memo not found', async () => {
            mockVoiceMemoFindUnique.mockResolvedValue(null);
            await expect((0, integration_service_1.processVoiceMemo)('memo-1')).rejects.toThrow('Voice memo not found');
        });
    });
    describe('getVoiceMemosByProject', () => {
        it('returns voice memos ordered by createdAt desc', async () => {
            const memos = [{ id: 'memo-1' }];
            mockVoiceMemoFindMany.mockResolvedValue(memos);
            const result = await (0, integration_service_1.getVoiceMemosByProject)('proj-1');
            expect(mockVoiceMemoFindMany).toHaveBeenCalledWith({
                where: { projectId: 'proj-1' },
                orderBy: { createdAt: 'desc' },
            });
            expect(result).toEqual(memos);
        });
    });
    describe('getVoiceMemoById', () => {
        it('returns a voice memo', async () => {
            const memo = { id: 'memo-1' };
            mockVoiceMemoFindUnique.mockResolvedValue(memo);
            const result = await (0, integration_service_1.getVoiceMemoById)('memo-1');
            expect(mockVoiceMemoFindUnique).toHaveBeenCalledWith({ where: { id: 'memo-1' } });
            expect(result).toEqual(memo);
        });
    });
    describe('createSelfMemo', () => {
        it('creates an issue with source self_memo', async () => {
            mockIssueFindFirst.mockResolvedValue(null);
            mockIssueCreate.mockResolvedValue({ id: 'self-1', source: 'self_memo' });
            const result = await (0, integration_service_1.createSelfMemo)('proj-1', 'user-1', 'Self note', 'My note desc');
            expect(mockIssueCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    projectId: 'proj-1',
                    type: 'field_issue',
                    source: 'self_memo',
                    title: 'Self note',
                    description: 'My note desc',
                    createdBy: 'user-1',
                }),
            });
            expect(result.source).toBe('self_memo');
        });
    });
    describe('getSelfMemosByUser', () => {
        it('returns issues with source self_memo for user', async () => {
            const memos = [{ id: 'self-1', source: 'self_memo' }];
            mockIssueFindMany.mockResolvedValue(memos);
            const result = await (0, integration_service_1.getSelfMemosByUser)('user-1');
            expect(mockIssueFindMany).toHaveBeenCalledWith({
                where: { createdBy: 'user-1', source: 'self_memo' },
                orderBy: { createdAt: 'desc' },
            });
            expect(result).toEqual(memos);
        });
    });
    describe('logChange', () => {
        it('creates a change log entry', async () => {
            const created = { id: 'log-1', module: 'schedule' };
            mockUnifiedChangeLogCreate.mockResolvedValue(created);
            const result = await (0, integration_service_1.logChange)({
                projectId: 'proj-1',
                module: 'schedule',
                changeType: 'baseline_change',
                description: 'Baseline updated',
                changedBy: 'user-1',
            });
            expect(mockUnifiedChangeLogCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    projectId: 'proj-1',
                    module: 'schedule',
                    changeType: 'baseline_change',
                    description: 'Baseline updated',
                    changedBy: 'user-1',
                    changedAt: expect.any(Date),
                }),
            });
            expect(result.module).toBe('schedule');
        });
        it('uses provided changedAt', async () => {
            const changedAt = new Date('2026-06-01');
            mockUnifiedChangeLogCreate.mockResolvedValue({ id: 'log-1' });
            await (0, integration_service_1.logChange)({
                projectId: 'proj-1',
                module: 'cost',
                changeType: 'data_entry',
                description: 'Budget updated',
                changedBy: 'user-1',
                changedAt,
            });
            expect(mockUnifiedChangeLogCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({ changedAt }),
            });
        });
    });
    describe('getChangeLogByProject', () => {
        it('returns change logs ordered by changedAt desc', async () => {
            const logs = [{ id: 'log-1' }];
            mockUnifiedChangeLogFindMany.mockResolvedValue(logs);
            const result = await (0, integration_service_1.getChangeLogByProject)('proj-1');
            expect(mockUnifiedChangeLogFindMany).toHaveBeenCalledWith({
                where: { projectId: 'proj-1' },
                orderBy: { changedAt: 'desc' },
            });
            expect(result).toEqual(logs);
        });
    });
    describe('getChangeLogByModule', () => {
        it('filters by module', async () => {
            const logs = [{ id: 'log-1', module: 'cost' }];
            mockUnifiedChangeLogFindMany.mockResolvedValue(logs);
            const result = await (0, integration_service_1.getChangeLogByModule)('proj-1', 'cost');
            expect(mockUnifiedChangeLogFindMany).toHaveBeenCalledWith({
                where: { projectId: 'proj-1', module: 'cost' },
                orderBy: { changedAt: 'desc' },
            });
            expect(result).toEqual(logs);
        });
    });
    describe('getChangeLogByRecord', () => {
        it('filters by record id and type', async () => {
            const logs = [{ id: 'log-1' }];
            mockUnifiedChangeLogFindMany.mockResolvedValue(logs);
            const result = await (0, integration_service_1.getChangeLogByRecord)('rec-1', 'budget_line');
            expect(mockUnifiedChangeLogFindMany).toHaveBeenCalledWith({
                where: { affectedRecordId: 'rec-1', affectedRecordType: 'budget_line' },
                orderBy: { changedAt: 'desc' },
            });
            expect(result).toEqual(logs);
        });
    });
    describe('initializeCloseoutChecklist', () => {
        it('creates a checklist with default items', async () => {
            mockCloseoutChecklistFindFirst.mockResolvedValue(null);
            const created = { id: 'cl-1', items: integration_service_1.DEFAULT_CLOSEOUT_ITEMS };
            mockCloseoutChecklistCreate.mockResolvedValue(created);
            const result = await (0, integration_service_1.initializeCloseoutChecklist)('proj-1');
            expect(mockCloseoutChecklistCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    projectId: 'proj-1',
                    items: expect.any(Array),
                    status: 'in_progress',
                }),
            });
            expect(result.items).toHaveLength(10);
        });
        it('returns existing checklist if one already exists', async () => {
            const existing = { id: 'cl-1', items: integration_service_1.DEFAULT_CLOSEOUT_ITEMS };
            mockCloseoutChecklistFindFirst.mockResolvedValue(existing);
            const result = await (0, integration_service_1.initializeCloseoutChecklist)('proj-1');
            expect(mockCloseoutChecklistCreate).not.toHaveBeenCalled();
            expect(result).toEqual(existing);
        });
    });
    describe('getCloseoutChecklist', () => {
        it('returns the checklist for a project', async () => {
            const checklist = { id: 'cl-1' };
            mockCloseoutChecklistFindFirst.mockResolvedValue(checklist);
            const result = await (0, integration_service_1.getCloseoutChecklist)('proj-1');
            expect(mockCloseoutChecklistFindFirst).toHaveBeenCalledWith({
                where: { projectId: 'proj-1' },
            });
            expect(result).toEqual(checklist);
        });
    });
    describe('completeChecklistItem', () => {
        it('marks an item as completed', async () => {
            const checklist = {
                id: 'cl-1',
                items: integration_service_1.DEFAULT_CLOSEOUT_ITEMS,
            };
            mockCloseoutChecklistFindUnique.mockResolvedValue(checklist);
            mockCloseoutChecklistUpdate.mockResolvedValue({
                ...checklist,
                items: checklist.items.map((item) => item.id === '1'
                    ? { ...item, completed: true, completedAt: expect.any(String), completedBy: 'user-1' }
                    : item),
            });
            const result = await (0, integration_service_1.completeChecklistItem)('cl-1', '1', 'user-1');
            expect(mockCloseoutChecklistUpdate).toHaveBeenCalledWith({
                where: { id: 'cl-1' },
                data: expect.objectContaining({
                    items: expect.any(Array),
                    status: 'in_progress',
                }),
            });
        });
        it('sets status to complete when all items are done', async () => {
            const items = integration_service_1.DEFAULT_CLOSEOUT_ITEMS.map((item, idx) => ({
                ...item,
                completed: idx < 9,
                completedAt: idx < 9 ? '2026-06-01T00:00:00Z' : undefined,
                completedBy: idx < 9 ? 'user-1' : undefined,
            }));
            const checklist = { id: 'cl-1', items };
            mockCloseoutChecklistFindUnique.mockResolvedValue(checklist);
            mockCloseoutChecklistUpdate.mockResolvedValue({ ...checklist, status: 'complete' });
            await (0, integration_service_1.completeChecklistItem)('cl-1', '10', 'user-1');
            expect(mockCloseoutChecklistUpdate).toHaveBeenCalledWith({
                where: { id: 'cl-1' },
                data: expect.objectContaining({ status: 'complete' }),
            });
        });
        it('throws when checklist not found', async () => {
            mockCloseoutChecklistFindUnique.mockResolvedValue(null);
            await expect((0, integration_service_1.completeChecklistItem)('cl-1', '1', 'user-1')).rejects.toThrow('Closeout checklist not found');
        });
    });
    describe('getCloseoutProgress', () => {
        it('returns progress for a checklist', async () => {
            const items = integration_service_1.DEFAULT_CLOSEOUT_ITEMS.map((item, idx) => ({
                ...item,
                completed: idx < 5,
            }));
            mockCloseoutChecklistFindFirst.mockResolvedValue({
                id: 'cl-1',
                items,
                status: 'in_progress',
            });
            const result = await (0, integration_service_1.getCloseoutProgress)('proj-1');
            expect(result.total).toBe(10);
            expect(result.completed).toBe(5);
            expect(result.percentComplete).toBe(50);
            expect(result.status).toBe('in_progress');
        });
        it('returns zero progress when no checklist exists', async () => {
            mockCloseoutChecklistFindFirst.mockResolvedValue(null);
            const result = await (0, integration_service_1.getCloseoutProgress)('proj-1');
            expect(result.total).toBe(0);
            expect(result.completed).toBe(0);
            expect(result.percentComplete).toBe(0);
            expect(result.status).toBe('in_progress');
        });
    });
});
//# sourceMappingURL=integration.service.test.js.map