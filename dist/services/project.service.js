"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProject = createProject;
exports.getProjectById = getProjectById;
exports.listProjects = listProjects;
exports.updateProject = updateProject;
exports.lockProjectStructure = lockProjectStructure;
exports.addWorkBreakdownItem = addWorkBreakdownItem;
exports.deleteProject = deleteProject;
exports.setProjectOrgBridge = setProjectOrgBridge;
const prisma_1 = require("../lib/prisma");
const status_1 = require("../constants/status");
async function createProject(data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.project.create({
        data: {
            name: data.name,
            orgId: data.orgId,
            structureType: data.structureType,
            startDate: data.startDate,
            endDate: data.endDate,
            activeMilestones: data.activeMilestones,
            superintendentAssignments: data.superintendentAssignments,
        },
    });
}
async function getProjectById(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.project.findUnique({
        where: { id },
        include: { workBreakdownItems: true },
    });
}
async function listProjects() {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
    });
}
async function updateProject(id, data) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.project.update({
        where: { id },
        data: {
            name: data.name,
            status: data.status,
            startDate: data.startDate,
            endDate: data.endDate,
            activeMilestones: data.activeMilestones,
            superintendentAssignments: data.superintendentAssignments,
        },
    });
}
async function lockProjectStructure(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
        throw new Error('Project not found');
    }
    if (project.structureLocked) {
        return project;
    }
    return prisma.project.update({
        where: { id },
        data: { structureLocked: true },
    });
}
async function addWorkBreakdownItem(projectId, item) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
        throw new Error('Project not found');
    }
    if (!project.structureType) {
        throw new Error('Project structure type must be set before adding work breakdown items');
    }
    const existingItems = await prisma.workBreakdownItem.count({
        where: { projectId },
    });
    const createdItem = await prisma.workBreakdownItem.create({
        data: {
            projectId,
            structureType: project.structureType,
            code: item.code,
            name: item.name,
            parentId: item.parentId,
            level: item.level ?? 1,
        },
    });
    if (existingItems === 0) {
        await prisma.project.update({
            where: { id: projectId },
            data: { structureLocked: true },
        });
    }
    return createdItem;
}
async function deleteProject(id) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.project.update({
        where: { id },
        data: { status: status_1.PROJECT_STATUSES.CANCELLED },
    });
}
async function setProjectOrgBridge(id, orgId) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.project.update({
        where: { id },
        data: { orgId },
    });
}
//# sourceMappingURL=project.service.js.map