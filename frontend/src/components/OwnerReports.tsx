/**
 * Owner Reports page
 * ============================================================================
 * List of weekly owner status reports for a project + report detail view
 * with editable sections.
 *
 * The "Generate This Week's Report" button calls the agent endpoint
 * (POST /api/v1/projects/:id/agents/owner-report). The response is
 * persisted and we redirect to the new report's detail.
 *
 * The dashboard surfaces "Owner Report Due" when the current week's
 * report is missing — this is computed once on mount by looking at the
 * list and checking the latest week's date.
 */

import { useEffect, useState, useCallback } from 'react';
import { fetchApi } from '../api';

interface ReportSummary {
  id: string;
  projectId: string;
  weekEnding: string;
  generatedBy: string;
  generatedAt: string;
  sentAt: string | null;
  sentToEmail: string | null;
}

interface ReportDetail {
  id: string;
  projectId: string;
  weekEnding: string;
  generatedBy: string;
  generatedAt: string;
  sentAt: string | null;
  sentToEmail: string | null;
  reportJson: {
    report_title: string;
    week_ending: string;
    sections: {
      schedule: string;
      cost: string;
      rfis: string;
      change_orders: string;
      risks: string;
      lookahead: string;
    };
    full_report_text: string;
    source: 'ai' | 'fallback';
    metrics: any;
    meta: any;
  };
}

interface Props {
  projectId: string;
  onBack: () => void;
}

export function OwnerReports({ projectId, onBack }: Props) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchApi(`/api/v1/projects/${projectId}/agents/owner-report`);
      setReports(list);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await fetchApi(`/api/v1/projects/${projectId}/agents/owner-report`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSelectedId(result.id);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (selectedId) {
    return (
      <ReportDetailView
        projectId={projectId}
        reportId={selectedId}
        onBack={() => {
          setSelectedId(null);
          load();
        }}
      />
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#1B2A4A',
            cursor: 'pointer',
            fontSize: 16,
            marginRight: 16,
          }}
        >
          ← Back
        </button>
        <h1 style={{ flex: 1, color: '#1B2A4A', margin: 0, fontSize: 24 }}>Owner Reports</h1>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            background: '#E8720C',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 6,
            cursor: generating ? 'wait' : 'pointer',
            fontSize: 14,
            fontWeight: 600,
            opacity: generating ? 0.7 : 1,
          }}
        >
          {generating ? 'Generating…' : "Generate This Week's Report"}
        </button>
      </div>

      {error && (
        <div
          style={{
            background: '#FEE2E2',
            border: '1px solid #EF4444',
            color: '#991B1B',
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#6B7280' }}>Loading…</div>
      ) : reports.length === 0 ? (
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
          No reports yet. Click "Generate This Week's Report" to start.
        </div>
      ) : (
        <div
          style={{
            background: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ textAlign: 'left', padding: 12, color: '#1B2A4A', fontWeight: 600 }}>
                  Week ending
                </th>
                <th style={{ textAlign: 'left', padding: 12, color: '#1B2A4A', fontWeight: 600 }}>
                  Generated
                </th>
                <th style={{ textAlign: 'left', padding: 12, color: '#1B2A4A', fontWeight: 600 }}>
                  Status
                </th>
                <th style={{ textAlign: 'right', padding: 12, color: '#1B2A4A', fontWeight: 600 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                  onClick={() => setSelectedId(r.id)}
                >
                  <td style={{ padding: 12 }}>{r.weekEnding.slice(0, 10)}</td>
                  <td style={{ padding: 12, color: '#6B7280', fontSize: 13 }}>
                    {new Date(r.generatedAt).toLocaleString()}
                  </td>
                  <td style={{ padding: 12 }}>
                    {r.sentAt ? (
                      <span
                        style={{
                          background: '#DCFCE7',
                          color: '#15803D',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Sent
                      </span>
                    ) : (
                      <span
                        style={{
                          background: '#FEF3C7',
                          color: '#92400E',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Draft
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 12, textAlign: 'right' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(r.id);
                      }}
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
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReportDetailView({
  projectId,
  reportId,
  onBack,
}: {
  projectId: string;
  reportId: string;
  onBack: () => void;
}) {
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchApi(`/api/v1/projects/${projectId}/agents/owner-report/${reportId}`);
      setReport(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, reportId]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (section: string, currentBody: string) => {
    setEditing(section);
    setEditBody(currentBody);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditBody('');
  };

  const saveEdit = async (section: string) => {
    setSaving(true);
    setError(null);
    try {
      await fetchApi(`/api/v1/projects/${projectId}/agents/owner-report/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ section, body: editBody }),
      });
      cancelEdit();
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const markSent = async () => {
    try {
      await fetchApi(`/api/v1/projects/${projectId}/agents/owner-report/${reportId}/send`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const copyAll = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.reportJson.full_report_text);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1500);
    } catch {
      setError('Copy failed — your browser may have blocked clipboard access.');
    }
  };

  const exportPdf = async () => {
    // Sprint 11 Task 9: server-rendered PDF via pdfkit (SiteDeck-branded
    // cover page, executive summary tile row, six sections). Falls
    // back to print if the server route is unreachable.
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `/api/v1/projects/${projectId}/agents/owner-report/${report!.id}/pdf`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) {
        throw new Error(`PDF route returned ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `owner-report-${report!.reportJson.week_ending || 'report'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      // Fallback: print-to-PDF
      window.print();
    }
  };

  if (loading) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }
  if (!report) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ color: '#EF4444' }}>{error || 'Report not found'}</div>
        <button onClick={onBack}>← Back</button>
      </div>
    );
  }

  const sections = report.reportJson.sections;
  const sectionOrder: Array<{ key: keyof typeof sections; label: string }> = [
    { key: 'schedule', label: 'Schedule' },
    { key: 'cost', label: 'Cost' },
    { key: 'rfis', label: 'RFIs' },
    { key: 'change_orders', label: 'Change Orders' },
    { key: 'risks', label: 'Risks' },
    { key: 'lookahead', label: 'Two-Week Lookahead' },
  ];

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#1B2A4A',
            cursor: 'pointer',
            fontSize: 16,
            marginRight: 16,
          }}
        >
          ← Back
        </button>
        <h1 style={{ flex: 1, color: '#1B2A4A', margin: 0, fontSize: 24 }}>
          {report.reportJson.report_title}
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={copyAll}
            style={{
              background: 'white',
              border: '1px solid #1B2A4A',
              color: '#1B2A4A',
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {copyOk ? 'Copied!' : 'Copy All'}
          </button>
          <button
            onClick={exportPdf}
            style={{
              background: 'white',
              border: '1px solid #1B2A4A',
              color: '#1B2A4A',
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Export PDF
          </button>
          <button
            onClick={markSent}
            disabled={!!report.sentAt}
            style={{
              background: report.sentAt ? '#9CA3AF' : '#E8720C',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 6,
              cursor: report.sentAt ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {report.sentAt ? 'Sent' : 'Mark as Sent'}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: '#FEE2E2',
            border: '1px solid #EF4444',
            color: '#991B1B',
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginBottom: 16, fontSize: 13, color: '#6B7280' }}>
        Source: {report.reportJson.source} • Generated{' '}
        {new Date(report.generatedAt).toLocaleString()} {report.sentAt && `• Sent ${new Date(report.sentAt).toLocaleString()}`}
      </div>

      {sectionOrder.map(({ key, label }) => {
        const body = sections[key] || '';
        const isEditing = editing === key;
        return (
          <div
            key={key}
            style={{
              background: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              padding: 20,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <h2 style={{ margin: 0, color: '#1B2A4A', fontSize: 16, fontWeight: 700 }}>{label}</h2>
              {!isEditing && (
                <button
                  onClick={() => startEdit(key, body)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#E8720C',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Edit
                </button>
              )}
            </div>
            {isEditing ? (
              <div>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={6}
                  style={{
                    width: '100%',
                    border: '1px solid #D1D5DB',
                    borderRadius: 4,
                    padding: 8,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => saveEdit(key)}
                    disabled={saving}
                    style={{
                      background: '#E8720C',
                      color: 'white',
                      border: 'none',
                      padding: '6px 16px',
                      borderRadius: 4,
                      cursor: saving ? 'wait' : 'pointer',
                      fontSize: 13,
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    style={{
                      background: 'white',
                      border: '1px solid #6B7280',
                      color: '#6B7280',
                      padding: '6px 16px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {body}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
