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
const express_auth_1 = require("../middleware/express-auth");
const roles_1 = require("../constants/roles");
const async_handler_1 = require("../lib/async-handler");
const communicationsService = __importStar(require("../services/communications.service"));
const router = (0, express_1.Router)({ mergeParams: true });
router.get('/rfis', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP, roles_1.ROLES.SUBCONTRACTOR_PM), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await communicationsService.getRfiByProject(req.params.projectId);
    res.json(result);
}));
router.post('/rfis', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await communicationsService.createRfi({
        projectId: req.params.projectId,
        ...req.body,
    });
    res.status(201).json(result);
}));
router.get('/rfis/:rfiId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP, roles_1.ROLES.SUBCONTRACTOR_PM), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await communicationsService.getRfiById(req.params.rfiId);
    if (!result) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'RFI not found' } });
        return;
    }
    res.json(result);
}));
router.patch('/rfis/:rfiId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { action, ...rest } = req.body || {};
    if (action === 'submit') {
        const result = await communicationsService.submitRfi(req.params.rfiId);
        res.json(result);
        return;
    }
    if (action === 'close') {
        const result = await communicationsService.closeRfi(req.params.rfiId);
        res.json(result);
        return;
    }
    if (action === 'answer' && typeof rest.responseText === 'string') {
        const result = await communicationsService.answerRfi(req.params.rfiId, rest.responseText, rest.answeredBy || req.user?.uid || 'unknown');
        res.json(result);
        return;
    }
    const result = await communicationsService.updateRfi(req.params.rfiId, rest);
    res.json(result);
}));
router.get('/submittals', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP, roles_1.ROLES.SUBCONTRACTOR_PM), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await communicationsService.getSubmittalsByProject(req.params.projectId);
    res.json(result);
}));
router.post('/submittals', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUBCONTRACTOR_PM), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await communicationsService.createSubmittal({
        projectId: req.params.projectId,
        ...req.body,
    });
    res.status(201).json(result);
}));
router.get('/submittals/:submittalId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP, roles_1.ROLES.SUBCONTRACTOR_PM), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await communicationsService.getSubmittalById(req.params.submittalId);
    if (!result) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Submittal not found' } });
        return;
    }
    res.json(result);
}));
router.patch('/submittals/:submittalId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { action, decision, reviewComments, reviewedBy, ...rest } = req.body || {};
    if (action === 'submit') {
        const result = await communicationsService.submitSubmittal(req.params.submittalId);
        res.json(result);
        return;
    }
    if (action === 'review' && decision) {
        const result = await communicationsService.reviewSubmittal(req.params.submittalId, decision, reviewedBy || req.user?.uid || 'unknown', reviewComments);
        res.json(result);
        return;
    }
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Unknown action' } });
}));
// ── Meeting Minutes ──
router.get('/meetings', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;
    const result = await communicationsService.getMeetingsByProject(req.params.projectId, startDate, endDate);
    res.json(result);
}));
router.post('/meetings', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await communicationsService.createMeeting({
        projectId: req.params.projectId,
        ...req.body,
    });
    res.status(201).json(result);
}));
router.get('/meetings/:meetingId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await communicationsService.getMeetingById(req.params.meetingId);
    if (!result) {
        res.status(404).json({ error: 'Meeting not found' });
        return;
    }
    res.json(result);
}));
router.put('/meetings/:meetingId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await communicationsService.updateMeeting(req.params.meetingId, req.body);
    res.json(result);
}));
router.delete('/meetings/:meetingId', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    await communicationsService.deleteMeeting(req.params.meetingId);
    res.status(204).end();
}));
router.patch('/meetings/:meetingId/action-items/:index', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const index = parseInt(String(req.params.index), 10);
    const result = await communicationsService.updateMeetingActionItemStatus(req.params.meetingId, index, req.body.status);
    res.json(result);
}));
// ── PDF Exports ──
const pdf_service_1 = require("../services/pdf/pdf.service");
router.get('/rfis/:rfiId/pdf', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP, roles_1.ROLES.SUBCONTRACTOR_PM), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const data = await communicationsService.getRfiPdfData(req.params.rfiId);
    // Re-fetch the full record to get the optional fields (statusHistory, ballInCourt, etc.)
    const fullRfi = await communicationsService.getRfiById(req.params.rfiId);
    if (!fullRfi) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'RFI not found' } });
        return;
    }
    const pdf = await (0, pdf_service_1.buildRfiPdf)({
        rfiNumber: data.rfiNumber,
        subject: data.subject,
        description: data.description,
        status: data.status,
        submittedBy: data.submittedBy,
        submittedAt: data.submittedAt,
        responseText: data.responseText,
        answeredAt: data.answeredAt,
        projectName: data.projectName,
        statusHistory: fullRfi.statusHistory,
        sourceReference: fullRfi.sourceReference,
        requiredDate: fullRfi.requiredDate,
        ballInCourt: fullRfi.ballInCourt,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${data.rfiNumber}.pdf"`);
    res.setHeader('Content-Length', pdf.length.toString());
    res.send(pdf);
}));
router.get('/submittals/log/pdf', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP, roles_1.ROLES.SUBCONTRACTOR_PM), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const allSubmittals = await communicationsService.getSubmittalsByProject(req.params.projectId);
    const project = await communicationsService.getSubmittalsByProject(req.params.projectId);
    // Get project name from first submittal
    let projectName = 'Project';
    if (allSubmittals.length > 0) {
        // Project name lookup is in the rfi/submittal; for now we use the slug
        projectName = `Project ${req.params.projectId.slice(0, 8)}`;
    }
    const now = Date.now();
    const rows = allSubmittals.map((s) => {
        const daysOpen = s.submittedAt
            ? Math.ceil((now - new Date(s.submittedAt).getTime()) / (1000 * 60 * 60 * 24))
            : s.createdAt
                ? Math.ceil((now - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : 0;
        return {
            submittalNumber: s.submittalNumber,
            specSection: s.specSection,
            title: s.title,
            status: s.status,
            submittedAt: s.submittedAt,
            requiredDate: s.requiredDate,
            daysOpen,
        };
    });
    const pdf = await (0, pdf_service_1.buildSubmittalLogPdf)(rows, projectName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="submittal-log-${req.params.projectId}.pdf"`);
    res.setHeader('Content-Length', pdf.length.toString());
    res.send(pdf);
}));
router.get('/submittals/:submittalId/pdf', express_auth_1.requireAuth, (0, express_auth_1.requireRole)(roles_1.ROLES.OWNER_ADMIN, roles_1.ROLES.PROJECT_MANAGER, roles_1.ROLES.SUPERINTENDENT, roles_1.ROLES.OWNERS_REP, roles_1.ROLES.SUBCONTRACTOR_PM), (0, async_handler_1.asyncHandler)(async (req, res) => {
    const data = await communicationsService.getSubmittalPdfData(req.params.submittalId);
    const fullSubmittal = await communicationsService.getSubmittalById(req.params.submittalId);
    if (!fullSubmittal) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Submittal not found' } });
        return;
    }
    const pdf = await (0, pdf_service_1.buildSubmittalPdf)({
        submittalNumber: data.submittalNumber,
        title: data.title,
        description: data.description,
        status: data.status,
        specSection: data.specSection,
        submittedBy: data.submittedBy,
        submittedAt: data.submittedAt,
        reviewedBy: data.reviewedBy,
        reviewedAt: data.reviewedAt,
        reviewComments: fullSubmittal.reviewComments,
        requiredDate: fullSubmittal.requiredDate,
        projectName: data.projectName,
        statusHistory: fullSubmittal.statusHistory,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${data.submittalNumber}.pdf"`);
    res.setHeader('Content-Length', pdf.length.toString());
    res.send(pdf);
}));
exports.default = router;
//# sourceMappingURL=communications.routes.js.map