/**
 * Platform-aware shortcut display for the redesigned portal.
 *
 * The app is browser-only, but the guards keep this safe for tooling and tests.
 * macOS uses its familiar symbolic labels; Windows uses clear written modifier
 * names. Other platforms intentionally follow the Windows convention.
 */
function getPlatform() {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
}

export function isMacOS(platform = getPlatform()) {
  return /Mac|iPhone|iPad|iPod/i.test(String(platform));
}

export function getPlatformShortcuts(platform) {
  const macOS = isMacOS(platform);
  const primary = macOS ? '⌘' : 'Ctrl';
  const alternate = macOS ? '⌥' : 'Alt';
  const shift = macOS ? '⇧' : 'Shift';
  const enter = macOS ? '↵' : 'Enter';
  const join = (keys) => (macOS ? keys.join('') : keys.join(' + '));
  const primaryKey = (key) => join([primary, key]);
  const primaryShiftKey = (key) => (
    macOS ? join([shift, primary, key]) : join([primary, shift, key])
  );

  return {
    isMacOS: macOS,
    primary,
    alternate,
    shift,
    enter,
    escape: macOS ? 'esc' : 'Esc',
    primaryK: primaryKey('K'),
    primaryEnter: primaryKey(enter),
    alternateEnter: join([alternate, enter]),
    shiftEnter: join([shift, enter]),
    undo: primaryKey('Z'),
    redo: primaryShiftKey('Z'),
    zoomOut: primaryKey('−'),
    zoomIn: primaryKey('+'),
    fitWidth: primaryKey('0'),
    hideTools: primaryKey('.'),
  };
}

/**
 * Returns whether an event uses the operating system's primary application
 * modifier: Command on macOS and Control on Windows.
 */
export function isPrimaryModifier(event, platform) {
  return isMacOS(platform) ? Boolean(event.metaKey) : Boolean(event.ctrlKey);
}

export function isPrimaryShortcut(event, key, platform) {
  if (event.key?.toLowerCase() !== String(key).toLowerCase()) return false;
  return isPrimaryModifier(event, platform);
}
