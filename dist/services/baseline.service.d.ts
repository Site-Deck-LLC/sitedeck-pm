import { Prisma } from '@prisma/client';
import { Role } from '../constants/roles';
export declare function createBaseline(projectId: string, name: string, createdBy: string): Promise<{
    id: string;
    createdAt: Date;
    name: string;
    projectId: string;
    createdBy: string;
    locked: boolean;
    baselineDate: Date;
    activities: Prisma.JsonValue;
}>;
export declare function lockBaseline(baselineId: string): Promise<{
    id: string;
    createdAt: Date;
    name: string;
    projectId: string;
    createdBy: string;
    locked: boolean;
    baselineDate: Date;
    activities: Prisma.JsonValue;
}>;
export declare function getBaselineById(id: string): Promise<{
    id: string;
    createdAt: Date;
    name: string;
    projectId: string;
    createdBy: string;
    locked: boolean;
    baselineDate: Date;
    activities: Prisma.JsonValue;
} | null>;
export declare function getBaselinesByProject(projectId: string): Promise<{
    id: string;
    createdAt: Date;
    name: string;
    projectId: string;
    createdBy: string;
    locked: boolean;
    baselineDate: Date;
    activities: Prisma.JsonValue;
}[]>;
export declare function compareToBaseline(projectId: string, baselineId: string): Promise<{
    activityId: string;
    activityName: string;
    baselineStart: Date;
    currentStart: Date;
    startVarianceDays: number;
    baselineFinish: Date;
    currentFinish: Date;
    finishVarianceDays: number;
}[]>;
export declare function canRebaseline(_projectId: string, userRole: Role, _justification?: string): boolean;
//# sourceMappingURL=baseline.service.d.ts.map