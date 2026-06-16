"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTaskCompleted = handleTaskCompleted;
exports.handleMaterialReceived = handleMaterialReceived;
exports.handleLaborHoursLogged = handleLaborHoursLogged;
exports.handleEquipmentUsageLogged = handleEquipmentUsageLogged;
exports.handleSafetyIncident = handleSafetyIncident;
exports.handleFieldIssueLogged = handleFieldIssueLogged;
exports.handleScheduleChangeRequested = handleScheduleChangeRequested;
exports.handleAttendanceUpdated = handleAttendanceUpdated;
exports.handleEquipmentStatusUpdated = handleEquipmentStatusUpdated;
exports.sendActivityReady = sendActivityReady;
exports.sendMaterialNeeded = sendMaterialNeeded;
exports.sendRfiStatusUpdated = sendRfiStatusUpdated;
exports.sendSubmittalStatusUpdated = sendSubmittalStatusUpdated;
exports.sendScheduleChangeDecided = sendScheduleChangeDecided;
const prisma_1 = require("../lib/prisma");
const activity_service_1 = require("./activity.service");
const procurement_service_1 = require("./procurement.service");
const cost_service_1 = require("./cost.service");
const risk_service_1 = require("./risk.service");
const integration_service_1 = require("./integration.service");
const change_request_service_1 = require("./change-request.service");
const resource_service_1 = require("./resource.service");
const webhook_events_1 = require("../constants/webhook-events");
async function logWebhookEvent(event, direction, payload, status, retryCount = 0) {
    const prisma = (0, prisma_1.getPrismaClient)();
    return prisma.webhooksLog.create({
        data: {
            event,
            direction,
            payload: payload,
            status,
            retryCount,
        },
    });
}
async function isDuplicateEvent(event, payload) {
    const prisma = (0, prisma_1.getPrismaClient)();
    const eventId = payload.eventId;
    const referenceId = payload.referenceId;
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
                            },
                        },
                    ]
                    : []),
                ...(referenceId
                    ? [
                        {
                            payload: {
                                path: ['referenceId'],
                                equals: referenceId,
                            },
                        },
                    ]
                    : []),
            ],
        },
    });
    return !!existing;
}
// Inbound handlers
async function handleTaskCompleted(payload) {
    const event = webhook_events_1.INBOUND_EVENTS.TASK_COMPLETED;
    try {
        if (await isDuplicateEvent(event, payload)) {
            await logWebhookEvent(event, 'inbound', payload, 'duplicate');
            return { success: true, message: 'Duplicate event ignored' };
        }
        const projectId = payload.project_id;
        const activityId = payload.activity_id;
        const completedBy = payload.completed_by;
        const completedAt = payload.completed_at
            ? new Date(payload.completed_at)
            : new Date();
        if (!activityId) {
            await logWebhookEvent(event, 'inbound', payload, 'failed');
            return { success: false, message: 'Missing activity_id' };
        }
        await (0, activity_service_1.markActivityComplete)(activityId, completedBy, completedAt);
        await logWebhookEvent(event, 'inbound', payload, 'processed');
        return { success: true, message: 'Activity marked complete' };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await logWebhookEvent(event, 'inbound', payload, 'failed');
        return { success: false, message };
    }
}
async function handleMaterialReceived(payload) {
    const event = webhook_events_1.INBOUND_EVENTS.MATERIAL_RECEIVED;
    try {
        if (await isDuplicateEvent(event, payload)) {
            await logWebhookEvent(event, 'inbound', payload, 'duplicate');
            return { success: true, message: 'Duplicate event ignored' };
        }
        const projectId = payload.project_id;
        const poId = payload.po_id;
        const lineItemsReceived = payload.line_items_received;
        const receivedBy = payload.receiver_id;
        const receivedAt = payload.received_at
            ? new Date(payload.received_at)
            : new Date();
        const discrepancies = payload.discrepancies;
        const deliveryReference = payload.referenceId;
        if (!poId || !lineItemsReceived || lineItemsReceived.length === 0) {
            await logWebhookEvent(event, 'inbound', payload, 'failed');
            return { success: false, message: 'Missing po_id or line_items_received' };
        }
        for (const item of lineItemsReceived) {
            await (0, procurement_service_1.recordMaterialDelivery)({
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await logWebhookEvent(event, 'inbound', payload, 'failed');
        return { success: false, message };
    }
}
async function handleLaborHoursLogged(payload) {
    const event = webhook_events_1.INBOUND_EVENTS.LABOR_HOURS_LOGGED;
    try {
        if (await isDuplicateEvent(event, payload)) {
            await logWebhookEvent(event, 'inbound', payload, 'duplicate');
            return { success: true, message: 'Duplicate event ignored' };
        }
        const projectId = payload.project_id;
        const budgetLineId = payload.cost_code;
        const hours = payload.hours;
        const date = payload.date ? new Date(payload.date) : new Date();
        const referenceId = payload.eventId || payload.referenceId;
        if (!budgetLineId || hours === undefined) {
            await logWebhookEvent(event, 'inbound', payload, 'failed');
            return { success: false, message: 'Missing cost_code or hours' };
        }
        await (0, cost_service_1.createCostTransaction)({
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await logWebhookEvent(event, 'inbound', payload, 'failed');
        return { success: false, message };
    }
}
async function handleEquipmentUsageLogged(payload) {
    const event = webhook_events_1.INBOUND_EVENTS.EQUIPMENT_USAGE_LOGGED;
    try {
        if (await isDuplicateEvent(event, payload)) {
            await logWebhookEvent(event, 'inbound', payload, 'duplicate');
            return { success: true, message: 'Duplicate event ignored' };
        }
        const projectId = payload.project_id;
        const budgetLineId = payload.equipment_id;
        const hoursOnSite = payload.hours_on_site;
        const date = payload.date ? new Date(payload.date) : new Date();
        const referenceId = payload.eventId || payload.referenceId;
        if (!budgetLineId || hoursOnSite === undefined) {
            await logWebhookEvent(event, 'inbound', payload, 'failed');
            return { success: false, message: 'Missing equipment_id or hours_on_site' };
        }
        await (0, cost_service_1.createCostTransaction)({
            projectId,
            budgetLineId,
            type: 'incurred',
            source: 'equipment_webhook',
            amount: hoursOnSite,
            transactionDate: date,
            referenceId,
        });
        try {
            await (0, resource_service_1.upsertEquipment)({
                projectId,
                externalId: budgetLineId,
                name: payload.equipment_name || budgetLineId,
            });
            await (0, resource_service_1.recordEquipmentUsage)({
                projectId,
                externalId: budgetLineId,
                hours: hoursOnSite,
                date,
            });
        }
        catch {
            // Best-effort equipment registry update. Cost transaction is the source of truth.
        }
        await logWebhookEvent(event, 'inbound', payload, 'processed');
        return { success: true, message: 'Equipment usage logged' };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await logWebhookEvent(event, 'inbound', payload, 'failed');
        return { success: false, message };
    }
}
async function handleSafetyIncident(payload) {
    const event = webhook_events_1.INBOUND_EVENTS.SAFETY_INCIDENT;
    try {
        if (await isDuplicateEvent(event, payload)) {
            await logWebhookEvent(event, 'inbound', payload, 'duplicate');
            return { success: true, message: 'Duplicate event ignored' };
        }
        const projectId = payload.project_id;
        const incidentType = payload.incident_type;
        const severity = payload.severity;
        const recordable = payload.recordable;
        const description = payload.description;
        const incidentReference = payload.eventId || payload.referenceId || `safety-${Date.now()}`;
        if (!projectId || incidentType === undefined || severity === undefined) {
            await logWebhookEvent(event, 'inbound', payload, 'failed');
            return { success: false, message: 'Missing required fields' };
        }
        await (0, risk_service_1.autoCreateRiskFromSafetyIncident)(projectId, {
            incidentType,
            severity,
            recordable: !!recordable,
            description: description || '',
        }, incidentReference);
        await logWebhookEvent(event, 'inbound', payload, 'processed');
        return { success: true, message: 'Risk item created from safety incident' };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await logWebhookEvent(event, 'inbound', payload, 'failed');
        return { success: false, message };
    }
}
async function handleFieldIssueLogged(payload) {
    const event = webhook_events_1.INBOUND_EVENTS.FIELD_ISSUE_LOGGED;
    try {
        if (await isDuplicateEvent(event, payload)) {
            await logWebhookEvent(event, 'inbound', payload, 'duplicate');
            return { success: true, message: 'Duplicate event ignored' };
        }
        const projectId = payload.project_id;
        const description = payload.description;
        const reporterId = payload.reporter_id;
        const activityId = payload.activity_id;
        if (!projectId || !description) {
            await logWebhookEvent(event, 'inbound', payload, 'failed');
            return { success: false, message: 'Missing project_id or description' };
        }
        await (0, integration_service_1.createIssue)({
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await logWebhookEvent(event, 'inbound', payload, 'failed');
        return { success: false, message };
    }
}
async function handleScheduleChangeRequested(payload) {
    const event = webhook_events_1.INBOUND_EVENTS.SCHEDULE_CHANGE_REQUESTED;
    try {
        if (await isDuplicateEvent(event, payload)) {
            await logWebhookEvent(event, 'inbound', payload, 'duplicate');
            return { success: true, message: 'Duplicate event ignored' };
        }
        const projectId = payload.project_id;
        const activityId = payload.activity_id;
        const reasonCode = payload.reason_code;
        const proposedDates = payload.proposed_dates;
        const impactDescription = payload.impact_description;
        const requestedBy = payload.requested_by;
        if (!projectId || !activityId || !reasonCode) {
            await logWebhookEvent(event, 'inbound', payload, 'failed');
            return { success: false, message: 'Missing required fields' };
        }
        await (0, change_request_service_1.createChangeRequest)({
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await logWebhookEvent(event, 'inbound', payload, 'failed');
        return { success: false, message };
    }
}
async function handleAttendanceUpdated(payload) {
    const event = webhook_events_1.INBOUND_EVENTS.ATTENDANCE_UPDATED;
    try {
        if (await isDuplicateEvent(event, payload)) {
            await logWebhookEvent(event, 'inbound', payload, 'duplicate');
            return { success: true, message: 'Duplicate event ignored' };
        }
        const projectId = payload.project_id;
        const date = payload.date ? new Date(payload.date) : new Date();
        const workerCount = payload.worker_count;
        const hours = payload.hours;
        if (!projectId || workerCount === undefined || hours === undefined) {
            await logWebhookEvent(event, 'inbound', payload, 'failed');
            return { success: false, message: 'Missing project_id, worker_count, or hours' };
        }
        await (0, resource_service_1.upsertAttendance)(projectId, date, workerCount, hours);
        await logWebhookEvent(event, 'inbound', payload, 'processed');
        return { success: true, message: 'Attendance recorded' };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await logWebhookEvent(event, 'inbound', payload, 'failed');
        return { success: false, message };
    }
}
async function handleEquipmentStatusUpdated(payload) {
    const event = webhook_events_1.INBOUND_EVENTS.EQUIPMENT_STATUS_UPDATED;
    try {
        if (await isDuplicateEvent(event, payload)) {
            await logWebhookEvent(event, 'inbound', payload, 'duplicate');
            return { success: true, message: 'Duplicate event ignored' };
        }
        const projectId = payload.project_id;
        const externalId = payload.equipment_id;
        const status = payload.status;
        const dailyRate = payload.daily_rate;
        if (!projectId || !externalId || !status) {
            await logWebhookEvent(event, 'inbound', payload, 'failed');
            return { success: false, message: 'Missing project_id, equipment_id, or status' };
        }
        await (0, resource_service_1.upsertEquipment)({
            projectId,
            externalId,
            name: payload.equipment_name || externalId,
            type: payload.equipment_type,
        });
        const prisma = (0, prisma_1.getPrismaClient)();
        const equipment = await prisma.equipment.findUnique({
            where: { projectId_externalId: { projectId, externalId } },
        });
        if (equipment) {
            await prisma.equipment.update({
                where: { id: equipment.id },
                data: { status },
            });
        }
        if (dailyRate !== undefined) {
            await (0, resource_service_1.setEquipmentDailyRate)(projectId, externalId, dailyRate);
        }
        await logWebhookEvent(event, 'inbound', payload, 'processed');
        return { success: true, message: 'Equipment status updated' };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await logWebhookEvent(event, 'inbound', payload, 'failed');
        return { success: false, message };
    }
}
// Outbound stubs
async function sendActivityReady(projectId, activityId) {
    const event = webhook_events_1.OUTBOUND_EVENTS.ACTIVITY_READY;
    const payload = { project_id: projectId, activity_id: activityId };
    await logWebhookEvent(event, 'outbound', payload, 'pending');
    return { success: true, message: 'Outbound event logged' };
}
async function sendMaterialNeeded(projectId, poId, materialName, quantity, neededByDate, activityId) {
    const event = webhook_events_1.OUTBOUND_EVENTS.MATERIAL_NEEDED;
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
async function sendRfiStatusUpdated(projectId, rfiNumber, status, responseText, holdOnActivityId) {
    const event = webhook_events_1.OUTBOUND_EVENTS.RFI_STATUS_UPDATED;
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
async function sendSubmittalStatusUpdated(projectId, submittalId, approvalStatus, holdOnActivityId) {
    const event = webhook_events_1.OUTBOUND_EVENTS.SUBMITTAL_STATUS_UPDATED;
    const payload = {
        project_id: projectId,
        submittal_id: submittalId,
        approval_status: approvalStatus,
        hold_on_activity_id: holdOnActivityId,
    };
    await logWebhookEvent(event, 'outbound', payload, 'pending');
    return { success: true, message: 'Outbound event logged' };
}
async function sendScheduleChangeDecided(projectId, requestId, decision, notes, newDates) {
    const event = webhook_events_1.OUTBOUND_EVENTS.SCHEDULE_CHANGE_DECIDED;
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
//# sourceMappingURL=webhook.service.js.map