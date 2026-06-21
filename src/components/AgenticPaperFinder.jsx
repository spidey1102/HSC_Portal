import React, { useState } from 'react';
import { Search, Sparkles, XCircle } from 'lucide-react';

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
}) {
  const [draft, setDraft] = useState(value || '');

  const submitSearch = (event) => {
    event.preventDefault();
    onSearch(draft);
  };

  const hasSearch = Boolean(value && value.trim());
  const hasResult = hasSearch && result?.applied;

  return (
    <section className="agent-finder">
      <div className="agent-finder-header">
        <div>
          <div className="eyebrow">Agent finder</div>
          <h3>Ask for the paper you need</h3>
        </div>
        <Sparkles size={18} />
      </div>

      <form className="agent-search-row" onSubmit={submitSearch}>
        <div className="agent-search-input">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Try: recent chemistry trials with solutions"
            disabled={disabled}
            className="discord-input"
          />
          <Search size={16} />
        </div>
        <button type="submit" className="btn-primary" disabled={disabled || !draft.trim()}>
          <Sparkles size={16} />
          <span>Find</span>
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
            disabled={disabled}
          >
            {example}
          </button>
        ))}
      </div>

      {hasResult && (
        <div className="agent-result-note">
          <span>
            Interpreted as <strong>{result.summary}</strong>
          </span>
          <span>
            {result.total.toLocaleString()} ranked match{result.total === 1 ? '' : 'es'}
          </span>
        </div>
      )}
    </section>
  );
}
