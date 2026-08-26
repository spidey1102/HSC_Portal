import { ArrowRight, RefreshCw, Sparkles } from 'lucide-react';

function questionLabel(question) {
  const id = String(question?.id || '').trim();
  const subpart = String(question?.challenge?.subpartId || '').trim();
  return `Question ${id}${subpart ? ` (${subpart})` : ''}`;
}

function challengeLabel(level) {
  if (level === 'stretch') return 'Stretch';
  if (level === 'challenging') return 'Challenging';
  return 'Guided';
}

function markLabel(marks) {
  if (marks === null || marks === undefined || Number.isNaN(Number(marks))) return 'Marks not stated';
  const value = Number(marks);
  return `${value} mark${value === 1 ? '' : 's'}`;
}

export default function HomeQuestionRecommendations({
  questions = [],
  loading = false,
  error = '',
  contextLabel = '',
  onRefresh,
  onOpenQuestion,
}) {
  const hasQuestions = Array.isArray(questions) && questions.length > 0;

  return (
    <section className="home-question-recommendations" aria-labelledby="home-question-recommendations-title">
      <div className="home-question-recommendations-header">
        <div>
          <div className="card-kicker home-question-recommendations-kicker">
            <Sparkles size={13} aria-hidden="true" />
            Question recommendations
          </div>
          <h2 id="home-question-recommendations-title">Your next best questions</h2>
          <p>{contextLabel || 'Drawn only from shared Question Maps that are already analysed and ready to open.'}</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost home-question-recommendations-refresh"
          onClick={onRefresh}
          disabled={loading}
          title="Find a different set of cached questions"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} aria-hidden="true" />
          {loading ? 'Finding questions' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="home-question-recommendations-grid" aria-label="Finding cached questions">
          {[0, 1, 2].map((index) => <div className="home-question-recommendations-skeleton" key={index} />)}
        </div>
      ) : error ? (
        <div className="home-question-recommendations-empty">
          <strong>Recommendations are unavailable right now.</strong>
          <span>{error}</span>
        </div>
      ) : hasQuestions ? (
        <div className="home-question-recommendations-grid">
          {questions.map((result) => {
            const question = result.question || {};
            const topics = Array.isArray(question.topics) ? question.topics : [];
            const detail = [question.commandVerb, question.skill].filter(Boolean).join(' · ');
            const page = Number(question.page);
            const canOpen = typeof onOpenQuestion === 'function'
              && result.paperIdentity
              && Number.isInteger(page)
              && page > 0;

            return (
              <button
                className="home-question-recommendation-card"
                disabled={!canOpen}
                key={result.key}
                onClick={() => onOpenQuestion?.(result)}
                title={canOpen ? `Open ${result.paperName}, ${questionLabel(question)}, page ${page}` : 'This question cannot be opened yet'}
                type="button"
              >
                <span className="home-question-recommendation-source">
                  {result.subject} · {result.paperYear || 'Paper year unavailable'}
                </span>
                <strong>{questionLabel(question)}</strong>
                <span className="home-question-recommendation-paper">{result.paperName}</span>
                <span className="home-question-recommendation-meta">
                  {markLabel(question.marks)} · Page {page} · {challengeLabel(question.challenge?.level)}
                </span>
                {topics.length > 0 && (
                  <span className="home-question-recommendation-topics">
                    {topics.map((topic) => <span key={topic}>{topic}</span>)}
                  </span>
                )}
                {detail && <span className="home-question-recommendation-skill">{detail}</span>}
                {canOpen && (
                  <span className="home-question-recommendation-open">
                    Open in Practice Room
                    <ArrowRight size={13} aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="home-question-recommendations-empty">
          <strong>No analysed question matches yet.</strong>
          <span>When shared Question Maps exist for your current subjects and year level, they will appear here.</span>
        </div>
      )}
    </section>
  );
}
