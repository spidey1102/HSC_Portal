import { useEffect, useState } from 'react';
import { Check, X, Monitor, Moon, Palette, Sun, KeyRound, Server, UserRound, Eye, EyeOff, Trash2 } from 'lucide-react';
import {
  APPEARANCE_PRESETS,
  ACCENT_OPTIONS,
  DENSITY_OPTIONS,
  LAYOUT_OPTIONS,
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

export default function CustomizationMenu({
  isOpen,
  settings,
  onChange,
  aiSettings = { providerMode: 'portal', personalKey: '' },
  onAiSettingsChange,
  onClose,
}) {
  const [showPersonalKey, setShowPersonalKey] = useState(false);

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
                <div className="appearance-section-title">Suggested Next</div>
                <div className="appearance-section-note">Show or hide the recommendation box above paper search.</div>
              </div>
              <div className="appearance-option-grid appearance-option-grid--compact">
                <OptionButton
                  active={settings.showRecommendations !== false}
                  label={settings.showRecommendations !== false ? 'Show Suggested Next' : 'Hide Suggested Next'}
                  description={settings.showRecommendations !== false
                    ? 'Recommendations are visible on the paper library.'
                    : 'The paper library opens directly to search and results.'}
                  icon={settings.showRecommendations !== false ? Eye : EyeOff}
                  onClick={() => onChange({ showRecommendations: settings.showRecommendations === false })}
                />
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
                <div className="appearance-section-title">Page layout</div>
                <div className="appearance-section-note">Focus hides dashboard extras to make browsing papers calmer and easier to scan.</div>
              </div>
              <div className="appearance-option-grid appearance-option-grid--compact">
                {LAYOUT_OPTIONS.map((option) => (
                  <OptionButton
                    key={option.value}
                    active={settings.layout === option.value}
                    label={option.label}
                    description={option.description}
                    icon={Palette}
                    onClick={() => onChange({ layout: option.value })}
                  />
                ))}
              </div>
            </section>

            <section className="appearance-section">
              <div className="appearance-section-header">
                <div className="appearance-section-title">Portal design</div>
                <div className="appearance-section-note">Switch between the original portal and the redesigned Paper Room without changing your study data.</div>
              </div>
              <div className="appearance-option-grid appearance-option-grid--compact">
                <OptionButton
                  active={settings.portalLayout === 'classic'}
                  label="Classic portal"
                  description="The original dashboard, cards, navigation, and icons."
                  icon={Palette}
                  onClick={() => onChange({ portalLayout: 'classic' })}
                />
                <OptionButton
                  active={(settings.portalLayout || 'new') === 'new'}
                  label="New Paper Room"
                  description="The new editorial study workspace."
                  icon={Monitor}
                  onClick={() => onChange({ portalLayout: 'new' })}
                />
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

            <section className="appearance-section">
              <div className="appearance-section-header">
                <div className="appearance-section-title">AI provider</div>
                <div className="appearance-section-note">Choose the portal AI or use your own OpenRouter key for this browser session.</div>
              </div>
              <div className="appearance-option-grid appearance-option-grid--compact">
                <OptionButton
                  active={aiSettings.providerMode !== 'personal'}
                  label="Use portal AI"
                  description="Uses the server-side key configured by HSC Portal."
                  icon={Server}
                  onClick={() => onAiSettingsChange?.({ providerMode: 'portal' })}
                />
                <OptionButton
                  active={aiSettings.providerMode === 'personal'}
                  label="Use my OpenRouter key"
                  description="Uses your own key for AI requests in this browser session."
                  icon={UserRound}
                  onClick={() => onAiSettingsChange?.({ providerMode: 'personal' })}
                />
              </div>

              {aiSettings.providerMode === 'personal' && (
                <div style={{ marginTop: '12px', padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--sidebar-border)' }}>
                  <label htmlFor="personal-openrouter-key" style={{ display: 'block', marginBottom: '7px', fontSize: '12px', fontWeight: 700, color: 'var(--text-normal)' }}>
                    OpenRouter API key
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      id="personal-openrouter-key"
                      type={showPersonalKey ? 'text' : 'password'}
                      value={aiSettings.personalKey || ''}
                      onChange={(event) => onAiSettingsChange?.({ personalKey: event.target.value })}
                      className="discord-input"
                      placeholder="sk-or-v1-…"
                      autoComplete="off"
                      spellCheck="false"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowPersonalKey((visible) => !visible)}
                      aria-label={showPersonalKey ? 'Hide personal API key' : 'Show personal API key'}
                      title={showPersonalKey ? 'Hide key' : 'Show key'}
                      style={{ padding: '8px 10px' }}
                    >
                      {showPersonalKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    {!!aiSettings.personalKey && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => onAiSettingsChange?.({ personalKey: '', providerMode: 'portal' })}
                        title="Remove personal key"
                        aria-label="Remove personal key"
                        style={{ padding: '8px 10px', color: 'var(--status-danger)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', marginTop: '9px', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.45 }}>
                    <KeyRound size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>{aiSettings.personalKey
                      ? 'Your key is stored only in this browser tab’s session storage. It is not synced, saved to your HSC Portal profile, or shown to other users. It is sent to the portal only for your AI requests and is discarded after each request.'
                      : 'Add a personal key to enable this option. Until then, AI requests continue to use the portal server key when it is configured.'}
                    </span>
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="appearance-modal-footer">
            Appearance settings save automatically. Personal OpenRouter keys remain only in the current browser session.
          </div>
        </div>
      </div>
    </>
  );
}
