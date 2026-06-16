import { useEffect, useState } from 'react';
import { COLORS, FONTS, SHADOWS } from '../styles/design-system';

/**
 * NetworkBanner (Sprint 9 Task 5)
 *
 * Tiny banner that surfaces "you're offline" so the field crew
 * doesn't see failed network requests as broken buttons.
 * Goes away the moment connectivity comes back.
 */
export function NetworkBanner() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        background: COLORS.amber,
        color: COLORS.white,
        padding: '8px 16px',
        textAlign: 'center',
        fontFamily: FONTS.family,
        fontSize: FONTS.size.sm,
        fontWeight: FONTS.weight.semibold,
        boxShadow: SHADOWS.sm,
      }}
    >
      You're offline. Cached pages will work; live data will refresh when you reconnect.
    </div>
  );
}
