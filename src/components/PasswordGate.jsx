import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, GraduationCap } from 'lucide-react';

const PASSWORD = 'HSC_HIDE';
const SESSION_KEY = 'hsc_hide_auth';

export default function PasswordGate({ children }) {
  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  });
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!authenticated) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [authenticated]);

  const submit = () => {
    if (input === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      setAuthenticated(true);
    } else {
      setError(true);
      setShaking(true);
      setInput('');
      setTimeout(() => setShaking(false), 500);
      setTimeout(() => setError(false), 2000);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') submit();
  };

  if (authenticated) return children;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-canvas, #0f1117)',
        zIndex: 99999,
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'var(--bg-elevated, #1a1d26)',
          border: '1px solid var(--sidebar-border, rgba(255,255,255,0.08))',
          borderRadius: '20px',
          padding: '40px 36px',
          boxShadow: '0 32px 64px -16px rgba(0,0,0,0.5)',
          animation: shaking ? 'pg-shake 0.45s ease' : undefined,
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'var(--brand-experiment, #5865f2)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <GraduationCap size={28} color="#fff" />
          </div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-muted, #72767d)',
              marginBottom: '6px',
            }}
          >
            HSC Portal
          </div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--header-primary, #fff)',
              margin: 0,
            }}
          >
            Private library
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-muted, #72767d)',
              marginTop: '8px',
              lineHeight: 1.5,
            }}
          >
            This collection is password protected.
          </p>
        </div>

        {/* Input */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: error ? 'var(--status-danger, #ed4245)' : 'var(--text-muted, #72767d)',
              marginBottom: '8px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              transition: 'color 0.2s',
            }}
          >
            {error ? 'Incorrect password — try again' : 'Password'}
          </label>
          <div style={{ position: 'relative' }}>
            <Lock
              size={16}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: error ? 'var(--status-danger, #ed4245)' : 'var(--text-muted, #72767d)',
                pointerEvents: 'none',
                transition: 'color 0.2s',
              }}
            />
            <input
              ref={inputRef}
              type={showPwd ? 'text' : 'password'}
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(false); }}
              onKeyDown={handleKeyDown}
              placeholder="Enter password"
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '12px 44px 12px 42px',
                borderRadius: '12px',
                background: 'var(--bg-secondary, #111318)',
                border: `1.5px solid ${error ? 'var(--status-danger, #ed4245)' : 'var(--border-subtle, rgba(255,255,255,0.1))'}`,
                color: 'var(--text-normal, #dcddde)',
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted, #72767d)',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              tabIndex={-1}
              aria-label={showPwd ? 'Hide password' : 'Show password'}
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          onClick={submit}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: '12px',
            background: 'var(--brand-experiment, #5865f2)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '15px',
            border: 'none',
            cursor: 'pointer',
            transition: 'opacity 0.15s, transform 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          Unlock
        </button>
      </div>

      <style>{`
        @keyframes pg-shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(7px); }
          45%       { transform: translateX(-6px); }
          60%       { transform: translateX(5px); }
          75%       { transform: translateX(-3px); }
          90%       { transform: translateX(2px); }
        }
      `}</style>
    </div>
  );
}
