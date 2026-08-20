const LEVEL_SCORES = Object.freeze({
  routine: 0,
  challenging: 2,
  stretch: 4,
});

const REASON_LABELS = Object.freeze({
  'unfamiliar-context': 'an unfamiliar exam context',
  'multi-step-reasoning': 'multiple linked reasoning steps',
  'cross-topic-synthesis': 'ideas from more than one topic',
  'data-interpretation': 'careful data or graph interpretation',
  'common-misconception': 'a likely misconception trap',
  'non-routine-method': 'a non-routine method',
  'extended-response': 'a sustained written response',
});

function questionScore(question) {
  const challenge = question?.challenge || {};
  const levelScore = LEVEL_SCORES[challenge.level] || 0;
  const reasonScore = Math.min(2, Array.isArray(challenge.reasons) ? challenge.reasons.length : 0);
  const markScore = Math.min(2, Math.max(0, Number(question?.marks) - 3) / 3);
  return levelScore + reasonScore + markScore;
}

export function challengeLevelLabel(level) {
  if (level === 'stretch') return 'Stretch';
  if (level === 'challenging') return 'Challenging';
  return 'Practice';
}

export function challengeReasonLabel(question) {
  const challenge = question?.challenge || {};
  if (challenge.note) return challenge.note;

  const labels = (Array.isArray(challenge.reasons) ? challenge.reasons : [])
    .map((reason) => REASON_LABELS[reason])
    .filter(Boolean);
  if (labels.length === 1) return `Chosen for ${labels[0]}.`;
  if (labels.length > 1) return `Chosen for ${labels[0]} and ${labels[1]}.`;
  return 'A substantial question to attempt carefully.';
}

/**
 * Chooses the strongest page-addressable questions from a cached paper analysis.
 * Only non-routine questions are surfaced, so the feature never claims that an
 * ordinary question is a recommended challenge merely to fill a card.
 */
export function getChallengeRecommendations(questions, limit = 3) {
  const pool = (Array.isArray(questions) ? questions : [])
    .filter((question) => {
      const page = Number(question?.page);
      const level = question?.challenge?.level;
      return Number.isInteger(page) && page > 0 && (level === 'challenging' || level === 'stretch');
    })
    .map((question) => ({
      ...question,
      challengeScore: questionScore(question),
    }))
    .sort((left, right) => (
      right.challengeScore - left.challengeScore
      || Number(right.marks || 0) - Number(left.marks || 0)
      || Number(left.page) - Number(right.page)
      || String(left.id).localeCompare(String(right.id), undefined, { numeric: true })
    ));

  return pool.slice(0, Math.max(1, Math.min(3, limit)));
}
