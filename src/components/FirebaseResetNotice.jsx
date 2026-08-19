import { DatabaseZap } from 'lucide-react';

export default function FirebaseResetNotice({ isOpen, onDismiss }) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="firebase-reset-notice-title"
      aria-describedby="firebase-reset-notice-description"
      style={{ zIndex: 10000 }}
    >
      <div className="modal-content" style={{ maxWidth: '460px', padding: '28px' }}>
        <div
          aria-hidden="true"
          style={{
            width: '42px',
            height: '42px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '12px',
            background: 'color-mix(in srgb, var(--brand-experiment) 14%, transparent)',
            color: 'var(--brand-experiment)',
            marginBottom: '16px',
          }}
        >
          <DatabaseZap size={22} />
        </div>
        <h2 id="firebase-reset-notice-title" style={{ margin: '0 0 10px' }}>
          Your HSC Portal setup needs a fresh start
        </h2>
        <p id="firebase-reset-notice-description" style={{ color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 12px' }}>
          We have moved HSC Portal to a dedicated, more reliable data service. Your previous synced setup could not be transferred, so please sign in again and choose your subjects and preferences.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 24px' }}>
          Your paper library is unchanged. This message appears only once on this device.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={onDismiss}
          style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
        >
          Continue to HSC Portal
        </button>
      </div>
    </div>
  );
}
