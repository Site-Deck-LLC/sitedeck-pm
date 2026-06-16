import { useEffect, useState } from 'react';
import { COLORS, FONTS, BORDERS } from '../styles/design-system';
import { fetchApi } from '../api';

interface WbsNode {
  id: string;
  code: string;
  name: string;
  level: number;
  parentId: string | null;
  budget: number;
  actualCost: number;
  percentComplete: number;
  costVariance: number;
  colorStatus: 'green' | 'amber' | 'red' | 'gray';
  childCount: number;
  children: WbsNode[];
}

interface CrosswalkEntry {
  id: string;
  gcItemId: string;
  gcItemCode: string;
  gcItemName: string;
  subItemId: string;
  subItemCode: string;
  subItemName: string;
}

interface Props {
  projectId: string;
  canEdit: boolean;
  structureType: 'wbs' | 'cost_code';
}

const COLORS_BY_STATUS: Record<string, string> = {
  green: '#22C55E',
  amber: '#F59E0B',
  red: '#EF4444',
  gray: '#9CA3AF',
};

function fmtMoney(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function WbsBuilder({ projectId, canEdit, structureType }: Props) {
  const [tree, setTree] = useState<WbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'tree' | 'crosswalk'>('tree');
  const [adding, setAdding] = useState<{ parentId: string | null } | null>(null);
  const [editing, setEditing] = useState<WbsNode | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchApi(`/api/v1/projects/${projectId}/wbs/`);
      setTree(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const elementLabel = structureType === 'cost_code' ? 'Cost Code' : 'WBS Element';
  const rootLabel = structureType === 'cost_code' ? 'Cost Codes' : 'WBS';

  if (loading) return <div style={{ padding: 24, color: COLORS.textSecondary }}>Loading {rootLabel}…</div>;
  if (error) return <div style={{ padding: 24, color: COLORS.red }}>{error}</div>;

  return (
    <div style={{ padding: 24, fontFamily: FONTS.family, background: COLORS.offWhite, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.navy, margin: 0 }}>
          {rootLabel}
        </h1>
        <div style={{ display: 'flex', gap: 4 }}>
          <Tab active={tab === 'tree'} onClick={() => setTab('tree')}>Tree</Tab>
          <Tab active={tab === 'crosswalk'} onClick={() => setTab('crosswalk')}>Crosswalk</Tab>
        </div>
      </div>

      {tab === 'tree' ? (
        <>
          {canEdit && tree.length > 0 && (
            <button
              onClick={() => setAdding({ parentId: null })}
              style={{
                background: COLORS.orange, color: COLORS.white, border: 'none',
                padding: '8px 16px', borderRadius: BORDERS.radius.sm,
                fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold,
                cursor: 'pointer', marginBottom: 12,
              }}
            >
              + Add {elementLabel}
            </button>
          )}

          {tree.length === 0 ? (
            <div style={{ padding: 32, background: COLORS.white, borderRadius: BORDERS.radius.md, textAlign: 'center', color: COLORS.textSecondary }}>
              No {rootLabel.toLowerCase()} yet. {canEdit ? `Click "Add ${elementLabel}" to create the first one.` : ''}
            </div>
          ) : (
            <div style={{ background: COLORS.white, borderRadius: BORDERS.radius.md, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              {tree.map((node) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  canEdit={canEdit}
                  elementLabel={elementLabel}
                  onAdd={(parentId) => setAdding({ parentId })}
                  onEdit={(n) => setEditing(n)}
                  onDeleted={load}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <CrosswalkTab projectId={projectId} canEdit={canEdit} />
      )}

      {adding && (
        <EditModal
          projectId={projectId}
          mode="add"
          parentId={adding.parentId}
          structureType={structureType}
          onClose={() => setAdding(null)}
          onSaved={() => { setAdding(null); load(); }}
        />
      )}

      {editing && (
        <EditModal
          projectId={projectId}
          mode="edit"
          initial={editing}
          structureType={structureType}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? COLORS.navy : COLORS.white,
        color: active ? COLORS.white : COLORS.textSecondary,
        border: `1px solid ${active ? COLORS.navy : COLORS.gray200}`,
        padding: '6px 14px',
        borderRadius: BORDERS.radius.sm,
        fontSize: FONTS.size.sm,
        fontWeight: FONTS.weight.semibold,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function TreeRow({
  node, depth, canEdit, elementLabel, onAdd, onEdit, onDeleted,
}: {
  node: WbsNode;
  depth: number;
  canEdit: boolean;
  elementLabel: string;
  onAdd: (parentId: string) => void;
  onEdit: (n: WbsNode) => void;
  onDeleted: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const dot = COLORS_BY_STATUS[node.colorStatus] || COLORS_BY_STATUS.gray;
  const hasChildren = node.children.length > 0;
  const projId = window.location.pathname.split('/')[2];
  const codeHint = /^\d+$/.test(node.code) && node.code.length >= 6
    ? `${node.code.slice(0, 2)}.${node.code.slice(2)}` : node.code;

  const onDelete = async () => {
    if (!confirm(`Delete ${node.name} (${codeHint})?`)) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetchApi(`/api/v1/projects/${projId}/wbs/${node.id}`, { method: 'DELETE' });
      if (res.deleted) {
        onDeleted();
      } else {
        setDeleteError(`Cannot delete — ${res.blockers.activityCount} activities and ${res.blockers.costLineCount} cost lines reference this ${elementLabel.toLowerCase()}`);
      }
    } catch (e: any) {
      setDeleteError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 8px',
          paddingLeft: 8 + depth * 24,
          borderBottom: `1px solid ${COLORS.gray100}`,
          gap: 8,
        }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: COLORS.textSecondary, fontSize: FONTS.size.xs, width: 16 }}
        >
          {hasChildren ? (expanded ? '▾' : '▸') : ' '}
        </button>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} title={`Status: ${node.colorStatus}`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, fontFamily: 'monospace' }}>{codeHint}</span>
            <span style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary, fontWeight: FONTS.weight.semibold }}>{node.name}</span>
          </div>
          {deleteError && (
            <div style={{ marginTop: 4, fontSize: FONTS.size.xs, color: COLORS.red }}>{deleteError}</div>
          )}
        </div>
        <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, textAlign: 'right', minWidth: 120 }}>
          {node.budget > 0 ? (
            <>
              <div>{fmtMoney(node.budget)} budget</div>
              <div style={{ color: node.actualCost > node.budget ? COLORS.red : COLORS.textSecondary }}>
                {fmtMoney(node.actualCost)} actual
              </div>
            </>
          ) : '—'}
        </div>
        <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, minWidth: 60, textAlign: 'right' }}>
          {Math.round(node.percentComplete * 100)}% complete
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 4 }}>
            {depth < 3 && (
              <button onClick={() => onAdd(node.id)} style={iconButtonStyle} title={`Add child ${elementLabel}`}>+</button>
            )}
            <button onClick={() => onEdit(node)} style={iconButtonStyle} title="Edit">✎</button>
            <button onClick={onDelete} disabled={deleting} style={iconButtonStyle} title="Delete">×</button>
          </div>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((c) => (
            <TreeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              canEdit={canEdit}
              elementLabel={elementLabel}
              onAdd={onAdd}
              onEdit={onEdit}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const iconButtonStyle: React.CSSProperties = {
  background: COLORS.gray100, border: 'none', color: COLORS.textSecondary,
  width: 24, height: 24, borderRadius: BORDERS.radius.sm, fontSize: FONTS.size.sm,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

interface EditModalProps {
  projectId: string;
  mode: 'add' | 'edit';
  parentId?: string | null;
  initial?: WbsNode;
  structureType: 'wbs' | 'cost_code';
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ projectId, mode, parentId, initial, structureType, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState<any>({
    code: initial?.code || '',
    name: initial?.name || '',
    parentId: initial?.parentId || parentId || null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (mode === 'add') {
        await fetchApi(`/api/v1/projects/${projectId}/wbs/`, {
          method: 'POST',
          body: JSON.stringify({ code: form.code, name: form.name, parentId: form.parentId }),
        });
      } else {
        await fetchApi(`/api/v1/projects/${projectId}/wbs/${initial!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: form.name, code: form.code }),
        });
      }
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const codeFormat = structureType === 'cost_code' ? 'XX.XXXX' : 'XX.XX.XX';

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: COLORS.white, zIndex: 51, padding: 24, borderRadius: BORDERS.radius.md,
        width: 420,
      }}>
        <h2 style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.navy, margin: '0 0 12px' }}>
          {mode === 'add' ? 'Add' : 'Edit'} {structureType === 'cost_code' ? 'Cost Code' : 'WBS Element'}
        </h2>
        {error && <div style={{ padding: 8, background: '#FEE2E2', color: '#991B1B', borderRadius: BORDERS.radius.sm, marginBottom: 12, fontSize: FONTS.size.xs }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label={`Code (suggested format: ${codeFormat})`}>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              disabled={mode === 'edit'}
              placeholder={codeFormat}
              title={mode === 'edit' ? 'Locked — activities reference this element' : ''}
              style={{
                ...inputStyle,
                background: mode === 'edit' ? COLORS.gray100 : COLORS.white,
                color: mode === 'edit' ? COLORS.textSecondary : COLORS.textPrimary,
              }}
            />
          </Field>
          <Field label="Name (required)">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={buttonSecondary}>Cancel</button>
          <button onClick={save} disabled={saving || !form.name || !form.code} style={{
            ...buttonPrimary,
            opacity: (saving || !form.name || !form.code) ? 0.5 : 1,
          }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </>
  );
}

function CrosswalkTab({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const [entries, setEntries] = useState<CrosswalkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [tree, setTree] = useState<WbsNode[]>([]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [cw, tr] = await Promise.all([
        fetchApi(`/api/v1/projects/${projectId}/wbs/crosswalk`),
        fetchApi(`/api/v1/projects/${projectId}/wbs/`),
      ]);
      setEntries(cw);
      setTree(tr);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const flat = (nodes: WbsNode[], out: WbsNode[] = []): WbsNode[] => {
    for (const n of nodes) {
      out.push(n);
      if (n.children.length) flat(n.children, out);
    }
    return out;
  };

  const allItems = flat(tree);

  const remove = async (id: string) => {
    if (!confirm('Remove this mapping?')) return;
    try {
      await fetchApi(`/api/v1/projects/${projectId}/wbs/crosswalk/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) return <div style={{ padding: 24, color: COLORS.textSecondary }}>Loading crosswalk…</div>;

  return (
    <div style={{ background: COLORS.white, borderRadius: BORDERS.radius.md, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      {error && <div style={{ padding: 8, background: '#FEE2E2', color: '#991B1B', borderRadius: BORDERS.radius.sm, marginBottom: 12, fontSize: FONTS.size.xs }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ fontSize: FONTS.size.md, color: COLORS.navy, margin: 0 }}>GC ↔ Sub Mapping</h3>
        {canEdit && <button onClick={() => setAdding(true)} style={buttonPrimary}>+ Add Mapping</button>}
      </div>
      {entries.length === 0 ? (
        <div style={{ padding: 16, color: COLORS.textSecondary, fontSize: FONTS.size.sm, textAlign: 'center' }}>No mappings yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
              <Th>GC Code</Th>
              <Th>GC Name</Th>
              <Th> </Th>
              <Th>Sub Code</Th>
              <Th>Sub Name</Th>
              {canEdit && <Th> </Th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={{ borderBottom: `1px solid ${COLORS.gray100}` }}>
                <Td><span style={{ fontFamily: 'monospace', fontSize: FONTS.size.xs }}>{e.gcItemCode}</span></Td>
                <Td>{e.gcItemName}</Td>
                <Td>→</Td>
                <Td><span style={{ fontFamily: 'monospace', fontSize: FONTS.size.xs }}>{e.subItemCode}</span></Td>
                <Td>{e.subItemName}</Td>
                {canEdit && (
                  <Td>
                    <button onClick={() => remove(e.id)} style={iconButtonStyle}>×</button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {adding && (
        <CrosswalkAddModal
          projectId={projectId}
          items={allItems}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); load(); }}
        />
      )}
    </div>
  );
}

function CrosswalkAddModal({ projectId, items, onClose, onSaved }: { projectId: string; items: WbsNode[]; onClose: () => void; onSaved: () => void }) {
  const [gcId, setGcId] = useState('');
  const [subId, setSubId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!gcId || !subId) {
      setError('Select both items');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await fetchApi(`/api/v1/projects/${projectId}/wbs/crosswalk`, {
        method: 'POST',
        body: JSON.stringify({ gcItemId: gcId, subItemId: subId }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: COLORS.white, zIndex: 51, padding: 24, borderRadius: BORDERS.radius.md,
        width: 480,
      }}>
        <h2 style={{ fontSize: FONTS.size.lg, color: COLORS.navy, margin: '0 0 12px' }}>Add Crosswalk Mapping</h2>
        {error && <div style={{ padding: 8, background: '#FEE2E2', color: '#991B1B', borderRadius: BORDERS.radius.sm, marginBottom: 12, fontSize: FONTS.size.xs }}>{error}</div>}
        <Field label="GC Item">
          <select value={gcId} onChange={(e) => setGcId(e.target.value)} style={inputStyle}>
            <option value="">Select…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.code} — {i.name}</option>)}
          </select>
        </Field>
        <Field label="Sub Item">
          <select value={subId} onChange={(e) => setSubId(e.target.value)} style={inputStyle}>
            <option value="">Select…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.code} — {i.name}</option>)}
          </select>
        </Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={buttonSecondary}>Cancel</button>
          <button onClick={save} disabled={saving || !gcId || !subId} style={buttonPrimary}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: 'left', padding: 8, fontSize: FONTS.size.xs, color: COLORS.navy, textTransform: 'uppercase' }}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: 8, fontSize: FONTS.size.sm, color: COLORS.textPrimary }}>{children}</td>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginBottom: 4, fontWeight: FONTS.weight.semibold }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: `1px solid ${COLORS.gray200}`,
  borderRadius: BORDERS.radius.sm,
  fontSize: FONTS.size.sm,
  fontFamily: FONTS.family,
  color: COLORS.textPrimary,
  boxSizing: 'border-box',
};

const buttonPrimary: React.CSSProperties = {
  background: COLORS.orange, color: COLORS.white, border: 'none',
  padding: '8px 16px', borderRadius: BORDERS.radius.sm,
  fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, cursor: 'pointer',
};

const buttonSecondary: React.CSSProperties = {
  background: COLORS.white, color: COLORS.navy, border: `1px solid ${COLORS.gray200}`,
  padding: '8px 16px', borderRadius: BORDERS.radius.sm,
  fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, cursor: 'pointer',
};
