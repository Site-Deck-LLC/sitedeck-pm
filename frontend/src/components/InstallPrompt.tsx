import { useEffect, useState } from 'react';
import { COLORS, FONTS, SHADOWS } from '../styles/design-system';

/**
 * InstallPrompt (Sprint 9 Task 5 + Sprint 11 Task 5)
 *
 * Surfaces a small in-app banner when the browser fires the
 * `beforeinstallprompt` event. Lets the field crew add SiteDeck
 * to their home screen in 2 taps, so the icon lives where the
 * other field tools are.
 *
 * Sprint 11: on a mobile browser, show the prompt on the first
 * visit (not just after the 3rd). iOS Safari doesn't fire
 * `beforeinstallprompt`; we detect it explicitly and show the
 * Share-icon instructions. After install, show a brief
 * "SiteDeck PM is now installed" confirmation.
 *
 * Design notes:
 * - We DO NOT use a modal. The PM is mid-task when they see it;
 *   a bottom sheet feels right.
 * - The prompt is dismissed for 30 days once the user closes it
 *   (stored in localStorage). Don't pester.
 */
const DISMISS_KEY = 'sitedeck:pwa-install-dismissed-at';
const INSTALLED_KEY = 'sitedeck:pwa-installed-at';
const DISMISS_DAYS = 30;

function isDismissed(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) return false;
  return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function dismiss() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

function markInstalled() {
  localStorage.setItem(INSTALLED_KEY, String(Date.now()));
}

function isInstalledAlready(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if ((navigator as any).standalone === true) return true;
  return false;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [visible, setVisible] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    if (isDismissed()) return;

    // Sprint 11: mobile browsers show the prompt on the first
    // visit; desktop browsers still wait for the 3rd visit
    // (i.e. only when the browser fires beforeinstallprompt).
    const isMobile = (navigator.maxTouchPoints || 0) > 0;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS Safari: no `beforeinstallprompt`; detect standalone vs browser
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
    const isStandalone = isInstalledAlready();
    if (isIOS && !isStandalone && isMobile) {
      setShowIOS(true);
      setVisible(true);
    } else if (isMobile && !isStandalone) {
      // Android Chrome — also show early. The actual install
      // button only appears once beforeinstallprompt has fired
      // (the platform requirement), but the hint can be there
      // from the start.
      setShowIOS(false);
      setVisible(true);
    }

    // Detect a fresh install — fires when the app launches from
    // a home-screen tap with a fresh standalone window.
    if (isStandalone && !localStorage.getItem(INSTALLED_KEY)) {
      markInstalled();
      setJustInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const handleInstall = async () => {
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === 'accepted') {
      markInstalled();
      setJustInstalled(true);
    }
    dismiss();
    setVisible(false);
  };

  const handleDismiss = () => {
    dismiss();
    setVisible(false);
  };

  if (justInstalled) {
    return (
      <div
        style={{
          position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 9999,
          background: COLORS.white, border: `1px solid ${COLORS.gray200}`,
          borderRadius: 8, boxShadow: SHADOWS.lg, padding: 16,
          fontFamily: FONTS.family, maxWidth: 480, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <div style={{ width: 40, height: 40, borderRadius: 8, background: COLORS.green, color: COLORS.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: FONTS.weight.bold }}>✓</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: FONTS.size.sm, color: COLORS.textPrimary }}>SiteDeck PM is now installed</div>
          <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginTop: 2 }}>Open from your home screen for the fastest experience.</div>
        </div>
        <button onClick={() => setJustInstalled(false)} style={{ appearance: 'none', border: 0, background: 'transparent', color: COLORS.textSecondary, fontWeight: 600, fontSize: FONTS.size.xs, cursor: 'pointer' }}>×</button>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 9999,
        background: COLORS.white,
        border: `1px solid ${COLORS.gray200}`,
        borderRadius: 8,
        boxShadow: SHADOWS.lg,
        padding: 16,
        fontFamily: FONTS.family,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/icons/icon-192.png" alt="" width={48} height={48} style={{ borderRadius: 8 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: FONTS.size.md, color: COLORS.textPrimary }}>
            Install SiteDeck
          </div>
          <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {showIOS ? (
              <>
                <span>Tap the</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                <span>Share button, then "Add to Home Screen".</span>
              </>
            ) : (
              'Add to your home screen for one-tap access in the field.'
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={handleDismiss}
          style={{
            appearance: 'none',
            border: 0,
            background: 'transparent',
            color: COLORS.textSecondary,
            fontWeight: 600,
            fontSize: FONTS.size.sm,
            padding: '8px 12px',
            cursor: 'pointer',
          }}
        >
          Not now
        </button>
        {!showIOS && evt && (
          <button
            onClick={handleInstall}
            style={{
              appearance: 'none',
              border: 0,
              background: COLORS.orange,
              color: COLORS.white,
              fontWeight: 600,
              fontSize: FONTS.size.sm,
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
