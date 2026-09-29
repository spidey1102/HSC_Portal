import reviewed from './reviewedPracticeData.js';

export function reviewedPracticeCandidates({ subject, level } = {}) {
  return reviewed.candidates.filter((candidate) => candidate.subject === subject && candidate.level === Number(level));
}

export function reviewedPracticePaperCount({ subject, level } = {}) {
  return new Set(reviewedPracticeCandidates({ subject, level }).map((candidate) => candidate.paperIdentity)).size;
}
