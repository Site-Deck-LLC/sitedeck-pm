import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { loginDev } from '../api';
import { COLORS, FONTS, SHADOWS, BORDERS } from '../styles/design-system';
import { getFirebaseAuth, isFirebaseConfigured } from '../firebase';
import { setCurrentRole } from '../auth';

const DEV_ROLES = [
  { value: 'owner_admin', label: 'Owner Admin' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'superintendent', label: 'Superintendent' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'field_crew', label: 'Field Crew' },
  { value: 'subcontractor_pm', label: 'Subcontractor PM' },
  { value: 'subcontractor_super', label: 'Subcontractor Super' },
  { value: 'owners_rep', label: "Owner's Rep" },
  { value: 'accountant_ap', label: 'Accountant / AP' },
];

export function Login({ onLogin }: { onLogin: (token: string, role: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError('');
    setLoading(true);
    try {
      // Production path: Firebase client SDK sign-in
      const fbAuth = getFirebaseAuth();
      if (fbAuth && isFirebaseConfigured) {
        const cred = await signInWithEmailAndPassword(fbAuth, email, password);
        const idToken = await cred.user.getIdToken();
        const role = (cred.user as any).role || 'project_manager';
        onLogin(idToken, role);
        return;
      }
      // Dev path: any email/password works, server returns dev-token
      const result = await loginDev(email, password);
      onLogin(result.idToken, result.role);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDevLogin(role: string) {
    setCurrentRole(role);
    onLogin('dev-token', role);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.navyDark} 100%)`,
        fontFamily: FONTS.family,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '48px 40px',
          borderRadius: BORDERS.radius.xl,
          background: COLORS.white,
          boxShadow: SHADOWS.xl,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: COLORS.orange,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: FONTS.weight.bold,
              fontSize: FONTS.size.xl,
              color: COLORS.white,
              margin: '0 auto 16px',
            }}
          >
            SD
          </div>
          <h1
            style={{
              fontSize: FONTS.size.xxl,
              fontWeight: FONTS.weight.bold,
              color: COLORS.textPrimary,
              margin: '0 0 4px 0',
            }}
          >
            SiteDeck PM
          </h1>
          <p style={{ fontSize: FONTS.size.md, color: COLORS.textSecondary, margin: 0 }}>
            Project Management for Construction Teams
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: BORDERS.radius.md,
              background: COLORS.redLight,
              color: COLORS.red,
              fontSize: FONTS.size.sm,
              marginBottom: 20,
              border: `1px solid ${COLORS.red}`,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                fontSize: FONTS.size.sm,
                fontWeight: FONTS.weight.semibold,
                color: COLORS.textPrimary,
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: BORDERS.radius.md,
                border: `1px solid ${COLORS.gray300}`,
                fontSize: FONTS.size.md,
                color: COLORS.textPrimary,
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = COLORS.orange;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = COLORS.gray300;
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: FONTS.size.sm,
                fontWeight: FONTS.weight.semibold,
                color: COLORS.textPrimary,
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: BORDERS.radius.md,
                border: `1px solid ${COLORS.gray300}`,
                fontSize: FONTS.size.md,
                color: COLORS.textPrimary,
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = COLORS.orange;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = COLORS.gray300;
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: BORDERS.radius.md,
              border: 'none',
              background: COLORS.orange,
              color: COLORS.white,
              fontSize: FONTS.size.md,
              fontWeight: FONTS.weight.semibold,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p
          style={{
            textAlign: 'center',
            fontSize: FONTS.size.sm,
            color: COLORS.textMuted,
            marginTop: 20,
            marginBottom: isFirebaseConfigured ? 20 : 0,
          }}
        >
          {isFirebaseConfigured
            ? 'Production auth — Firebase sign-in'
            : 'Dev mode — any email / password works'}
        </p>

        {!isFirebaseConfigured && (
          <>
            <div
              style={{
                marginTop: 16,
                padding: 8,
                background: '#FEF3C7',
                color: '#92400E',
                borderRadius: BORDERS.radius.sm,
                fontSize: FONTS.size.xs,
                textAlign: 'center',
              }}
            >
              Firebase not configured. Set VITE_FIREBASE_* env vars for production.
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: FONTS.size.xs,
                color: COLORS.textSecondary,
                fontWeight: FONTS.weight.semibold,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Or pick a dev role:
            </div>
            <div
              style={{
                marginTop: 8,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 6,
              }}
            >
              {DEV_ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => handleDevLogin(r.value)}
                  style={{
                    background: COLORS.white,
                    color: COLORS.textPrimary,
                    border: `1px solid ${COLORS.gray200}`,
                    borderLeft: `3px solid ${r.value === 'owner_admin' ? COLORS.orange : COLORS.navy}`,
                    padding: '6px 8px',
                    borderRadius: BORDERS.radius.sm,
                    fontSize: FONTS.size.xs,
                    fontWeight: FONTS.weight.medium,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
