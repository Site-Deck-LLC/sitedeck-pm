import { Firestore } from 'firebase-admin/firestore';
import { Project } from '@prisma/client';
export declare function getFirestoreInstance(): Firestore;
export declare function setFirestoreInstance(instance: Firestore): void;
export interface FirestoreProjectData {
    project_id: string;
    project_name: string;
    status: string;
    schedule_start: Date | null;
    schedule_end: Date | null;
    active_milestones: unknown[] | null;
    superintendent_assignments: {
        userId: string;
        name: string;
    }[] | null;
    org_id: string;
    updated_at: Date;
}
export declare function replicateProjectToFirestore(project: Project): Promise<void>;
export declare function updateFirestoreProject(projectId: string, updates: Partial<FirestoreProjectData>): Promise<void>;
export declare function deleteFirestoreProject(projectId: string): Promise<void>;
//# sourceMappingURL=pro-sync.service.d.ts.map