import { Prisma } from '@prisma/client';
import { ProjectStatus } from '../constants/status';
export interface CreateProjectInput {
    name: string;
    orgId: string;
    structureType: 'WBS' | 'COST_CODE';
    startDate?: Date;
    endDate?: Date;
    activeMilestones?: unknown[];
    superintendentAssignments?: {
        userId: string;
        name: string;
    }[];
}
export interface UpdateProjectInput {
    name?: string;
    status?: ProjectStatus;
    startDate?: Date | null;
    endDate?: Date | null;
    activeMilestones?: unknown[];
    superintendentAssignments?: {
        userId: string;
        name: string;
    }[];
}
export interface WbsItemInput {
    code: string;
    name: string;
    parentId?: string;
    level?: number;
}
export declare function createProject(data: CreateProjectInput): Promise<{
    id: string;
    name: string;
    status: string;
    orgId: string;
    structureType: string;
    structureLocked: boolean;
    startDate: Date | null;
    endDate: Date | null;
    activeMilestones: Prisma.JsonValue | null;
    superintendentAssignments: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function getProjectById(id: string): Promise<({
    workBreakdownItems: {
        id: string;
        name: string;
        structureType: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        code: string;
        parentId: string | null;
        level: number;
    }[];
} & {
    id: string;
    name: string;
    status: string;
    orgId: string;
    structureType: string;
    structureLocked: boolean;
    startDate: Date | null;
    endDate: Date | null;
    activeMilestones: Prisma.JsonValue | null;
    superintendentAssignments: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
}) | null>;
export declare function updateProject(id: string, data: UpdateProjectInput): Promise<{
    id: string;
    name: string;
    status: string;
    orgId: string;
    structureType: string;
    structureLocked: boolean;
    startDate: Date | null;
    endDate: Date | null;
    activeMilestones: Prisma.JsonValue | null;
    superintendentAssignments: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function lockProjectStructure(id: string): Promise<{
    id: string;
    name: string;
    status: string;
    orgId: string;
    structureType: string;
    structureLocked: boolean;
    startDate: Date | null;
    endDate: Date | null;
    activeMilestones: Prisma.JsonValue | null;
    superintendentAssignments: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function addWorkBreakdownItem(projectId: string, item: WbsItemInput): Promise<{
    id: string;
    name: string;
    structureType: string;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    code: string;
    parentId: string | null;
    level: number;
}>;
export declare function deleteProject(id: string): Promise<{
    id: string;
    name: string;
    status: string;
    orgId: string;
    structureType: string;
    structureLocked: boolean;
    startDate: Date | null;
    endDate: Date | null;
    activeMilestones: Prisma.JsonValue | null;
    superintendentAssignments: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function setProjectOrgBridge(id: string, orgId: string): Promise<{
    id: string;
    name: string;
    status: string;
    orgId: string;
    structureType: string;
    structureLocked: boolean;
    startDate: Date | null;
    endDate: Date | null;
    activeMilestones: Prisma.JsonValue | null;
    superintendentAssignments: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
}>;
//# sourceMappingURL=project.service.d.ts.map