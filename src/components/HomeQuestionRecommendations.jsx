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
  subjects = [],
  selectedSubject = '',
  onRefresh,
  onOpenQuestion,
  onSubjectSelect,
}) {
  const hasQuestions = Array.isArray(questions) && questions.length > 0;
  const selectedSubjectIndex = Math.max(0, subjects.indexOf(selectedSubject));
  const selectedTabId = `home-question-recommendations-tab-${selectedSubjectIndex}`;

  const handleTabKeyDown = (event, index) => {
    if (subjects.length === 0) return;
    const lastIndex = subjects.length - 1;
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = lastIndex;
    else return;

    event.preventDefault();
    onSubjectSelect?.(subjects[nextIndex]);
    document.getElementById(`home-question-recommendations-tab-${nextIndex}`)?.focus();
  };

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

      {subjects.length > 0 && (
        <div className="home-question-recommendations-tabs" role="tablist" aria-label="Choose a subject for question recommendations">
          {subjects.map((subject, index) => {
            const selected = subject === selectedSubject;
            return (
              <button
                aria-controls="home-question-recommendations-panel"
                aria-selected={selected}
                className={`home-question-recommendations-tab${selected ? ' is-active' : ''}`}
                id={`home-question-recommendations-tab-${index}`}
                key={subject}
                onClick={() => onSubjectSelect?.(subject)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                {subject}
              </button>
            );
          })}
        </div>
      )}

      <div
        aria-labelledby={subjects.length > 0 ? selectedTabId : undefined}
        className="home-question-recommendations-panel"
        id="home-question-recommendations-panel"
        role={subjects.length > 0 ? 'tabpanel' : undefined}
        tabIndex={subjects.length > 0 ? 0 : undefined}
      >
        {loading ? (
          <div className="home-question-recommendations-grid" aria-label={`Finding cached questions for ${selectedSubject || 'your subjects'}`}>
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
            <span>{selectedSubject
              ? `When shared Question Maps exist for ${selectedSubject} at your current year level, they will appear here.`
              : 'When shared Question Maps exist for your current subjects and year level, they will appear here.'}</span>
          </div>
        )}
      </div>
    </section>
  );
}
