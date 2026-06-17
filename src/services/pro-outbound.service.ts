/**
 * Pro Outbound Service
 * ============================================================================
 * Sprint 14 Task 6. Sends work assignments from PM to Pro's Firebase
 * Functions `createTask` endpoint.
 *
 * Standalone rule: if FIREBASE_FUNCTIONS_URL or PM_SERVICE_TOKEN is not
 * configured, the call logs a warning and returns silently. Never throws.
 * ============================================================================
 */

export interface AssignToFieldInput {
  projectId: string;
  activityId: string;
  activityName: string;
  taskDescription: string;
}

export async function assignToField(input: AssignToFieldInput): Promise<{ taskId?: string; sent: boolean }> {
  const url = process.env.FIREBASE_FUNCTIONS_URL;
  const token = process.env.PM_SERVICE_TOKEN;

  if (!url) {
    console.warn('[pro-outbound] FIREBASE_FUNCTIONS_URL not configured; skipping assignToField');
    return { sent: false };
  }
  if (!token) {
    console.warn('[pro-outbound] PM_SERVICE_TOKEN not configured; skipping assignToField');
    return { sent: false };
  }

  const body = JSON.stringify({
    projectId: input.projectId,
    activityId: input.activityId,
    activityName: input.activityName,
    taskDescription: input.taskDescription,
    assignedAt: new Date().toISOString(),
  });

  try {
    const res = await fetch(`${url}/createTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': token,
      },
      body,
    });

    if (!res.ok) {
      console.warn(`[pro-outbound] createTask returned HTTP ${res.status}`);
      return { sent: false };
    }

    const data = (await res.json().catch(() => ({}))) as any;
    return { taskId: data?.taskId, sent: true };
  } catch (err: any) {
    console.warn('[pro-outbound] createTask failed:', err?.message || err);
    return { sent: false };
  }
}
