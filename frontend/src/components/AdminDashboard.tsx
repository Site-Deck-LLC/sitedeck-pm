/**
 * AdminDashboard.tsx — Sprint 11
 * ============================================================================
 * The /admin UI for Site Deck LLC owner_admin users.
 *
 * ADMIN SECURITY RULE (non-negotiable):
 *   - This component renders the same 404 page as any unknown route
 *     for non-admins. The route does not exist to them.
 *   - All data fetching goes through /api/v1/admin/* which is
 *     already gated server-side by requireSiteDeckAdmin.
 *   - The admin nav is only rendered when isAdmin === true.
 * ============================================================================
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { COLORS, FONTS, SHADOWS, BORDERS } from '../styles/design-system';
import { getCurrentRole } from '../auth';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function adminFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/v1/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    },
  });
  if (res.status === 404) {
    // ADMIN SECURITY RULE: 404 means "not an admin" to the client.
    // The component treats this as "render the 404 page".
    throw Object.assign(new Error('admin not available'), { code: 'not_admin' });
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Icon set (SVG inline so we don't add an icon dep) ───────────────────────
const Icon = {
  Home: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V21H3V9.5z" /></svg>),
  Bug: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2l1 2M16 2l-1 2M5 7h14M5 12h14M5 17h14M12 7v14" /><circle cx="12" cy="13" r="3" /></svg>),
  Bulb: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /></svg>),
  Users: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
  Wrench: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.7-2.7 2.3-2.3z" /></svg>),
  Activity: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>),
  List: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>),
  Back: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>),
  Spinner: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  new: { bg: COLORS.gray200, text: COLORS.textPrimary },
  triaging: { bg: COLORS.navyLight, text: COLORS.white },
  code_fix_pending: { bg: COLORS.amber, text: COLORS.white },
  code_fix_approved: { bg: COLORS.navy, text: COLORS.white },
  code_fix_deployed: { bg: COLORS.green, text: COLORS.white },
  closed: { bg: COLORS.gray300, text: COLORS.textPrimary },
  user_error_resolved: { bg: COLORS.gray200, text: COLORS.textPrimary },
  feature_logged: { bg: COLORS.gray200, text: COLORS.textPrimary },
  under_review: { bg: COLORS.navyLight, text: COLORS.white },
  planned: { bg: COLORS.orange, text: COLORS.white },
  shipped: { bg: COLORS.green, text: COLORS.white },
  declined: { bg: COLORS.gray300, text: COLORS.textPrimary },
  open: { bg: COLORS.green, text: COLORS.white },
  in_progress: { bg: COLORS.navy, text: COLORS.white },
  resolved: { bg: COLORS.gray300, text: COLORS.textPrimary },
  disabled: { bg: COLORS.red, text: COLORS.white },
  active: { bg: COLORS.green, text: COLORS.white },
};

const RISK_BADGE: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: COLORS.red, text: COLORS.white },
  MEDIUM: { bg: COLORS.amber, text: COLORS.white },
  LOW: { bg: COLORS.green, text: COLORS.white },
};

function StatusBadge({ value }: { value: string }) {
  const c = STATUS_BADGE[value] || { bg: COLORS.gray200, text: COLORS.textPrimary };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10,
      fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold,
      background: c.bg, color: c.text, whiteSpace: 'nowrap',
    }}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const c = RISK_BADGE[level] || RISK_BADGE.LOW;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10,
      fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold,
      background: c.bg, color: c.text,
    }}>
      {level}
    </span>
  );
}

function ProductBadge({ product }: { product: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    pm: { bg: COLORS.navy, text: COLORS.white },
    benchmark: { bg: COLORS.orange, text: COLORS.white },
    pro: { bg: COLORS.green, text: COLORS.white },
    design: { bg: '#7C3AED', text: COLORS.white },
  };
  const c = map[product] || { bg: COLORS.gray300, text: COLORS.textPrimary };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10,
      fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold,
      background: c.bg, color: c.text, textTransform: 'uppercase',
    }}>
      {product}
    </span>
  );
}

function NotAdmin({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: COLORS.offWhite, fontFamily: FONTS.family, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: 40, background: COLORS.white, borderRadius: BORDERS.radius.lg, boxShadow: SHADOWS.md, maxWidth: 480 }}>
        <h1 style={{ fontSize: FONTS.size.display, color: COLORS.textPrimary, margin: '0 0 16px', fontWeight: FONTS.weight.bold }}>404</h1>
        <p style={{ fontSize: FONTS.size.md, color: COLORS.textSecondary, margin: '0 0 24px' }}>Page not found.</p>
        <button onClick={onBack} style={{ padding: '10px 20px', borderRadius: BORDERS.radius.md, border: 'none', background: COLORS.navy, color: COLORS.white, fontSize: FONTS.size.md, fontWeight: FONTS.weight.semibold, cursor: 'pointer' }}>
          Go Home
        </button>
      </div>
    </div>
  );
}

// ─── Sub-views ───────────────────────────────────────────────────────────────

type AdminSection = 'overview' | 'bugs' | 'features' | 'users' | 'health' | 'audit';

function Overview({ recentActivity, products }: any) {
  return (
    <div>
      <h2 style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: '0 0 16px' }}>Portfolio Health</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {(['pm', 'benchmark', 'pro', 'design'] as const).map((p) => {
          const prod = products?.[p] || { openBugs: 0 };
          return (
            <div key={p} style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, padding: 20, boxShadow: SHADOWS.sm, border: `1px solid ${COLORS.gray200}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS.green }} />
                <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, textTransform: 'uppercase' }}>{p}</span>
              </div>
              <div style={{ fontSize: FONTS.size.xxl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: '0 0 4px' }}>{prod.openBugs}</div>
              <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, margin: 0 }}>open bugs</div>
            </div>
          );
        })}
      </div>

      <h2 style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: '0 0 16px' }}>Recent Activity</h2>
      <div style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, padding: 16, boxShadow: SHADOWS.sm, border: `1px solid ${COLORS.gray200}` }}>
        {(recentActivity || []).length === 0 ? (
          <p style={{ color: COLORS.textMuted, textAlign: 'center', padding: 20, margin: 0 }}>No activity yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(recentActivity || []).slice(0, 20).map((r: any, i: number) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < 19 ? `1px solid ${COLORS.gray100}` : 'none' }}>
                <StatusBadge value={r.action} />
                <span style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary, flex: 1 }}>
                  {r.action} {r.targetType ? `→ ${r.targetType}` : ''} {r.targetId ? `(${r.targetId.slice(0, 8)})` : ''}
                </span>
                <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>{timeAgo(r.time)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BugQueue({ onSelectBug }: { onSelectBug: (id: string) => void }) {
  const [bugs, setBugs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [approveModal, setApproveModal] = useState<any | null>(null);
  const [rejectModal, setRejectModal] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (productFilter !== 'all') params.set('product', productFilter);
      const data = await adminFetch<any[]>(`/bugs?${params.toString()}`);
      setBugs(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, productFilter]);

  useEffect(() => { load(); }, [load]);

  async function retriage(bugId: string) {
    try {
      await adminFetch(`/bugs/${bugId}/retriage`, { method: 'POST' });
      await load();
    } catch (err: any) {
      alert(`Re-triage failed: ${err.message}`);
    }
  }

  async function approve(bugId: string) {
    try {
      await adminFetch(`/bugs/${bugId}/send-approval`, { method: 'POST' });
      setApproveModal(null);
      await load();
      alert('Approval email sent. The operator must click the link to deploy.');
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  }

  async function reject(bugId: string) {
    if (!rejectReason.trim()) {
      alert('Please enter a reason for rejection.');
      return;
    }
    try {
      await adminFetch(`/bugs/${bugId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason }),
      });
      setRejectModal(null);
      setRejectReason('');
      await load();
    } catch (err: any) {
      alert(`Reject failed: ${err.message}`);
    }
  }

  const filtered = riskFilter === 'all' ? bugs : bugs.filter((b) => (b.riskLevel || '').toLowerCase() === riskFilter.toLowerCase());

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { v: 'all', label: 'All' },
          { v: 'new', label: 'Pending' },
          { v: 'code_fix_pending', label: 'In Progress' },
          { v: 'code_fix_deployed', label: 'Resolved' },
        ].map((t) => (
          <button key={t.v} onClick={() => setStatusFilter(t.v)} style={{
            padding: '6px 14px', borderRadius: 20, border: `1px solid ${statusFilter === t.v ? COLORS.navy : COLORS.gray200}`,
            background: statusFilter === t.v ? COLORS.navy : COLORS.white,
            color: statusFilter === t.v ? COLORS.white : COLORS.textPrimary,
            fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, cursor: 'pointer',
          }}>{t.label}</button>
        ))}
        <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: BORDERS.radius.sm, border: `1px solid ${COLORS.gray200}`, fontSize: FONTS.size.sm }}>
          <option value="all">All Products</option>
          <option value="pm">PM</option>
          <option value="benchmark">Benchmark</option>
          <option value="pro">Pro</option>
          <option value="design">Design</option>
        </select>
        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: BORDERS.radius.sm, border: `1px solid ${COLORS.gray200}`, fontSize: FONTS.size.sm }}>
          <option value="all">All Risk</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40, color: COLORS.textMuted }}>Loading bugs…</p>
      ) : error ? (
        <p style={{ textAlign: 'center', padding: 40, color: COLORS.red }}>{error}</p>
      ) : filtered.length === 0 ? (
        <div style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, padding: 40, textAlign: 'center', border: `1px solid ${COLORS.gray200}` }}>
          <p style={{ color: COLORS.textMuted, margin: 0 }}>No bugs match the current filters.</p>
        </div>
      ) : (
        <div style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, overflow: 'hidden', border: `1px solid ${COLORS.gray200}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONTS.size.sm }}>
            <thead>
              <tr style={{ background: COLORS.gray100 }}>
                {['Product', 'Route', 'User', 'Class', 'Conf', 'Risk', 'Status', 'Age', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: 10, textAlign: 'left', fontWeight: FONTS.weight.semibold, color: COLORS.textSecondary, fontSize: FONTS.size.xs }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} style={{ borderTop: `1px solid ${COLORS.gray100}` }}>
                  <td style={{ padding: 10 }}><ProductBadge product={b.product} /></td>
                  <td style={{ padding: 10, color: COLORS.textPrimary, fontFamily: 'monospace', fontSize: FONTS.size.xs }}>{b.route || '—'}</td>
                  <td style={{ padding: 10, color: COLORS.textSecondary }}>{b.userRole || '—'}</td>
                  <td style={{ padding: 10, color: COLORS.textPrimary }}>{b.classification || '—'}</td>
                  <td style={{ padding: 10, color: COLORS.textSecondary }}>{b.confidence ? `${Math.round(b.confidence * 100)}%` : '—'}</td>
                  <td style={{ padding: 10 }}>{b.riskLevel ? <RiskBadge level={b.riskLevel} /> : '—'}</td>
                  <td style={{ padding: 10 }}><StatusBadge value={b.status} /></td>
                  <td style={{ padding: 10, color: COLORS.textMuted, fontSize: FONTS.size.xs }}>{timeAgo(b.createdAt)}</td>
                  <td style={{ padding: 10 }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button onClick={() => onSelectBug(b.id)} style={{ padding: '4px 10px', fontSize: FONTS.size.xs, borderRadius: BORDERS.radius.sm, border: `1px solid ${COLORS.gray200}`, background: COLORS.white, color: COLORS.textPrimary, cursor: 'pointer' }}>View</button>
                      {b.status === 'code_fix_pending' && (
                        <>
                          <button onClick={() => setApproveModal(b)} style={{ padding: '4px 10px', fontSize: FONTS.size.xs, borderRadius: BORDERS.radius.sm, border: 'none', background: COLORS.orange, color: COLORS.white, fontWeight: FONTS.weight.semibold, cursor: 'pointer' }}>Approve</button>
                          <button onClick={() => setRejectModal(b)} style={{ padding: '4px 10px', fontSize: FONTS.size.xs, borderRadius: BORDERS.radius.sm, border: `1px solid ${COLORS.gray200}`, background: COLORS.white, color: COLORS.red, cursor: 'pointer' }}>Reject</button>
                        </>
                      )}
                      {(b.status === 'new' || b.status === 'triaging') && (
                        <button onClick={() => retriage(b.id)} style={{ padding: '4px 10px', fontSize: FONTS.size.xs, borderRadius: BORDERS.radius.sm, border: 'none', background: 'transparent', color: COLORS.navy, cursor: 'pointer', textDecoration: 'underline' }}>Re-triage</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {approveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setApproveModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, padding: 24, maxWidth: 500, width: '90%', boxShadow: SHADOWS.lg }}>
            <h3 style={{ margin: '0 0 16px', color: COLORS.textPrimary }}>Approve code fix?</h3>
            <p style={{ color: COLORS.textSecondary, margin: '0 0 12px', fontSize: FONTS.size.sm }}>
              An email will be sent to the operator with a one-click deploy link. The fix will only deploy after they click the link (token expires in 48h).
            </p>
            <div style={{ background: COLORS.offWhite, borderRadius: BORDERS.radius.sm, padding: 12, marginBottom: 16, fontSize: FONTS.size.sm }}>
              <div><strong>Affected files:</strong> {approveModal.affectedFiles?.length || '—'}</div>
              <div><strong>Risk level:</strong> {approveModal.riskLevel || '—'}</div>
              <div><strong>Suggested fix:</strong> {approveModal.suggestedFix || '—'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setApproveModal(null)} style={{ padding: '8px 16px', borderRadius: BORDERS.radius.md, border: `1px solid ${COLORS.gray200}`, background: COLORS.white, color: COLORS.textPrimary, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => approve(approveModal.id)} style={{ padding: '8px 16px', borderRadius: BORDERS.radius.md, border: 'none', background: COLORS.orange, color: COLORS.white, fontWeight: FONTS.weight.semibold, cursor: 'pointer' }}>Confirm Approval</button>
            </div>
          </div>
        </div>
      )}

      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setRejectModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, padding: 24, maxWidth: 500, width: '90%', boxShadow: SHADOWS.lg }}>
            <h3 style={{ margin: '0 0 16px', color: COLORS.textPrimary }}>Reject this fix?</h3>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why are you rejecting? The user will see this." rows={4} style={{ width: '100%', padding: 8, borderRadius: BORDERS.radius.sm, border: `1px solid ${COLORS.gray200}`, fontSize: FONTS.size.sm, fontFamily: FONTS.family, marginBottom: 16, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }} style={{ padding: '8px 16px', borderRadius: BORDERS.radius.md, border: `1px solid ${COLORS.gray200}`, background: COLORS.white, color: COLORS.textPrimary, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => reject(rejectModal.id)} style={{ padding: '8px 16px', borderRadius: BORDERS.radius.md, border: 'none', background: COLORS.red, color: COLORS.white, fontWeight: FONTS.weight.semibold, cursor: 'pointer' }}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BugDetail({ bugId, onBack }: { bugId: string; onBack: () => void }) {
  const [bug, setBug] = useState<any>(null);
  const [fixStatus, setFixStatus] = useState<any>(null);
  const [error, setError] = useState('');
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminFetch(`/bugs/${bugId}`);
      setBug(data);
      if (data.status === 'code_fix_approved' || data.status === 'code_fix_deployed') {
        try { setFixStatus(await adminFetch(`/bugs/${bugId}/fix-status`)); } catch {}
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [bugId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (bug && (bug.status === 'code_fix_approved')) {
      pollRef.current = window.setInterval(async () => {
        try {
          const s = await adminFetch(`/bugs/${bugId}/fix-status`);
          setFixStatus(s);
          if (s?.status === 'deployed' || s?.status === 'failed' || s?.status === 'timeout') {
            if (pollRef.current) clearInterval(pollRef.current);
            load();
          }
        } catch {}
      }, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [bug, bugId, load]);

  if (error) return <div style={{ padding: 24, color: COLORS.red }}>{error}</div>;
  if (!bug) return <div style={{ padding: 24, color: COLORS.textMuted }}>Loading…</div>;

  return (
    <div>
      <button onClick={onBack} style={{ marginBottom: 16, padding: '6px 12px', borderRadius: BORDERS.radius.sm, border: `1px solid ${COLORS.gray200}`, background: COLORS.white, color: COLORS.textPrimary, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon.Back /> Back to queue</button>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, padding: 20, border: `1px solid ${COLORS.gray200}` }}>
          <h3 style={{ margin: '0 0 12px', color: COLORS.textPrimary }}>Bug Report</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <ProductBadge product={bug.product} />
            <StatusBadge value={bug.status} />
            {bug.riskLevel && <RiskBadge level={bug.riskLevel} />}
          </div>
          <p style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, margin: '0 0 8px' }}><strong>Route:</strong> <code>{bug.route || '—'}</code></p>
          <p style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, margin: '0 0 8px' }}><strong>User role:</strong> {bug.userRole || '—'}</p>
          <p style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary, margin: '0 0 12px' }}><strong>User action:</strong> {bug.userAction || bug.description || '—'}</p>
          {bug.consoleErrors && (
            <details style={{ marginBottom: 8 }}>
              <summary style={{ cursor: 'pointer', color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>Console errors</summary>
              <pre style={{ background: COLORS.offWhite, padding: 8, borderRadius: BORDERS.radius.sm, fontSize: FONTS.size.xs, overflow: 'auto' }}>{typeof bug.consoleErrors === 'string' ? bug.consoleErrors : JSON.stringify(bug.consoleErrors, null, 2)}</pre>
            </details>
          )}
          {bug.lastApiCall && (
            <details style={{ marginBottom: 8 }}>
              <summary style={{ cursor: 'pointer', color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>Last API call</summary>
              <pre style={{ background: COLORS.offWhite, padding: 8, borderRadius: BORDERS.radius.sm, fontSize: FONTS.size.xs, overflow: 'auto' }}>{typeof bug.lastApiCall === 'string' ? bug.lastApiCall : JSON.stringify(bug.lastApiCall, null, 2)}</pre>
            </details>
          )}
        </div>

        <div style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, padding: 20, border: `1px solid ${COLORS.gray200}` }}>
          <h3 style={{ margin: '0 0 12px', color: COLORS.textPrimary }}>Classification</h3>
          <p style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary, margin: '0 0 6px' }}><strong>Class:</strong> {bug.classification || '—'}</p>
          {bug.confidence !== null && bug.confidence !== undefined && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ height: 6, borderRadius: 3, background: COLORS.gray200, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round((bug.confidence || 0) * 100)}%`, height: '100%', background: COLORS.orange }} />
              </div>
              <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: 2 }}>{Math.round((bug.confidence || 0) * 100)}% confidence</div>
            </div>
          )}
          <p style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary, margin: '0 0 6px' }}><strong>Suggested fix:</strong></p>
          <p style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, margin: '0 0 12px' }}>{bug.suggestedFix || '—'}</p>
          {bug.workaround && (
            <p style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, margin: 0 }}>
              <strong>Workaround given to user:</strong> {bug.workaround}
            </p>
          )}
        </div>
      </div>

      {fixStatus && (
        <div style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, padding: 20, border: `1px solid ${COLORS.gray200}`, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px', color: COLORS.textPrimary }}>Fix Pipeline</h3>
          {fixStatus.status === 'running' && <p style={{ color: COLORS.navy, margin: 0 }}><Icon.Spinner /> Claude Code is running…</p>}
          {fixStatus.status === 'deployed' && <p style={{ color: COLORS.green, margin: 0 }}>✅ Deployed — {fixStatus.testCount} tests pass</p>}
          {fixStatus.status === 'failed' && <p style={{ color: COLORS.red, margin: 0 }}>❌ Tests failed — manual review</p>}
          {fixStatus.status === 'timeout' && <p style={{ color: COLORS.red, margin: 0 }}>⏱ Timeout — manual review</p>}
        </div>
      )}
    </div>
  );
}

function FeaturesView() {
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<'most_requested' | 'recent' | 'product'>('most_requested');

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<any[]>('/features');
      setFeatures(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    try {
      await adminFetch(`/features/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 40, color: COLORS.textMuted }}>Loading…</p>;
  if (error) return <p style={{ textAlign: 'center', padding: 40, color: COLORS.red }}>{error}</p>;

  const sorted = [...features].sort((a, b) => {
    if (sort === 'most_requested') return (b.requestCount || 0) - (a.requestCount || 0);
    if (sort === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return (a.product || '').localeCompare(b.product || '');
  });

  const total = features.length;
  const byStatus = (s: string) => features.filter((f) => f.status === s).length;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total', value: total },
          { label: 'New', value: byStatus('new') },
          { label: 'Planned', value: byStatus('planned') },
          { label: 'Shipped', value: byStatus('shipped') },
        ].map((s) => (
          <div key={s.label} style={{ background: COLORS.white, borderRadius: BORDERS.radius.md, padding: 12, border: `1px solid ${COLORS.gray200}`, textAlign: 'center' }}>
            <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>{s.value}</div>
            <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>Sort:</span>
        {[
          { v: 'most_requested', label: 'Most Requested' },
          { v: 'recent', label: 'Recent' },
          { v: 'product', label: 'Product' },
        ].map((s) => (
          <button key={s.v} onClick={() => setSort(s.v as any)} style={{
            padding: '4px 12px', borderRadius: 20, border: `1px solid ${sort === s.v ? COLORS.navy : COLORS.gray200}`,
            background: sort === s.v ? COLORS.navy : COLORS.white,
            color: sort === s.v ? COLORS.white : COLORS.textPrimary,
            fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold, cursor: 'pointer',
          }}>{s.label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
        {sorted.map((f) => (
          <div key={f.id} style={{ background: COLORS.white, borderRadius: BORDERS.radius.md, padding: 16, border: `1px solid ${COLORS.gray200}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <ProductBadge product={f.product} />
              <span style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.orange }}>{f.requestCount || 1}</span>
            </div>
            <p style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary, margin: '0 0 8px' }}>{f.description}</p>
            <p style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, margin: '0 0 8px' }}>{f.route || '—'} · {f.userRole || '—'} · {timeAgo(f.createdAt)}</p>
            <select value={f.status} onChange={(e) => updateStatus(f.id, e.target.value)} style={{ width: '100%', padding: 6, borderRadius: BORDERS.radius.sm, border: `1px solid ${COLORS.gray200}`, fontSize: FONTS.size.sm }}>
              <option value="new">New</option>
              <option value="under_review">Under Review</option>
              <option value="planned">Planned</option>
              <option value="shipped">Shipped</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersView() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleModal, setRoleModal] = useState<any | null>(null);
  const [newRole, setNewRole] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<any[]>('/users');
      setMembers(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resetPassword(memberId: string, email: string) {
    if (!confirm(`Send password reset to ${email}?`)) return;
    try {
      await adminFetch(`/users/${memberId}/reset-password`, { method: 'POST' });
      alert(`Reset email sent to ${email}`);
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    }
  }

  async function toggleDisabled(memberId: string, currentlyDisabled: boolean) {
    if (!confirm(`${currentlyDisabled ? 'Enable' : 'Disable'} this user?`)) return;
    try {
      await adminFetch(`/users/${memberId}/${currentlyDisabled ? 'enable' : 'disable'}`, { method: 'POST' });
      await load();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  }

  async function changeRole() {
    if (!roleModal || !newRole) return;
    try {
      await adminFetch(`/users/${roleModal.id}/role`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) });
      setRoleModal(null);
      setNewRole('');
      await load();
    } catch (err: any) {
      alert(`Role change failed: ${err.message}`);
    }
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 40, color: COLORS.textMuted }}>Loading…</p>;
  if (error) return <p style={{ textAlign: 'center', padding: 40, color: COLORS.red }}>{error}</p>;

  const filtered = members.filter((m) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (m.email || '').toLowerCase().includes(s) || (m.name || '').toLowerCase().includes(s);
  });

  return (
    <div>
      <input type="search" placeholder="Search by email or name…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', maxWidth: 360, padding: '8px 12px', borderRadius: BORDERS.radius.sm, border: `1px solid ${COLORS.gray200}`, fontSize: FONTS.size.sm, marginBottom: 16 }} />

      <div style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, overflow: 'hidden', border: `1px solid ${COLORS.gray200}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONTS.size.sm }}>
          <thead>
            <tr style={{ background: COLORS.gray100 }}>
              {['Name', 'Email', 'Role', 'Org', 'Status', 'Actions'].map((h) => (
                <th key={h} style={{ padding: 10, textAlign: 'left', fontWeight: FONTS.weight.semibold, color: COLORS.textSecondary, fontSize: FONTS.size.xs }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} style={{ borderTop: `1px solid ${COLORS.gray100}` }}>
                <td style={{ padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: COLORS.navyLight, color: COLORS.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold }}>
                      {(m.name || m.email || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ color: COLORS.textPrimary }}>{m.name || '—'}</span>
                  </div>
                </td>
                <td style={{ padding: 10, color: COLORS.textSecondary, fontSize: FONTS.size.xs }}>{m.email}</td>
                <td style={{ padding: 10 }}><StatusBadge value={m.role} /></td>
                <td style={{ padding: 10, color: COLORS.textMuted, fontSize: FONTS.size.xs }}>{m.orgId || '—'}</td>
                <td style={{ padding: 10 }}><StatusBadge value={m.status} /></td>
                <td style={{ padding: 10 }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button onClick={() => { setRoleModal(m); setNewRole(m.role || ''); }} style={{ padding: '4px 10px', fontSize: FONTS.size.xs, borderRadius: BORDERS.radius.sm, border: `1px solid ${COLORS.gray200}`, background: COLORS.white, color: COLORS.textPrimary, cursor: 'pointer' }}>Manage Role</button>
                    <button onClick={() => resetPassword(m.id, m.email)} style={{ padding: '4px 10px', fontSize: FONTS.size.xs, borderRadius: BORDERS.radius.sm, border: `1px solid ${COLORS.gray200}`, background: COLORS.white, color: COLORS.textPrimary, cursor: 'pointer' }}>Reset Password</button>
                    <button onClick={() => toggleDisabled(m.id, m.status === 'disabled')} style={{ padding: '4px 10px', fontSize: FONTS.size.xs, borderRadius: BORDERS.radius.sm, border: `1px solid ${m.status === 'disabled' ? COLORS.green : COLORS.red}`, background: COLORS.white, color: m.status === 'disabled' ? COLORS.green : COLORS.red, cursor: 'pointer' }}>
                      {m.status === 'disabled' ? 'Enable' : 'Disable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {roleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setRoleModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, padding: 24, maxWidth: 480, width: '90%' }}>
            <h3 style={{ margin: '0 0 12px', color: COLORS.textPrimary }}>Change role for {roleModal.email}</h3>
            <p style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, margin: '0 0 8px' }}>Current role: <strong>{roleModal.role}</strong></p>
            <div style={{ background: '#FDF3E0', border: `1px solid ${COLORS.amber}`, borderRadius: BORDERS.radius.sm, padding: 10, marginBottom: 12, fontSize: FONTS.size.xs, color: '#7A5A00' }}>
              ⚠️ Role change updates Firebase claims. Takes effect on user's next login.
            </div>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: BORDERS.radius.sm, border: `1px solid ${COLORS.gray200}`, fontSize: FONTS.size.sm, marginBottom: 16 }}>
              {['owner_admin', 'project_manager', 'superintendent', 'supervisor', 'field_crew', 'subcontractor_pm', 'subcontractor_super', 'owners_rep', 'accountant_ap'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setRoleModal(null); setNewRole(''); }} style={{ padding: '8px 16px', borderRadius: BORDERS.radius.md, border: `1px solid ${COLORS.gray200}`, background: COLORS.white, color: COLORS.textPrimary, cursor: 'pointer' }}>Cancel</button>
              <button onClick={changeRole} style={{ padding: '8px 16px', borderRadius: BORDERS.radius.md, border: 'none', background: COLORS.orange, color: COLORS.white, fontWeight: FONTS.weight.semibold, cursor: 'pointer' }}>Save Role</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HealthView() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await adminFetch('/health'));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  if (error) return <p style={{ textAlign: 'center', padding: 40, color: COLORS.red }}>{error}</p>;
  if (!data) return <p style={{ textAlign: 'center', padding: 40, color: COLORS.textMuted }}>Loading…</p>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {Object.entries(data.products || {}).map(([k, v]: any) => (
          <div key={k} style={{ background: COLORS.white, borderRadius: BORDERS.radius.md, padding: 16, border: `1px solid ${COLORS.gray200}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: v.ok ? COLORS.green : COLORS.red }} />
              <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, textTransform: 'uppercase' }}>{k}</span>
            </div>
            <p style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, margin: 0 }}>{v.ok ? 'Operational' : 'Down'}</p>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: '24px 0 12px' }}>Infrastructure</h3>
      <div style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, padding: 16, border: `1px solid ${COLORS.gray200}`, marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONTS.size.sm }}>
          <tbody>
            {Object.entries(data.infrastructure || {}).map(([k, v]: any) => (
              <tr key={k} style={{ borderTop: `1px solid ${COLORS.gray100}` }}>
                <td style={{ padding: 8, color: COLORS.textSecondary, textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</td>
                <td style={{ padding: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.ok ? COLORS.green : COLORS.red }} />
                    <span style={{ color: COLORS.textPrimary }}>{v.ok ? 'Live' : 'Down'}</span>
                  </div>
                </td>
                <td style={{ padding: 8, color: COLORS.textMuted, fontSize: FONTS.size.xs }}>{v.from || v.host || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: '24px 0 12px' }}>Anthropic Spend Today</h3>
      <div style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, padding: 24, border: `1px solid ${COLORS.gray200}` }}>
        <div style={{ fontSize: FONTS.size.display, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
          ${(data.anthropicToday?.costUsd || 0).toFixed(2)}
        </div>
        <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: 4 }}>{data.anthropicToday?.callCount || 0} calls today</div>
      </div>
    </div>
  );
}

function AuditView() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      params.set('limit', '200');
      const data = await adminFetch<any[]>(`/audit?${params.toString()}`);
      setEntries(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => { load(); }, [load]);

  function exportCsv() {
    const rows = entries.map((e) => [new Date(e.createdAt).toISOString(), e.action, e.performedBy || '', e.targetType || '', e.targetId || '', JSON.stringify(e.details || {})]);
    const csv = 'Timestamp,Action,Performed By,Target Type,Target ID,Details\n' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sitedeck-ops-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 40, color: COLORS.textMuted }}>Loading…</p>;
  if (error) return <p style={{ textAlign: 'center', padding: 40, color: COLORS.red }}>{error}</p>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="search" placeholder="Filter by action…" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: BORDERS.radius.sm, border: `1px solid ${COLORS.gray200}`, fontSize: FONTS.size.sm, minWidth: 220 }} />
        <button onClick={exportCsv} style={{ padding: '6px 14px', borderRadius: BORDERS.radius.sm, border: 'none', background: COLORS.navy, color: COLORS.white, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, cursor: 'pointer' }}>Export CSV</button>
      </div>

      <div style={{ background: COLORS.white, borderRadius: BORDERS.radius.lg, overflow: 'hidden', border: `1px solid ${COLORS.gray200}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONTS.size.sm }}>
          <thead>
            <tr style={{ background: COLORS.gray100 }}>
              {['Timestamp', 'Action', 'Performed By', 'Target', 'Details'].map((h) => (
                <th key={h} style={{ padding: 10, textAlign: 'left', fontWeight: FONTS.weight.semibold, color: COLORS.textSecondary, fontSize: FONTS.size.xs }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <>
                <tr key={e.id} style={{ borderTop: `1px solid ${COLORS.gray100}` }}>
                  <td style={{ padding: 10, color: COLORS.textSecondary, fontSize: FONTS.size.xs }}>{new Date(e.createdAt).toLocaleString()}</td>
                  <td style={{ padding: 10 }}><StatusBadge value={e.action} /></td>
                  <td style={{ padding: 10, color: COLORS.textPrimary, fontSize: FONTS.size.xs }}>{(e.performedBy || '—').slice(0, 12)}</td>
                  <td style={{ padding: 10, color: COLORS.textSecondary, fontSize: FONTS.size.xs }}>{(e.targetType || '—')}{(e.targetId ? ` · ${e.targetId.slice(0, 8)}` : '')}</td>
                  <td style={{ padding: 10 }}>
                    <button onClick={() => setDetailsOpen((s) => ({ ...s, [e.id]: !s[e.id] }))} style={{ padding: '2px 8px', fontSize: FONTS.size.xs, borderRadius: BORDERS.radius.sm, border: `1px solid ${COLORS.gray200}`, background: COLORS.white, color: COLORS.textPrimary, cursor: 'pointer' }}>{detailsOpen[e.id] ? 'Hide' : 'Show'}</button>
                  </td>
                </tr>
                {detailsOpen[e.id] && (
                  <tr><td colSpan={5} style={{ padding: 10, background: COLORS.offWhite }}>
                    <pre style={{ fontSize: FONTS.size.xs, margin: 0, whiteSpace: 'pre-wrap', color: COLORS.textPrimary }}>{JSON.stringify(e.details || {}, null, 2)}</pre>
                  </td></tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AdminDashboard({ onBack }: { onBack: () => void }) {
  // CLIENT-SIDE admin check: 404 (same as unknown route) for non-admins.
  // This is defense-in-depth; the server-side requireSiteDeckAdmin is the
  // primary gate and returns 404 (not 403) on every failure path.
  const isAdmin = getCurrentRole() === 'owner_admin';

  if (!isAdmin) {
    return <NotAdmin onBack={onBack} />;
  }

  const [section, setSection] = useState<AdminSection>('overview');
  const [selectedBugId, setSelectedBugId] = useState<string | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [overviewError, setOverviewError] = useState('');

  useEffect(() => {
    if (section === 'overview') {
      adminFetch('/overview')
        .then(setOverview)
        .catch((err) => setOverviewError(err.message));
    }
  }, [section]);

  const navItems: { v: AdminSection; label: string; icon: () => React.ReactNode }[] = [
    { v: 'overview', label: 'Overview', icon: Icon.Home },
    { v: 'bugs', label: 'Bug Queue', icon: Icon.Bug },
    { v: 'features', label: 'Feature Requests', icon: Icon.Bulb },
    { v: 'users', label: 'Users', icon: Icon.Users },
    { v: 'health', label: 'Health Monitor', icon: Icon.Activity },
    { v: 'audit', label: 'Audit Log', icon: Icon.List },
  ];

  return (
    <div style={{ minHeight: '100vh', background: COLORS.offWhite, fontFamily: FONTS.family, display: 'flex' }}>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      {/* Sidebar */}
      <aside style={{ width: 220, background: COLORS.navy, color: COLORS.white, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px', borderBottom: `1px solid ${COLORS.navyLight}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: COLORS.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold }}>SD</div>
            <div>
              <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, lineHeight: 1.1 }}>SiteDeck</div>
              <div style={{ fontSize: FONTS.size.xs, color: COLORS.orange, fontWeight: FONTS.weight.semibold }}>OPS</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: 12 }}>
          {navItems.map((item) => (
            <button
              key={item.v}
              onClick={() => { setSection(item.v); setSelectedBugId(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 12px', marginBottom: 4,
                border: 'none', borderRadius: BORDERS.radius.sm,
                background: section === item.v ? COLORS.navyLight : 'transparent',
                color: section === item.v ? COLORS.white : 'rgba(255,255,255,0.7)',
                fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: 12, borderTop: `1px solid ${COLORS.navyLight}` }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', border: 'none', borderRadius: BORDERS.radius.sm, background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: FONTS.size.sm, cursor: 'pointer' }}>
            <Icon.Back /> Back to PM
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: COLORS.white, padding: '12px 24px', borderBottom: `1px solid ${COLORS.gray200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: 0 }}>
            {selectedBugId ? 'Bug Detail' : navItems.find((i) => i.v === section)?.label}
          </h1>
          <span style={{ padding: '4px 10px', borderRadius: 12, background: COLORS.red, color: COLORS.white, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold }}>PRODUCTION</span>
        </header>

        <main style={{ flex: 1, padding: '24px 32px', overflow: 'auto' }}>
          {selectedBugId ? (
            <BugDetail bugId={selectedBugId} onBack={() => setSelectedBugId(null)} />
          ) : section === 'overview' ? (
            overviewError ? <p style={{ color: COLORS.red }}>{overviewError}</p> :
            overview ? <Overview {...overview} /> : <p style={{ textAlign: 'center', padding: 40, color: COLORS.textMuted }}>Loading overview…</p>
          ) : section === 'bugs' ? (
            <BugQueue onSelectBug={setSelectedBugId} />
          ) : section === 'features' ? (
            <FeaturesView />
          ) : section === 'users' ? (
            <UsersView />
          ) : section === 'health' ? (
            <HealthView />
          ) : section === 'audit' ? (
            <AuditView />
          ) : null}
        </main>
      </div>
    </div>
  );
}
