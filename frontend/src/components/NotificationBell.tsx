import { useEffect, useRef, useState, useCallback } from 'react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api';
import type { Notification } from '../api';
import { COLORS, FONTS, SHADOWS, BORDERS } from '../styles/design-system';

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

function kindLabel(kind: string): string {
  const labels: Record<string, string> = {
    rfi_assigned: 'RFI',
    rfi_answered: 'RFI',
    issue_assigned: 'ISSUE',
    schedule_change_request: 'SCHEDULE',
    co_approved: 'CHANGE ORDER',
    co_rejected: 'CHANGE ORDER',
    system: 'SYSTEM',
  };
  return labels[kind] || kind.toUpperCase();
}

function kindColor(kind: string): string {
  const colors: Record<string, string> = {
    rfi_assigned: '#0EA5E9',
    rfi_answered: '#22A06B',
    issue_assigned: '#D68A00',
    schedule_change_request: '#7C3AED',
    co_approved: '#22A06B',
    co_rejected: '#C9372D',
    system: '#5A6072',
  };
  return colors[kind] || COLORS.navy;
}

export function NotificationBell({
  onSelectProject,
}: {
  onSelectProject?: (projectId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  // Avoid clobbering the user's mark-as-read click with a stale
  // count fetch right after the click.
  const refreshingRef = useRef(false);

  // Initial load + a periodic refresh. The bell polls every 60s so
  // the badge stays current while the user is on a long view. We
  // pause polling while the popover is open to avoid jitter.
  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const { count } = await getUnreadNotificationCount();
      setUnreadCount(count);
    } catch {
      // Standalone: a failed badge fetch is invisible to the user.
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Load the full list when the popover opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await getNotifications({ limit: 30 });
        if (!cancelled) setNotifications(data.notifications);
      } catch {
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const handleMarkRead = async (n: Notification) => {
    if (n.read) return;
    // Optimistic update: flip locally, then persist.
    setNotifications((prev) => prev.map((p) => (p.id === n.id ? { ...p, read: true } : p)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationRead(n.id);
    } catch {
      // Roll back if the server rejected.
      setNotifications((prev) => prev.map((p) => (p.id === n.id ? { ...p, read: false } : p)));
      setUnreadCount((c) => c + 1);
    }
  };

  const handleMarkAllRead = async () => {
    const previousUnread = unreadCount;
    setUnreadCount(0);
    setNotifications((prev) => prev.map((p) => ({ ...p, read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      // Roll back if the server rejected.
      setUnreadCount(previousUnread);
      refresh();
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: 'none',
          background: 'transparent',
          color: COLORS.white,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              padding: '0 4px',
              fontSize: 10,
              fontWeight: FONTS.weight.bold,
              background: COLORS.red,
              color: COLORS.white,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 380,
            maxHeight: 480,
            background: COLORS.white,
            borderRadius: BORDERS.radius.lg,
            boxShadow: SHADOWS.xl,
            zIndex: 100,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: `1px solid ${COLORS.gray200}`,
            }}
          >
            <span style={{ fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: COLORS.orange,
                  fontSize: FONTS.size.xs,
                  fontWeight: FONTS.weight.semibold,
                  cursor: 'pointer',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>
                No notifications yet.
                <br />
                You'll see updates here when RFIs, issues, or schedule changes need your attention.
              </div>
            ) : (
              notifications.map((n) => {
                const projectId = (n.payload as any)?.projectId;
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      handleMarkRead(n);
                      // Deep-link to the project for any notification
                      // carrying a projectId payload.
                      if (projectId && onSelectProject) {
                        setOpen(false);
                        onSelectProject(String(projectId));
                      }
                    }}
                    style={{
                      padding: '12px 16px',
                      borderBottom: `1px solid ${COLORS.gray200}`,
                      background: n.read ? COLORS.white : COLORS.orangeLight + '15',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: FONTS.weight.bold,
                          letterSpacing: '0.5px',
                          padding: '2px 6px',
                          borderRadius: 3,
                          background: kindColor(n.kind),
                          color: COLORS.white,
                          textTransform: 'uppercase',
                        }}
                      >
                        {kindLabel(n.kind)}
                      </span>
                      <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
                        {timeAgo(n.createdAt)}
                      </span>
                      {!n.read && (
                        <span
                          style={{
                            marginLeft: 'auto',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: COLORS.orange,
                          }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: FONTS.size.sm,
                        fontWeight: n.read ? FONTS.weight.regular : FONTS.weight.semibold,
                        color: COLORS.textPrimary,
                        marginBottom: n.body ? 2 : 0,
                        lineHeight: 1.3,
                      }}
                    >
                      {n.title}
                    </div>
                    {n.body && (
                      <div
                        style={{
                          fontSize: FONTS.size.xs,
                          color: COLORS.textSecondary,
                          lineHeight: 1.3,
                        }}
                      >
                        {n.body}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
