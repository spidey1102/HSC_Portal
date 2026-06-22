import React, { useState } from 'react';
import { Search, Sparkles, XCircle, RefreshCw } from 'lucide-react';

const EXAMPLES = [
  'recent chemistry trials with solutions',
  'year 12 physics papers after 2020',
  'maths extension 1 trial papers',
];

export default function AgenticPaperFinder({
  value,
  onSearch,
  onClear,
  result,
  disabled,
  loading,
}) {
  const [draft, setDraft] = useState(value || '');

  const submitSearch = (event) => {
    event.preventDefault();
    onSearch(draft);
  };

  const hasSearch = Boolean(value && value.trim());
  const hasResult = hasSearch && result?.applied;

  return (
    <section className="agent-finder" aria-label="Agent paper finder">
      <div className="agent-finder-header">
        <div>
          <div className="eyebrow">Agent finder</div>
          <h3>Ask for the paper you need</h3>
        </div>
        <Sparkles size={18} />
      </div>

      <form className="agent-search-row" onSubmit={submitSearch} aria-label="Natural-language paper search">
        <div className="agent-search-input">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Try: recent chemistry trials with solutions"
            disabled={disabled || loading}
            className="discord-input"
          />
          <Search size={16} />
        </div>
        <button type="submit" className="btn-primary" disabled={disabled || loading || !draft.trim()} style={{ minWidth: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
          {loading ? (
            <RefreshCw size={16} className="spin" />
          ) : (
            <Sparkles size={16} />
          )}
          <span>{loading ? 'Finding' : 'Find'}</span>
        </button>
        {hasSearch && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setDraft('');
              onClear();
            }}
            title="Clear agent search"
            disabled={disabled || loading}
          >
            <XCircle size={16} />
          </button>
        )}
      </form>

      <div className="agent-example-row">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="chip"
            onClick={() => {
              setDraft(example);
              onSearch(example);
            }}
            disabled={disabled || loading}
          >
            {example}
          </button>
        ))}
      </div>

      {hasResult && (
        <div className="agent-result-note" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>
              Interpreted as <strong>{result.summary}</strong>
            </span>
            {result.isAiAssisted && (
              <span className="ai-badge" style={{
                fontSize: '10px',
                fontWeight: '700',
                background: 'rgba(97, 124, 187, 0.15)',
                color: 'var(--brand-experiment)',
                padding: '2px 6px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                border: '1px solid rgba(97, 124, 187, 0.25)'
              }}>
                <Sparkles size={10} />
                <span>AI Powered</span>
              </span>
            )}
          </div>
          <span>
            {result.total.toLocaleString()} ranked match{result.total === 1 ? '' : 'es'}
          </span>
        </div>
      )}
    </section>
  );
}
