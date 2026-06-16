import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as communicationsService from '../services/communications.service';

const router = Router({ mergeParams: true });

router.get(
  '/rfis',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP, ROLES.SUBCONTRACTOR_PM),
  asyncHandler(async (req, res) => {
    const result = await communicationsService.getRfiByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/rfis',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT),
  asyncHandler(async (req, res) => {
    const result = await communicationsService.createRfi({
      projectId: req.params.projectId,
      ...req.body,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/rfis/:rfiId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP, ROLES.SUBCONTRACTOR_PM),
  asyncHandler(async (req, res) => {
    const result = await communicationsService.getRfiById(req.params.rfiId);
    if (!result) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'RFI not found' } });
      return;
    }
    res.json(result);
  })
);

router.patch(
  '/rfis/:rfiId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
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
      const result = await communicationsService.answerRfi(
        req.params.rfiId,
        rest.responseText,
        rest.answeredBy || req.user?.uid || 'unknown'
      );
      res.json(result);
      return;
    }
    const result = await communicationsService.updateRfi(req.params.rfiId, rest);
    res.json(result);
  })
);

router.get(
  '/submittals',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP, ROLES.SUBCONTRACTOR_PM),
  asyncHandler(async (req, res) => {
    const result = await communicationsService.getSubmittalsByProject(req.params.projectId);
    res.json(result);
  })
);

router.post(
  '/submittals',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUBCONTRACTOR_PM),
  asyncHandler(async (req, res) => {
    const result = await communicationsService.createSubmittal({
      projectId: req.params.projectId,
      ...req.body,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/submittals/:submittalId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP, ROLES.SUBCONTRACTOR_PM),
  asyncHandler(async (req, res) => {
    const result = await communicationsService.getSubmittalById(req.params.submittalId);
    if (!result) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Submittal not found' } });
      return;
    }
    res.json(result);
  })
);

router.patch(
  '/submittals/:submittalId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const { action, decision, reviewComments, reviewedBy, ...rest } = req.body || {};
    if (action === 'submit') {
      const result = await communicationsService.submitSubmittal(req.params.submittalId);
      res.json(result);
      return;
    }
    if (action === 'review' && decision) {
      const result = await communicationsService.reviewSubmittal(
        req.params.submittalId,
        decision,
        reviewedBy || req.user?.uid || 'unknown',
        reviewComments
      );
      res.json(result);
      return;
    }
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Unknown action' } });
  })
);

// ── Meeting Minutes ──

router.get(
  '/meetings',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;
    const result = await communicationsService.getMeetingsByProject(
      req.params.projectId,
      startDate,
      endDate
    );
    res.json(result);
  })
);

router.post(
  '/meetings',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await communicationsService.createMeeting({
      projectId: req.params.projectId,
      ...req.body,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/meetings/:meetingId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP),
  asyncHandler(async (req, res) => {
    const result = await communicationsService.getMeetingById(req.params.meetingId);
    if (!result) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }
    res.json(result);
  })
);

router.put(
  '/meetings/:meetingId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await communicationsService.updateMeeting(req.params.meetingId, req.body);
    res.json(result);
  })
);

router.delete(
  '/meetings/:meetingId',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    await communicationsService.deleteMeeting(req.params.meetingId);
    res.status(204).end();
  })
);

router.patch(
  '/meetings/:meetingId/action-items/:index',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const index = parseInt(String(req.params.index), 10);
    const result = await communicationsService.updateMeetingActionItemStatus(
      req.params.meetingId,
      index,
      req.body.status
    );
    res.json(result);
  })
);

// ── PDF Exports ──

import {
  buildRfiPdf,
  buildSubmittalPdf,
  buildSubmittalLogPdf,
} from '../services/pdf/pdf.service';

router.get(
  '/rfis/:rfiId/pdf',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP, ROLES.SUBCONTRACTOR_PM),
  asyncHandler(async (req, res) => {
    const data = await communicationsService.getRfiPdfData(req.params.rfiId);
    // Re-fetch the full record to get the optional fields (statusHistory, ballInCourt, etc.)
    const fullRfi = await communicationsService.getRfiById(req.params.rfiId);
    if (!fullRfi) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'RFI not found' } });
      return;
    }
    const pdf = await buildRfiPdf({
      rfiNumber: data.rfiNumber,
      subject: data.subject,
      description: data.description,
      status: data.status,
      submittedBy: data.submittedBy,
      submittedAt: data.submittedAt,
      responseText: data.responseText,
      answeredAt: data.answeredAt,
      projectName: data.projectName,
      statusHistory: fullRfi.statusHistory as any,
      sourceReference: fullRfi.sourceReference,
      requiredDate: fullRfi.requiredDate,
      ballInCourt: fullRfi.ballInCourt,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${data.rfiNumber}.pdf"`);
    res.setHeader('Content-Length', pdf.length.toString());
    res.send(pdf);
  })
);

router.get(
  '/submittals/log/pdf',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP, ROLES.SUBCONTRACTOR_PM),
  asyncHandler(async (req, res) => {
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
    const pdf = await buildSubmittalLogPdf(rows, projectName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="submittal-log-${req.params.projectId}.pdf"`);
    res.setHeader('Content-Length', pdf.length.toString());
    res.send(pdf);
  })
);

router.get(
  '/submittals/:submittalId/pdf',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.OWNERS_REP, ROLES.SUBCONTRACTOR_PM),
  asyncHandler(async (req, res) => {
    const data = await communicationsService.getSubmittalPdfData(req.params.submittalId);
    const fullSubmittal = await communicationsService.getSubmittalById(req.params.submittalId);
    if (!fullSubmittal) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Submittal not found' } });
      return;
    }
    const pdf = await buildSubmittalPdf({
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
      statusHistory: fullSubmittal.statusHistory as any,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${data.submittalNumber}.pdf"`);
    res.setHeader('Content-Length', pdf.length.toString());
    res.send(pdf);
  })
);

export default router;
