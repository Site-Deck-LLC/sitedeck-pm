"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const async_handler_1 = require("../lib/async-handler");
const webhookService = __importStar(require("../services/webhook.service"));
const webhook_events_1 = require("../constants/webhook-events");
const router = (0, express_1.Router)();
function getHandler(event) {
    switch (event) {
        case webhook_events_1.INBOUND_EVENTS.TASK_COMPLETED:
            return webhookService.handleTaskCompleted;
        case webhook_events_1.INBOUND_EVENTS.MATERIAL_RECEIVED:
            return webhookService.handleMaterialReceived;
        case webhook_events_1.INBOUND_EVENTS.LABOR_HOURS_LOGGED:
            return webhookService.handleLaborHoursLogged;
        case webhook_events_1.INBOUND_EVENTS.EQUIPMENT_USAGE_LOGGED:
            return webhookService.handleEquipmentUsageLogged;
        case webhook_events_1.INBOUND_EVENTS.SAFETY_INCIDENT:
            return webhookService.handleSafetyIncident;
        case webhook_events_1.INBOUND_EVENTS.FIELD_ISSUE_LOGGED:
            return webhookService.handleFieldIssueLogged;
        case webhook_events_1.INBOUND_EVENTS.SCHEDULE_CHANGE_REQUESTED:
            return webhookService.handleScheduleChangeRequested;
        default:
            return null;
    }
}
router.post('/:event', (0, async_handler_1.asyncHandler)(async (req, res) => {
    const handler = getHandler(req.params.event);
    if (!handler) {
        res.status(400).json({ error: { code: 'UNKNOWN_EVENT', message: 'Unknown webhook event' } });
        return;
    }
    const result = await handler(req.body);
    if (result.success) {
        res.json(result);
    }
    else {
        res.status(400).json({ error: { code: 'WEBHOOK_FAILED', message: result.message } });
    }
}));
exports.default = router;
//# sourceMappingURL=webhook.routes.js.map