import { useCallback, useState } from 'react';

import ClassicPortal from './ClassicPortal';
import NewPortal from './NewPortal';
import TreePortal from './TreePortal';
import { APPEARANCE_STORAGE_KEY, loadAppearanceSettings } from './utils/appearancePresets';

/**
 * Switchboard for the portal designs:
 * - 'simplified' / 'tree': Tree Layout hierarchical file directory (default on dev-tree)
 * - 'new': The Paper Room editorial study workspace
 * - 'classic': The original card & sidebar dashboard
 */
export default function App() {
  const [portalLayout, setPortalLayout] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlMode = (urlParams.get('mode') || urlParams.get('layout') || '').toLowerCase();
      if (['simplified', 'thsc', 'tree'].includes(urlMode)) return 'simplified';
      if (urlMode === 'classic') return 'classic';
      if (urlMode === 'new') return 'new';
    } catch {
      // URLSearchParams error fallback
    }
    return loadAppearanceSettings().portalLayout || 'new';
  });

  const handlePortalLayoutChange = useCallback((nextLayout) => {
    const normalized = nextLayout === 'tree' ? 'simplified' : nextLayout;
    const validLayout = ['classic', 'simplified', 'new'].includes(normalized) ? normalized : 'new';
    try {
      const currentAppearance = loadAppearanceSettings();
      window.localStorage.setItem(
        APPEARANCE_STORAGE_KEY,
        JSON.stringify({ ...currentAppearance, portalLayout: validLayout }),
      );
    } catch {
      // A browser that blocks storage can still switch for this visit.
    }
    setPortalLayout(validLayout);
  }, []);

  if (portalLayout === 'simplified' || portalLayout === 'tree') {
    return <TreePortal key="simplified" onPortalLayoutChange={handlePortalLayoutChange} />;
  }

  if (portalLayout === 'classic') {
    return <ClassicPortal key="classic" onPortalLayoutChange={handlePortalLayoutChange} />;
  }

  return <NewPortal key="new" onPortalLayoutChange={handlePortalLayoutChange} />;
}
