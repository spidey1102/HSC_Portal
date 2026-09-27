import { DEFAULT_MINUTES_PER_MARK } from '../shared/practiceBuilderConstants.js';

export { DEFAULT_MINUTES_PER_MARK };

export function normaliseBuilderOptions(options = {}) {
  const mode = options.target?.mode === 'time' ? 'time' : 'marks';
  const value = Number(options.target?.value);
  const targetValue = Math.round(Math.max(mode === 'time' ? 10 : 5, Math.min(mode === 'time' ? 120 : 80, value || (mode === 'time' ? 30 : 20))));
  return {
    subject: String(options.subject || '').trim(),
    level: Number(options.level) === 11 ? 11 : 12,
    topics: [...new Set((Array.isArray(options.topics) ? options.topics : []).map((topic) => String(topic || '').trim()).filter(Boolean))].slice(0, 8),
    difficulty: ['routine', 'challenging', 'stretch'].includes(String(options.difficulty || '').toLowerCase())
      ? String(options.difficulty).toLowerCase() : 'mixed',
    preferSolutions: options.preferSolutions !== false,
    pdfOnly: options.pdfOnly === true,
    target: { mode, value: targetValue },
    targetMarks: mode === 'time' ? Math.max(1, Math.round(targetValue / DEFAULT_MINUTES_PER_MARK)) : targetValue,
    excludeQuestionKeys: (Array.isArray(options.excludeQuestionKeys) ? options.excludeQuestionKeys : []).slice(0, 200).map(String),
  };
}

const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const marksOf = (candidate) => Number(candidate?.question?.marks);
const topicsOf = (candidate) => (Array.isArray(candidate?.allTopics) ? candidate.allTopics : Array.isArray(candidate?.question?.topics) ? candidate.question.topics : []).map(norm);
const challengeOf = (candidate) => ['routine', 'challenging', 'stretch'].includes(candidate?.question?.challenge?.level)
  ? candidate.question.challenge.level : 'routine';

function parentOf(candidate) {
  return candidate.parentKey || `${candidate.paperIdentity}::${candidate.question?.id}`;
}

function canAdd(candidate, chosen) {
  const parentKey = parentOf(candidate);
  return !chosen.some((entry) => {
    if (entry.key === candidate.key) return true;
    const entryParentKey = parentOf(entry);
    const candidateIsParent = candidate.key === parentKey;
    const entryIsParent = entry.key === entryParentKey;
    return (candidateIsParent && entryParentKey === parentKey)
      || (entryIsParent && parentKey === entry.key);
  });
}

function rankCandidate(candidate, chosen, options, targetMarks, { coverage = false } = {}) {
  const marks = marksOf(candidate);
  const currentMarks = chosen.reduce((sum, entry) => sum + marksOf(entry), 0);
  const afterGap = Math.abs(targetMarks - (currentMarks + marks));
  const beforeGap = Math.abs(targetMarks - currentMarks);
  const paperCount = chosen.filter((entry) => entry.paperIdentity === candidate.paperIdentity).length;
  const siblingCount = chosen.filter((entry) => parentOf(entry) === parentOf(candidate)).length;
  const topicMatches = topicsOf(candidate).filter((topic) => options.topics.some((wanted) => norm(wanted) === topic));
  const missingTopics = options.topics.filter((topic) => !chosen.some((entry) => topicsOf(entry).includes(norm(topic))));
  const covers = topicMatches.filter((topic) => missingTopics.some((wanted) => norm(wanted) === topic)).length;
  const diffCounts = chosen.reduce((counts, entry) => ({ ...counts, [challengeOf(entry)]: counts[challengeOf(entry)] + marksOf(entry) }), { routine: 0, challenging: 0, stretch: 0 });
  const beforeDiffCounts = { ...diffCounts };
  const beforeDiffKinds = Object.values(diffCounts).filter(Boolean).length;
  diffCounts[challengeOf(candidate)] += marks;
  const afterDiffKinds = Object.values(diffCounts).filter(Boolean).length;
  const mixedTargets = { routine: 0.5, challenging: 0.35, stretch: 0.15 };
  const mixLoss = (counts) => {
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0) || 1;
    return Object.entries(mixedTargets).reduce((sum, [level, target]) => sum + Math.abs((counts[level] || 0) / total - target), 0);
  };
  const diffBonus = options.difficulty === 'mixed'
    ? ((afterDiffKinds > beforeDiffKinds ? 1.2 : 0) + Math.max(-1, Math.min(1, mixLoss(beforeDiffCounts) - mixLoss(diffCounts))) * 3)
    : 0;
  const solutionBonus = options.preferSolutions && candidate.hasSolutions ? 1.8 : 0;
  const newPaperBonus = paperCount === 0 ? 2.2 : paperCount === 1 ? 0.7 : -Math.min(2, paperCount);
  const targetBonus = (beforeGap - afterGap) * 2;
  const coverageBonus = coverage ? covers * 100 : covers * 3.2;
  const newerBonus = Math.max(0, Math.min(1, (Number(candidate.paperYear) - 2000) / 40));
  const orderTieBreak = (candidate.key || '').split('').reduce((sum, char) => (sum + char.charCodeAt(0)) % 997, 0) / 10000;
  return targetBonus + coverageBonus + diffBonus + solutionBonus + newPaperBonus + newerBonus + orderTieBreak - siblingCount * 3;
}

function matchesDifficulty(candidate, difficulty) {
  return difficulty === 'mixed' || challengeOf(candidate) === difficulty;
}

export function buildPracticeSet(rawCandidates, rawOptions = {}) {
  const options = normaliseBuilderOptions(rawOptions);
  const excluded = new Set(options.excludeQuestionKeys);
  let candidates = (Array.isArray(rawCandidates) ? rawCandidates : []).filter((candidate) => {
    const marks = marksOf(candidate);
    return candidate?.key && Number.isFinite(marks) && marks > 0
      && !excluded.has(candidate.key)
      && (!options.pdfOnly || Boolean(candidate.question?.pdfCrop))
      && (!options.subject || norm(candidate.subject) === norm(options.subject))
      && Number(candidate.level ?? options.level) === options.level
      && matchesDifficulty(candidate, options.difficulty)
      && (!options.topics.length || options.topics.some((topic) => topicsOf(candidate).includes(norm(topic))));
  });

  const selected = [];
  const availableTopics = new Set(candidates.flatMap(topicsOf));
  // Seed each available selected topic once before filling the mark target.
  for (const topic of options.topics) {
    const wanted = norm(topic);
    if (!availableTopics.has(wanted)) continue;
    const pool = candidates.filter((candidate) => topicsOf(candidate).includes(wanted) && canAdd(candidate, selected));
    pool.sort((left, right) => marksOf(left) - marksOf(right)
      || rankCandidate(right, selected, options, options.targetMarks, { coverage: true })
        - rankCandidate(left, selected, options, options.targetMarks, { coverage: true }));
    if (pool[0] && selected.reduce((sum, entry) => sum + marksOf(entry), 0) + marksOf(pool[0]) <= options.targetMarks + Math.max(2, Math.round(options.targetMarks * 0.1))) {
      selected.push(pool[0]);
    }
  }

  const tolerance = Math.max(2, Math.round(options.targetMarks * 0.1));
  while (selected.length < 20) {
    const currentMarks = selected.reduce((sum, entry) => sum + marksOf(entry), 0);
    const currentGap = Math.abs(options.targetMarks - currentMarks);
    if (currentMarks >= options.targetMarks - tolerance) break;
    let eligible = candidates.filter((candidate) => canAdd(candidate, selected)
      && currentMarks + marksOf(candidate) <= options.targetMarks + tolerance);
    if (!eligible.length && selected.length === 0) eligible = candidates.filter((candidate) => canAdd(candidate, selected));
    if (!eligible.length) break;
    eligible.sort((left, right) => rankCandidate(right, selected, options, options.targetMarks)
      - rankCandidate(left, selected, options, options.targetMarks));
    const best = eligible[0];
    if (!best || Math.abs(options.targetMarks - (currentMarks + marksOf(best))) > currentGap && currentMarks > 0) break;
    selected.push(best);
  }

  // If exclusions made the pool too small, make a second best-effort pass
  // without exclusions and say so explicitly in the preview.
  const warnings = [];
  const selectedMarks = selected.reduce((sum, entry) => sum + marksOf(entry), 0);
  if (!selected.length) {
    warnings.push(options.pdfOnly
      ? 'No questions with verified PDF images are available for these filters yet.'
      : options.difficulty === 'mixed'
      ? 'No suitable marked questions are available for these filters yet.'
      : `No ${options.difficulty} questions with known marks are available for these filters yet.`);
    return { ...options, summary: { questionCount: 0, totalMarks: 0, estimatedMinutes: 0, sourcePaperCount: 0, withSolutionsCount: 0 }, questions: [], warnings };
  }
  const missingTopics = options.topics.filter((topic) => availableTopics.has(norm(topic))
    && !selected.some((candidate) => topicsOf(candidate).includes(norm(topic))));
  if (missingTopics.length) warnings.push(`Could not include every selected topic: ${missingTopics.join(', ')}.`);
  if (selectedMarks < options.targetMarks - tolerance) warnings.push(`Only ${selectedMarks} suitable marks are currently available for these filters.`);
  else if (selectedMarks !== options.targetMarks) warnings.push(`Target was ${options.targetMarks} marks; generated ${selectedMarks} marks.`);
  const sourcePaperCount = new Set(selected.map((candidate) => candidate.paperIdentity)).size;
  const withSolutionsCount = selected.filter((candidate) => candidate.hasSolutions).length;
  if (options.preferSolutions && withSolutionsCount < selected.length) warnings.push(`${withSolutionsCount} of ${selected.length} questions have supplied solutions.`);
  const difficultyOrder = { routine: 0, challenging: 1, stretch: 2 };
  const questions = [...selected]
    .sort((left, right) => difficultyOrder[challengeOf(left)] - difficultyOrder[challengeOf(right)]
      || Number(left.paperYear || 0) - Number(right.paperYear || 0))
    .map((candidate) => {
      const result = { ...candidate };
      delete result.allTopics;
      return result;
    });
  return {
    subject: options.subject,
    level: options.level,
    topics: options.topics,
    difficulty: options.difficulty,
    target: options.target,
    summary: {
      questionCount: questions.length,
      totalMarks: selectedMarks,
      estimatedMinutes: Math.round(selectedMarks * DEFAULT_MINUTES_PER_MARK),
      sourcePaperCount,
      withSolutionsCount,
    },
    questions,
    warnings,
  };
}
