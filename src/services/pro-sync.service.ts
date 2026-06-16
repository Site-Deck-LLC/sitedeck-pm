import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { Project } from '@prisma/client';

let firestoreInstance: Firestore | null = null;

export function getFirestoreInstance(): Firestore {
  if (!firestoreInstance) {
    if (getApps().length === 0) {
      initializeApp();
    }
    firestoreInstance = getFirestore();
  }
  return firestoreInstance;
}

export function setFirestoreInstance(instance: Firestore): void {
  firestoreInstance = instance;
}

export interface FirestoreProjectData {
  project_id: string;
  project_name: string;
  status: string;
  schedule_start: Date | null;
  schedule_end: Date | null;
  active_milestones: unknown[] | null;
  superintendent_assignments: { userId: string; name: string }[] | null;
  org_id: string;
  updated_at: Date;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
}

export async function replicateProjectToFirestore(project: Project): Promise<void> {
  const db = getFirestoreInstance();
  try {
    const data: FirestoreProjectData = {
      project_id: project.id,
      project_name: project.name,
      status: project.status,
      schedule_start: project.startDate ?? null,
      schedule_end: project.endDate ?? null,
      active_milestones: (project.activeMilestones as unknown[] | null) ?? null,
      superintendent_assignments:
        (project.superintendentAssignments as { userId: string; name: string }[] | null) ?? null,
      org_id: project.orgId,
      updated_at: project.updatedAt,
      latitude: project.latitude ?? null,
      longitude: project.longitude ?? null,
      city: project.city ?? null,
      state: project.state ?? null,
    };
    await db.collection('projects').doc(project.id).set(data);
  } catch (err) {
    console.error('Failed to replicate project to Firestore:', err);
  }
}

export async function updateFirestoreProject(
  projectId: string,
  updates: Partial<FirestoreProjectData>
): Promise<void> {
  const db = getFirestoreInstance();
  try {
    const payload: Record<string, unknown> = { ...updates };
    if (!payload.updated_at) {
      payload.updated_at = new Date();
    }
    await db.collection('projects').doc(projectId).update(payload);
  } catch (err) {
    console.error('Failed to update Firestore project:', err);
  }
}

export async function deleteFirestoreProject(projectId: string): Promise<void> {
  const db = getFirestoreInstance();
  try {
    await db.collection('projects').doc(projectId).delete();
  } catch (err) {
    console.error('Failed to delete Firestore project:', err);
  }
}
