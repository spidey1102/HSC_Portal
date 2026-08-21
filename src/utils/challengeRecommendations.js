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

function challengeScore(question) {
  const challenge = question?.challenge || {};
  const levelScore = LEVEL_SCORES[challenge.level] || 0;
  const reasonScore = Math.min(2, Array.isArray(challenge.reasons) ? challenge.reasons.length : 0);
  const markScore = Math.min(2, Math.max(0, Number(question?.marks) - 3) / 3);
  return levelScore + reasonScore + markScore;
}

function getChallengeSubpart(question) {
  const subpartId = String(question?.challenge?.subpartId || '').trim();
  if (!subpartId) return null;

  return (Array.isArray(question?.subparts) ? question.subparts : []).find((subpart) => (
    String(subpart?.id || '').trim().toLowerCase() === subpartId.toLowerCase()
  )) || null;
}

function isKnownPage(value) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0;
}

/**
 * The selected recommendation keeps its top-level question identity but carries
 * an optional direct subpart target. This prevents cards from pretending that a
 * whole long question is the challenge when the model identified Question 8(c).
 */
function prepareRecommendation(question) {
  const challengeSubpart = getChallengeSubpart(question);
  const targetPage = isKnownPage(challengeSubpart?.page)
    ? Number(challengeSubpart.page)
    : Number(question?.page);

  return {
    ...question,
    challengeSubpart,
    targetPage,
    targetMarks: challengeSubpart?.marks ?? question?.marks ?? null,
  };
}

export function challengeLevelLabel(level) {
  if (level === 'stretch') return 'Stretch';
  if (level === 'challenging') return 'Challenging';
  return 'Practice';
}

export function challengeQuestionLabel(question) {
  const questionId = String(question?.id || '').trim();
  const subpartId = String(question?.challengeSubpart?.id || '').trim();
  return `Question ${questionId}${subpartId ? `(${subpartId})` : ''}`;
}

export function challengeReasonLabel(question) {
  if (question?.isFallback) {
    return 'The most substantial page-addressable question in this paper.';
  }

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
 * Challenging and stretch questions always lead. If a paper's metadata contains
 * no such tag, one substantial routine question is still surfaced rather than
 * leaving an HSC student with an empty recommendation panel.
 */
export function getChallengeRecommendations(questions, limit = 3) {
  const ranked = (Array.isArray(questions) ? questions : [])
    .map(prepareRecommendation)
    .filter((question) => isKnownPage(question.targetPage))
    .map((question) => ({
      ...question,
      challengeScore: challengeScore(question),
    }))
    .sort((left, right) => (
      right.challengeScore - left.challengeScore
      || Number(right.targetMarks || 0) - Number(left.targetMarks || 0)
      || Number(left.targetPage) - Number(right.targetPage)
      || String(left.id).localeCompare(String(right.id), undefined, { numeric: true })
    ));

  const tagged = ranked.filter((question) => (
    question?.challenge?.level === 'challenging' || question?.challenge?.level === 'stretch'
  ));
  if (tagged.length) return tagged.slice(0, Math.max(1, Math.min(3, limit)));

  return ranked.length ? [{ ...ranked[0], isFallback: true }] : [];
}
