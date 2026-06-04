import { WbsItemInput } from './project.service';
import { Project, WorkBreakdownItem } from '@prisma/client';
export interface SetupWizardInput {
    name: string;
    orgId: string;
    structureType: 'WBS' | 'COST_CODE';
    startDate?: Date;
    endDate?: Date;
    milestones?: unknown[];
    superintendentAssignments?: {
        userId: string;
        name: string;
    }[];
    initialWbsItems?: WbsItemInput[];
}
export declare function runProjectSetup(input: SetupWizardInput): Promise<Project & {
    workBreakdownItems: WorkBreakdownItem[];
}>;
//# sourceMappingURL=project-setup.service.d.ts.map