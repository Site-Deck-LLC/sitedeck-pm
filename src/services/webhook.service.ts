import { getPrismaClient } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { markActivityComplete } from './activity.service';
import { recordMaterialDelivery } from './procurement.service';
import { createCostTransaction } from './cost.service';
import { autoCreateRiskFromSafetyIncident } from './risk.service';
import { createIssue } from './integration.service';
import { createChangeRequest } from './change-request.service';
import { upsertEquipment, recordEquipmentUsage } from './resource.service';
import { INBOUND_EVENTS, OUTBOUND_EVENTS } from '../constants/webhook-events';

async function logWebhookEvent(
  event: string,
  direction: 'inbound' | 'outbound',
  payload: Record<string, unknown>,
  status: string,
  retryCount = 0
) {
  const prisma = getPrismaClient();
  return prisma.webhooksLog.create({
    data: {
      event,
      direction,
      payload: payload as unknown as Prisma.InputJsonValue,
      status,
      retryCount,
    },
  });
}

async function isDuplicateEvent(
  event: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const prisma = getPrismaClient();
  const eventId = payload.eventId as string | undefined;
  const referenceId = payload.referenceId as string | undefined;

  if (!eventId && !referenceId) {
    return false;
  }

  const existing = await prisma.webhooksLog.findFirst({
    where: {
      event,
      direction: 'inbound',
      OR: [
        ...(eventId
          ? [
              {
                payload: {
                  path: ['eventId'],
                  equals: eventId,
                } as Record<string, unknown>,
              },
            ]
          : []),
        ...(referenceId
          ? [
              {
                payload: {
                  path: ['referenceId'],
                  equals: referenceId,
                } as Record<string, unknown>,
              },
            ]
          : []),
      ],
    },
  });

  return !!existing;
}

interface WebhookResult {
  success: boolean;
  message: string;
}

// Inbound handlers

export async function handleTaskCompleted(
  payload: Record<string, unknown>
): Promise<WebhookResult> {
  const event = INBOUND_EVENTS.TASK_COMPLETED;
  try {
    if (await isDuplicateEvent(event, payload)) {
      await logWebhookEvent(event, 'inbound', payload, 'duplicate');
      return { success: true, message: 'Duplicate event ignored' };
    }

    const projectId = payload.project_id as string;
    const activityId = payload.activity_id as string;
    const completedBy = payload.completed_by as string;
    const completedAt = payload.completed_at
      ? new Date(payload.completed_at as string)
      : new Date();

    if (!activityId) {
      await logWebhookEvent(event, 'inbound', payload, 'failed');
      return { success: false, message: 'Missing activity_id' };
    }

    await markActivityComplete(activityId, completedBy, completedAt);
    await logWebhookEvent(event, 'inbound', payload, 'processed');
    return { success: true, message: 'Activity marked complete' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logWebhookEvent(event, 'inbound', payload, 'failed');
    return { success: false, message };
  }
}

export async function handleMaterialReceived(
  payload: Record<string, unknown>
): Promise<WebhookResult> {
  const event = INBOUND_EVENTS.MATERIAL_RECEIVED;
  try {
    if (await isDuplicateEvent(event, payload)) {
      await logWebhookEvent(event, 'inbound', payload, 'duplicate');
      return { success: true, message: 'Duplicate event ignored' };
    }

    const projectId = payload.project_id as string;
    const poId = payload.po_id as string;
    const lineItemsReceived = payload.line_items_received as
      | { line_item_id: string; quantity_received: number }[]
      | undefined;
    const receivedBy = payload.receiver_id as string;
    const receivedAt = payload.received_at
      ? new Date(payload.received_at as string)
      : new Date();
    const discrepancies = payload.discrepancies as string | undefined;
    const deliveryReference = payload.referenceId as string | undefined;

    if (!poId || !lineItemsReceived || lineItemsReceived.length === 0) {
      await logWebhookEvent(event, 'inbound', payload, 'failed');
      return { success: false, message: 'Missing po_id or line_items_received' };
    }

    for (const item of lineItemsReceived) {
      await recordMaterialDelivery({
        projectId,
        poId,
        lineItemId: item.line_item_id,
        quantityReceived: item.quantity_received,
        receivedBy,
        receivedAt,
        discrepancies,
        deliveryReference,
      });
    }

    await logWebhookEvent(event, 'inbound', payload, 'processed');
    return { success: true, message: 'Material delivery recorded' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logWebhookEvent(event, 'inbound', payload, 'failed');
    return { success: false, message };
  }
}

export async function handleLaborHoursLogged(
  payload: Record<string, unknown>
): Promise<WebhookResult> {
  const event = INBOUND_EVENTS.LABOR_HOURS_LOGGED;
  try {
    if (await isDuplicateEvent(event, payload)) {
      await logWebhookEvent(event, 'inbound', payload, 'duplicate');
      return { success: true, message: 'Duplicate event ignored' };
    }

    const projectId = payload.project_id as string;
    const budgetLineId = payload.cost_code as string;
    const hours = payload.hours as number;
    const date = payload.date ? new Date(payload.date as string) : new Date();
    const referenceId = (payload.eventId as string) || (payload.referenceId as string);

    if (!budgetLineId || hours === undefined) {
      await logWebhookEvent(event, 'inbound', payload, 'failed');
      return { success: false, message: 'Missing cost_code or hours' };
    }

    await createCostTransaction({
      projectId,
      budgetLineId,
      type: 'incurred',
      source: 'labor_webhook',
      amount: hours,
      transactionDate: date,
      referenceId,
    });

    await logWebhookEvent(event, 'inbound', payload, 'processed');
    return { success: true, message: 'Labor hours logged' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logWebhookEvent(event, 'inbound', payload, 'failed');
    return { success: false, message };
  }
}

export async function handleEquipmentUsageLogged(
  payload: Record<string, unknown>
): Promise<WebhookResult> {
  const event = INBOUND_EVENTS.EQUIPMENT_USAGE_LOGGED;
  try {
    if (await isDuplicateEvent(event, payload)) {
      await logWebhookEvent(event, 'inbound', payload, 'duplicate');
      return { success: true, message: 'Duplicate event ignored' };
    }

    const projectId = payload.project_id as string;
    const budgetLineId = payload.equipment_id as string;
    const hoursOnSite = payload.hours_on_site as number;
    const date = payload.date ? new Date(payload.date as string) : new Date();
    const referenceId = (payload.eventId as string) || (payload.referenceId as string);

    if (!budgetLineId || hoursOnSite === undefined) {
      await logWebhookEvent(event, 'inbound', payload, 'failed');
      return { success: false, message: 'Missing equipment_id or hours_on_site' };
    }

    await createCostTransaction({
      projectId,
      budgetLineId,
      type: 'incurred',
      source: 'equipment_webhook',
      amount: hoursOnSite,
      transactionDate: date,
      referenceId,
    });

    try {
      await upsertEquipment({
        projectId,
        externalId: budgetLineId,
        name: (payload.equipment_name as string) || budgetLineId,
      });
      await recordEquipmentUsage({
        projectId,
        externalId: budgetLineId,
        hours: hoursOnSite,
        date,
      });
    } catch {
      // Best-effort equipment registry update. Cost transaction is the source of truth.
    }

    await logWebhookEvent(event, 'inbound', payload, 'processed');
    return { success: true, message: 'Equipment usage logged' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logWebhookEvent(event, 'inbound', payload, 'failed');
    return { success: false, message };
  }
}

export async function handleSafetyIncident(
  payload: Record<string, unknown>
): Promise<WebhookResult> {
  const event = INBOUND_EVENTS.SAFETY_INCIDENT;
  try {
    if (await isDuplicateEvent(event, payload)) {
      await logWebhookEvent(event, 'inbound', payload, 'duplicate');
      return { success: true, message: 'Duplicate event ignored' };
    }

    const projectId = payload.project_id as string;
    const incidentType = payload.incident_type as string;
    const severity = payload.severity as number;
    const recordable = payload.recordable as boolean;
    const description = payload.description as string | undefined;
    const incidentReference =
      (payload.eventId as string) || (payload.referenceId as string) || `safety-${Date.now()}`;

    if (!projectId || incidentType === undefined || severity === undefined) {
      await logWebhookEvent(event, 'inbound', payload, 'failed');
      return { success: false, message: 'Missing required fields' };
    }

    await autoCreateRiskFromSafetyIncident(
      projectId,
      {
        incidentType,
        severity,
        recordable: !!recordable,
        description: description || '',
      },
      incidentReference
    );

    await logWebhookEvent(event, 'inbound', payload, 'processed');
    return { success: true, message: 'Risk item created from safety incident' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logWebhookEvent(event, 'inbound', payload, 'failed');
    return { success: false, message };
  }
}

export async function handleFieldIssueLogged(
  payload: Record<string, unknown>
): Promise<WebhookResult> {
  const event = INBOUND_EVENTS.FIELD_ISSUE_LOGGED;
  try {
    if (await isDuplicateEvent(event, payload)) {
      await logWebhookEvent(event, 'inbound', payload, 'duplicate');
      return { success: true, message: 'Duplicate event ignored' };
    }

    const projectId = payload.project_id as string;
    const description = payload.description as string;
    const reporterId = payload.reporter_id as string;
    const activityId = payload.activity_id as string | undefined;

    if (!projectId || !description) {
      await logWebhookEvent(event, 'inbound', payload, 'failed');
      return { success: false, message: 'Missing project_id or description' };
    }

    await createIssue({
      projectId,
      type: 'field_issue',
      source: 'pro_webhook',
      title: `Field issue: ${description.slice(0, 80)}`,
      description,
      activityId,
      createdBy: reporterId || 'pro_system',
    });

    await logWebhookEvent(event, 'inbound', payload, 'processed');
    return { success: true, message: 'Field issue logged' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logWebhookEvent(event, 'inbound', payload, 'failed');
    return { success: false, message };
  }
}

export async function handleScheduleChangeRequested(
  payload: Record<string, unknown>
): Promise<WebhookResult> {
  const event = INBOUND_EVENTS.SCHEDULE_CHANGE_REQUESTED;
  try {
    if (await isDuplicateEvent(event, payload)) {
      await logWebhookEvent(event, 'inbound', payload, 'duplicate');
      return { success: true, message: 'Duplicate event ignored' };
    }

    const projectId = payload.project_id as string;
    const activityId = payload.activity_id as string;
    const reasonCode = payload.reason_code as string;
    const proposedDates = payload.proposed_dates as
      | { start_date?: string; end_date?: string }
      | undefined;
    const impactDescription = payload.impact_description as string | undefined;
    const requestedBy = payload.requested_by as string | undefined;

    if (!projectId || !activityId || !reasonCode) {
      await logWebhookEvent(event, 'inbound', payload, 'failed');
      return { success: false, message: 'Missing required fields' };
    }

    await createChangeRequest({
      projectId,
      activityId,
      requestedBy: requestedBy || 'pro_system',
      reasonCode,
      proposedStart: proposedDates?.start_date
        ? new Date(proposedDates.start_date)
        : undefined,
      proposedEnd: proposedDates?.end_date
        ? new Date(proposedDates.end_date)
        : undefined,
      impactDescription,
    });

    await logWebhookEvent(event, 'inbound', payload, 'processed');
    return { success: true, message: 'Schedule change request created' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logWebhookEvent(event, 'inbound', payload, 'failed');
    return { success: false, message };
  }
}

// Outbound stubs

export async function sendActivityReady(
  projectId: string,
  activityId: string
): Promise<WebhookResult> {
  const event = OUTBOUND_EVENTS.ACTIVITY_READY;
  const payload = { project_id: projectId, activity_id: activityId };
  await logWebhookEvent(event, 'outbound', payload, 'pending');
  return { success: true, message: 'Outbound event logged' };
}

export async function sendMaterialNeeded(
  projectId: string,
  poId: string,
  materialName: string,
  quantity: number,
  neededByDate: Date,
  activityId?: string
): Promise<WebhookResult> {
  const event = OUTBOUND_EVENTS.MATERIAL_NEEDED;
  const payload = {
    project_id: projectId,
    po_id: poId,
    material_name: materialName,
    quantity,
    needed_by_date: neededByDate.toISOString(),
    activity_id: activityId,
  };
  await logWebhookEvent(event, 'outbound', payload, 'pending');
  return { success: true, message: 'Outbound event logged' };
}

export async function sendRfiStatusUpdated(
  projectId: string,
  rfiNumber: string,
  status: string,
  responseText?: string,
  holdOnActivityId?: string
): Promise<WebhookResult> {
  const event = OUTBOUND_EVENTS.RFI_STATUS_UPDATED;
  const payload = {
    project_id: projectId,
    rfi_number: rfiNumber,
    status,
    response_text: responseText,
    hold_on_activity_id: holdOnActivityId,
  };
  await logWebhookEvent(event, 'outbound', payload, 'pending');
  return { success: true, message: 'Outbound event logged' };
}

export async function sendSubmittalStatusUpdated(
  projectId: string,
  submittalId: string,
  approvalStatus: string,
  holdOnActivityId?: string
): Promise<WebhookResult> {
  const event = OUTBOUND_EVENTS.SUBMITTAL_STATUS_UPDATED;
  const payload = {
    project_id: projectId,
    submittal_id: submittalId,
    approval_status: approvalStatus,
    hold_on_activity_id: holdOnActivityId,
  };
  await logWebhookEvent(event, 'outbound', payload, 'pending');
  return { success: true, message: 'Outbound event logged' };
}

export async function sendScheduleChangeDecided(
  projectId: string,
  requestId: string,
  decision: string,
  notes?: string,
  newDates?: { startDate?: Date; endDate?: Date }
): Promise<WebhookResult> {
  const event = OUTBOUND_EVENTS.SCHEDULE_CHANGE_DECIDED;
  const payload = {
    project_id: projectId,
    request_id: requestId,
    decision,
    notes,
    new_dates: {
      start_date: newDates?.startDate?.toISOString(),
      end_date: newDates?.endDate?.toISOString(),
    },
  };
  await logWebhookEvent(event, 'outbound', payload, 'pending');
  return { success: true, message: 'Outbound event logged' };
}
