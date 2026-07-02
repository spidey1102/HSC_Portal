export const APPEARANCE_STORAGE_KEY = 'hsc_appearance';

export const APPEARANCE_DEFAULTS = {
  mode: 'system',
  preset: 'current',
  accent: 'forest',
  density: 'comfortable',
};

export const APPEARANCE_PRESETS = {
  current: {
    label: 'Current',
    description: 'Keeps the existing green study look.',
    swatches: ['#355b4f', '#3e6f59'],
    vars: {},
    darkVars: {},
  },
  forest: {
    label: 'Forest',
    description: 'A deeper woodland tone with softer surfaces.',
    swatches: ['#355b4f', '#577a68'],
    vars: {
      '--page-gradient-top': 'rgba(53, 91, 79, 0.09)',
      '--page-gradient-bottom': '#eef3ef',
      '--panel-surface': 'rgba(255, 255, 255, 0.84)',
      '--panel-strong': 'rgba(255, 255, 255, 0.96)',
      '--sidebar-footer-bg': 'rgba(255, 255, 255, 0.58)',
      '--topbar-bg': 'rgba(247, 248, 246, 0.88)',
    },
    darkVars: {
      '--page-gradient-top': 'rgba(86, 124, 108, 0.14)',
      '--page-gradient-bottom': '#0f1412',
      '--panel-surface': 'rgba(17, 24, 21, 0.92)',
      '--panel-strong': 'rgba(19, 27, 24, 0.98)',
      '--sidebar-footer-bg': 'rgba(255, 255, 255, 0.05)',
      '--topbar-bg': 'rgba(14, 19, 17, 0.82)',
      '--sidebar-border': 'rgba(126, 165, 150, 0.14)',
    },
  },
  ocean: {
    label: 'Ocean',
    description: 'Cooler blue-green tones for a cleaner look.',
    swatches: ['#2f6d8e', '#3d83a4'],
    vars: {
      '--page-gradient-top': 'rgba(47, 109, 142, 0.10)',
      '--page-gradient-bottom': '#eef4f7',
      '--panel-surface': 'rgba(255, 255, 255, 0.86)',
      '--panel-strong': 'rgba(255, 255, 255, 0.97)',
      '--sidebar-footer-bg': 'rgba(255, 255, 255, 0.62)',
      '--topbar-bg': 'rgba(245, 248, 251, 0.90)',
    },
    darkVars: {
      '--page-gradient-top': 'rgba(61, 131, 164, 0.14)',
      '--page-gradient-bottom': '#0e1416',
      '--panel-surface': 'rgba(16, 24, 27, 0.92)',
      '--panel-strong': 'rgba(18, 27, 30, 0.98)',
      '--sidebar-footer-bg': 'rgba(255, 255, 255, 0.05)',
      '--topbar-bg': 'rgba(14, 20, 22, 0.82)',
      '--sidebar-border': 'rgba(97, 131, 147, 0.16)',
    },
  },
  sunrise: {
    label: 'Sunrise',
    description: 'Warm neutrals with a brighter study feel.',
    swatches: ['#b06b3b', '#d3944b'],
    vars: {
      '--page-gradient-top': 'rgba(176, 107, 59, 0.10)',
      '--page-gradient-bottom': '#f6f0e7',
      '--panel-surface': 'rgba(255, 252, 247, 0.88)',
      '--panel-strong': 'rgba(255, 252, 247, 0.98)',
      '--sidebar-footer-bg': 'rgba(255, 249, 240, 0.72)',
      '--topbar-bg': 'rgba(255, 250, 243, 0.90)',
    },
    darkVars: {
      '--page-gradient-top': 'rgba(176, 107, 59, 0.16)',
      '--page-gradient-bottom': '#11100f',
      '--panel-surface': 'rgba(23, 20, 18, 0.92)',
      '--panel-strong': 'rgba(26, 22, 19, 0.98)',
      '--sidebar-footer-bg': 'rgba(255, 255, 255, 0.05)',
      '--topbar-bg': 'rgba(18, 16, 14, 0.82)',
      '--sidebar-border': 'rgba(211, 162, 74, 0.16)',
    },
  },
  graphite: {
    label: 'Graphite',
    description: 'Neutral, high-contrast, and minimal.',
    swatches: ['#4f5f66', '#6d7c84'],
    vars: {
      '--page-gradient-top': 'rgba(79, 95, 102, 0.10)',
      '--page-gradient-bottom': '#eef1f2',
      '--panel-surface': 'rgba(255, 255, 255, 0.88)',
      '--panel-strong': 'rgba(255, 255, 255, 0.98)',
      '--sidebar-footer-bg': 'rgba(245, 247, 248, 0.78)',
      '--topbar-bg': 'rgba(247, 249, 250, 0.92)',
    },
    darkVars: {
      '--page-gradient-top': 'rgba(111, 127, 136, 0.12)',
      '--page-gradient-bottom': '#0f1315',
      '--panel-surface': 'rgba(18, 23, 25, 0.92)',
      '--panel-strong': 'rgba(20, 26, 28, 0.98)',
      '--sidebar-footer-bg': 'rgba(255, 255, 255, 0.05)',
      '--topbar-bg': 'rgba(15, 19, 21, 0.82)',
      '--sidebar-border': 'rgba(111, 127, 136, 0.14)',
    },
  },
  paper: {
    label: 'Paper',
    description: 'Soft, calm, and lightly textured in feel.',
    swatches: ['#8f8a7a', '#b4aa96'],
    vars: {
      '--page-gradient-top': 'rgba(143, 138, 122, 0.08)',
      '--page-gradient-bottom': '#f7f4ed',
      '--panel-surface': 'rgba(255, 251, 244, 0.90)',
      '--panel-strong': 'rgba(255, 251, 244, 0.98)',
      '--sidebar-footer-bg': 'rgba(255, 248, 237, 0.78)',
      '--topbar-bg': 'rgba(255, 251, 244, 0.90)',
    },
    darkVars: {
      '--page-gradient-top': 'rgba(180, 170, 150, 0.10)',
      '--page-gradient-bottom': '#11100d',
      '--panel-surface': 'rgba(23, 22, 19, 0.92)',
      '--panel-strong': 'rgba(27, 25, 22, 0.98)',
      '--sidebar-footer-bg': 'rgba(255, 255, 255, 0.05)',
      '--topbar-bg': 'rgba(18, 17, 15, 0.82)',
      '--sidebar-border': 'rgba(180, 170, 150, 0.14)',
    },
  },
  ember: {
    label: 'Ember',
    description: 'Warm, lively, and slightly more dramatic.',
    swatches: ['#9b563f', '#b86d57'],
    vars: {
      '--page-gradient-top': 'rgba(155, 86, 63, 0.10)',
      '--page-gradient-bottom': '#f7efea',
      '--panel-surface': 'rgba(255, 251, 249, 0.88)',
      '--panel-strong': 'rgba(255, 251, 249, 0.98)',
      '--sidebar-footer-bg': 'rgba(255, 244, 239, 0.76)',
      '--topbar-bg': 'rgba(255, 248, 244, 0.90)',
    },
    darkVars: {
      '--page-gradient-top': 'rgba(184, 109, 87, 0.14)',
      '--page-gradient-bottom': '#12100f',
      '--panel-surface': 'rgba(24, 19, 18, 0.92)',
      '--panel-strong': 'rgba(27, 22, 20, 0.98)',
      '--sidebar-footer-bg': 'rgba(255, 255, 255, 0.05)',
      '--topbar-bg': 'rgba(18, 15, 14, 0.82)',
      '--sidebar-border': 'rgba(184, 109, 87, 0.16)',
    },
  },
};

export const ACCENT_OPTIONS = {
  forest: {
    label: 'Forest',
    description: 'Keeps the current study-green accent.',
    accent: '#355b4f',
    hover: '#2d4d42',
    active: '#233c34',
    positive: '#3e6f59',
  },
  ocean: {
    label: 'Ocean',
    description: 'Blue-green accent for a cooler interface.',
    accent: '#2f6d8e',
    hover: '#285b77',
    active: '#1f495f',
    positive: '#3d83a4',
  },
  amber: {
    label: 'Amber',
    description: 'A warmer accent that stands out more.',
    accent: '#b06b3b',
    hover: '#955734',
    active: '#784628',
    positive: '#c08743',
  },
  rose: {
    label: 'Rose',
    description: 'Soft red accent for a more editorial feel.',
    accent: '#a95a67',
    hover: '#8f4854',
    active: '#733942',
    positive: '#be6c78',
  },
  slate: {
    label: 'Slate',
    description: 'Muted neutral accent with low saturation.',
    accent: '#5f6f78',
    hover: '#4f5d65',
    active: '#3f4b52',
    positive: '#6f7f88',
  },
  ember: {
    label: 'Ember',
    description: 'A punchier warm accent for energetic highlights.',
    accent: '#9b563f',
    hover: '#824735',
    active: '#683829',
    positive: '#b86d57',
  },
};

export const DENSITY_OPTIONS = [
  {
    value: 'comfortable',
    label: 'Comfortable',
    description: 'Keeps the current spacing.',
  },
  {
    value: 'compact',
    label: 'Compact',
    description: 'Tighter spacing for denser layouts.',
  },
];

export const APPEARANCE_VARIABLE_KEYS = [
  '--page-gradient-top',
  '--page-gradient-bottom',
  '--panel-surface',
  '--panel-strong',
  '--sidebar-footer-bg',
  '--topbar-bg',
  '--sidebar-border',
  '--accent-brand',
  '--brand-experiment',
  '--brand-experiment-hover',
  '--brand-experiment-active',
  '--status-positive',
  '--status-positive-background',
];

export function getAppearanceVars(presetKey, theme) {
  const preset = APPEARANCE_PRESETS[presetKey] || APPEARANCE_PRESETS[APPEARANCE_DEFAULTS.preset];
  if (theme === 'dark') {
    return preset.darkVars || {};
  }
  return preset.vars || {};
}

export function loadAppearanceSettings() {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return { ...APPEARANCE_DEFAULTS };

    const parsed = JSON.parse(raw);
    const mode = ['system', 'light', 'dark'].includes(parsed?.mode) ? parsed.mode : APPEARANCE_DEFAULTS.mode;
    const preset = APPEARANCE_PRESETS[parsed?.preset] ? parsed.preset : APPEARANCE_DEFAULTS.preset;
    const accent = ACCENT_OPTIONS[parsed?.accent] ? parsed.accent : APPEARANCE_DEFAULTS.accent;
    const density = DENSITY_OPTIONS.some((option) => option.value === parsed?.density)
      ? parsed.density
      : APPEARANCE_DEFAULTS.density;

    return { mode, preset, accent, density };
  } catch (error) {
    return { ...APPEARANCE_DEFAULTS };
  }
}
