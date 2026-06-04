"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schedule_service_1 = require("./schedule.service");
const prisma_1 = require("../lib/prisma");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function addDays(date, days) {
    return new Date(date.getTime() + days * MS_PER_DAY);
}
function sameDay(a, b) {
    return Math.abs(a.getTime() - b.getTime()) < MS_PER_DAY / 2;
}
describe('schedule.service', () => {
    describe('calculateCpm', () => {
        const projectStart = new Date('2026-01-01');
        it('computes forward pass correctly for a simple chain', () => {
            const activities = [
                {
                    id: 'A',
                    startDate: projectStart,
                    endDate: addDays(projectStart, 3),
                    duration: 3,
                    predecessors: [],
                },
                {
                    id: 'B',
                    startDate: addDays(projectStart, 3),
                    endDate: addDays(projectStart, 5),
                    duration: 2,
                    predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
                },
            ];
            const result = (0, schedule_service_1.calculateCpm)(activities, projectStart);
            const a = result.get('A');
            const b = result.get('B');
            expect(sameDay(a.earlyStart, projectStart)).toBe(true);
            expect(sameDay(a.earlyFinish, addDays(projectStart, 3))).toBe(true);
            expect(sameDay(b.earlyStart, addDays(projectStart, 3))).toBe(true);
            expect(sameDay(b.earlyFinish, addDays(projectStart, 5))).toBe(true);
        });
        it('identifies critical path activities with zero total float', () => {
            const activities = [
                {
                    id: 'A',
                    startDate: projectStart,
                    endDate: addDays(projectStart, 3),
                    duration: 3,
                    predecessors: [],
                },
                {
                    id: 'B',
                    startDate: addDays(projectStart, 3),
                    endDate: addDays(projectStart, 5),
                    duration: 2,
                    predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
                },
                {
                    id: 'C',
                    startDate: addDays(projectStart, 3),
                    endDate: addDays(projectStart, 7),
                    duration: 4,
                    predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
                },
                {
                    id: 'D',
                    startDate: addDays(projectStart, 7),
                    endDate: addDays(projectStart, 9),
                    duration: 2,
                    predecessors: [
                        { activityId: 'B', type: 'FS', lag: 0 },
                        { activityId: 'C', type: 'FS', lag: 0 },
                    ],
                },
            ];
            const result = (0, schedule_service_1.calculateCpm)(activities, projectStart);
            expect(result.get('A').isCritical).toBe(true);
            expect(result.get('B').isCritical).toBe(false);
            expect(result.get('C').isCritical).toBe(true);
            expect(result.get('D').isCritical).toBe(true);
        });
        it('calculates total float correctly', () => {
            const activities = [
                {
                    id: 'A',
                    startDate: projectStart,
                    endDate: addDays(projectStart, 3),
                    duration: 3,
                    predecessors: [],
                },
                {
                    id: 'B',
                    startDate: addDays(projectStart, 3),
                    endDate: addDays(projectStart, 5),
                    duration: 2,
                    predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
                },
                {
                    id: 'C',
                    startDate: addDays(projectStart, 3),
                    endDate: addDays(projectStart, 7),
                    duration: 4,
                    predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
                },
                {
                    id: 'D',
                    startDate: addDays(projectStart, 7),
                    endDate: addDays(projectStart, 9),
                    duration: 2,
                    predecessors: [
                        { activityId: 'B', type: 'FS', lag: 0 },
                        { activityId: 'C', type: 'FS', lag: 0 },
                    ],
                },
            ];
            const result = (0, schedule_service_1.calculateCpm)(activities, projectStart);
            expect(result.get('A').totalFloat).toBeCloseTo(0);
            expect(result.get('B').totalFloat).toBeCloseTo(2);
            expect(result.get('C').totalFloat).toBeCloseTo(0);
            expect(result.get('D').totalFloat).toBeCloseTo(0);
        });
        it('calculates free float correctly', () => {
            const activities = [
                {
                    id: 'A',
                    startDate: projectStart,
                    endDate: addDays(projectStart, 3),
                    duration: 3,
                    predecessors: [],
                },
                {
                    id: 'B',
                    startDate: addDays(projectStart, 3),
                    endDate: addDays(projectStart, 5),
                    duration: 2,
                    predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
                },
                {
                    id: 'C',
                    startDate: addDays(projectStart, 3),
                    endDate: addDays(projectStart, 7),
                    duration: 4,
                    predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
                },
                {
                    id: 'D',
                    startDate: addDays(projectStart, 7),
                    endDate: addDays(projectStart, 9),
                    duration: 2,
                    predecessors: [
                        { activityId: 'B', type: 'FS', lag: 0 },
                        { activityId: 'C', type: 'FS', lag: 0 },
                    ],
                },
            ];
            const result = (0, schedule_service_1.calculateCpm)(activities, projectStart);
            expect(result.get('A').freeFloat).toBeCloseTo(0);
            expect(result.get('B').freeFloat).toBeCloseTo(2);
            expect(result.get('C').freeFloat).toBeCloseTo(0);
            expect(result.get('D').freeFloat).toBeCloseTo(0);
        });
        it('handles lag in predecessor relationships', () => {
            const activities = [
                {
                    id: 'A',
                    startDate: projectStart,
                    endDate: addDays(projectStart, 3),
                    duration: 3,
                    predecessors: [],
                },
                {
                    id: 'B',
                    startDate: addDays(projectStart, 5),
                    endDate: addDays(projectStart, 7),
                    duration: 2,
                    predecessors: [{ activityId: 'A', type: 'FS', lag: 2 }],
                },
            ];
            const result = (0, schedule_service_1.calculateCpm)(activities, projectStart);
            expect(sameDay(result.get('B').earlyStart, addDays(projectStart, 5))).toBe(true);
            expect(sameDay(result.get('B').earlyFinish, addDays(projectStart, 7))).toBe(true);
        });
        it('throws on cycle detection', () => {
            const activities = [
                {
                    id: 'A',
                    startDate: projectStart,
                    endDate: addDays(projectStart, 3),
                    duration: 3,
                    predecessors: [{ activityId: 'B', type: 'FS', lag: 0 }],
                },
                {
                    id: 'B',
                    startDate: addDays(projectStart, 3),
                    endDate: addDays(projectStart, 5),
                    duration: 2,
                    predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
                },
            ];
            expect(() => (0, schedule_service_1.calculateCpm)(activities, projectStart)).toThrow('Cycle detected');
        });
    });
    describe('calculateBaselineVariance', () => {
        it('returns zero variance when dates match', () => {
            const date = new Date('2026-01-01');
            const current = {
                id: 'A',
                startDate: date,
                endDate: addDays(date, 5),
                duration: 5,
            };
            const baseline = {
                id: 'A',
                startDate: date,
                endDate: addDays(date, 5),
                duration: 5,
            };
            const variance = (0, schedule_service_1.calculateBaselineVariance)(current, baseline);
            expect(variance.startVarianceDays).toBeCloseTo(0);
            expect(variance.finishVarianceDays).toBeCloseTo(0);
        });
        it('returns positive variance when current is later than baseline', () => {
            const baselineDate = new Date('2026-01-01');
            const currentDate = new Date('2026-01-03');
            const current = {
                id: 'A',
                startDate: currentDate,
                endDate: addDays(currentDate, 5),
                duration: 5,
            };
            const baseline = {
                id: 'A',
                startDate: baselineDate,
                endDate: addDays(baselineDate, 5),
                duration: 5,
            };
            const variance = (0, schedule_service_1.calculateBaselineVariance)(current, baseline);
            expect(variance.startVarianceDays).toBeCloseTo(2);
            expect(variance.finishVarianceDays).toBeCloseTo(2);
        });
    });
    describe('calculateCriticalPathImpact', () => {
        it('returns zero when duration change does not affect project end', () => {
            const projectStart = new Date('2026-01-01');
            const activities = [
                {
                    id: 'A',
                    startDate: projectStart,
                    endDate: addDays(projectStart, 3),
                    duration: 3,
                    predecessors: [],
                },
                {
                    id: 'B',
                    startDate: addDays(projectStart, 3),
                    endDate: addDays(projectStart, 5),
                    duration: 2,
                    predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
                },
                {
                    id: 'C',
                    startDate: addDays(projectStart, 3),
                    endDate: addDays(projectStart, 7),
                    duration: 4,
                    predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
                },
                {
                    id: 'D',
                    startDate: addDays(projectStart, 7),
                    endDate: addDays(projectStart, 9),
                    duration: 2,
                    predecessors: [
                        { activityId: 'B', type: 'FS', lag: 0 },
                        { activityId: 'C', type: 'FS', lag: 0 },
                    ],
                },
            ];
            // B has 2 days of float; increasing duration by 1 should not impact project end
            const impact = (0, schedule_service_1.calculateCriticalPathImpact)(activities, 'B', 3, projectStart);
            expect(impact).toBeCloseTo(0);
        });
        it('returns positive impact when critical path activity duration increases', () => {
            const projectStart = new Date('2026-01-01');
            const activities = [
                {
                    id: 'A',
                    startDate: projectStart,
                    endDate: addDays(projectStart, 3),
                    duration: 3,
                    predecessors: [],
                },
                {
                    id: 'B',
                    startDate: addDays(projectStart, 3),
                    endDate: addDays(projectStart, 5),
                    duration: 2,
                    predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
                },
                {
                    id: 'C',
                    startDate: addDays(projectStart, 3),
                    endDate: addDays(projectStart, 7),
                    duration: 4,
                    predecessors: [{ activityId: 'A', type: 'FS', lag: 0 }],
                },
                {
                    id: 'D',
                    startDate: addDays(projectStart, 7),
                    endDate: addDays(projectStart, 9),
                    duration: 2,
                    predecessors: [
                        { activityId: 'B', type: 'FS', lag: 0 },
                        { activityId: 'C', type: 'FS', lag: 0 },
                    ],
                },
            ];
            // C is critical; increasing duration by 2 should push project end by 2
            const impact = (0, schedule_service_1.calculateCriticalPathImpact)(activities, 'C', 6, projectStart);
            expect(impact).toBeCloseTo(2);
        });
    });
    describe('recalculateSchedule', () => {
        const mockProjectFindUnique = jest.fn();
        const mockScheduleActivityUpdate = jest.fn();
        const mockPrisma = {
            project: {
                findUnique: mockProjectFindUnique,
            },
            scheduleActivity: {
                update: mockScheduleActivityUpdate,
            },
        };
        beforeEach(() => {
            jest.clearAllMocks();
            (0, prisma_1.setPrismaClient)(mockPrisma);
        });
        it('updates activity CPM fields after calculation', async () => {
            const projectStart = new Date('2026-01-01');
            const activities = [
                {
                    id: 'act-1',
                    projectId: 'proj-1',
                    startDate: projectStart,
                    endDate: addDays(projectStart, 3),
                    duration: 3,
                    predecessors: null,
                    successors: null,
                },
                {
                    id: 'act-2',
                    projectId: 'proj-1',
                    startDate: addDays(projectStart, 3),
                    endDate: addDays(projectStart, 5),
                    duration: 2,
                    predecessors: [{ activityId: 'act-1', type: 'FS', lag: 0 }],
                    successors: null,
                },
            ];
            mockProjectFindUnique.mockResolvedValue({
                id: 'proj-1',
                startDate: projectStart,
                scheduleActivities: activities,
            });
            mockScheduleActivityUpdate.mockImplementation((args) => Promise.resolve({ id: args.where.id, ...args.data }));
            await (0, schedule_service_1.recalculateSchedule)('proj-1');
            expect(mockScheduleActivityUpdate).toHaveBeenCalledTimes(2);
            expect(mockScheduleActivityUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'act-1' },
                data: expect.objectContaining({
                    isCritical: true,
                    totalFloat: expect.any(Number),
                    freeFloat: expect.any(Number),
                }),
            }));
        });
        it('throws if project not found', async () => {
            mockProjectFindUnique.mockResolvedValue(null);
            await expect((0, schedule_service_1.recalculateSchedule)('proj-1')).rejects.toThrow('Project not found');
        });
        it('returns early if no activities exist', async () => {
            mockProjectFindUnique.mockResolvedValue({
                id: 'proj-1',
                startDate: new Date('2026-01-01'),
                scheduleActivities: [],
            });
            await (0, schedule_service_1.recalculateSchedule)('proj-1');
            expect(mockScheduleActivityUpdate).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=schedule.service.test.js.map