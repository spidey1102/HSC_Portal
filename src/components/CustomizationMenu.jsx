import { useEffect } from 'react';
import { Check, X, Monitor, Moon, Palette, Sun } from 'lucide-react';
import {
  APPEARANCE_PRESETS,
  ACCENT_OPTIONS,
  DENSITY_OPTIONS,
} from '../utils/appearancePresets';

const MODE_OPTIONS = [
  {
    value: 'system',
    label: 'System',
    description: 'Follow your device theme.',
    icon: Monitor,
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Force the brighter theme.',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Force the darker theme.',
    icon: Moon,
  },
];

function OptionButton({ active, label, description, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      className={`appearance-option ${active ? 'is-active' : ''}`}
      onClick={onClick}
    >
      <span className="appearance-option-icon">
        <Icon size={16} />
      </span>
      <span className="appearance-option-copy">
        <span className="appearance-option-label">{label}</span>
        <span className="appearance-option-description">{description}</span>
      </span>
      {active && <Check size={16} className="appearance-option-check" />}
    </button>
  );
}

export default function CustomizationMenu({ isOpen, settings, onChange, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="appearance-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="appearance-modal" role="dialog" aria-modal="true" aria-label="Customize appearance">
        <div className="appearance-modal-card" onClick={(event) => event.stopPropagation()}>
          <div className="appearance-modal-header">
            <div className="appearance-title-block">
              <span className="appearance-modal-icon">
                <Palette size={18} />
              </span>
              <div>
                <div className="appearance-title">Customisation</div>
                <div className="appearance-subtitle">Themes, colors, and a few extra layout choices</div>
              </div>
            </div>
            <button type="button" className="appearance-close-btn" onClick={onClose} aria-label="Close customisation menu">
              <X size={16} />
            </button>
          </div>

          <div className="appearance-modal-body">
            <section className="appearance-section">
              <div className="appearance-section-header">
                <div className="appearance-section-title">Theme mode</div>
                <div className="appearance-section-note">Keep the current light/dark toggle or let the app follow your system.</div>
              </div>
              <div className="appearance-option-grid">
                {MODE_OPTIONS.map((option) => (
                  <OptionButton
                    key={option.value}
                    active={settings.mode === option.value}
                    label={option.label}
                    description={option.description}
                    icon={option.icon}
                    onClick={() => onChange({ mode: option.value })}
                  />
                ))}
              </div>
            </section>

            <section className="appearance-section">
              <div className="appearance-section-header">
                <div className="appearance-section-title">Presets</div>
                <div className="appearance-section-note">Use one of the existing looks or switch to a new study palette.</div>
              </div>
              <div className="appearance-preset-grid">
                {Object.entries(APPEARANCE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    className={`appearance-preset-card ${settings.preset === key ? 'is-active' : ''}`}
                    onClick={() => onChange({ preset: key })}
                  >
                    <div className="appearance-preset-topline">
                      <span className="appearance-preset-label">{preset.label}</span>
                      {settings.preset === key && <Check size={14} className="appearance-option-check" />}
                    </div>
                    <div className="appearance-preset-swatches">
                      {(preset.swatches || []).map((color) => (
                        <span key={color} className="appearance-preset-swatch" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                    <div className="appearance-preset-description">{preset.description}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="appearance-section">
              <div className="appearance-section-header">
                <div className="appearance-section-title">Accent color</div>
                <div className="appearance-section-note">This updates buttons, highlights, and primary actions.</div>
              </div>
              <div className="appearance-swatch-row">
                {Object.entries(ACCENT_OPTIONS).map(([key, accent]) => (
                  <button
                    key={key}
                    type="button"
                    className={`appearance-swatch ${settings.accent === key ? 'is-active' : ''}`}
                    onClick={() => onChange({ accent: key })}
                    title={accent.description}
                    aria-label={accent.label}
                  >
                    <span className="appearance-swatch-chip" style={{ backgroundColor: accent.accent }} />
                    <span className="appearance-swatch-label">{accent.label}</span>
                    {settings.accent === key && <Check size={14} className="appearance-option-check" />}
                  </button>
                ))}
              </div>
            </section>

            <section className="appearance-section">
              <div className="appearance-section-header">
                <div className="appearance-section-title">Spacing</div>
                <div className="appearance-section-note">A small extra option for dense or relaxed layouts.</div>
              </div>
              <div className="appearance-option-grid appearance-option-grid--compact">
                {DENSITY_OPTIONS.map((option) => (
                  <OptionButton
                    key={option.value}
                    active={settings.density === option.value}
                    label={option.label}
                    description={option.description}
                    icon={Palette}
                    onClick={() => onChange({ density: option.value })}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="appearance-modal-footer">
            Settings save automatically and stay in your browser.
          </div>
        </div>
      </div>
    </>
  );
}
