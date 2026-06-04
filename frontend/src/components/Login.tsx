import { useState } from 'react';
import { loginDev } from '../api';
import { COLORS, FONTS, SHADOWS, BORDERS } from '../styles/design-system';

export function Login({ onLogin }: { onLogin: (token: string, role: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await loginDev(email, password);
      onLogin(result.idToken, result.role);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
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
          }}
        >
          Dev mode — any email / password works
        </p>
      </div>
    </div>
  );
}
