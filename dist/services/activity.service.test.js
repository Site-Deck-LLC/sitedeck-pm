"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../lib/prisma");
const activity_service_1 = require("./activity.service");
const schedule_service_1 = require("./schedule.service");
jest.mock('./schedule.service', () => ({
    ...jest.requireActual('./schedule.service'),
    recalculateSchedule: jest.fn().mockResolvedValue(undefined),
}));
const mockScheduleActivityCreate = jest.fn();
const mockScheduleActivityFindUnique = jest.fn();
const mockScheduleActivityFindMany = jest.fn();
const mockScheduleActivityUpdate = jest.fn();
const mockScheduleActivityDelete = jest.fn();
const mockPrisma = {
    scheduleActivity: {
        create: mockScheduleActivityCreate,
        findUnique: mockScheduleActivityFindUnique,
        findMany: mockScheduleActivityFindMany,
        update: mockScheduleActivityUpdate,
        delete: mockScheduleActivityDelete,
    },
};
beforeEach(() => {
    jest.clearAllMocks();
    (0, prisma_1.setPrismaClient)(mockPrisma);
});
describe('activity.service', () => {
    describe('createActivity', () => {
        it('creates an activity and recalculates schedule', async () => {
            const data = {
                projectId: 'proj-1',
                name: 'Foundation',
                startDate: new Date('2026-01-01'),
                endDate: new Date('2026-01-10'),
                duration: 10,
            };
            const created = { id: 'act-1', ...data };
            mockScheduleActivityCreate.mockResolvedValue(created);
            const result = await (0, activity_service_1.createActivity)(data);
            expect(mockScheduleActivityCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    projectId: 'proj-1',
                    name: 'Foundation',
                    startDate: new Date('2026-01-01'),
                    endDate: new Date('2026-01-10'),
                    duration: 10,
                    status: 'not_started',
                }),
            });
            expect(schedule_service_1.recalculateSchedule).toHaveBeenCalledWith('proj-1');
            expect(result).toEqual(created);
        });
    });
    describe('getActivityById', () => {
        it('returns activity by id', async () => {
            const activity = { id: 'act-1', name: 'Foundation' };
            mockScheduleActivityFindUnique.mockResolvedValue(activity);
            const result = await (0, activity_service_1.getActivityById)('act-1');
            expect(mockScheduleActivityFindUnique).toHaveBeenCalledWith({
                where: { id: 'act-1' },
            });
            expect(result).toEqual(activity);
        });
    });
    describe('getActivitiesByProject', () => {
        it('returns activities ordered by startDate', async () => {
            const activities = [{ id: 'act-1' }, { id: 'act-2' }];
            mockScheduleActivityFindMany.mockResolvedValue(activities);
            const result = await (0, activity_service_1.getActivitiesByProject)('proj-1');
            expect(mockScheduleActivityFindMany).toHaveBeenCalledWith({
                where: { projectId: 'proj-1' },
                orderBy: { startDate: 'asc' },
            });
            expect(result).toEqual(activities);
        });
    });
    describe('updateActivity', () => {
        it('updates activity and recalculates schedule', async () => {
            const existing = { id: 'act-1', projectId: 'proj-1', name: 'Foundation' };
            const updated = { id: 'act-1', projectId: 'proj-1', name: 'Updated' };
            mockScheduleActivityFindUnique.mockResolvedValue(existing);
            mockScheduleActivityUpdate.mockResolvedValue(updated);
            const result = await (0, activity_service_1.updateActivity)('act-1', { name: 'Updated' });
            expect(mockScheduleActivityUpdate).toHaveBeenCalledWith({
                where: { id: 'act-1' },
                data: { name: 'Updated' },
            });
            expect(schedule_service_1.recalculateSchedule).toHaveBeenCalledWith('proj-1');
            expect(result).toEqual(updated);
        });
        it('throws if activity not found', async () => {
            mockScheduleActivityFindUnique.mockResolvedValue(null);
            await expect((0, activity_service_1.updateActivity)('act-1', { name: 'X' })).rejects.toThrow('Activity not found');
        });
    });
    describe('deleteActivity', () => {
        it('deletes activity and recalculates schedule', async () => {
            const existing = { id: 'act-1', projectId: 'proj-1' };
            mockScheduleActivityFindUnique.mockResolvedValue(existing);
            mockScheduleActivityDelete.mockResolvedValue(existing);
            const result = await (0, activity_service_1.deleteActivity)('act-1');
            expect(mockScheduleActivityDelete).toHaveBeenCalledWith({
                where: { id: 'act-1' },
            });
            expect(schedule_service_1.recalculateSchedule).toHaveBeenCalledWith('proj-1');
            expect(result).toEqual(existing);
        });
        it('throws if activity not found', async () => {
            mockScheduleActivityFindUnique.mockResolvedValue(null);
            await expect((0, activity_service_1.deleteActivity)('act-1')).rejects.toThrow('Activity not found');
        });
    });
    describe('markActivityReady', () => {
        it('sets status to not_started', async () => {
            const existing = { id: 'act-1', status: 'delayed' };
            const updated = { id: 'act-1', status: 'not_started' };
            mockScheduleActivityFindUnique.mockResolvedValue(existing);
            mockScheduleActivityUpdate.mockResolvedValue(updated);
            const result = await (0, activity_service_1.markActivityReady)('act-1');
            expect(mockScheduleActivityUpdate).toHaveBeenCalledWith({
                where: { id: 'act-1' },
                data: { status: 'not_started' },
            });
            expect(result).toEqual(updated);
        });
        it('throws if activity not found', async () => {
            mockScheduleActivityFindUnique.mockResolvedValue(null);
            await expect((0, activity_service_1.markActivityReady)('act-1')).rejects.toThrow('Activity not found');
        });
    });
    describe('markActivityComplete', () => {
        it('sets percentComplete to 100, status to complete, and recalculates schedule', async () => {
            const existing = { id: 'act-1', projectId: 'proj-1' };
            const completedAt = new Date('2026-01-15');
            const updated = {
                id: 'act-1',
                percentComplete: 100,
                status: 'complete',
                endDate: completedAt,
            };
            mockScheduleActivityFindUnique.mockResolvedValue(existing);
            mockScheduleActivityUpdate.mockResolvedValue(updated);
            const result = await (0, activity_service_1.markActivityComplete)('act-1', 'user-1', completedAt);
            expect(mockScheduleActivityUpdate).toHaveBeenCalledWith({
                where: { id: 'act-1' },
                data: {
                    percentComplete: 100,
                    status: 'complete',
                    endDate: completedAt,
                },
            });
            expect(schedule_service_1.recalculateSchedule).toHaveBeenCalledWith('proj-1');
            expect(result).toEqual(updated);
        });
        it('throws if activity not found', async () => {
            mockScheduleActivityFindUnique.mockResolvedValue(null);
            await expect((0, activity_service_1.markActivityComplete)('act-1', 'user-1', new Date())).rejects.toThrow('Activity not found');
        });
    });
});
//# sourceMappingURL=activity.service.test.js.map