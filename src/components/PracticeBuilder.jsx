import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, RefreshCw, Sparkles } from 'lucide-react';
import { fetchPracticeBuilderFacets, generatePracticeSet } from '../utils/practiceBuilder';
import { extractQuestionKeys } from '../utils/topicQuestionQueue';

const TIME_PRESETS = [10, 20, 30, 45, 60, 90];
const MARK_PRESETS = [10, 15, 20, 25, 30, 40, 50];
const DIFFICULTIES = [
  { id: 'mixed', label: 'Mixed' },
  { id: 'routine', label: 'Routine' },
  { id: 'challenging', label: 'Challenging' },
  { id: 'stretch', label: 'Stretch' },
];

export default function PracticeBuilder({
  subjects = [], mySubjects = [], selectedLevel = 12, onLevelChange, onStart,
}) {
  const initialSubject = mySubjects.find((name) => subjects.includes(name)) || subjects[0] || '';
  const [subject, setSubject] = useState(initialSubject);
  const [facets, setFacets] = useState(null);
  const [topics, setTopics] = useState([]);
  const [topicSearch, setTopicSearch] = useState('');
  const [difficulty, setDifficulty] = useState('mixed');
  const [targetMode, setTargetMode] = useState('time');
  const [targetValue, setTargetValue] = useState(30);
  const [preferSolutions, setPreferSolutions] = useState(true);
  const [generatedSet, setGeneratedSet] = useState(null);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!subjects.length) return;
    if (!subjects.includes(subject)) setSubject(mySubjects.find((name) => subjects.includes(name)) || subjects[0]);
  }, [subjects, mySubjects, subject]);

  useEffect(() => {
    if (!subject || ![11, 12].includes(Number(selectedLevel))) return undefined;
    const controller = new AbortController();
    setIsLoadingTopics(true);
    setFacets(null);
    setTopics([]);
    setGeneratedSet(null);
    setError('');
    fetchPracticeBuilderFacets(subject, selectedLevel, { signal: controller.signal })
      .then((payload) => setFacets(payload))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message || 'Available topics could not be loaded.');
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoadingTopics(false); });
    return () => controller.abort();
  }, [subject, selectedLevel]);

  const visibleTopics = useMemo(() => {
    const query = topicSearch.trim().toLowerCase();
    return (facets?.topics || []).filter((entry) => !query || entry.name.toLowerCase().includes(query));
  }, [facets, topicSearch]);
  const targetPresets = targetMode === 'time' ? TIME_PRESETS : MARK_PRESETS;
  const availableCount = facets?.markedQuestionCount;
  const canBuild = Boolean(subject && facets && facets.markedQuestionCount > 0 && !isLoadingTopics && !isBuilding && Number(targetValue) > 0);

  const toggleTopic = (name) => {
    setTopics((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name].slice(0, 8));
    setGeneratedSet(null);
  };

  const build = async () => {
    if (!canBuild) return;
    setIsBuilding(true);
    setError('');
    try {
      const payload = await generatePracticeSet({
        subject,
        level: selectedLevel,
        topics,
        difficulty,
        target: { mode: targetMode, value: Number(targetValue) },
        preferSolutions,
        excludeQuestionKeys: generatedSet ? extractQuestionKeys(generatedSet.questions) : [],
      });
      setGeneratedSet(payload);
      if (!payload.questions?.length) setError(payload.warnings?.[0] || 'No suitable questions are available for these filters.');
    } catch (requestError) {
      setError(requestError.message || 'We couldn’t build a set from those filters. Try another topic, difficulty, or length.');
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <main className="section-pane practice-builder">
      <div className="builder-heading">
        <div>
          <div className="kick">A focused practice session</div>
          <h1>Build a mini-paper</h1>
          <p className="dim">Choose what you want to practise. We’ll assemble real questions from cached Question Maps.</p>
        </div>
        <Sparkles size={22} aria-hidden="true" />
      </div>

      <div className="builder-layout">
        <section className="card builder-filters" aria-label="Practice set filters">
          <div className="builder-field">
            <label htmlFor="builder-subject">Subject</label>
            <select id="builder-subject" className="input" value={subject} onChange={(event) => setSubject(event.target.value)}>
              {subjects.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          <fieldset className="builder-field builder-level">
            <legend>Year level</legend>
            {[11, 12].map((level) => (
              <label key={level} className="seg-opt">
                <input type="radio" name="builder-level" checked={Number(selectedLevel) === level} onChange={() => onLevelChange?.(level)} />
                Year {level}
              </label>
            ))}
          </fieldset>

          <div className="builder-field">
            <div className="builder-field-heading">
              <label htmlFor="builder-topic-search">Topics</label>
              <span className="dim">{topics.length ? `${topics.length} selected` : 'All topics'}</span>
            </div>
            <input
              id="builder-topic-search"
              className="input"
              type="search"
              value={topicSearch}
              onChange={(event) => setTopicSearch(event.target.value)}
              placeholder="Search available topics"
              disabled={!facets}
            />
            <div className="builder-topic-list" aria-label="Available topics">
              <button
                type="button"
                className={`builder-topic${topics.length === 0 ? ' is-selected' : ''}`}
                aria-pressed={topics.length === 0}
                onClick={() => { setTopics([]); setGeneratedSet(null); }}
                disabled={!facets}
              >All topics</button>
              {visibleTopics.map(({ name, count }) => {
                const isSelected = topics.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    className={`builder-topic${isSelected ? ' is-selected' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => toggleTopic(name)}
                    disabled={!isSelected && topics.length >= 8}
                  >
                    {isSelected && <Check size={13} aria-hidden="true" />}
                    {name}<span className="builder-topic-count">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="dim" role="status" aria-live="polite">
              {isLoadingTopics ? 'Loading available topics…' : facets ? `${facets.markedQuestionCount} questions with known marks available` : ''}
            </div>
          </div>

          <fieldset className="builder-field">
            <legend>Difficulty</legend>
            <div className="builder-segmented" role="radiogroup" aria-label="Question difficulty">
              {DIFFICULTIES.map(({ id, label }) => (
                <button key={id} type="button" role="radio" aria-checked={difficulty === id}
                  className={`builder-segment${difficulty === id ? ' is-selected' : ''}`}
                  onClick={() => { setDifficulty(id); setGeneratedSet(null); }}>
                  {label}{id !== 'mixed' && facets && <small>{facets.difficulty?.[id] || 0}</small>}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="builder-field">
            <legend>Set length</legend>
            <div className="builder-mode-tabs" role="radiogroup" aria-label="Set length mode">
              {['time', 'marks'].map((mode) => (
                <button key={mode} type="button" role="radio" aria-checked={targetMode === mode}
                  className={`builder-mode${targetMode === mode ? ' is-selected' : ''}`}
                  onClick={() => { setTargetMode(mode); setTargetValue(mode === 'time' ? 30 : 20); setGeneratedSet(null); }}>
                  By {mode}
                </button>
              ))}
            </div>
            <div className="builder-presets">
              {targetPresets.map((value) => (
                <button key={value} type="button" className={`builder-preset${Number(targetValue) === value ? ' is-selected' : ''}`}
                  aria-pressed={Number(targetValue) === value}
                  onClick={() => { setTargetValue(value); setGeneratedSet(null); }}>
                  {value}{targetMode === 'time' ? ' min' : ' marks'}
                </button>
              ))}
            </div>
            <label className="builder-custom-target" htmlFor="builder-target">
              Custom {targetMode === 'time' ? 'minutes' : 'marks'}
              <input id="builder-target" className="input" type="number" min={targetMode === 'time' ? 10 : 5} max={targetMode === 'time' ? 120 : 80}
                value={targetValue} onChange={(event) => { setTargetValue(event.target.value); setGeneratedSet(null); }} />
            </label>
            <p className="dim">{availableCount ?? 0} marked questions match this subject and year. Working time is an estimate.</p>
          </fieldset>

          <label className="builder-solution-toggle">
            <input type="checkbox" checked={preferSolutions} onChange={(event) => { setPreferSolutions(event.target.checked); setGeneratedSet(null); }} />
            Prefer questions from papers with solutions
          </label>
          <button type="button" className="btn btn-primary builder-build-button" onClick={build} disabled={!canBuild}>
            {isBuilding ? <><RefreshCw size={15} className="spin" /> Building set…</> : generatedSet ? 'Regenerate set' : 'Build practice set'}
          </button>
          {!canBuild && !isLoadingTopics && <p className="dim builder-help">{facets && facets.markedQuestionCount === 0
            ? 'This subject and year do not have questions with reliable marks to build a set yet.'
            : 'Choose a subject and wait for available topics before building.'}</p>}
        </section>

        <section className="builder-preview" aria-label="Practice set preview" aria-live="polite">
          {!generatedSet ? (
            <div className="card builder-empty">
              <div className="kick">Your set</div>
              <h2>Questions, ready when you are</h2>
              <p className="dim">{facets?.questionCount === 0
                ? 'There aren’t enough cached Question Map questions for this subject yet. You can still practise full papers from the Library.'
                : facets?.markedQuestionCount === 0
                  ? 'These topics have cached questions, but not enough with reliable mark values to build a scored practice set yet.'
                  : 'Choose a subject, topics and length, then build a preview. The question order stays fixed when you start.'}</p>
              {error && <p className="builder-error" role="alert">{error}</p>}
            </div>
          ) : generatedSet.questions?.length ? (
            <div className="card builder-result">
              <div className="builder-result-top">
                <div><div className="kick">Your mini-paper</div><h2>{generatedSet.subject}</h2></div>
                <span className="builder-result-level">Year {generatedSet.level}</span>
              </div>
              {error && <p className="builder-error" role="alert">{error}</p>}
              <div className="builder-summary">
                <div><strong>{generatedSet.summary.questionCount}</strong><span>questions</span></div>
                <div><strong>{generatedSet.summary.totalMarks}</strong><span>marks</span></div>
                <div><strong>~{generatedSet.summary.estimatedMinutes}</strong><span>min estimated</span></div>
                <div><strong>{generatedSet.summary.sourcePaperCount}</strong><span>source papers</span></div>
              </div>
              {topics.length > 0 && <div className="builder-selected-topics">{topics.map((name) => <span key={name}>{name}</span>)}</div>}
              <ol className="builder-question-list">
                {generatedSet.questions.map((question, index) => (
                  <li key={question.key || `${question.paperIdentity}-${index}`}>
                    <span className="builder-question-index">{index + 1}</span>
                    <div className="builder-question-info">
                      <strong>{question.question?.id}{question.question?.challenge?.subpartId ? `(${question.question.challenge.subpartId})` : ''} · {question.question?.marks} marks</strong>
                      <span>{String(question.paperName || '').replace(/\s+w\.?\s*sol(?:utions?)?/gi, '').trim()} {question.paperYear} · page {question.question?.page}</span>
                      <span>{(question.question?.topics || []).join(' · ')}</span>
                    </div>
                    <span className={`builder-difficulty is-${question.question?.challenge?.level}`}>{question.question?.challenge?.level}</span>
                  </li>
                ))}
              </ol>
              {generatedSet.warnings?.length > 0 && <ul className="builder-warnings">{generatedSet.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
              <button type="button" className="btn btn-primary builder-start-button" onClick={() => onStart?.(generatedSet)}>
                Start practice <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="card builder-empty"><div className="kick">Your set</div><h2>Not enough questions yet</h2><p className="dim">Try another topic, difficulty, or length.</p>{error && <p className="builder-error" role="alert">{error}</p>}</div>
          )}
        </section>
      </div>
    </main>
  );
}
