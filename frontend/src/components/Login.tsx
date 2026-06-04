import { useState } from 'react';
import { login } from '../api';

export function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(token);
      onLogin(token);
    } catch (err: any) {
      setError(err.message || 'Invalid token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1>SiteDeck PM</h1>
      <p>Enter your API token to continue.</p>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          placeholder="Bearer token (try dev-token)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={styles.input}
          autoFocus
        />
        <button type="submit" disabled={!token || loading} style={styles.button}>
          {loading ? 'Checking...' : 'Sign In'}
        </button>
        {error && <p style={styles.error}>{error}</p>}
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 400,
    margin: '120px auto',
    textAlign: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 24,
  },
  input: {
    padding: '12px 16px',
    fontSize: 16,
    borderRadius: 8,
    border: '1px solid #ccc',
  },
  button: {
    padding: '12px 16px',
    fontSize: 16,
    borderRadius: 8,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer',
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
  },
};
