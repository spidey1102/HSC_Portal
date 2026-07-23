import React from 'react';
import { useAuth } from './AuthContext';
import { LogIn, LogOut, User } from 'lucide-react';

export default function UserButton() {
  const { user, loading, signInWithGoogle, logOut } = useAuth();

  if (loading) {
    return <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--surface-sunken)' }} />;
  }

  if (user) {
    return (
      <button
        onClick={logOut}
        className="btn-secondary"
        style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
        title="Sign Out"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt={user.displayName} style={{ width: 24, height: 24, borderRadius: '50%' }} />
        ) : (
          <User size={16} />
        )}
        <span style={{ fontSize: '14px', fontWeight: 500 }}>{user.displayName?.split(' ')[0] || 'User'}</span>
        <LogOut size={16} style={{ marginLeft: '4px' }} />
      </button>
    );
  }

  return (
    <button
      onClick={signInWithGoogle}
      className="btn-primary"
      style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
      title="Sign In with Google to sync your data"
    >
      <LogIn size={16} />
      <span>Sign In</span>
    </button>
  );
}
