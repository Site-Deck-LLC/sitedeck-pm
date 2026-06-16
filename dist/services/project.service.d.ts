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
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
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
    latitude?: number | null;
    longitude?: number | null;
    city?: string | null;
    state?: string | null;
}
export interface WbsItemInput {
    code: string;
    name: string;
    parentId?: string;
    level?: number;
}
export declare function createProject(data: CreateProjectInput): Promise<{
    orgId: string;
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    updatedAt: Date;
    structureType: string;
    structureLocked: boolean;
    startDate: Date | null;
    endDate: Date | null;
    activeMilestones: Prisma.JsonValue | null;
    superintendentAssignments: Prisma.JsonValue | null;
    contractValue: Prisma.Decimal | null;
    trirTarget: number | null;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    state: string | null;
}>;
export declare function getProjectById(id: string): Promise<({
    workBreakdownItems: {
        id: string;
        createdAt: Date;
        name: string;
        projectId: string;
        updatedAt: Date;
        structureType: string;
        code: string;
        parentId: string | null;
        level: number;
    }[];
} & {
    orgId: string;
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    updatedAt: Date;
    structureType: string;
    structureLocked: boolean;
    startDate: Date | null;
    endDate: Date | null;
    activeMilestones: Prisma.JsonValue | null;
    superintendentAssignments: Prisma.JsonValue | null;
    contractValue: Prisma.Decimal | null;
    trirTarget: number | null;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    state: string | null;
}) | null>;
export declare function listProjects(): Promise<{
    orgId: string;
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    updatedAt: Date;
    structureType: string;
    structureLocked: boolean;
    startDate: Date | null;
    endDate: Date | null;
    activeMilestones: Prisma.JsonValue | null;
    superintendentAssignments: Prisma.JsonValue | null;
    contractValue: Prisma.Decimal | null;
    trirTarget: number | null;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    state: string | null;
}[]>;
export declare function updateProject(id: string, data: UpdateProjectInput): Promise<{
    orgId: string;
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    updatedAt: Date;
    structureType: string;
    structureLocked: boolean;
    startDate: Date | null;
    endDate: Date | null;
    activeMilestones: Prisma.JsonValue | null;
    superintendentAssignments: Prisma.JsonValue | null;
    contractValue: Prisma.Decimal | null;
    trirTarget: number | null;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    state: string | null;
}>;
export declare function lockProjectStructure(id: string): Promise<{
    orgId: string;
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    updatedAt: Date;
    structureType: string;
    structureLocked: boolean;
    startDate: Date | null;
    endDate: Date | null;
    activeMilestones: Prisma.JsonValue | null;
    superintendentAssignments: Prisma.JsonValue | null;
    contractValue: Prisma.Decimal | null;
    trirTarget: number | null;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    state: string | null;
}>;
export declare function addWorkBreakdownItem(projectId: string, item: WbsItemInput): Promise<{
    id: string;
    createdAt: Date;
    name: string;
    projectId: string;
    updatedAt: Date;
    structureType: string;
    code: string;
    parentId: string | null;
    level: number;
}>;
export declare function deleteProject(id: string): Promise<{
    orgId: string;
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    updatedAt: Date;
    structureType: string;
    structureLocked: boolean;
    startDate: Date | null;
    endDate: Date | null;
    activeMilestones: Prisma.JsonValue | null;
    superintendentAssignments: Prisma.JsonValue | null;
    contractValue: Prisma.Decimal | null;
    trirTarget: number | null;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    state: string | null;
}>;
export declare function setProjectOrgBridge(id: string, orgId: string): Promise<{
    orgId: string;
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    updatedAt: Date;
    structureType: string;
    structureLocked: boolean;
    startDate: Date | null;
    endDate: Date | null;
    activeMilestones: Prisma.JsonValue | null;
    superintendentAssignments: Prisma.JsonValue | null;
    contractValue: Prisma.Decimal | null;
    trirTarget: number | null;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    state: string | null;
}>;
export interface ProjectMapItem {
    id: string;
    name: string;
    status: string;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    state: string | null;
    health: 'green' | 'amber' | 'red';
    cpi: number;
    spi: number;
    openItems: number;
    computedStatus: 'green' | 'amber' | 'red';
}
export declare function getProjectMapData(): Promise<ProjectMapItem[]>;
//# sourceMappingURL=project.service.d.ts.map