import { useState } from 'react';

// This is intentionally embedded at the user's request. It is a convenience gate,
// not a server-side security boundary, because browser-delivered source is inspectable.
const HIDDEN_PORTAL_PASSWORD = 'HSC-Hide-Portal-2026';
const ACCESS_STORAGE_KEY = 'hsc_hidden_access_granted';

export default function HiddenAccessGate({ children }) {
  const [isAllowed, setIsAllowed] = useState(() => (
    sessionStorage.getItem(ACCESS_STORAGE_KEY) === 'true'
  ));
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (password === HIDDEN_PORTAL_PASSWORD) {
      sessionStorage.setItem(ACCESS_STORAGE_KEY, 'true');
      setIsAllowed(true);
      setPassword('');
      setError('');
      return;
    }

    setPassword('');
    setError('That password is not correct.');
  };

  if (isAllowed) return children;

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: 'var(--app-background, #f6f7fb)',
        color: 'var(--text-normal, #202534)',
      }}
    >
      <section
        aria-labelledby="hidden-access-title"
        style={{
          width: 'min(100%, 420px)',
          padding: '32px',
          borderRadius: '20px',
          border: '1px solid var(--border-subtle, rgba(35, 42, 59, 0.14))',
          background: 'var(--surface-card, #ffffff)',
          boxShadow: '0 20px 55px rgba(26, 35, 57, 0.14)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: '44px',
            height: '44px',
            display: 'grid',
            placeItems: 'center',
            marginBottom: '20px',
            borderRadius: '14px',
            background: 'var(--brand-experiment, #4169e1)',
            color: '#ffffff',
            fontWeight: 800,
            letterSpacing: '0.04em',
          }}
        >
          HSC
        </div>
        <p style={{ margin: 0, color: 'var(--text-muted, #677085)', fontSize: '0.88rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Private library
        </p>
        <h1 id="hidden-access-title" style={{ margin: '8px 0 10px', fontSize: '1.7rem', letterSpacing: '-0.035em' }}>
          HSC Portal
        </h1>
        <p style={{ margin: '0 0 24px', color: 'var(--text-secondary, #596174)', lineHeight: 1.55 }}>
          Enter the password to open this private paper collection.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="hidden-portal-password" style={{ display: 'block', marginBottom: '8px', fontSize: '0.92rem', fontWeight: 700 }}>
            Password
          </label>
          <input
            id="hidden-portal-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            required
            aria-describedby={error ? 'hidden-access-error' : undefined}
            style={{
              boxSizing: 'border-box',
              width: '100%',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-strong, rgba(35, 42, 59, 0.24))',
              background: 'var(--surface-input, #ffffff)',
              color: 'inherit',
              font: 'inherit',
            }}
          />
          {error && (
            <p id="hidden-access-error" role="alert" style={{ margin: '10px 0 0', color: 'var(--status-danger, #b33a3a)', fontSize: '0.9rem' }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            style={{
              width: '100%',
              marginTop: '20px',
              padding: '12px 16px',
              border: 0,
              borderRadius: '10px',
              background: 'var(--brand-experiment, #4169e1)',
              color: '#ffffff',
              cursor: 'pointer',
              font: 'inherit',
              fontWeight: 700,
            }}
          >
            Open library
          </button>
        </form>
      </section>
    </main>
  );
}
