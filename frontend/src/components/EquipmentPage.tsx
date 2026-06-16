import { useEffect, useState } from 'react';
import { COLORS, FONTS, BORDERS } from '../styles/design-system';
import {
  getEquipmentRegistry,
  getEquipmentHistory,
  createEquipment,
  updateEquipment,
} from '../api';
import { EquipmentStatusModal } from './EquipmentStatusModal';

interface EquipmentItem {
  id: string;
  externalId: string;
  name: string;
  type: string | null;
  status: string;
  dailyRate: number | null;
  isOwned: boolean;
  lastUsageDate: string | null;
  updatedAt: string;
  calDueDate: string | null;
  calDueSoon: boolean;
  totalCostToDate: number;
  daysOnProject: number;
}

interface Props {
  projectId: string;
  canEdit: boolean;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: '#22C55E', fg: COLORS.white, label: 'Active' },
  idle: { bg: '#F59E0B', fg: COLORS.white, label: 'Idle' },
  standby: { bg: '#F59E0B', fg: COLORS.white, label: 'Standby' },
  offsite: { bg: '#9CA3AF', fg: COLORS.white, label: 'Offsite' },
  maintenance: { bg: '#9CA3AF', fg: COLORS.white, label: 'Maintenance' },
};

const TYPE_OPTIONS = [
  'Excavator', 'Crane', 'Pump Truck', 'Boom Lift', 'Skid Steer',
  'Welder', 'Torque Wrench', 'Trencher', 'Boring Machine', 'Compactor',
  'Generator', 'Other',
];

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  return d.slice(0, 10);
}

export function EquipmentPage({ projectId, canEdit }: Props) {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<EquipmentItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [logStatusOpen, setLogStatusOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getEquipmentRegistry(projectId);
      setItems(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const changeStatus = async (item: EquipmentItem, newStatus: string) => {
    try {
      await updateEquipment(projectId, item.id, { status: newStatus });
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: newStatus } : it)));
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, color: COLORS.textSecondary }}>Loading equipment…</div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 24, color: COLORS.red }}>{error}</div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: FONTS.family, background: COLORS.offWhite, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.navy, margin: 0 }}>
          Equipment
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setLogStatusOpen(true)}
            style={{
              background: COLORS.white,
              color: COLORS.navy,
              border: `1px solid ${COLORS.navy}`,
              padding: '8px 16px',
              borderRadius: BORDERS.radius.sm,
              fontSize: FONTS.size.sm,
              fontWeight: FONTS.weight.semibold,
              cursor: 'pointer',
            }}
          >
            Log Today's Status
          </button>
          {canEdit && (
            <button
              onClick={() => setAdding(true)}
              style={{
                background: COLORS.orange,
                color: COLORS.white,
                border: 'none',
                padding: '8px 16px',
                borderRadius: BORDERS.radius.sm,
                fontSize: FONTS.size.sm,
                fontWeight: FONTS.weight.semibold,
                cursor: 'pointer',
              }}
            >
              + Add Equipment
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: 32, background: COLORS.white, borderRadius: BORDERS.radius.md, textAlign: 'center', color: COLORS.textSecondary }}>
          No equipment registered. {canEdit ? 'Click "Add Equipment" to register your first piece.' : ''}
        </div>
      ) : (
        <div style={{ background: COLORS.white, borderRadius: BORDERS.radius.md, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: COLORS.gray100, borderBottom: `1px solid ${COLORS.gray200}` }}>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Daily Rate</Th>
                <Th>Owned / Rented</Th>
                <Th>Days</Th>
                <Th>Total Cost</Th>
                <Th>Last Updated</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const sc = STATUS_COLORS[item.status] || STATUS_COLORS.offsite;
                return (
                  <tr
                    key={item.id}
                    onClick={() => { setSelected(item); setEditing(false); }}
                    style={{ borderBottom: `1px solid ${COLORS.gray100}`, cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFAFA')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Td>
                      <div style={{ fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>{item.name}</div>
                      {item.calDueSoon && (
                        <span style={{ display: 'inline-block', marginTop: 2, padding: '2px 6px', background: COLORS.red, color: COLORS.white, fontSize: 10, borderRadius: 3, fontWeight: FONTS.weight.semibold }}>
                          Cal Due {fmtDate(item.calDueDate)}
                        </span>
                      )}
                    </Td>
                    <Td>{item.type || '—'}</Td>
                    <Td>
                      {canEdit ? (
                        <select
                          value={item.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => changeStatus(item, e.target.value)}
                          style={{
                            background: sc.bg,
                            color: sc.fg,
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: BORDERS.radius.sm,
                            fontSize: FONTS.size.xs,
                            fontWeight: FONTS.weight.semibold,
                            cursor: 'pointer',
                          }}
                        >
                          {Object.entries(STATUS_COLORS).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ background: sc.bg, color: sc.fg, padding: '2px 8px', borderRadius: BORDERS.radius.sm, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold }}>
                          {sc.label}
                        </span>
                      )}
                    </Td>
                    <Td>{item.dailyRate != null ? fmtMoney(item.dailyRate) : '—'}</Td>
                    <Td>{item.isOwned ? 'Owned' : 'Rented'}</Td>
                    <Td>{item.daysOnProject}</Td>
                    <Td>{fmtMoney(item.totalCostToDate)}</Td>
                    <Td>{fmtDate(item.updatedAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <EquipmentDrawer
          projectId={projectId}
          item={selected}
          canEdit={canEdit}
          editing={editing}
          onClose={() => setSelected(null)}
          onEdit={() => setEditing(true)}
          onCancelEdit={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}

      {adding && (
        <AddEquipmentModal
          projectId={projectId}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); load(); }}
        />
      )}

      {logStatusOpen && (
        <EquipmentStatusModal
          projectId={projectId}
          onClose={() => setLogStatusOpen(false)}
          onSaved={() => { setLogStatusOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      textAlign: 'left',
      padding: '12px 12px',
      fontSize: FONTS.size.xs,
      fontWeight: FONTS.weight.bold,
      color: COLORS.navy,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    }}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{
      padding: '12px 12px',
      fontSize: FONTS.size.sm,
      color: COLORS.textPrimary,
    }}>
      {children}
    </td>
  );
}

function EquipmentDrawer({
  projectId,
  item,
  canEdit,
  editing,
  onClose,
  onEdit,
  onCancelEdit,
  onSaved,
}: {
  projectId: string;
  item: EquipmentItem;
  canEdit: boolean;
  editing: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
}) {
  const [history, setHistory] = useState<any[]>([]);
  const [editForm, setEditForm] = useState<any>({
    name: item.name,
    type: item.type || '',
    dailyRate: item.dailyRate || 0,
    isOwned: item.isOwned,
    serialNumber: '',
    vendor: '',
    calDueDate: item.calDueDate ? item.calDueDate.slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getEquipmentHistory(projectId, item.id).then(setHistory).catch(() => setHistory([]));
  }, [projectId, item.id]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await updateEquipment(projectId, item.id, {
        name: editForm.name,
        type: editForm.type,
        dailyRate: Number(editForm.dailyRate),
        isOwned: !!editForm.isOwned,
        serialNumber: editForm.serialNumber || null,
        vendor: editForm.vendor || null,
        calDueDate: editForm.calDueDate || null,
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
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50,
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
        background: COLORS.white, zIndex: 51, padding: 24, overflowY: 'auto',
        boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.navy, margin: 0 }}>
            {editing ? 'Edit Equipment' : item.name}
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: COLORS.textSecondary,
            fontSize: FONTS.size.lg, cursor: 'pointer',
          }}>×</button>
        </div>

        {item.calDueSoon && (
          <div style={{ padding: 10, background: COLORS.red, color: COLORS.white, borderRadius: BORDERS.radius.sm, marginBottom: 12, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold }}>
            ⚠ Calibration due {fmtDate(item.calDueDate)}
          </div>
        )}

        {error && (
          <div style={{ padding: 10, background: '#FEE2E2', color: '#991B1B', borderRadius: BORDERS.radius.sm, marginBottom: 12, fontSize: FONTS.size.xs }}>
            {error}
          </div>
        )}

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Name">
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Type">
              <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} style={inputStyle}>
                <option value="">Select…</option>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Daily Rate">
              <input type="number" value={editForm.dailyRate} onChange={(e) => setEditForm({ ...editForm, dailyRate: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Owned">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={editForm.isOwned} onChange={(e) => setEditForm({ ...editForm, isOwned: e.target.checked })} />
                Owned (unchecked = rented)
              </label>
            </Field>
            <Field label="Serial Number">
              <input value={editForm.serialNumber} onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Vendor">
              <input value={editForm.vendor} onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Cal Due Date">
              <input type="date" value={editForm.calDueDate} onChange={(e) => setEditForm({ ...editForm, calDueDate: e.target.value })} style={inputStyle} />
            </Field>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={save} disabled={saving} style={{
                ...buttonPrimary,
                opacity: saving ? 0.6 : 1,
              }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={onCancelEdit} style={buttonSecondary}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <Section title="Details">
              <DetailRow label="Name" value={item.name} />
              <DetailRow label="Type" value={item.type || '—'} />
              <DetailRow label="Daily Rate" value={item.dailyRate != null ? fmtMoney(item.dailyRate) : '—'} />
              <DetailRow label="Owned" value={item.isOwned ? 'Owned' : 'Rented'} />
              <DetailRow label="External ID" value={item.externalId} />
              {item.calDueDate && <DetailRow label="Cal Due" value={fmtDate(item.calDueDate)} />}
            </Section>
            <Section title="Cost Summary">
              <DetailRow label="Days on Project" value={String(item.daysOnProject)} />
              <DetailRow label="Total Cost to Date" value={fmtMoney(item.totalCostToDate)} />
              <DetailRow label="Budgeted Daily Cost" value={item.dailyRate != null ? fmtMoney(item.dailyRate) : '—'} />
            </Section>
            <Section title="Status History">
              {history.length === 0 ? (
                <div style={{ color: COLORS.textSecondary, fontSize: FONTS.size.xs, fontStyle: 'italic' }}>No status logs yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {history.slice(0, 10).map((h) => (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: FONTS.size.xs, color: COLORS.textPrimary }}>
                      <span>{fmtDate(h.date)} — {h.status} ({h.hours}h)</span>
                      {h.notes && <span style={{ color: COLORS.textSecondary }}>{h.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
            </Section>
            {canEdit && (
              <button onClick={onEdit} style={{ ...buttonPrimary, marginTop: 16 }}>
                Edit
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

function AddEquipmentModal({
  projectId,
  onClose,
  onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({
    name: '',
    type: 'Excavator',
    dailyRate: 0,
    isOwned: false,
    serialNumber: '',
    vendor: '',
    calDueDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await createEquipment(projectId, {
        name: form.name,
        type: form.type,
        dailyRate: Number(form.dailyRate),
        isOwned: !!form.isOwned,
        serialNumber: form.serialNumber || undefined,
        vendor: form.vendor || undefined,
        calDueDate: form.calDueDate || undefined,
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
        width: 480, maxWidth: '90vw',
      }}>
        <h2 style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.navy, margin: '0 0 16px' }}>
          Add Equipment
        </h2>
        {error && <div style={{ padding: 8, background: '#FEE2E2', color: '#991B1B', borderRadius: BORDERS.radius.sm, marginBottom: 12, fontSize: FONTS.size.xs }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Name (required)">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle}>
              {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Daily Rate (required)">
            <input type="number" value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Ownership">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={form.isOwned} onChange={(e) => setForm({ ...form, isOwned: e.target.checked })} />
              Owned
            </label>
          </Field>
          <Field label="Serial Number (optional)">
            <input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Vendor (optional)">
            <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Cal Due Date (optional)">
            <input type="date" value={form.calDueDate} onChange={(e) => setForm({ ...form, calDueDate: e.target.value })} style={inputStyle} />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={buttonSecondary}>Cancel</button>
          <button onClick={save} disabled={saving || !form.name || !form.dailyRate} style={{
            ...buttonPrimary,
            opacity: (saving || !form.name || !form.dailyRate) ? 0.5 : 1,
          }}>
            {saving ? 'Saving…' : 'Add Equipment'}
          </button>
        </div>
      </div>
    </>
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
  background: COLORS.orange,
  color: COLORS.white,
  border: 'none',
  padding: '8px 16px',
  borderRadius: BORDERS.radius.sm,
  fontSize: FONTS.size.sm,
  fontWeight: FONTS.weight.semibold,
  cursor: 'pointer',
};

const buttonSecondary: React.CSSProperties = {
  background: COLORS.white,
  color: COLORS.navy,
  border: `1px solid ${COLORS.gray200}`,
  padding: '8px 16px',
  borderRadius: BORDERS.radius.sm,
  fontSize: FONTS.size.sm,
  fontWeight: FONTS.weight.semibold,
  cursor: 'pointer',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginBottom: 4, fontWeight: FONTS.weight.semibold }}>{label}</label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold, color: COLORS.navy, textTransform: 'uppercase', marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${COLORS.gray200}` }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FONTS.size.sm }}>
      <span style={{ color: COLORS.textSecondary }}>{label}</span>
      <span style={{ color: COLORS.textPrimary, fontWeight: FONTS.weight.medium }}>{value}</span>
    </div>
  );
}
