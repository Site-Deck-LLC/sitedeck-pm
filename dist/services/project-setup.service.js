"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProjectSetup = runProjectSetup;
const project_service_1 = require("./project.service");
const pro_sync_service_1 = require("./pro-sync.service");
async function runProjectSetup(input) {
    if (!input.name || input.name.trim().length === 0) {
        throw new Error('Project name is required');
    }
    if (!input.orgId || input.orgId.trim().length === 0) {
        throw new Error('Org ID is required');
    }
    if (input.structureType !== 'WBS' && input.structureType !== 'COST_CODE') {
        throw new Error('Structure type must be WBS or COST_CODE');
    }
    if (input.startDate && input.endDate && input.endDate < input.startDate) {
        throw new Error('End date must be on or after start date');
    }
    const project = await (0, project_service_1.createProject)({
        name: input.name,
        orgId: input.orgId,
        structureType: input.structureType,
        startDate: input.startDate,
        endDate: input.endDate,
        activeMilestones: input.milestones,
        superintendentAssignments: input.superintendentAssignments,
    });
    if (input.initialWbsItems && input.initialWbsItems.length > 0) {
        for (const item of input.initialWbsItems) {
            await (0, project_service_1.addWorkBreakdownItem)(project.id, item);
        }
    }
    await (0, pro_sync_service_1.replicateProjectToFirestore)(project);
    const fullProject = await (0, project_service_1.getProjectById)(project.id);
    if (!fullProject) {
        throw new Error('Project not found after creation');
    }
    return fullProject;
}
//# sourceMappingURL=project-setup.service.js.map