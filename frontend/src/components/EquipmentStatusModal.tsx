import { useEffect, useState } from 'react';
import { COLORS, FONTS, BORDERS, SHADOWS } from '../styles/design-system';
import {
  getEquipment,
  getEquipmentStatusLog,
  postEquipment,
  postEquipmentStatusLog,
} from '../api';
import { canEditSchedule } from '../auth';

interface Equipment {
  id: string;
  externalId: string;
  name: string;
  type?: string | null;
  status: string;
  totalHours: number;
}

interface StatusLog {
  id: string;
  equipmentId: string;
  date: string;
  status: string;
  hours: number;
  notes: string | null;
  loggedBy: string | null;
  equipment?: { id: string; externalId: string; name: string };
}

interface Row {
  equipmentId: string;
  status: string;
  hours: string;
  notes: string;
}

interface Props {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'idle', label: 'Idle' },
  { value: 'standby', label: 'Standby' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'broken', label: 'Broken Down' },
  { value: 'off_site', label: 'Off Site' },
];

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  active: { bg: '#DCFCE7', fg: '#166534' },
  idle: { bg: '#FEF3C7', fg: '#B45309' },
  standby: { bg: '#FEF3C7', fg: '#B45309' },
  maintenance: { bg: '#E0E7FF', fg: '#1B2A4A' },
  broken: { bg: '#FEE2E2', fg: '#991B1B' },
  off_site: { bg: '#F0F1F3', fg: '#5A6072' },
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function EquipmentStatusModal({ projectId, onClose, onSaved }: Props) {
  const canEdit = canEditSchedule();
  const [date, setDate] = useState<string>(todayIso());
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [recent, setRecent] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Add equipment form
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [newExtId, setNewExtId] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newType, setNewType] = useState<string>('');
  const [adding, setAdding] = useState<boolean>(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [eqRes, logRes] = await Promise.all([
        getEquipment(projectId).catch(() => []),
        getEquipmentStatusLog(projectId).catch(() => []),
      ]);
      const items = (Array.isArray(eqRes) ? eqRes : eqRes?.items || eqRes?.data || []) as Equipment[];
      setEquipment(items);
      // Pre-fill rows from each equipment's current status
      const initial: Record<string, Row> = {};
      items.forEach((e) => {
        initial[e.id] = {
          equipmentId: e.id,
          status: e.status || 'active',
          hours: '0',
          notes: '',
        };
      });
      setRows(initial);
      setRecent((Array.isArray(logRes) ? logRes : logRes?.items || logRes?.data || []) as StatusLog[]);
    } catch (e: any) {
      setError(e.message || 'Failed to load equipment');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  // Escape closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function saveAll() {
    setSaving(true);
    setError('');
    try {
      const updates = Object.values(rows).filter((r) =>
        r.hours !== '' && Number(r.hours) > 0 || r.notes.trim() !== ''
      );
      for (const r of updates) {
        await postEquipmentStatusLog(projectId, {
          equipmentId: r.equipmentId,
          date,
          status: r.status,
          hours: Number(r.hours) || 0,
          notes: r.notes || undefined,
        });
      }
      await load();
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Failed to save status log');
    } finally {
      setSaving(false);
    }
  }

  async function addEquipment() {
    if (!newExtId.trim() || !newName.trim()) {
      setError('External ID and name are required');
      return;
    }
    setAdding(true);
    setError('');
    try {
      await postEquipment(projectId, {
        externalId: newExtId.trim(),
        name: newName.trim(),
        type: newType.trim() || undefined,
      });
      setNewExtId('');
      setNewName('');
      setNewType('');
      setShowAdd(false);
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to add equipment');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(27, 42, 74, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
    >
      <div style={{
        background: COLORS.white,
        borderRadius: BORDERS.radius.lg,
        boxShadow: SHADOWS.lg,
        width: '100%',
        maxWidth: 800,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${COLORS.gray200}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
              Log Equipment Status
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
              Update status, hours today, and notes for each piece of equipment on site
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: COLORS.textMuted,
              fontSize: 22,
              cursor: 'pointer',
              padding: 0,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: COLORS.textSecondary, padding: 24 }}>Loading…</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>
                  <span>Date:</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={inputStyle}
                  />
                </label>
                {canEdit && (
                  <button
                    onClick={() => setShowAdd((s) => !s)}
                    style={{
                      background: 'transparent',
                      color: COLORS.navy,
                      border: `1px solid ${COLORS.navy}`,
                      padding: '4px 10px',
                      borderRadius: BORDERS.radius.sm,
                      fontSize: FONTS.size.xs,
                      fontWeight: FONTS.weight.semibold,
                      cursor: 'pointer',
                    }}
                  >
                    {showAdd ? '− Cancel Add' : '+ Add Equipment'}
                  </button>
                )}
              </div>

              {showAdd && (
                <div style={{
                  background: COLORS.gray100,
                  padding: 12,
                  borderRadius: BORDERS.radius.sm,
                  marginBottom: 16,
                  display: 'grid',
                  gridTemplateColumns: '1fr 2fr 1fr auto',
                  gap: 8,
                  alignItems: 'end',
                }}>
                  <label style={fieldLabelStyle}>
                    <span style={labelTextStyle}>External ID</span>
                    <input
                      type="text"
                      value={newExtId}
                      onChange={(e) => setNewExtId(e.target.value)}
                      placeholder="EQ-101"
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    <span style={labelTextStyle}>Name</span>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="CAT 320 Excavator"
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    <span style={labelTextStyle}>Type</span>
                    <input
                      type="text"
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      placeholder="Excavator"
                      style={inputStyle}
                    />
                  </label>
                  <button
                    onClick={addEquipment}
                    disabled={adding}
                    style={primaryButtonStyle(adding)}
                  >
                    {adding ? 'Adding…' : 'Add'}
                  </button>
                </div>
              )}

              {equipment.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: COLORS.textMuted,
                  padding: '24px 0',
                  fontSize: FONTS.size.sm,
                }}>
                  No equipment on this project yet. {canEdit && 'Use "Add Equipment" above to create one.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {equipment.map((e) => {
                    const row = rows[e.id] || { status: e.status, hours: '0', notes: '' };
                    const sc = STATUS_COLORS[row.status] || STATUS_COLORS.active;
                    return (
                      <div
                        key={e.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 140px 90px 1.5fr',
                          gap: 8,
                          alignItems: 'center',
                          padding: 8,
                          background: COLORS.gray100,
                          borderRadius: BORDERS.radius.sm,
                          borderLeft: `3px solid ${sc.bg}`,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>
                            {e.name}
                          </div>
                          <div style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: 'monospace' }}>
                            {e.externalId} · {e.totalHours.toFixed(1)}h total
                          </div>
                        </div>
                        <select
                          value={row.status}
                          onChange={(ev) => updateRow(e.id, { status: ev.target.value })}
                          disabled={!canEdit}
                          style={{
                            ...inputStyle,
                            background: sc.bg,
                            color: sc.fg,
                            fontWeight: FONTS.weight.semibold,
                            cursor: canEdit ? 'pointer' : 'default',
                          }}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={row.hours}
                          onChange={(ev) => updateRow(e.id, { hours: ev.target.value })}
                          placeholder="0"
                          disabled={!canEdit}
                          style={{ ...inputStyle, textAlign: 'right' }}
                        />
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(ev) => updateRow(e.id, { notes: ev.target.value })}
                          placeholder="Notes (optional)"
                          disabled={!canEdit}
                          style={inputStyle}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {recent.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h3 style={{
                    fontSize: FONTS.size.xs,
                    fontWeight: FONTS.weight.bold,
                    color: COLORS.navy,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    margin: '0 0 8px',
                    paddingBottom: 4,
                    borderBottom: `1px solid ${COLORS.gray200}`,
                  }}>
                    Recent Status Updates
                  </h3>
                  <ol style={{ margin: 0, paddingLeft: 20, fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>
                    {recent.slice(0, 8).map((l) => (
                      <li key={l.id} style={{ marginBottom: 4 }}>
                        <span style={{ fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>
                          {l.equipment?.name || l.equipmentId.slice(0, 8)}
                        </span>
                        {' · '}{l.status} · {l.hours}h
                        {l.notes && <span style={{ color: COLORS.textMuted }}> · {l.notes}</span>}
                        <span style={{ color: COLORS.textMuted, marginLeft: 6 }}>
                          ({l.date.slice(0, 10)})
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {error && (
                <div style={{
                  marginTop: 12,
                  padding: 8,
                  background: '#FEE2E2',
                  color: '#991B1B',
                  borderRadius: BORDERS.radius.sm,
                  fontSize: FONTS.size.xs,
                }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{
          padding: 16,
          borderTop: `1px solid ${COLORS.gray200}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted }}>
            Hours &gt; 0 increment total hours and update last-used date
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
            <button
              onClick={saveAll}
              disabled={saving || !canEdit || equipment.length === 0}
              style={primaryButtonStyle(saving || !canEdit || equipment.length === 0)}
            >
              {saving ? 'Saving…' : 'Save Status Log'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 0,
};

const labelTextStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: FONTS.weight.semibold,
  color: COLORS.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const inputStyle: React.CSSProperties = {
  border: `1px solid ${COLORS.gray200}`,
  borderRadius: BORDERS.radius.sm,
  padding: '6px 8px',
  fontSize: FONTS.size.sm,
  fontFamily: FONTS.family,
  color: COLORS.textPrimary,
  background: COLORS.white,
  boxSizing: 'border-box',
};

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  background: COLORS.orange,
  color: COLORS.white,
  border: 'none',
  padding: '8px 16px',
  borderRadius: BORDERS.radius.sm,
  fontSize: FONTS.size.sm,
  fontWeight: FONTS.weight.semibold,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
});

const secondaryButtonStyle: React.CSSProperties = {
  background: COLORS.white,
  color: COLORS.navy,
  border: `1px solid ${COLORS.gray200}`,
  padding: '8px 16px',
  borderRadius: BORDERS.radius.sm,
  fontSize: FONTS.size.sm,
  fontWeight: FONTS.weight.semibold,
  cursor: 'pointer',
};
