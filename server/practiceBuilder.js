import { collectCachedQuestionCandidates } from './cachedQuestionDiscovery.js';
import { buildPracticeSet, normaliseBuilderOptions } from './practiceBuilderCore.js';

function validateSubject(subject) {
  const value = String(subject || '').trim();
  if (!value || value.length > 100) throw new Error('Choose a valid subject.');
  return value;
}

function validateLevel(level) {
  const value = Number(level);
  if (![11, 12].includes(value)) throw new Error('Year level must be 11 or 12.');
  return value;
}

function facetResponse(subject, level, candidates) {
  const topics = new Map();
  const difficulty = { routine: 0, challenging: 0, stretch: 0 };
  let markedQuestionCount = 0;
  for (const candidate of candidates) {
    const marks = Number(candidate.question?.marks);
    const hasMarks = Number.isFinite(marks) && marks > 0;
    if (hasMarks) {
      markedQuestionCount += 1;
      const kind = candidate.question?.challenge?.level;
      if (Object.hasOwn(difficulty, kind)) difficulty[kind] += 1;
    }
    for (const label of candidate.allTopics || candidate.question?.topics || []) {
      const name = String(label || '').trim();
      if (name) topics.set(name, (topics.get(name) || 0) + 1);
    }
  }
  return {
    subject, level,
    questionCount: candidates.length,
    markedQuestionCount,
    topics: [...topics.entries()].map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
    difficulty,
  };
}

export async function getPracticeBuilderFacets({ subject, level }) {
  const safeSubject = validateSubject(subject);
  const safeLevel = validateLevel(level);
  const candidates = await collectCachedQuestionCandidates({ subject: safeSubject, level: safeLevel, preferSubparts: true, requireIndexedPaper: true, groupRomanSubparts: true });
  return facetResponse(safeSubject, safeLevel, candidates);
}

export async function createPracticeBuilderSet(body = {}) {
  const subject = validateSubject(body.subject);
  const level = validateLevel(body.level);
  if (body.topics !== undefined && (!Array.isArray(body.topics) || body.topics.length > 8
    || body.topics.some((topic) => typeof topic !== 'string' || topic.length > 100))) {
    throw new Error('Choose up to eight available topics.');
  }
  const target = body.target || {};
  if (!['time', 'marks'].includes(target.mode) || !Number.isFinite(Number(target.value))) {
    throw new Error('Choose a valid time or marks target.');
  }
  const min = target.mode === 'time' ? 10 : 5;
  const max = target.mode === 'time' ? 120 : 80;
  const targetValue = Math.round(Math.max(min, Math.min(max, Number(target.value))));
  if (!['mixed', 'routine', 'challenging', 'stretch'].includes(String(body.difficulty || 'mixed').toLowerCase())) {
    throw new Error('Choose a valid difficulty.');
  }
  if (body.excludeQuestionKeys !== undefined && (!Array.isArray(body.excludeQuestionKeys) || body.excludeQuestionKeys.length > 200)) {
    throw new Error('Too many excluded questions.');
  }
  const options = normaliseBuilderOptions({ ...body, subject, level, target: { mode: target.mode, value: targetValue } });
  const excludedCandidates = await collectCachedQuestionCandidates({
    subject, level, topics: options.topics, difficulty: options.difficulty === 'mixed' ? 'any' : options.difficulty,
    excludeQuestionKeys: options.excludeQuestionKeys, requireMarks: true, requireIndexedPaper: true, groupRomanSubparts: true,
  });
  let result = buildPracticeSet(excludedCandidates, options);
  const tolerance = Math.max(2, Math.round(options.targetMarks * 0.1));
  if (options.excludeQuestionKeys.length
    && (!result.questions.length || result.summary.totalMarks < options.targetMarks - tolerance)) {
    const fallbackCandidates = await collectCachedQuestionCandidates({
      subject, level, topics: options.topics, difficulty: options.difficulty === 'mixed' ? 'any' : options.difficulty,
      requireMarks: true, requireIndexedPaper: true, groupRomanSubparts: true,
    });
    const fallback = buildPracticeSet(fallbackCandidates, { ...options, excludeQuestionKeys: [] });
    if (fallback.questions.length && (!result.questions.length
      || Math.abs(options.targetMarks - fallback.summary.totalMarks) < Math.abs(options.targetMarks - result.summary.totalMarks))) {
      result = fallback;
      result.warnings.unshift('Some questions were reused because there were not enough alternatives for these filters.');
    }
  }
  return result;
}
