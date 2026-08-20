import { useCallback, useState } from 'react';

import ClassicPortal from './ClassicPortal';
import NewPortal from './NewPortal';
import { APPEARANCE_STORAGE_KEY, loadAppearanceSettings } from './utils/appearancePresets';

/**
 * Demo switchboard for the two portal designs.
 *
 * Both shells keep their own established data, Firebase, AI, and Practice Room
 * behaviour. The selected shell is only a presentation preference.
 */
export default function App() {
  const [portalLayout, setPortalLayout] = useState(() => loadAppearanceSettings().portalLayout);

  const handlePortalLayoutChange = useCallback((nextLayout) => {
    const portalLayout = nextLayout === 'classic' ? 'classic' : 'new';
    try {
      const currentAppearance = loadAppearanceSettings();
      window.localStorage.setItem(
        APPEARANCE_STORAGE_KEY,
        JSON.stringify({ ...currentAppearance, portalLayout }),
      );
    } catch {
      // A browser that blocks storage can still switch for this visit.
    }
    setPortalLayout(portalLayout);
  }, []);

  if (portalLayout === 'classic') {
    return <ClassicPortal key="classic" onPortalLayoutChange={handlePortalLayoutChange} />;
  }

  return <NewPortal key="new" onPortalLayoutChange={handlePortalLayoutChange} />;
}
