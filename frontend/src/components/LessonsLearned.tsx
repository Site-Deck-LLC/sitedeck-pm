/**
 * Lessons Learned page
 * ============================================================================
 * List, filter, add, and flag-for-template lessons for a project.
 *
 * Categories (string-tabs at the top): All / Schedule / Cost / Procurement /
 * Quality / Safety / Communications / Risk / Other.
 *
 * Source badges:
 *   🤖 Agent — auto-flagged from pattern detection
 *   👤 PM — manually entered
 *   🔧 Field — field-reported (future)
 *
 * "Add to Template" toggle per lesson sets addedToTemplate=true so the
 * lesson rides along when the project is saved as a template.
 */

import { useEffect, useState, useCallback } from 'react';
import { fetchApi } from '../api';

interface Lesson {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  category: string;
  source: string;
  impact: string | null;
  recommendation: string | null;
  dfowRef: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  addedToTemplate: boolean;
}

const CATEGORIES = [
  'all',
  'schedule',
  'cost',
  'procurement',
  'quality',
  'safety',
  'communications',
  'risk',
  'other',
];

const SOURCE_BADGE: Record<string, { icon: string; label: string; color: string }> = {
  agent_flagged: { icon: '🤖', label: 'Agent', color: '#F59E0B' },
  pm_entered: { icon: '👤', label: 'PM', color: '#1B2A4A' },
  field_reported: { icon: '🔧', label: 'Field', color: '#22A06B' },
};

interface Props {
  projectId: string;
  onBack: () => void;
}

export function LessonsLearned({ projectId, onBack }: Props) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = activeCategory === 'all' ? '' : `?category=${activeCategory}`;
      const list = await fetchApi(`/api/v1/projects/${projectId}/lessons${query}`);
      setLessons(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId, activeCategory]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFlagTemplate = async (lesson: Lesson) => {
    try {
      await fetchApi(`/api/v1/projects/${projectId}/lessons/${lesson.id}/flag-template`, {
        method: 'POST',
        body: JSON.stringify({ on: !lesson.addedToTemplate }),
      });
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      await fetchApi(`/api/v1/projects/${projectId}/lessons/scan-patterns`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
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
        <h1 style={{ flex: 1, color: '#1B2A4A', margin: 0, fontSize: 24 }}>Lessons Learned</h1>
        <button
          onClick={handleScan}
          disabled={scanning}
          style={{
            background: 'white',
            border: '1px solid #1B2A4A',
            color: '#1B2A4A',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: scanning ? 'wait' : 'pointer',
            fontSize: 13,
            marginRight: 8,
          }}
        >
          {scanning ? 'Scanning…' : 'Scan for Patterns'}
        </button>
        <button
          onClick={() => setShowAdd(true)}
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
          + Add Lesson
        </button>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            style={{
              background: activeCategory === c ? '#1B2A4A' : 'white',
              color: activeCategory === c ? 'white' : '#1B2A4A',
              border: '1px solid #1B2A4A',
              padding: '6px 12px',
              borderRadius: 16,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#6B7280' }}>Loading…</div>
      ) : lessons.length === 0 ? (
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
          No lessons yet. Click "Add Lesson" or "Scan for Patterns" to start.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lessons.map((l) => {
            const badge = SOURCE_BADGE[l.source] || { icon: '?', label: l.source, color: '#6B7280' };
            const expanded = expandedId === l.id;
            return (
              <div
                key={l.id}
                style={{
                  background: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      background: badge.color,
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {badge.icon} {badge.label}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#1B2A4A', fontWeight: 600, fontSize: 14 }}>{l.title}</div>
                    <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
                      {new Date(l.createdAt).toLocaleDateString()} • {l.category}
                      {l.dfowRef && ` • DFOW: ${l.dfowRef}`}
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedId(expanded ? null : l.id)}
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
                    {expanded ? 'Collapse' : 'Expand'}
                  </button>
                </div>

                {expanded && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F3F4F6' }}>
                    {l.description && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ color: '#6B7280', fontSize: 11, fontWeight: 600 }}>DESCRIPTION</div>
                        <div style={{ color: '#374151', fontSize: 13, marginTop: 2 }}>{l.description}</div>
                      </div>
                    )}
                    {l.impact && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ color: '#6B7280', fontSize: 11, fontWeight: 600 }}>IMPACT</div>
                        <div style={{ color: '#374151', fontSize: 13, marginTop: 2 }}>{l.impact}</div>
                      </div>
                    )}
                    {l.recommendation && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ color: '#6B7280', fontSize: 11, fontWeight: 600 }}>RECOMMENDATION</div>
                        <div style={{ color: '#374151', fontSize: 13, marginTop: 2 }}>{l.recommendation}</div>
                      </div>
                    )}
                    <button
                      onClick={() => handleFlagTemplate(l)}
                      style={{
                        background: l.addedToTemplate ? '#22A06B' : 'white',
                        color: l.addedToTemplate ? 'white' : '#22A06B',
                        border: '1px solid #22A06B',
                        padding: '6px 12px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        marginTop: 4,
                      }}
                    >
                      {l.addedToTemplate ? '✓ Added to Template' : 'Add to Template'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddLessonModal
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddLessonModal({
  projectId,
  onClose,
  onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('schedule');
  const [impact, setImpact] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [dfowRef, setDfowRef] = useState('');
  const [addedToTemplate, setAddedToTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await fetchApi(`/api/v1/projects/${projectId}/lessons`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          category,
          impact,
          recommendation,
          dfowRef,
          addedToTemplate,
        }),
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
      <div
        style={{
          background: 'white',
          borderRadius: 8,
          padding: 24,
          width: 480,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 16px', color: '#1B2A4A', fontSize: 18 }}>Add Lesson</h2>
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
        <Field label="Title" required>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
            placeholder="What happened?"
          />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            {CATEGORIES.filter((c) => c !== 'all').map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="What went wrong or right? (impact)">
          <textarea
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            rows={3}
            style={inputStyle}
          />
        </Field>
        <Field label="What to do next time? (recommendation)">
          <textarea
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            rows={3}
            style={inputStyle}
          />
        </Field>
        <Field label="DFOW / activity reference (optional)">
          <input value={dfowRef} onChange={(e) => setDfowRef(e.target.value)} style={inputStyle} />
        </Field>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            fontSize: 13,
            color: '#374151',
          }}
        >
          <input
            type="checkbox"
            checked={addedToTemplate}
            onChange={(e) => setAddedToTemplate(e.target.checked)}
          />
          Add to Template (include when project is saved as a template)
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
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
            disabled={!title || saving}
            style={{
              background: '#E8720C',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: !title || saving ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              opacity: !title || saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Lesson'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: any }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: 'block',
          color: '#374151',
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
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
