/**
 * Drawings page
 * ============================================================================
 * Drawing repository list + upload + revision history + download/preview.
 *
 * Upload flow:
 *   1. PM picks a file in the upload modal
 *   2. Frontend calls POST /documents/:id/presign → gets a presigned PUT URL
 *   3. Frontend PUTs the file bytes directly to the presigned URL
 *   4. On 2xx, frontend calls POST /documents/:id/confirm with sha256+size
 *   5. Backend flips the revision row to status="uploaded"
 *
 * Download/preview flow:
 *   1. PM clicks Download on a document row → GET /documents/:id/download
 *      with ?mode=attachment → opens the presigned URL in a new tab
 *   2. PM clicks Preview → GET /documents/:id/download with ?mode=inline →
 *      opens in a modal iframe (PDF) or img tag (image)
 *   3. Each request creates a row in document_download_logs (audit trail)
 *
 * In dev (no R2 env) the presign/download return dev-stub URLs; the
 * upload PUT is skipped, the download iframe shows nothing (no real
 * content), and the local flow can be tested end-to-end at the
 * metadata level.
 *
 * Source: /Volumes/Extra Storage/SiteDeckPM/frontend/src/components/Drawings.tsx
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchApi, getAsBuiltPdfUrl } from '../api';

interface DocumentSummary {
  id: string;
  projectId: string;
  name: string;
  discipline: string;
  drawingNo: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  latestRevision: { revisionNo: number; uploadedAt: string; sizeBytes: number; uploadStatus: string } | null;
}

interface DocumentDetail extends DocumentSummary {
  revisions: Array<{
    id: string;
    revisionNo: number;
    contentType: string;
    sizeBytes: number;
    sha256: string | null;
    uploadedBy: string;
    uploadedAt: string;
    notes: string | null;
    uploadStatus: string;
  }>;
}

interface PresignedDownload {
  url: string;
  filename: string;
  contentType: string;
  expiresAt: string;
  devStub: boolean;
  contentDisposition: 'inline' | 'attachment';
}

const DISCIPLINES = [
  'architectural',
  'structural',
  'mechanical',
  'electrical',
  'plumbing',
  'civil',
  'landscape',
  'other',
];

interface Props {
  projectId: string;
  onBack: () => void;
}

export function Drawings({ projectId, onBack }: Props) {
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<DocumentDetail | null>(null);
  const [showUpload, setShowUpload] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; filename: string; contentType: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchApi(`/api/v1/projects/${projectId}/documents`);
      setDocs(list);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    setExpandedDetail(null);
    try {
      const detail = await fetchApi(`/api/v1/projects/${projectId}/documents/${id}`);
      setExpandedDetail(detail);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document and all of its revisions? This cannot be undone.')) return;
    try {
      await fetchApi(`/api/v1/projects/${projectId}/documents/${id}`, { method: 'DELETE' });
      setExpandedId(null);
      setExpandedDetail(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Fetches a presigned GET URL and opens the file. `mode='attachment'`
  // triggers a download (browser saves the file with the original
  // filename); `mode='inline'` lets the browser render PDFs/images in
  // place.
  const fetchAndOpen = async (docId: string, mode: 'inline' | 'attachment') => {
    const presigned = await fetchApi<PresignedDownload>(
      `/api/v1/projects/${projectId}/documents/${docId}/download?mode=${mode}`
    );
    return presigned;
  };

  const handleDownload = async (docId: string) => {
    setDownloading(docId);
    try {
      const presigned = await fetchAndOpen(docId, 'attachment');
      window.open(presigned.url, '_blank');
    } catch (e: any) {
      setError(e.message);
    } finally {
      // Tiny delay so the "Downloading…" state is visible — the request
      // is sub-second but the visual confirmation helps in the field.
      setTimeout(() => setDownloading(null), 500);
    }
  };

  const handlePreview = async (doc: DocumentSummary) => {
    try {
      const presigned = await fetchAndOpen(doc.id, 'inline');
      setPreview({
        url: presigned.url,
        filename: presigned.filename,
        contentType: presigned.contentType,
      });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleExportAsBuilt = async () => {
    try {
      // Reuse the PDF URL helper — the browser handles the download via
      // Content-Disposition. Open in a new tab so the dashboard state
      // survives.
      const url = getAsBuiltPdfUrl(projectId);
      window.open(url, '_blank');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#1B2A4A', cursor: 'pointer', fontSize: 16, marginRight: 16 }}
        >
          ← Back
        </button>
        <h1 style={{ flex: 1, color: '#1B2A4A', margin: 0, fontSize: 24 }}>Drawings</h1>
        <button
          onClick={handleExportAsBuilt}
          style={{
            background: 'white',
            color: '#1B2A4A',
            border: '1px solid #1B2A4A',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            marginRight: 12,
          }}
        >
          Export As-Built Package
        </button>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            background: '#E8720C',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          + New Document
        </button>
      </div>

      {error && (
        <div
          style={{
            background: '#FEE2E2',
            border: '1px solid #EF4444',
            color: '#991B1B',
            padding: 8,
            borderRadius: 4,
            marginBottom: 12,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#6B7280' }}>Loading…</div>
      ) : docs.length === 0 ? (
        <div
          style={{
            background: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            padding: 48,
            textAlign: 'center',
            color: '#6B7280',
          }}
        >
          No drawings yet. Add a document to start uploading revisions.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map((d) => {
            const expanded = expandedId === d.id;
            return (
              <div key={d.id} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#1B2A4A', fontWeight: 600, fontSize: 14 }}>
                      {d.drawingNo && <span style={{ marginRight: 8, color: '#6B7280' }}>{d.drawingNo}</span>}
                      {d.name}
                    </div>
                    <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
                      {d.discipline} • {d.latestRevision ? `rev ${d.latestRevision.revisionNo}` : 'no revisions yet'}
                    </div>
                  </div>
                  {d.latestRevision && (
                    <>
                      <button
                        onClick={() => handlePreview(d)}
                        title="Preview (PDF or image)"
                        style={{
                          background: 'none',
                          border: '1px solid #1B2A4A',
                          color: '#1B2A4A',
                          padding: '4px 10px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => handleDownload(d.id)}
                        disabled={downloading === d.id}
                        title="Download latest revision"
                        style={{
                          background: 'none',
                          border: '1px solid #1B2A4A',
                          color: '#1B2A4A',
                          padding: '4px 10px',
                          borderRadius: 4,
                          cursor: downloading === d.id ? 'wait' : 'pointer',
                          fontSize: 12,
                          opacity: downloading === d.id ? 0.6 : 1,
                        }}
                      >
                        {downloading === d.id ? 'Downloading…' : 'Download'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleExpand(d.id)}
                    style={{
                      background: 'none',
                      border: '1px solid #1B2A4A',
                      color: '#1B2A4A',
                      padding: '4px 12px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    {expanded ? 'Collapse' : 'Revisions'}
                  </button>
                  <button
                    onClick={() => setShowUpload(d.id)}
                    style={{
                      background: '#1B2A4A',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Upload Revision
                  </button>
                </div>

                {expanded && expandedDetail && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ flex: 1, color: '#374151', fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>Current:</span> rev {expandedDetail.revisions[0]?.revisionNo || '—'}
                        {expandedDetail.revisions[0] && (
                          <span style={{ color: '#6B7280', marginLeft: 8 }}>
                            uploaded {new Date(expandedDetail.revisions[0].uploadedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {expandedDetail.revisions[0]?.uploadStatus === 'uploaded' && (
                        <>
                          <button
                            onClick={() => handlePreview(d)}
                            style={{
                              background: 'white',
                              border: '1px solid #1B2A4A',
                              color: '#1B2A4A',
                              padding: '6px 14px',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => handleDownload(d.id)}
                            disabled={downloading === d.id}
                            style={{
                              background: '#E8720C',
                              border: 'none',
                              color: 'white',
                              padding: '6px 14px',
                              borderRadius: 4,
                              cursor: downloading === d.id ? 'wait' : 'pointer',
                              fontSize: 12,
                              fontWeight: 600,
                              opacity: downloading === d.id ? 0.6 : 1,
                            }}
                          >
                            {downloading === d.id ? 'Downloading…' : 'Download'}
                          </button>
                        </>
                      )}
                    </div>
                    {expandedDetail.revisions.length === 0 ? (
                      <div style={{ color: '#6B7280', fontSize: 12 }}>No revisions yet.</div>
                    ) : (
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: '#6B7280', textAlign: 'left' }}>
                            <th style={{ padding: '4px 8px' }}>Rev</th>
                            <th style={{ padding: '4px 8px' }}>Uploaded</th>
                            <th style={{ padding: '4px 8px' }}>By</th>
                            <th style={{ padding: '4px 8px' }}>Size</th>
                            <th style={{ padding: '4px 8px' }}>Status</th>
                            <th style={{ padding: '4px 8px' }}>Notes</th>
                            <th style={{ padding: '4px 8px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {expandedDetail.revisions.map((r) => (
                            <tr key={r.id} style={{ borderTop: '1px solid #F3F4F6' }}>
                              <td style={{ padding: '4px 8px', fontWeight: 600 }}>Rev {r.revisionNo}</td>
                              <td style={{ padding: '4px 8px' }}>{new Date(r.uploadedAt).toLocaleString()}</td>
                              <td style={{ padding: '4px 8px' }}>{r.uploadedBy}</td>
                              <td style={{ padding: '4px 8px' }}>{(r.sizeBytes / 1024).toFixed(1)} KB</td>
                              <td style={{ padding: '4px 8px' }}>
                                <span
                                  style={{
                                    background: r.uploadStatus === 'uploaded' ? '#22A06B' : '#F59E0B',
                                    color: 'white',
                                    padding: '2px 8px',
                                    borderRadius: 12,
                                    fontSize: 10,
                                    fontWeight: 600,
                                  }}
                                >
                                  {r.uploadStatus}
                                </span>
                              </td>
                              <td style={{ padding: '4px 8px', color: '#6B7280' }}>{r.notes || '—'}</td>
                              <td style={{ padding: '4px 8px' }}>
                                {r.uploadStatus === 'uploaded' && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const presigned = await fetchApi<PresignedDownload>(
                                          `/api/v1/projects/${projectId}/documents/${d.id}/download?revisionId=${r.id}&mode=attachment`
                                        );
                                        window.open(presigned.url, '_blank');
                                      } catch (e: any) {
                                        setError(e.message);
                                      }
                                    }}
                                    style={{
                                      background: 'none',
                                      border: '1px solid #1B2A4A',
                                      color: '#1B2A4A',
                                      padding: '2px 8px',
                                      borderRadius: 4,
                                      cursor: 'pointer',
                                      fontSize: 11,
                                    }}
                                  >
                                    Download
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <button
                      onClick={() => handleDelete(d.id)}
                      style={{
                        marginTop: 12,
                        background: 'none',
                        border: '1px solid #EF4444',
                        color: '#EF4444',
                        padding: '4px 12px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Delete document
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateDocumentModal
          projectId={projectId}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {showUpload && (
        <UploadRevisionModal
          projectId={projectId}
          documentId={showUpload}
          onClose={() => setShowUpload(null)}
          onSaved={() => {
            setShowUpload(null);
            if (expandedId === showUpload) {
              handleExpand(showUpload);
            }
            load();
          }}
        />
      )}

      {preview && (
        <PreviewModal
          url={preview.url}
          filename={preview.filename}
          contentType={preview.contentType}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

function PreviewModal({
  url,
  filename,
  contentType,
  onClose,
}: {
  url: string;
  filename: string;
  contentType: string;
  onClose: () => void;
}) {
  const isImage = contentType.startsWith('image/');
  const isPdf = contentType === 'application/pdf';
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 8,
          width: '90vw',
          maxWidth: 1100,
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, color: '#1B2A4A', fontSize: 14, fontWeight: 600 }}>{filename}</div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#1B2A4A', fontSize: 12, textDecoration: 'underline' }}
          >
            Open in new tab
          </a>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid #6B7280',
              color: '#6B7280',
              padding: '4px 12px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Close
          </button>
        </div>
        <div style={{ flex: 1, background: '#F9FAFB', overflow: 'auto' }}>
          {isImage ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%', padding: 16 }}>
              <img
                src={url}
                alt={filename}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={url}
              title={filename}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
              Preview not supported for this file type. Use Download.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateDocumentModal({
  projectId,
  onClose,
  onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState('architectural');
  const [drawingNo, setDrawingNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await fetchApi(`/api/v1/projects/${projectId}/documents`, {
        method: 'POST',
        body: JSON.stringify({ name, discipline, drawingNo }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div style={{ background: 'white', borderRadius: 8, padding: 24, width: 480 }}>
        <h2 style={{ margin: '0 0 16px', color: '#1B2A4A', fontSize: 18 }}>New Document</h2>
        {error && (
          <div
            style={{
              background: '#FEE2E2',
              border: '1px solid #EF4444',
              color: '#991B1B',
              padding: 8,
              borderRadius: 4,
              marginBottom: 12,
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
        <Field label="Name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Discipline" required>
          <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} style={inputStyle}>
            {DISCIPLINES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Drawing number (optional)">
          <input value={drawingNo} onChange={(e) => setDrawingNo(e.target.value)} style={inputStyle} />
        </Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={cancelBtn}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || saving}
            style={{
              ...primaryBtn,
              opacity: !name || saving ? 0.6 : 1,
              cursor: !name || saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Create Document'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadRevisionModal({
  projectId,
  documentId,
  onClose,
  onSaved,
}: {
  projectId: string;
  documentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [phase, setPhase] = useState<'pick' | 'uploading' | 'confirming' | 'done' | 'error'>('pick');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setPhase('uploading');
    setError(null);
    try {
      // 1. presign
      const presign = await fetchApi(`/api/v1/projects/${projectId}/documents/${documentId}/presign`, {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });

      // 2. PUT to the presigned URL (or skip for dev-stub)
      if (!presign.devStub) {
        const put = await fetch(presign.url, {
          method: 'PUT',
          headers: { 'Content-Type': presign.contentType },
          body: file,
        });
        if (!put.ok) throw new Error(`Upload failed: ${put.status}`);
      }

      // 3. compute sha256 of the file
      setPhase('confirming');
      const sha256 = await sha256OfFile(file);

      // 4. confirm
      const revisionNo = parseRevisionNoFromKey(presign.storageKey);
      await fetchApi(`/api/v1/projects/${projectId}/documents/${documentId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          revisionNo,
          sha256,
          sizeBytes: file.size,
          notes,
        }),
      });

      setPhase('done');
      onSaved();
    } catch (e: any) {
      setError(e.message);
      setPhase('error');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div style={{ background: 'white', borderRadius: 8, padding: 24, width: 480 }}>
        <h2 style={{ margin: '0 0 16px', color: '#1B2A4A', fontSize: 18 }}>Upload Revision</h2>
        {error && (
          <div
            style={{
              background: '#FEE2E2',
              border: '1px solid #EF4444',
              color: '#991B1B',
              padding: 8,
              borderRadius: 4,
              marginBottom: 12,
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
        <Field label="File" required>
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={inputStyle}
          />
          {file && (
            <div style={{ color: '#6B7280', fontSize: 11, marginTop: 4 }}>
              {file.name} — {(file.size / 1024).toFixed(1)} KB
            </div>
          )}
        </Field>
        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={inputStyle}
            placeholder="What changed in this revision?"
          />
        </Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={cancelBtn} disabled={phase === 'uploading' || phase === 'confirming'}>
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || phase === 'uploading' || phase === 'confirming'}
            style={{
              ...primaryBtn,
              opacity: !file || phase === 'uploading' || phase === 'confirming' ? 0.6 : 1,
              cursor: !file || phase === 'uploading' || phase === 'confirming' ? 'not-allowed' : 'pointer',
            }}
          >
            {phase === 'uploading' ? 'Uploading…' : phase === 'confirming' ? 'Confirming…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: any }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', color: '#374151', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {label}
        {required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #D1D5DB',
  borderRadius: 4,
  padding: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const primaryBtn: React.CSSProperties = {
  background: '#E8720C',
  color: 'white',
  border: 'none',
  padding: '8px 16px',
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
};

const cancelBtn: React.CSSProperties = {
  background: 'white',
  border: '1px solid #6B7280',
  color: '#6B7280',
  padding: '8px 16px',
  borderRadius: 4,
  fontSize: 13,
};

function parseRevisionNoFromKey(key: string): number {
  // key = "projects/p1/docs/d1/rev2-name.pdf"
  const m = key.match(/rev(\d+)-/);
  return m ? parseInt(m[1], 10) : 1;
}

async function sha256OfFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
