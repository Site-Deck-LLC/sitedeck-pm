/**
 * GetHelpModal.tsx — Sprint 10, Task 8
 * ============================================================================
 * The Get Help flow. Captures user context silently, accepts the
 * user-action text, submits to /api/v1/support/report, polls for the
 * triage result, and renders the right message for the classification.
 *
 * States:
 *   0s → 30s : "Our AI is looking at this…"
 *   30s+     : "This is taking a bit longer than expected — still working on it…"
 *   2m+      : "This one needs our engineering team. We've logged it and
 *               will follow up. In the meantime: {workaround if known}"
 *
 * Response rendering:
 *   USER_ERROR       — chat-style instructions, follow-up allowed
 *   FEATURE_REQUEST  — exact required text, closes in 3s
 *   DATA_FIX         — "We found the issue and fixed it. Refresh to see the fix"
 *   CODE_CHANGE      — workaround + close
 * ============================================================================
 */

import { useEffect, useRef, useState } from 'react';
import { getHelpBuffer } from './GetHelpButton';

type Status = 'idle' | 'submitting' | 'triaging' | 'follow_up_slow' | 'follow_up_long' | 'resolved' | 'error';

interface SubmitResponse {
  reportId: string;
  message: string;
}

interface PollResponse {
  reportId: string;
  status: string;
  classification: string | null;
  userFacingMessage: string;
  workaround: string | null;
}

const FEATURE_REQUEST_TEXT =
  'That is a cool idea for a new feature. Let me see if this is possible for a future build.';

export function GetHelpModal({
  onClose,
  onSubmitted,
  preblocked,
}: {
  onClose: () => void;
  onSubmitted: () => void;
  preblocked: boolean;
}) {
  const [userAction, setUserAction] = useState('');
  const [status, setStatus] = useState<Status>(preblocked ? 'error' : 'idle');
  const [errMsg, setErrMsg] = useState<string | null>(preblocked ? 'You have submitted several reports recently. Please wait before submitting more.' : null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [result, setResult] = useState<PollResponse | null>(null);
  const [followUpTurns, setFollowUpTurns] = useState(0);
  const [followUpText, setFollowUpText] = useState('');
  const followUpRef = useRef<HTMLInputElement | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (status !== 'triaging' || !reportId) return;
    const startedAt = Date.now();
    const SLOW_MS = 30_000;
    const LONG_MS = 2 * 60 * 1000;
    const t1 = setTimeout(() => setStatus('follow_up_slow'), SLOW_MS);
    const t2 = setTimeout(() => setStatus('follow_up_long'), LONG_MS);
    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const res = await fetch(`/api/v1/support/report/${reportId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data: PollResponse = await res.json();
        if (data.classification || ['data_fixed', 'closed', 'user_error_resolved', 'feature_logged', 'code_fix_deployed'].includes(data.status)) {
          setResult(data);
          setStatus('resolved');
        }
      } catch {
        // ignore — keep polling
      }
      void startedAt;
    }, 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(interval);
    };
  }, [status, reportId]);

  // Auto-close for FEATURE_REQUEST after 3s.
  useEffect(() => {
    if (status === 'resolved' && result?.classification === 'feature_request') {
      const t = setTimeout(onClose, 3000);
      return () => clearTimeout(t);
    }
  }, [status, result, onClose]);

  async function submit() {
    if (submittedRef.current) return;
    if (!userAction.trim()) {
      setErrMsg('Please describe what you were trying to do.');
      return;
    }
    submittedRef.current = true;
    setStatus('submitting');
    setErrMsg(null);
    const token = localStorage.getItem('token') || '';
    const body = {
      userAction: userAction.trim(),
      route: window.location.pathname,
      pageTitle: document.title,
      consoleErrors: getHelpBuffer.errors.slice(-10),
      lastApiCall: getHelpBuffer.lastApiCall,
      projectId: getHelpBuffer.projectId,
      browserInfo: {
        ua: navigator.userAgent,
        viewport: { w: window.innerWidth, h: window.innerHeight },
      },
    };
    try {
      const res = await fetch('/api/v1/support/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.status === 429) {
        setStatus('error');
        setErrMsg('You have submitted several reports recently. Please wait before submitting more.');
        submittedRef.current = false;
        return;
      }
      if (!res.ok) {
        setStatus('error');
        setErrMsg('Could not submit your report. Please try again.');
        submittedRef.current = false;
        return;
      }
      const data: SubmitResponse = await res.json();
      setReportId(data.reportId);
      onSubmitted();
      setStatus('triaging');
    } catch (e) {
      setStatus('error');
      setErrMsg('Network error. Please check your connection and try again.');
      submittedRef.current = false;
    }
  }

  function renderBody() {
    if (status === 'idle' || status === 'submitting') {
      return (
        <>
          <p style={{ margin: '0 0 8px 0', color: '#444', fontSize: 14 }}>
            Tell us what happened. We'll auto-attach details like the page and the
            last few errors so our team can see what you saw.
          </p>
          <textarea
            autoFocus
            value={userAction}
            onChange={(e) => setUserAction(e.target.value)}
            placeholder="e.g. I was trying to add a new activity to the Gantt chart"
            style={{
              width: '100%',
              minHeight: 100,
              padding: 10,
              borderRadius: 6,
              border: '1px solid #ccc',
              fontFamily: 'inherit',
              fontSize: 14,
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
          {errMsg && <p style={{ color: '#C9372D', fontSize: 13, margin: '8px 0 0 0' }}>{errMsg}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} style={btnSecondary}>Cancel</button>
            <button
              onClick={submit}
              disabled={status === 'submitting'}
              style={btnPrimary}
            >
              {status === 'submitting' ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </>
      );
    }

    if (status === 'triaging' || status === 'follow_up_slow' || status === 'follow_up_long') {
      const message =
        status === 'triaging'
          ? 'Our AI is looking at this…'
          : status === 'follow_up_slow'
            ? "This is taking a bit longer than expected — still working on it…"
            : "This one needs our engineering team. We've logged it and will follow up.";
      return (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #E8720C', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.9s linear infinite' }} />
          <p style={{ margin: 0, fontSize: 14, color: '#1B2A4A' }}>{message}</p>
          {status === 'follow_up_long' && result?.workaround && (
            <p style={{ marginTop: 12, fontSize: 13, color: '#444' }}>
              In the meantime: {result.workaround}
            </p>
          )}
        </div>
      );
    }

    if (status === 'error') {
      return (
        <>
          <p style={{ color: '#C9372D', fontSize: 14 }}>{errMsg || 'Something went wrong.'}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} style={btnSecondary}>Close</button>
          </div>
        </>
      );
    }

    if (status === 'resolved' && result) {
      const cls = result.classification;
      if (cls === 'user_error') {
        return (
          <>
            <p style={{ margin: '0 0 8px 0', fontSize: 14, color: '#1B2A4A' }}>
              {result.userFacingMessage}
            </p>
            <div style={{ background: '#F4F6F9', padding: 10, borderRadius: 6, fontSize: 13 }}>
              {result.userFacingMessage}
            </div>
            {followUpTurns < 5 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!followUpText.trim()) return;
                  setFollowUpTurns((t) => t + 1);
                  setFollowUpText('');
                  followUpRef.current?.focus();
                }}
                style={{ display: 'flex', gap: 6, marginTop: 12 }}
              >
                <input
                  ref={followUpRef}
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.target.value)}
                  placeholder="Still stuck? Ask a follow-up…"
                  style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 6, fontSize: 13 }}
                />
                <button type="submit" style={btnPrimary}>Send</button>
              </form>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={onClose} style={btnSecondary}>Close</button>
            </div>
          </>
        );
      }
      if (cls === 'feature_request') {
        return (
          <p style={{ margin: 0, fontSize: 14, color: '#1B2A4A' }}>{FEATURE_REQUEST_TEXT}</p>
        );
      }
      if (cls === 'data_fix' || result.status === 'data_fixed') {
        return (
          <>
            <p style={{ margin: 0, fontSize: 14, color: '#1B2A4A' }}>
              We found the issue and fixed it. Here's what happened:{' '}
              {result.userFacingMessage.replace(/^We found the issue and fixed it\. Here's what happened:\s*/, '')}
            </p>
            <p style={{ marginTop: 8, fontSize: 13, color: '#444' }}>Refresh the page to see the fix.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={onClose} style={btnPrimary}>Got it</button>
            </div>
          </>
        );
      }
      // code_change or fallback
      return (
        <>
          <p style={{ margin: 0, fontSize: 14, color: '#1B2A4A' }}>{result.userFacingMessage}</p>
          {result.workaround && (
            <p style={{ marginTop: 8, fontSize: 13, color: '#444' }}>In the meantime: {result.workaround}</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button onClick={onClose} style={btnPrimary}>OK</button>
          </div>
        </>
      );
    }

    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 20,
          width: '100%',
          maxWidth: 460,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#1B2A4A' }}>Get Help</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9CA3AF' }}>×</button>
        </div>
        {renderBody()}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: '#E8720C', color: '#fff', border: 'none', padding: '8px 16px',
  borderRadius: 6, fontWeight: 600, fontSize: 14, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: '#1B2A4A', border: '1px solid #1B2A4A',
  padding: '8px 16px', borderRadius: 6, fontWeight: 600, fontSize: 14, cursor: 'pointer',
};
