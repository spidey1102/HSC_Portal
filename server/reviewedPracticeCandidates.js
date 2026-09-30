import reviewed from './reviewedPracticeData.js';

export function reviewedPracticeCandidates({ subject, level } = {}) {
  return reviewed.candidates.filter((candidate) => candidate.subject === subject && candidate.level === Number(level));
}

export function reviewedPracticePaperCount({ subject, level } = {}) {
  return new Set(reviewedPracticeCandidates({ subject, level }).map((candidate) => candidate.paperIdentity)).size;
}

export function reviewedPracticeSubjects({ level } = {}) {
  return [...new Set(reviewed.candidates
    .filter((candidate) => candidate.level === Number(level))
    .map((candidate) => candidate.subject))]
    .sort((left, right) => left.localeCompare(right));
}
