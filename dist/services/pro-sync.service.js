"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFirestoreInstance = getFirestoreInstance;
exports.setFirestoreInstance = setFirestoreInstance;
exports.replicateProjectToFirestore = replicateProjectToFirestore;
exports.updateFirestoreProject = updateFirestoreProject;
exports.deleteFirestoreProject = deleteFirestoreProject;
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
let firestoreInstance = null;
function getFirestoreInstance() {
    if (!firestoreInstance) {
        if ((0, app_1.getApps)().length === 0) {
            (0, app_1.initializeApp)();
        }
        firestoreInstance = (0, firestore_1.getFirestore)();
    }
    return firestoreInstance;
}
function setFirestoreInstance(instance) {
    firestoreInstance = instance;
}
async function replicateProjectToFirestore(project) {
    const db = getFirestoreInstance();
    try {
        const data = {
            project_id: project.id,
            project_name: project.name,
            status: project.status,
            schedule_start: project.startDate ?? null,
            schedule_end: project.endDate ?? null,
            active_milestones: project.activeMilestones ?? null,
            superintendent_assignments: project.superintendentAssignments ?? null,
            org_id: project.orgId,
            updated_at: project.updatedAt,
            latitude: project.latitude ?? null,
            longitude: project.longitude ?? null,
            city: project.city ?? null,
            state: project.state ?? null,
        };
        await db.collection('projects').doc(project.id).set(data);
    }
    catch (err) {
        console.error('Failed to replicate project to Firestore:', err);
    }
}
async function updateFirestoreProject(projectId, updates) {
    const db = getFirestoreInstance();
    try {
        const payload = { ...updates };
        if (!payload.updated_at) {
            payload.updated_at = new Date();
        }
        await db.collection('projects').doc(projectId).update(payload);
    }
    catch (err) {
        console.error('Failed to update Firestore project:', err);
    }
}
async function deleteFirestoreProject(projectId) {
    const db = getFirestoreInstance();
    try {
        await db.collection('projects').doc(projectId).delete();
    }
    catch (err) {
        console.error('Failed to delete Firestore project:', err);
    }
}
//# sourceMappingURL=pro-sync.service.js.map