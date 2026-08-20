import ClassicApp from './classic/App.jsx';
import { AuthProvider as ClassicAuthProvider } from './classic/components/AuthContext.jsx';
import { SyncProvider as ClassicSyncProvider } from './classic/components/SyncContext.jsx';

/**
 * The Classic option intentionally mounts an isolated snapshot of the current
 * main-branch portal. This prevents redesigned components from replacing old
 * controls, icons, and card interactions inside the legacy interface.
 */
export default function ClassicPortal({ onPortalLayoutChange }) {
  return (
    <ClassicAuthProvider>
      <ClassicSyncProvider>
        <ClassicApp onPortalLayoutChange={onPortalLayoutChange} />
      </ClassicSyncProvider>
    </ClassicAuthProvider>
  );
}
