import React, { useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Plus, X } from 'lucide-react';
import { saveMistake, savePracticeReview } from '../utils/practiceRecords';

const MISTAKE_CATEGORIES = [
  'Knowledge gap',
  'Misread question',
  'Method / working',
  'Time management',
  'Exam technique',
  'Careless error',
  'Other',
];

function formatTimeSpent(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.round(safeSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function isKnownMark(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function getQuestionOptions(metadata) {
  const questions = Array.isArray(metadata?.questions) ? metadata.questions : [];
  return questions.flatMap((question) => {
    const topLevel = {
      value: String(question.id),
      label: `Question ${question.id}${isKnownMark(question.marks) ? ` · ${question.marks} mark${Number(question.marks) === 1 ? '' : 's'}` : ''}`,
      marks: isKnownMark(question.marks) ? Number(question.marks) : null,
    };
    const subparts = (Array.isArray(question.subparts) ? question.subparts : [])
      .map((subpart) => ({
        value: `${question.id}${subpart.id}`,
        label: `Question ${question.id}${subpart.id}${isKnownMark(subpart.marks) ? ` · ${subpart.marks} mark${Number(subpart.marks) === 1 ? '' : 's'}` : ''}`,
        marks: isKnownMark(subpart.marks) ? Number(subpart.marks) : null,
      }));
    return [topLevel, ...subparts];
  });
}

export default function PracticeReviewModal({
  paper,
  subjectName,
  schoolName,
  metadata,
  timeSpent,
  onClose,
  onSaved,
}) {
  const questionOptions = useMemo(() => getQuestionOptions(metadata), [metadata]);
  const suggestedTotal = isKnownMark(metadata?.totalMarks) ? Number(metadata.totalMarks) : '';
  const [score, setScore] = useState('');
  const [totalMarks, setTotalMarks] = useState(suggestedTotal);
  const [confidence, setConfidence] = useState(3);
  const [reflection, setReflection] = useState('');
  const [questionId, setQuestionId] = useState(questionOptions[0]?.value || '');
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState(MISTAKE_CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [draftMistakes, setDraftMistakes] = useState([]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedQuestion = questionOptions.find((option) => option.value === questionId);
  const totalLabel = metadata?.status === 'ready'
    ? `${metadata.questionCount || questionOptions.length} questions${suggestedTotal !== '' ? ` · ${suggestedTotal} marks` : ''}`
    : 'Question structure is not available yet';

  const addMistake = () => {
    if (!note.trim()) {
      setFormError('Add a short note before saving a mistake.');
      return;
    }
    setDraftMistakes((current) => [...current, {
      questionId: questionId || 'Unspecified',
      questionMarks: selectedQuestion?.marks ?? null,
      topic,
      category,
      note,
    }]);
    setTopic('');
    setNote('');
    setFormError('');
  };

  const removeDraftMistake = (index) => {
    setDraftMistakes((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const saveReview = () => {
    const safeScore = score === '' ? null : Number(score);
    const safeTotal = totalMarks === '' ? null : Number(totalMarks);
    if (safeScore !== null && (!Number.isFinite(safeScore) || safeScore < 0)) {
      setFormError('Enter a valid score, or leave it blank.');
      return;
    }
    if (safeTotal !== null && (!Number.isFinite(safeTotal) || safeTotal <= 0)) {
      setFormError('Enter a valid total mark, or leave it blank.');
      return;
    }
    if (safeScore !== null && safeTotal !== null && safeScore > safeTotal) {
      setFormError('Your score cannot be higher than the total marks.');
      return;
    }

    setIsSaving(true);
    try {
      const review = savePracticeReview({
        paper,
        subjectName,
        schoolName,
        review: {
          score: safeScore,
          totalMarks: safeTotal,
          timeSpent,
          confidence,
          reflection,
          questionCount: metadata?.questionCount || 0,
          metadataStatus: metadata?.status || 'missing',
        },
      });
      draftMistakes.forEach((mistake) => saveMistake({ paper, subjectName, schoolName, mistake }));
      onSaved?.(review, draftMistakes.length);
      onClose();
    } catch (error) {
      setFormError('Your review could not be saved locally. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <div className="practice-review-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="practice-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="practice-review-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="practice-review-header">
          <div>
            <div className="practice-review-eyebrow">Post-practice review</div>
            <h2 id="practice-review-title">Turn this paper into your next improvement</h2>
            <p>{paper?.n} · {formatTimeSpent(timeSpent)} recorded</p>
          </div>
          <button type="button" className="practice-review-icon-button" onClick={onClose} aria-label="Close review">
            <X size={18} />
          </button>
        </div>

        <div className="practice-review-scroll">
          <div className="practice-review-structure">
            <span>Paper structure</span>
            <strong>{totalLabel}</strong>
            {metadata?.notes && <p>{metadata.notes}</p>}
          </div>

          <div className="practice-review-grid">
            <label>
              <span>Score</span>
              <input type="number" min="0" step="0.5" value={score} onChange={(event) => setScore(event.target.value)} placeholder="Optional" />
            </label>
            <label>
              <span>Total marks</span>
              <input type="number" min="1" step="0.5" value={totalMarks} onChange={(event) => setTotalMarks(event.target.value)} placeholder="Optional" />
            </label>
          </div>

          <fieldset className="practice-review-confidence">
            <legend>How confident did you feel?</legend>
            <div>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={confidence === value ? 'is-selected' : ''}
                  onClick={() => setConfidence(value)}
                  aria-pressed={confidence === value}
                >
                  {value}
                </button>
              ))}
            </div>
            <small>1 = not confident, 5 = very confident</small>
          </fieldset>

          <label className="practice-review-field">
            <span>What would you change next time?</span>
            <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} rows={3} placeholder="For example: plan extended responses first, then return to calculations." />
          </label>

          <div className="practice-review-mistakes">
            <div className="practice-review-section-heading">
              <div>
                <span className="practice-review-eyebrow">Mistake notebook</span>
                <h3>Log the errors worth revisiting</h3>
              </div>
              <span className="practice-review-count">{draftMistakes.length} saved</span>
            </div>

            <div className="practice-review-grid">
              <label>
                <span>Question</span>
                {questionOptions.length > 0 ? (
                  <div className="practice-review-select-wrap">
                    <select value={questionId} onChange={(event) => setQuestionId(event.target.value)}>
                      {questionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <ChevronDown size={15} aria-hidden="true" />
                  </div>
                ) : (
                  <input value={questionId} onChange={(event) => setQuestionId(event.target.value)} placeholder="e.g. 4(b)" />
                )}
              </label>
              <label>
                <span>Type of error</span>
                <div className="practice-review-select-wrap">
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    {MISTAKE_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <ChevronDown size={15} aria-hidden="true" />
                </div>
              </label>
            </div>
            <label className="practice-review-field">
              <span>Topic, if you know it</span>
              <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. Chemical equilibrium" />
            </label>
            <label className="practice-review-field">
              <span>What went wrong and what will you do next?</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Describe the mistake, then add the rule or method you will use next time." />
            </label>
            <button type="button" className="btn-secondary practice-review-add" onClick={addMistake}>
              <Plus size={16} /> Add mistake
            </button>

            {draftMistakes.length > 0 && (
              <ul className="practice-review-draft-list">
                {draftMistakes.map((mistake, index) => (
                  <li key={`${mistake.questionId}-${index}`}>
                    <div>
                      <strong>{mistake.questionId} · {mistake.category}</strong>
                      <span>{mistake.topic || 'No topic added'} · {mistake.note}</span>
                    </div>
                    <button type="button" onClick={() => removeDraftMistake(index)} aria-label={`Remove mistake ${index + 1}`}>
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {formError && <div className="practice-review-error"><AlertCircle size={16} /> {formError}</div>}
        </div>

        <div className="practice-review-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>Skip for now</button>
          <button type="button" className="btn-primary practice-review-save" onClick={saveReview} disabled={isSaving}>
            <Check size={16} /> {isSaving ? 'Saving…' : 'Save review'}
          </button>
        </div>
      </section>
    </div>
  );
}
