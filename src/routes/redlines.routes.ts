/**
 * Redline Routes — Field redline capture workflow
 * ============================================================================
 * Sprint 9 Task 2.
 *   POST   /api/v1/projects/:id/redlines           — submit
 *   GET    /api/v1/projects/:id/redlines           — list
 *   GET    /api/v1/projects/:id/redlines/as-built-export — stub
 *   GET    /api/v1/projects/:id/redlines/:redlineId
 *   PATCH  /api/v1/projects/:id/redlines/:redlineId/review
 *
 * Tenant isolation: every query keys on projectId. The redline's
 * projectId must match the URL :projectId.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as redlines from '../services/redline.service';
import { RedlineNotFoundError, RedlineValidationError } from '../services/redline.service';
import { buildAsBuiltPdf } from '../services/pdf/pdf.service';

const router = Router({ mergeParams: true });

// Project name -> safe filename fragment. Keeps alphanumerics, dashes,
// dots, and underscores; collapses everything else. Capped at 80 chars.
function sanitizeForPdfFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return (cleaned || 'project').slice(0, 80);
}

router.post(
  '/',
  requireAuth,
  requireRole(
    ROLES.OWNER_ADMIN,
    ROLES.PROJECT_MANAGER,
    ROLES.SUPERINTENDENT,
    ROLES.SUPERVISOR,
    ROLES.SUBCONTRACTOR_PM
  ),
  asyncHandler(async (req, res) => {
    const { documentId, revisionId, description, redlineType, photoUrl, linkedActivityId } = req.body || {};
    if (!documentId || !description || !redlineType) {
      res.status(400).json({ error: 'documentId, description, and redlineType are required' });
      return;
    }
    try {
      const result = await redlines.submitRedline({
        projectId: req.params.projectId,
        documentId,
        revisionId,
        description,
        redlineType,
        photoUrl,
        linkedActivityId,
        submittedBy: req.user?.uid || 'unknown',
      });
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof RedlineValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await redlines.getRedlines(req.params.projectId, {
      documentId: req.query.documentId as string | undefined,
      status: req.query.status as any,
      type: req.query.type as any,
    });
    res.json(result);
  })
);

router.get(
  '/as-built-export',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await redlines.asBuiltExportStub(req.params.projectId));
  })
);

router.get(
  '/as-built-pdf',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const data = await redlines.asBuiltExportData(req.params.projectId);
    // Use the caller's displayName when present, fall back to email, then
    // "SiteDeck PM" — best-effort; the cert block needs a signer name.
    const token = req.user?.decodedToken;
    const preparedBy =
      (token as any)?.name ||
      (token as any)?.email ||
      'SiteDeck PM';
    const buffer = await buildAsBuiltPdf({
      projectName: data.projectName,
      preparedBy,
      exportDate: data.exportDate,
      projectStart: data.projectStart,
      drawings: data.drawings.map((d) => ({
        documentId: d.documentId,
        drawingNo: d.drawingNo,
        name: d.name,
        discipline: d.discipline,
        currentRevisionNo: d.currentRevisionNo,
        ifcReleasedAt: d.ifcReleasedAt,
        redlines: d.redlines.map((r) => ({
          redlineId: r.redlineId,
          description: r.description,
          redlineType: r.redlineType,
          submittedBy: r.submittedBy,
          submittedAt: r.submittedAt,
          status: r.status,
          reviewNotes: r.reviewNotes,
          submittedAfterLock: r.submittedAfterLock,
        })),
      })),
    });
    const safeName = sanitizeForPdfFilename(data.projectName);
    const filename = `as-built-${safeName}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  })
);

router.get(
  '/:redlineId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await redlines.getRedlineById(req.params.projectId, req.params.redlineId);
    if (!result) {
      res.status(404).json({ error: 'redline not found' });
      return;
    }
    res.json(result);
  })
);

router.patch(
  '/:redlineId/review',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const { decision, reviewNotes, draftRfiId } = req.body || {};
    if (!decision) {
      res.status(400).json({ error: 'decision is required' });
      return;
    }
    try {
      const result = await redlines.reviewRedline(req.params.projectId, req.params.redlineId, {
        decision,
        reviewNotes,
        draftRfiId,
        reviewerId: req.user?.uid || 'unknown',
      });
      res.json(result);
    } catch (err) {
      if (err instanceof RedlineNotFoundError) {
        res.status(404).json({ error: 'redline not found' });
        return;
      }
      if (err instanceof RedlineValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

export default router;
