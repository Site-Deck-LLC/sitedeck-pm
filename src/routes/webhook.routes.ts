import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import * as webhookService from '../services/webhook.service';
import { INBOUND_EVENTS } from '../constants/webhook-events';

const router = Router();

function getHandler(event: string) {
  switch (event) {
    case INBOUND_EVENTS.TASK_COMPLETED:
      return webhookService.handleTaskCompleted;
    case INBOUND_EVENTS.MATERIAL_RECEIVED:
      return webhookService.handleMaterialReceived;
    case INBOUND_EVENTS.LABOR_HOURS_LOGGED:
      return webhookService.handleLaborHoursLogged;
    case INBOUND_EVENTS.EQUIPMENT_USAGE_LOGGED:
      return webhookService.handleEquipmentUsageLogged;
    case INBOUND_EVENTS.SAFETY_INCIDENT:
      return webhookService.handleSafetyIncident;
    case INBOUND_EVENTS.FIELD_ISSUE_LOGGED:
      return webhookService.handleFieldIssueLogged;
    case INBOUND_EVENTS.SCHEDULE_CHANGE_REQUESTED:
      return webhookService.handleScheduleChangeRequested;
    default:
      return null;
  }
}

router.post(
  '/:event',
  asyncHandler(async (req, res) => {
    const handler = getHandler(req.params.event);
    if (!handler) {
      res.status(400).json({ error: { code: 'UNKNOWN_EVENT', message: 'Unknown webhook event' } });
      return;
    }

    const result = await handler(req.body);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: { code: 'WEBHOOK_FAILED', message: result.message } });
    }
  })
);

export default router;
