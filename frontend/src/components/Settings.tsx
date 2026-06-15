/**
 * Settings Page
 * ============================================================================
 * Sprint 12. Hosts:
 *   - Integrations → QuickBooks connection card
 *   - Notification preferences (global + per-project overrides)
 *
 * Routed from /settings. The Sidebar's "user footer" does not currently
 * link here — for now the entry point is the URL. Wiring into the
 * sidebar happens when notification preferences are turned on (the
 * card is the only thing the user actually wants to find).
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { fetchApi } from '../api';
import { COLORS, FONTS, BORDERS } from '../styles/design-system';

interface QboStatus {
  configured: boolean;
  connected: boolean;
  realmId: string | null;
  expiresAt: string | null;
  scope: string | null;
  sync?: { exported: number; pending: number; lastExportedAt: string | null };
}

interface NotificationPrefs {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  digestEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  kindOverrides: Record<string, { email?: boolean | null; push?: boolean | null }>;
  updatedAt: string;
  createdAt: string;
}

const KIND_LABELS: Record<string, string> = {
  rfi_assigned: 'RFI Assigned to You',
  rfi_answered: 'RFI Answered',
  issue_assigned: 'Issue Assigned to You',
  schedule_change_request: 'Schedule Change Request',
  co_approved: 'Change Order Approved',
  co_rejected: 'Change Order Rejected',
  drawing_ifc_released: 'Drawing IFC Released',
  schedule_risk: 'Schedule Risk Flag',
  system: 'System Announcements',
};

export function Settings({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ padding: 24, fontFamily: FONTS.family, maxWidth: 800 }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: COLORS.navy, cursor: 'pointer', fontSize: 16, marginBottom: 16 }}
      >
        ← Back
      </button>
      <h1 style={{ color: COLORS.navy, margin: 0, marginBottom: 24, fontSize: FONTS.size.xl }}>Settings</h1>

      <QuickbooksCard />
      <NotificationPrefsCard />
    </div>
  );
}

function QuickbooksCard() {
  const [status, setStatus] = useState<QboStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchApi<QboStatus>('/api/v1/integrations/quickbooks/status');
        setStatus(s);
      } catch (e: any) {
        setError(e?.message || 'failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleConnect = () => {
    window.location.href = '/api/v1/integrations/quickbooks/auth';
  };
  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect QuickBooks? Existing exports stay in QuickBooks; PM will no longer push new ones.')) return;
    try {
      await fetchApi('/api/v1/integrations/quickbooks/disconnect', { method: 'POST' });
      const s = await fetchApi<QboStatus>('/api/v1/integrations/quickbooks/status');
      setStatus(s);
    } catch (e: any) {
      setError(e?.message || 'failed to disconnect');
    }
  };

  return (
    <Card title="Integrations — QuickBooks">
      {loading && <p style={{ color: COLORS.textMuted }}>Loading…</p>}
      {error && <p style={{ color: COLORS.red }}>{error}</p>}
      {status && !status.configured && (
        <p style={{ color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>
          QuickBooks is not configured on the backend. Set{' '}
          <code>QUICKBOOKS_CLIENT_ID</code> and <code>QUICKBOOKS_CLIENT_SECRET</code> in the PM env to enable the connect flow.
        </p>
      )}
      {status?.configured && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: status.connected ? COLORS.green : COLORS.gray300,
                display: 'inline-block',
              }}
            />
            <strong style={{ color: COLORS.navy }}>
              {status.connected ? 'Connected' : 'Not connected'}
            </strong>
            {status.connected && status.realmId && (
              <span style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs }}>
                (realm {status.realmId})
              </span>
            )}
          </div>
          {status.connected ? (
            <button onClick={handleDisconnect} style={btnSecondary}>
              Disconnect
            </button>
          ) : (
            <button onClick={handleConnect} style={btnPrimary}>
              Connect QuickBooks
            </button>
          )}
          {status.connected && status.expiresAt && (
            <p style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs, marginTop: 12 }}>
              Token expires: {new Date(status.expiresAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function NotificationPrefsCard() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchApi<NotificationPrefs>(
          '/api/v1/notifications/preferences/me'
        );
        setPrefs(r);
      } catch (e: any) {
        setError(e?.message || 'failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const patch = async (body: Partial<NotificationPrefs>) => {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    // Optimistic local update.
    const next = { ...prefs, ...body };
    setPrefs(next);
    try {
      const r = await fetchApi<NotificationPrefs>(
        '/api/v1/notifications/preferences/me',
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        }
      );
      setPrefs(r);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e?.message || 'failed to save');
      // Revert on failure.
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  const toggleGlobal = (key: 'emailEnabled' | 'pushEnabled' | 'digestEnabled') => {
    if (!prefs) return;
    patch({ [key]: !prefs[key] } as Partial<NotificationPrefs>);
  };

  const toggleKindChannel = (
    kind: string,
    channel: 'email' | 'push',
    value: boolean | null
  ) => {
    if (!prefs) return;
    const next = { ...prefs.kindOverrides };
    const existing = next[kind] || {};
    next[kind] = { ...existing, [channel]: value };
    patch({ kindOverrides: next });
  };

  const resetKind = (kind: string) => {
    if (!prefs) return;
    const next = { ...prefs.kindOverrides };
    delete next[kind];
    patch({ kindOverrides: next });
  };

  if (loading) {
    return (
      <Card title="Notification Preferences">
        <p style={{ color: COLORS.textMuted }}>Loading…</p>
      </Card>
    );
  }
  if (error && !prefs) {
    return (
      <Card title="Notification Preferences">
        <p style={{ color: COLORS.red }}>{error}</p>
      </Card>
    );
  }
  if (!prefs) return null;

  return (
    <Card title="Notification Preferences">
      <p style={{ color: COLORS.textSecondary, fontSize: FONTS.size.sm, marginTop: 0, marginBottom: 16 }}>
        The in-app inbox is always on. Email and push are off by default for non-transactional
        kinds. Per-kind overrides win over the global toggles.
      </p>

      {/* Global toggles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <Toggle
          label="Email"
          checked={prefs.emailEnabled}
          onChange={() => toggleGlobal('emailEnabled')}
          disabled={saving}
        />
        <Toggle
          label="Push"
          checked={prefs.pushEnabled}
          onChange={() => toggleGlobal('pushEnabled')}
          disabled={saving}
        />
        <Toggle
          label="Daily digest"
          checked={prefs.digestEnabled}
          onChange={() => toggleGlobal('digestEnabled')}
          disabled={saving}
        />
      </div>

      {/* Quiet hours */}
      <div style={{ marginBottom: 20, paddingTop: 12, borderTop: `1px solid ${COLORS.gray100}` }}>
        <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.navy, marginBottom: 8 }}>
          Quiet hours (your local time)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="time"
            value={prefs.quietStart}
            onChange={(e) => patch({ quietStart: e.target.value })}
            disabled={saving}
            style={timeInput}
          />
          <span style={{ color: COLORS.textSecondary }}>to</span>
          <input
            type="time"
            value={prefs.quietEnd}
            onChange={(e) => patch({ quietEnd: e.target.value })}
            disabled={saving}
            style={timeInput}
          />
          <span style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs, marginLeft: 8 }}>
            Leave blank to disable. Crosses midnight (e.g. 22:00 → 07:00).
          </span>
        </div>
      </div>

      {/* Per-kind table */}
      <div style={{ paddingTop: 12, borderTop: `1px solid ${COLORS.gray100}` }}>
        <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.navy, marginBottom: 8 }}>
          Per-kind overrides
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONTS.size.sm }}>
          <thead>
            <tr style={{ textAlign: 'left', color: COLORS.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <th style={{ padding: '4px 8px 4px 0' }}>Kind</th>
              <th style={{ padding: '4px 8px' }}>Email</th>
              <th style={{ padding: '4px 8px' }}>Push</th>
              <th style={{ padding: '4px 8px' }}></th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(KIND_LABELS).map((kind) => {
              const ov = prefs.kindOverrides[kind] || {};
              const emailExplicit = ov.email !== undefined && ov.email !== null;
              const pushExplicit = ov.push !== undefined && ov.push !== null;
              return (
                <tr key={kind} style={{ borderTop: `1px solid ${COLORS.gray100}` }}>
                  <td style={{ padding: '8px 8px 8px 0', color: COLORS.textPrimary }}>{KIND_LABELS[kind]}</td>
                  <td style={{ padding: '8px' }}>
                    <select
                      value={emailExplicit ? String(ov.email) : 'default'}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === 'default') {
                          toggleKindChannel(kind, 'email', null);
                        } else {
                          toggleKindChannel(kind, 'email', v === 'true');
                        }
                      }}
                      disabled={saving}
                      style={selectInput}
                    >
                      <option value="default">Default</option>
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                  </td>
                  <td style={{ padding: '8px' }}>
                    <select
                      value={pushExplicit ? String(ov.push) : 'default'}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === 'default') {
                          toggleKindChannel(kind, 'push', null);
                        } else {
                          toggleKindChannel(kind, 'push', v === 'true');
                        }
                      }}
                      disabled={saving}
                      style={selectInput}
                    >
                      <option value="default">Default</option>
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                  </td>
                  <td style={{ padding: '8px' }}>
                    {(emailExplicit || pushExplicit) && (
                      <button
                        onClick={() => resetKind(kind)}
                        disabled={saving}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: COLORS.textMuted,
                          cursor: 'pointer',
                          fontSize: FONTS.size.xs,
                          textDecoration: 'underline',
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        {saving && <span style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs }}>Saving…</span>}
        {savedAt && !saving && (
          <span style={{ color: COLORS.green, fontSize: FONTS.size.xs }}>Saved at {savedAt}</span>
        )}
        {error && <span style={{ color: COLORS.red, fontSize: FONTS.size.xs }}>{error}</span>}
      </div>
    </Card>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        border: `1px solid ${COLORS.gray200}`,
        borderRadius: BORDERS.radius.sm,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary, fontWeight: FONTS.weight.medium }}>{label}</span>
    </label>
  );
}

const timeInput: React.CSSProperties = {
  padding: '4px 8px',
  border: `1px solid ${COLORS.gray200}`,
  borderRadius: BORDERS.radius.sm,
  fontSize: FONTS.size.sm,
  fontFamily: FONTS.family,
};

const selectInput: React.CSSProperties = {
  padding: '4px 6px',
  border: `1px solid ${COLORS.gray200}`,
  borderRadius: BORDERS.radius.sm,
  fontSize: FONTS.size.xs,
  fontFamily: FONTS.family,
  background: COLORS.white,
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.gray200}`,
        borderRadius: BORDERS.radius.md,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <h2 style={{ margin: 0, marginBottom: 12, color: COLORS.navy, fontSize: FONTS.size.lg }}>{title}</h2>
      {children}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: COLORS.orange,
  color: COLORS.white,
  border: 'none',
  padding: '8px 16px',
  borderRadius: BORDERS.radius.sm,
  fontSize: FONTS.size.sm,
  fontWeight: FONTS.weight.semibold,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: COLORS.white,
  color: COLORS.navy,
  border: `1px solid ${COLORS.gray200}`,
};
