import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';

// This screen renders before NewPortal initialises a saved palette. Keep its
// colours self-contained so an old dark-theme variable can never leave text
// white on a pale sign-in card.
const pageStyle = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '24px',
  background: 'linear-gradient(145deg, #14251d 0%, #2f5c42 100%)',
  color: '#f8fbf7',
};

const panelStyle = {
  width: 'min(100%, 440px)',
  padding: 'clamp(28px, 6vw, 48px)',
  border: '1px solid rgba(18, 35, 26, 0.18)',
  background: '#fffdf8',
  color: '#17231b',
  boxShadow: '0 22px 60px rgba(4, 18, 10, 0.32)',
};

/**
 * Deliberately has no skip path: the portal and all AI controls remain
 * unavailable until the Firebase Google session is established.
 */
export default function GoogleSignInGate({ children }) {
  const { user, loading, authError, signInWithGoogle } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <main style={pageStyle} aria-busy="true" aria-live="polite">
        <p className="kick" style={{ color: '#f8fbf7' }}>Checking your HSC Hide session…</p>
      </main>
    );
  }

  if (user) return children;

  const handleSignIn = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch {
      // AuthContext supplies a user-facing error message.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={panelStyle} aria-labelledby="sign-in-title">
        <p className="kick" style={{ color: '#41604c' }}>HSC Hide</p>
        <h1 id="sign-in-title" style={{ margin: '14px 0 10px', color: '#17231b' }}>Sign in to enter</h1>
        <p style={{ color: '#425248', lineHeight: 1.6, margin: '0 0 24px' }}>
          Use your Google account to access the paper library, study tools, and AI features.
        </p>
        <button
          type="button"
          className="btn"
          onClick={handleSignIn}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          style={{ width: '100%', justifyContent: 'center', background: '#1f5e3b', borderColor: '#1f5e3b', color: '#ffffff' }}
        >
          {isSubmitting ? 'Opening Google…' : 'Continue with Google'}
        </button>
        {authError && (
          <p role="alert" style={{ color: '#9a251c', lineHeight: 1.5, margin: '16px 0 0' }}>
            {authError}
          </p>
        )}
      </section>
    </main>
  );
}
