/**
 * Documents Routes — Drawing Repository Foundation
 * ============================================================================
 *
 *   GET    /api/v1/projects/:projectId/documents
 *     — list documents for the project, latest revision summary inline.
 *   POST   /api/v1/projects/:projectId/documents
 *     Body: { name, discipline, drawingNo? }
 *     — create a new logical document.
 *   GET    /api/v1/projects/:projectId/documents/:id
 *     — full document with all revisions.
 *   DELETE /api/v1/projects/:projectId/documents/:id
 *   POST   /api/v1/projects/:projectId/documents/:id/presign
 *     Body: { filename, contentType, sizeBytes }
 *     — returns a presigned PUT URL the browser can upload to.
 *   POST   /api/v1/projects/:projectId/documents/:id/confirm
 *     Body: { revisionNo, sha256, sizeBytes, notes? }
 *     — registers the upload as completed.
 *   GET    /api/v1/projects/:projectId/documents/:id/download
 *     Query: ?revisionId=&mode=inline|attachment
 *     — returns a presigned GET URL (60 min TTL) and writes an audit log
 *       row. The audit log records the *request*, not the actual fetch —
 *       a leaked URL is detectable by the row's existence.
 *   GET    /api/v1/projects/:projectId/documents/:id/revisions-with-urls
 *     — same shape as `/:id` but each revision carries a fresh presigned
 *       GET URL so the UI can render a per-row download column without
 *       N round-trips.
 *
 * Tenant isolation: the document's projectId must match the URL
 * :projectId on every read or write.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import * as documents from '../services/documents.service';

const router = Router({ mergeParams: true });

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await documents.listDocuments(req.params.projectId));
  })
);

router.post(
  '/',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const { name, discipline, drawingNo } = req.body || {};
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (!discipline) {
      res.status(400).json({ error: 'discipline is required' });
      return;
    }
    const result = await documents.createDocument({
      projectId: req.params.projectId,
      name,
      discipline,
      drawingNo,
      createdBy: req.user?.uid || 'unknown',
    });
    res.status(201).json(result);
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const doc = await documents.getDocument(req.params.projectId, req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(doc);
  })
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await documents.deleteDocument(req.params.projectId, req.params.id);
    if (!result.deleted) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(result);
  })
);

router.post(
  '/:id/presign',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const { filename, contentType, sizeBytes } = req.body || {};
    if (!filename || !contentType || !sizeBytes) {
      res.status(400).json({ error: 'filename, contentType, sizeBytes are required' });
      return;
    }
    if (typeof sizeBytes !== 'number' || sizeBytes <= 0 || sizeBytes > 200 * 1024 * 1024) {
      res.status(400).json({ error: 'sizeBytes must be > 0 and <= 200MB' });
      return;
    }
    const presigned = await documents.presignUpload({
      projectId: req.params.projectId,
      documentId: req.params.id,
      filename,
      contentType,
      sizeBytes,
    });
    res.json(presigned);
  })
);

router.post(
  '/:id/confirm',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.SUPERINTENDENT, ROLES.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const { revisionNo, sha256, sizeBytes, notes } = req.body || {};
    if (typeof revisionNo !== 'number' || !sha256 || typeof sizeBytes !== 'number') {
      res.status(400).json({ error: 'revisionNo, sha256, sizeBytes are required' });
      return;
    }
    await documents.confirmUpload({
      projectId: req.params.projectId,
      documentId: req.params.id,
      revisionNo,
      sha256,
      sizeBytes,
      notes,
      uploadedBy: req.user?.uid || 'unknown',
    });
    res.json({ ok: true });
  })
);

// GET /:id/download?revisionId=...&mode=inline|attachment
router.get(
  '/:id/download',
  requireAuth,
  asyncHandler(async (req, res) => {
    const mode = (req.query.mode as string) === 'attachment' ? 'attachment' : 'inline';
    const revisionId = (req.query.revisionId as string) || undefined;
    const presigned = await documents.generateDownloadUrl({
      projectId: req.params.projectId,
      documentId: req.params.id,
      revisionId,
      mode,
    });
    if (!presigned) {
      res.status(404).json({ error: 'document or revision not found' });
      return;
    }
    // Audit log — best-effort, do not fail the request if logging fails.
    try {
      await documents.logDownload({
        documentId: req.params.id,
        revisionId: revisionId || null,
        userId: req.user?.uid || 'unknown',
        ipAddress:
          (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
          req.socket.remoteAddress ||
          null,
      });
    } catch (err) {
      console.warn('[documents] logDownload failed:', (err as any)?.message);
    }
    res.json(presigned);
  })
);

// GET /:id/revisions-with-urls — same as /:id but every revision has a
// fresh inline presigned URL so the UI can render a download column
// without N follow-up requests.
router.get(
  '/:id/revisions-with-urls',
  requireAuth,
  asyncHandler(async (req, res) => {
    const doc = await documents.getDocument(req.params.projectId, req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const revisionsWithUrls = await Promise.all(
      doc.revisions.map(async (r) => {
        const presigned = await documents.generateDownloadUrl({
          projectId: req.params.projectId,
          documentId: req.params.id,
          revisionId: r.id,
          mode: 'inline',
        });
        return { ...r, downloadUrl: presigned?.url || null, expiresAt: presigned?.expiresAt || null };
      })
    );
    res.json({ ...doc, revisions: revisionsWithUrls });
  })
);

// POST /cleanup-orphans — manual trigger for the orphan-revision
// sweep. Lives on the project-scoped router so an org admin can
// run it for a single project. Owner_admin only; this is a
// maintenance operation.
router.post(
  '/cleanup-orphans',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN),
  asyncHandler(async (req, res) => {
    const olderThanHours = req.body?.olderThanHours
      ? Math.max(1, Math.min(720, Number(req.body.olderThanHours)))
      : 24;
    const result = await documents.cleanupOrphanRevisions({ olderThanHours });
    res.json(result);
  })
);

// POST /:id/release-ifc — Sprint 9 Task 1: release a document as
// Issued for Construction. Idempotent: re-releasing the same
// revision returns alreadyReleased=true with no side effects.
// Returns 404 when the document doesn't belong to the project.
router.post(
  '/:id/release-ifc',
  requireAuth,
  requireRole(ROLES.OWNER_ADMIN, ROLES.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const result = await documents.releaseAsIfc(
      req.params.projectId,
      req.params.id,
      req.user?.uid || 'unknown'
    );
    if (!result) {
      res.status(404).json({ error: 'document not found' });
      return;
    }
    res.json(result);
  })
);

// GET /ifc — list all IFC drawings for the project. Sprint 9 Task 1.
router.get(
  '/ifc',
  requireAuth,
  asyncHandler(async (req, res) => {
    const prisma = require('@prisma/client');
    const { getPrismaClient } = require('../lib/prisma');
    const db = getPrismaClient();
    const docs = await db.document.findMany({
      where: { projectId: req.params.projectId, status: 'issued_for_construction' },
      orderBy: { ifcReleasedAt: 'desc' },
      include: {
        revisions: {
          where: { uploadStatus: 'uploaded' },
          orderBy: { revisionNo: 'desc' },
          take: 1,
        },
      },
    });
    res.json(
      docs.map((d: any) => summarizeIfc(d, d.revisions[0] || null))
    );
  })
);

function summarizeIfc(d: any, latest: any | null) {
  return {
    id: d.id,
    projectId: d.projectId,
    name: d.name,
    discipline: d.discipline,
    drawingNo: d.drawingNo,
    currentRevisionId: d.currentRevisionId,
    ifcReleasedAt: d.ifcReleasedAt ? (d.ifcReleasedAt instanceof Date ? d.ifcReleasedAt.toISOString() : d.ifcReleasedAt) : null,
    ifcReleasedBy: d.ifcReleasedBy,
    latestRevision: latest
      ? {
          revisionNo: latest.revisionNo,
          uploadedAt: latest.uploadedAt instanceof Date ? latest.uploadedAt.toISOString() : latest.uploadedAt,
          sizeBytes: latest.sizeBytes,
        }
      : null,
  };
}

// GET /package — Sprint 9 Task 8: drawing package manifest.
router.get(
  '/package',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { getPrismaClient } = require('../lib/prisma');
    const db = getPrismaClient();
    const docs = await db.document.findMany({
      where: { projectId: req.params.projectId, status: 'issued_for_construction' },
      orderBy: [{ discipline: 'asc' }, { drawingNo: 'asc' }],
      include: {
        revisions: {
          where: { uploadStatus: 'uploaded' },
          orderBy: { revisionNo: 'desc' },
          take: 1,
        },
      },
    });
    const rows = docs
      .filter((d: any) => d.revisions[0])
      .map((d: any) => ({
        drawingNumber: d.drawingNo ?? '',
        title: d.name,
        discipline: d.discipline,
        revision: d.revisions[0].revisionNo,
        ifcDate: d.ifcReleasedAt
          ? (d.ifcReleasedAt instanceof Date ? d.ifcReleasedAt.toISOString() : d.ifcReleasedAt)
          : null,
        documentId: d.id,
        revisionId: d.revisions[0].id,
      }));
    res.json({
      projectId: req.params.projectId,
      generatedAt: new Date().toISOString(),
      count: rows.length,
      drawings: rows,
    });
  })
);

export default router;
