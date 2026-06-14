/**
 * GetHelpButton.tsx — Sprint 10, Task 8
 * ============================================================================
 * Floating "Get Help" button on every page in SiteDeck PM. On click,
 * opens the GetHelpModal which captures the user's report.
 *
 * Rate limiting: 5 submissions per hour per browser tab. Stored in
 * sessionStorage so it resets when the tab closes.
 *
 * Console error capture: a circular buffer of the last 10 errors
 * is pushed to by the listener registered in App.tsx (so any
 * unhandled error in any child component is captured).
 *
 * Last-API-call capture: a request interceptor on the fetch wrapper
 * records the most recent request/response pair. The button reads
 * this state on open.
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { GetHelpModal } from './GetHelpModal';

const SUBMIT_KEY = 'sitedeck:gethelp:count';
const SUBMIT_WINDOW_KEY = 'sitedeck:gethelp:windowStart';
const RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export const getHelpBuffer: {
  errors: Array<{ message: string; ts: number }>;
  lastApiCall: null | {
    endpoint: string;
    method: string;
    status?: number;
    response?: unknown;
    ts: number;
  };
  projectId: string | null;
  pushError: (e: Error | string) => void;
  setLastApiCall: (call: {
    endpoint: string;
    method: string;
    status?: number;
    response?: unknown;
    ts: number;
  }) => void;
  setProjectId: (id: string | null) => void;
} = {
  errors: [] as Array<{ message: string; ts: number }>,
  lastApiCall: null,
  projectId: null,
  pushError(e: Error | string) {
    const msg = typeof e === 'string' ? e : e?.message || String(e);
    this.errors.push({ message: msg.slice(0, 500), ts: Date.now() });
    if (this.errors.length > 10) this.errors.shift();
  },
  setLastApiCall(call) {
    this.lastApiCall = call;
  },
  setProjectId(id: string | null) {
    this.projectId = id;
  },
};

function readRateLimit(): { count: number; windowStart: number } {
  try {
    const count = Number(sessionStorage.getItem(SUBMIT_KEY) || '0');
    const windowStart = Number(sessionStorage.getItem(SUBMIT_WINDOW_KEY) || '0');
    return { count, windowStart };
  } catch {
    return { count: 0, windowStart: 0 };
  }
}

function recordSubmit(): void {
  const now = Date.now();
  const cur = readRateLimit();
  if (!cur.windowStart || now - cur.windowStart > RATE_LIMIT_WINDOW_MS) {
    sessionStorage.setItem(SUBMIT_WINDOW_KEY, String(now));
    sessionStorage.setItem(SUBMIT_KEY, '1');
    return;
  }
  sessionStorage.setItem(SUBMIT_KEY, String(cur.count + 1));
}

function isRateLimited(): boolean {
  const cur = readRateLimit();
  if (!cur.windowStart) return false;
  if (Date.now() - cur.windowStart > RATE_LIMIT_WINDOW_MS) return false;
  return cur.count >= RATE_LIMIT;
}

export function GetHelpButton() {
  const [open, setOpen] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    setRateLimited(isRateLimited());
  }, [open]);

  if (open) {
    return (
      <GetHelpModal
        onClose={() => setOpen(false)}
        onSubmitted={() => {
          recordSubmit();
          setRateLimited(true);
        }}
        preblocked={rateLimited}
      />
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Get help"
      title="Get help"
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 9998,
        width: hover ? 140 : 56,
        height: 56,
        borderRadius: 28,
        background: 'var(--sitedeck-navy, #1B2A4A)',
        color: '#fff',
        border: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: hover ? 'flex-start' : 'center',
        paddingLeft: hover ? 16 : 0,
        gap: 8,
        transition: 'width 0.18s ease, background 0.18s ease',
        fontSize: 14,
        fontWeight: 600,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1 }}>?</span>
      {hover && <span>Get Help</span>}
    </button>
  );
}
