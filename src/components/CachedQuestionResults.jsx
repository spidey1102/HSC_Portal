import { formatQuestionLabel } from '../utils/topicQuestionQueue';

function questionLabel(question) {
  return formatQuestionLabel(question);
}

function challengeLabel(level) {
  if (level === 'stretch') return 'Stretch';
  if (level === 'challenging') return 'Challenging';
  return '';
}

export default function CachedQuestionResults({ results = [], onOpenQuestion }) {
  if (!Array.isArray(results) || results.length === 0) return null;

  return (
    <section className="cached-question-results" aria-label="Cached question matches">
      <div className="cached-question-results-title">Topic Questions ({results.length})</div>
      <div className="cached-question-results-list">
        {results.map((result, index) => {
          const question = result.question || {};
          const topics = Array.isArray(question.topics) ? question.topics : [];
          const detail = [question.commandVerb, question.skill].filter(Boolean).join(' · ');
          const challenge = challengeLabel(question.challenge?.level);
          const page = Number(question.page);
          const canOpen = typeof onOpenQuestion === 'function' && result.paperIdentity && Number.isInteger(page) && page > 0;

          return (
            <button
              key={result.key || `${result.paperIdentity}_${question.id}_${index}`}
              type="button"
              className="cached-question-result-card"
              disabled={!canOpen}
              onClick={() => onOpenQuestion?.(result, results, index)}
              title={canOpen ? `Open ${result.paperName}, ${questionLabel(question)}, page ${page}` : 'This question cannot be opened yet'}
            >
              <span className="cached-question-result-source">{result.subject} · {result.school} · {result.paperYear || 'Paper year unavailable'}</span>
              <strong>{result.paperName} — {questionLabel(question)}</strong>
              <span className="cached-question-result-meta">
                {question.marks !== null && question.marks !== undefined ? `${question.marks} marks` : 'Marks not stated'} · Page {page}
                {challenge ? ` · ${challenge}` : ''}
              </span>
              {topics.length > 0 && (
                <span className="cached-question-result-topics">
                  {topics.map((topic) => <span key={topic}>{topic}</span>)}
                </span>
              )}
              {detail && <span className="cached-question-result-skill">{detail}</span>}
              {canOpen && <span className="cached-question-result-go">Start topic practice →</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
