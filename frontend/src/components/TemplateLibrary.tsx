/**
 * Template Library page
 * ============================================================================
 * Browse, create from, and delete full-snapshot project templates. The
 * library is org-scoped — every action resolves the org from the URL
 * :projectId (for save-as) or from the existing /templates endpoints
 * (for list/get/delete).
 *
 * "Create from template" is a two-step flow:
 *   1. PM creates a fresh project via POST /api/v1/projects
 *   2. PM applies the chosen template to it via POST /:projectId/templates/:id/apply
 * The apply is idempotent — re-running after partial completion is safe.
 *
 * Source: /Volumes/Extra Storage/SiteDeckPM/frontend/src/components/TemplateLibrary.tsx
 */

import { useEffect, useState, useCallback } from 'react';
import { fetchApi } from '../api';

interface TemplateSummary {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  structureType: string;
  sourceProjectId: string | null;
  counts: { wbs: number; activities: number; budget: number; risks: number; lessons: number };
  createdBy: string;
  createdAt: string;
}

interface TemplateDetail extends TemplateSummary {
  activities: any[];
  budget: any[];
  risks: any[];
  lessons: any[];
}

interface Props {
  onBack: () => void;
  // When the PM picks "Create from template" we land them back on the
  // project list. The new project id is returned.
  onProjectCreated: (projectId: string) => void;
}

export function TemplateLibrary({ onBack, onProjectCreated }: Props) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<TemplateDetail | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The endpoint is org-scoped. We need a projectId in the URL to
      // resolve the org. Use any project the user can read.
      const projects = await fetchApi('/api/v1/projects');
      if (!Array.isArray(projects) || projects.length === 0) {
        setTemplates([]);
        return;
      }
      const list = await fetchApi(`/api/v1/projects/${projects[0].id}/templates`);
      setTemplates(list);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

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
      const projects = await fetchApi('/api/v1/projects');
      const detail = await fetchApi(`/api/v1/projects/${projects[0].id}/templates/${id}`);
      setExpandedDetail(detail);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCreateFromTemplate = async (template: TemplateSummary) => {
    setApplying(template.id);
    setError(null);
    try {
      // Step 1: create a fresh project.
      const projects = await fetchApi('/api/v1/projects');
      const sourceProjectId = projects[0].id;
      const newProject = await fetchApi('/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: `${template.name} (copy)`,
          orgId: projects[0].orgId,
          structureType: template.structureType,
        }),
      });
      // Step 2: apply the template to the new project.
      await fetchApi(`/api/v1/projects/${sourceProjectId}/templates/${template.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ targetProjectId: newProject.id }),
      });
      onProjectCreated(newProject.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApplying(null);
    }
  };

  const handleDelete = async (template: TemplateSummary) => {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    try {
      const projects = await fetchApi('/api/v1/projects');
      await fetchApi(`/api/v1/projects/${projects[0].id}/templates/${template.id}`, {
        method: 'DELETE',
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

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
        <h1 style={{ flex: 1, color: '#1B2A4A', margin: 0, fontSize: 24 }}>Project Templates</h1>
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
          + New from Scratch
        </button>
      </div>

      <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 16 }}>
        Save an existing project as a template to reuse its WBS, activity shells, budget structure,
        risk register, and lessons learned on the next project.
      </p>

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
      ) : templates.length === 0 ? (
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
          No templates yet. Save a project as a template from its dashboard to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map((t) => {
            const expanded = expandedId === t.id;
            return (
              <div
                key={t.id}
                style={{
                  background: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#1B2A4A', fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                    {t.description && (
                      <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{t.description}</div>
                    )}
                    <div style={{ color: '#6B7280', fontSize: 11, marginTop: 4 }}>
                      {t.counts.wbs} WBS · {t.counts.activities} activities · {t.counts.budget}{' '}
                      budget · {t.counts.risks} risks · {t.counts.lessons} lessons ·{' '}
                      {new Date(t.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleExpand(t.id)}
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
                    {expanded ? 'Collapse' : 'Inspect'}
                  </button>
                  <button
                    onClick={() => handleCreateFromTemplate(t)}
                    disabled={applying === t.id}
                    style={{
                      background: '#E8720C',
                      color: 'white',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: 4,
                      cursor: applying === t.id ? 'wait' : 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {applying === t.id ? 'Creating…' : 'Use Template'}
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    style={{
                      background: 'none',
                      border: '1px solid #EF4444',
                      color: '#EF4444',
                      padding: '4px 12px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    Delete
                  </button>
                </div>

                {expanded && expandedDetail && (
                  <div
                    style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F3F4F6', fontSize: 12 }}
                  >
                    {expandedDetail.activities.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ color: '#6B7280', fontWeight: 600, fontSize: 11 }}>
                          ACTIVITY SHELLS
                        </div>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0, color: '#374151' }}>
                          {expandedDetail.activities.slice(0, 10).map((a: any, i: number) => (
                            <li key={i}>
                              {a.name} — {a.plannedDurationDays}d
                            </li>
                          ))}
                          {expandedDetail.activities.length > 10 && (
                            <li style={{ color: '#6B7280' }}>
                              …and {expandedDetail.activities.length - 10} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                    {expandedDetail.lessons.length > 0 && (
                      <div>
                        <div style={{ color: '#6B7280', fontWeight: 600, fontSize: 11 }}>
                          LESSONS CARRIED OVER
                        </div>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0, color: '#374151' }}>
                          {expandedDetail.lessons.map((l: any, i: number) => (
                            <li key={i}>{l.title}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            onProjectCreated(id);
          }}
        />
      )}
    </div>
  );
}

function CreateProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [structureType, setStructureType] = useState('wbs');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const projects = await fetchApi('/api/v1/projects');
      const created = await fetchApi('/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify({
          name,
          orgId: projects[0].orgId,
          structureType,
        }),
      });
      onCreated(created.id);
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
      <div
        style={{
          background: 'white',
          borderRadius: 8,
          padding: 24,
          width: 420,
        }}
      >
        <h2 style={{ margin: '0 0 16px', color: '#1B2A4A', fontSize: 18 }}>New Project</h2>
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
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', color: '#374151', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              border: '1px solid #D1D5DB',
              borderRadius: 4,
              padding: 8,
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', color: '#374151', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Structure Type
          </label>
          <select
            value={structureType}
            onChange={(e) => setStructureType(e.target.value)}
            style={{
              width: '100%',
              border: '1px solid #D1D5DB',
              borderRadius: 4,
              padding: 8,
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          >
            <option value="wbs">WBS</option>
            <option value="cost_code">Cost Code</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              background: 'white',
              border: '1px solid #6B7280',
              color: '#6B7280',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || saving}
            style={{
              background: '#E8720C',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: !name || saving ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              opacity: !name || saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
