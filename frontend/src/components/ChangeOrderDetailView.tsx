import { useEffect, useState } from 'react';
import { COLORS, FONTS, BORDERS } from '../styles/design-system';
import { fetchApi, getChangeOrder, patchChangeOrder, getChangeOrderPdfUrl } from '../api';
import { canEditSchedule } from '../auth';

interface ChangeOrder {
  id: string;
  coNumber: string;
  date: string;
  description: string;
  status: string;
  dollarValue: number | null;
  scheduleImpact: number | null;
  approver: string | null;
  approvedAt: string | null;
  affectedActivityIds: string[] | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  projectId: string;
  coId: string;
  token: string;
  apiBase: string;
  onBack: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: COLORS.gray300, fg: COLORS.textPrimary, label: 'Pending' },
  submitted: { bg: COLORS.navy, fg: COLORS.white, label: 'Submitted' },
  approved: { bg: COLORS.green, fg: COLORS.white, label: 'Approved' },
  rejected: { bg: COLORS.red, fg: COLORS.white, label: 'Rejected' },
};

function fmt(d?: string | null) {
  if (!d) return '—';
  try {
    return d.slice(0, 10);
  } catch {
    return '—';
  }
}

function fmtCurrency(n: number | null) {
  if (n == null) return '—';
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ChangeOrderDetailView({ projectId, coId, onBack }: Props) {
  const [co, setCo] = useState<ChangeOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [baselineUpdate, setBaselineUpdate] = useState<{ previous: number; next: number; added: number; source: string } | null>(null);
  const [qboExport, setQboExport] = useState<{ invoiceId: string; invoiceNumber: string; alreadyExported: boolean } | null>(null);
  const [qboBusy, setQboBusy] = useState(false);
  const canEdit = canEditSchedule();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data: ChangeOrder = await getChangeOrder(projectId, coId);
      setCo(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, coId]);

  const submit = async (body: any) => {
    setSaving(true);
    setError('');
    try {
      const result: any = await patchChangeOrder(projectId, coId, body);
      // The backend returns { changeOrder, baseline } for actions that
      // change state (approve/reject/submit) so the UI can surface the
      // new BAC. For 'update' actions, the response is the change order
      // itself. Normalize both shapes to the change-order object.
      const updated: ChangeOrder = result && result.changeOrder
        ? result.changeOrder
        : result;
      setCo(updated);
      // When the approval re-flowed the cost baseline, show the delta so
      // the user sees that BAC changed. Captured here and rendered in
      // the approval banner.
      if (result && result.baseline && result.baseline.addedAmount > 0) {
        const bl = result.baseline;
        setBaselineUpdate({
          previous: bl.previousTotalBudget,
          next: bl.newTotalBudget,
          added: bl.addedAmount,
          source: bl.source,
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', color: COLORS.textSecondary }}>
        Loading change order…
      </div>
    );
  }

  if (error || !co) {
    return (
      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        <button onClick={onBack} style={backButtonStyle}>← Back</button>
        <div style={{ marginTop: 16, color: COLORS.red, fontSize: FONTS.size.sm }}>{error || 'Change order not found'}</div>
      </div>
    );
  }

  const info = STATUS_COLORS[co.status] || STATUS_COLORS.pending;
  const isClosed = co.status === 'approved' || co.status === 'rejected';

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', fontFamily: FONTS.family }}>
      <button onClick={onBack} style={backButtonStyle}>← Back</button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, fontFamily: 'monospace' }}>{co.coNumber}</span>
            <span style={pillStyle(info.bg, info.fg, isClosed)}>{info.label}</span>
            {co.dollarValue != null && (
              <span style={pillStyle(COLORS.amber, COLORS.white)}>
                {fmtCurrency(co.dollarValue)}
              </span>
            )}
            {co.scheduleImpact != null && co.scheduleImpact !== 0 && (
              <span style={pillStyle(COLORS.amber, COLORS.white)}>
                {co.scheduleImpact > 0 ? '+' : ''}{co.scheduleImpact}h schedule
              </span>
            )}
          </div>
          <h1 style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: 0, lineHeight: 1.3 }}>
            Change Order
          </h1>
        </div>
      </div>

      <Section title="Scope Change">
        <Field label="Description" value={<MultiLine text={co.description} />} />
        <Field label="Initiated" value={fmt(co.date)} />
      </Section>

      <Section title="Approval">
        {co.approver ? (
          <>
            <Field label="Approver" value={co.approver} />
            <Field
              label="Decision date"
              value={fmt(co.approvedAt)}
            />
          </>
        ) : (
          <div style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, fontStyle: 'italic' }}>
            Not yet decided
          </div>
        )}
        {co.status === 'rejected' && co.approver && (
          <div style={{ marginTop: 8, padding: 8, background: '#FEE2E2', borderRadius: BORDERS.radius.sm, color: '#991B1B', fontSize: FONTS.size.xs }}>
            This change order was rejected by {co.approver} on {fmt(co.approvedAt)}.
          </div>
        )}
        {co.status === 'approved' && co.approver && (
          <div style={{ marginTop: 8, padding: 8, background: '#DCFCE7', borderRadius: BORDERS.radius.sm, color: '#166534', fontSize: FONTS.size.xs }}>
            Approved by {co.approver} on {fmt(co.approvedAt)}. Dollar value and schedule impact flow into the project cost baseline.
            {baselineUpdate && (
              <div style={{ marginTop: 4 }}>
                BAC updated: ${(baselineUpdate.previous / 100).toLocaleString()} → ${(baselineUpdate.next / 100).toLocaleString()}
                {' '}(+${(baselineUpdate.added / 100).toLocaleString()},
                {' '}{baselineUpdate.source === 'change_order_catchall' ? 'new catch-all line' : 'proportional distribution'}).
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Cost & Schedule Impact">
        <Field label="Dollar value" value={fmtCurrency(co.dollarValue)} />
        <Field label="Schedule impact (hours)" value={co.scheduleImpact != null ? `${co.scheduleImpact}h` : '—'} />
        {co.affectedActivityIds && co.affectedActivityIds.length > 0 && (
          <Field
            label="Affected activities"
            value={
              <span>
                {co.affectedActivityIds.length} activit{co.affectedActivityIds.length === 1 ? 'y' : 'ies'} linked
              </span>
            }
          />
        )}
      </Section>

      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {co.status === 'pending' && (
            <button
              onClick={() => submit({ action: 'submit' })}
              disabled={saving}
              style={primaryButtonStyle(saving)}
            >
              Submit to Owner
            </button>
          )}
          {(co.status === 'pending' || co.status === 'submitted') && (
            <button
              onClick={() => {
                const approver = window.prompt('Approver name:', 'Owner') || 'Owner';
                submit({ action: 'approve', approver });
              }}
              disabled={saving}
              style={secondaryButtonStyle}
            >
              Mark Approved
            </button>
          )}
          {(co.status === 'pending' || co.status === 'submitted') && (
            <button
              onClick={() => {
                const approver = window.prompt('Approver name:', 'Owner') || 'Owner';
                submit({ action: 'reject', approver });
              }}
              disabled={saving}
              style={secondaryButtonStyle}
            >
              Mark Rejected
            </button>
          )}
          <button
            onClick={() => {
              // Binary download; see RfiDetailView for the design rationale.
              const url = getChangeOrderPdfUrl(projectId, co.id);
              window.open(url, '_blank', 'noopener');
            }}
            style={secondaryButtonStyle}
          >
            Export CO PDF
          </button>
          {co.status === 'approved' && (
            <button
              onClick={async () => {
                setQboBusy(true);
                setError('');
                try {
                  const r = await fetchApi<{ invoiceId: string; invoiceNumber: string; alreadyExported: boolean }>(
                    `/api/v1/projects/${projectId}/integrations/quickbooks/export-co/${co.id}`,
                    { method: 'POST' }
                  );
                  setQboExport(r);
                } catch (e: any) {
                  setError(`QuickBooks export failed: ${e?.message || 'unknown'}`);
                } finally {
                  setQboBusy(false);
                }
              }}
              disabled={qboBusy}
              style={secondaryButtonStyle}
            >
              {qboBusy ? 'Exporting…' : qboExport ? 'Re-export to QuickBooks' : 'Export to QuickBooks'}
            </button>
          )}
        </div>
      )}
      {qboExport && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: COLORS.greenLight,
            color: COLORS.green,
            borderRadius: BORDERS.radius.sm,
            fontSize: FONTS.size.sm,
          }}
        >
          ✓ QuickBooks invoice <strong>{qboExport.invoiceNumber}</strong> created
          {qboExport.alreadyExported ? ' (already exported)' : ''}
        </div>
      )}
    </div>
  );
}

function pillStyle(bg: string, fg: string, strike = false): React.CSSProperties {
  return {
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 12,
    background: bg,
    color: fg,
    fontWeight: FONTS.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textDecoration: strike ? 'line-through' : 'none',
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: FONTS.size.xs,
          fontWeight: FONTS.weight.bold,
          color: COLORS.navy,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 8,
          paddingBottom: 4,
          borderBottom: `1px solid ${COLORS.gray200}`,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FONTS.size.sm, gap: 12 }}>
      <span style={{ color: COLORS.textSecondary, flexShrink: 0 }}>{label}</span>
      <span style={{ color: COLORS.textPrimary, fontWeight: FONTS.weight.medium, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function MultiLine({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: FONTS.size.sm,
        color: COLORS.textPrimary,
        whiteSpace: 'pre-wrap',
        background: COLORS.gray100,
        padding: 8,
        borderRadius: BORDERS.radius.sm,
        maxWidth: 600,
      }}
    >
      {text}
    </div>
  );
}

const backButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: COLORS.navy,
  fontSize: FONTS.size.sm,
  cursor: 'pointer',
  padding: 0,
  fontWeight: FONTS.weight.semibold,
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
