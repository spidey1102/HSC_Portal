import assert from 'node:assert/strict';
import {
  isObviouslyIncompleteCachedAnalysis,
  normaliseAnalysis,
  printedTotalMarksFromPaperText,
  questionRangeFromPaperText,
  readableSourceProblem,
} from '../api/paper-metadata.js';

const trialPaper = { c: 'T', n: 'Integrity test paper' };
const emptyChallenge = { level: 'routine', reasons: [], note: '', subpartId: null };

function answer(totalMarks, marks) {
  return JSON.stringify({
    totalMarks,
    confidence: 'high',
    notes: '',
    questions: marks.map((mark, index) => ({
      id: String(index + 1),
      marks: mark,
      page: index + 1,
      subparts: [],
      topics: ['Test topic'],
      skill: 'Test skill',
      commandVerb: '',
      challenge: emptyChallenge,
    })),
  });
}

const seventyMarkText = 'Total marks: 70. Attempt Questions 1–2.';
assert.equal(printedTotalMarksFromPaperText(seventyMarkText), 70);
assert.deepEqual(questionRangeFromPaperText(seventyMarkText), [1, 2]);
const validSeventy = normaliseAnalysis(answer(70, [35, 35]), 'test', {
  paper: trialPaper,
  paperText: seventyMarkText,
});
assert.equal(validSeventy.totalMarks, 70);
assert.equal(validSeventy.questionCount, 2);

const oneHundredMarkText = 'Total m arks : 10 0. Attempt Questions 1–2.';
assert.equal(printedTotalMarksFromPaperText(oneHundredMarkText), 100);
assert.throws(
  () => normaliseAnalysis(answer(100, [45, 45]), 'test', {
    paper: trialPaper,
    paperText: oneHundredMarkText,
  }),
  /totals 90 marks, but this paper is worth 100 marks/,
);

assert.equal(
  readableSourceProblem({
    paper: trialPaper,
    paperText: 'Question 21. Question 22. Question 23. Question 24. Question 25. Question 26. Question 27.',
  }),
  'The readable PDF text begins at Question 21 and does not expose a full paper question range.',
);

const partialReadyMap = {
  status: 'ready',
  questionCount: 7,
  totalMarks: 20,
  pagesAnalysed: 77,
  totalPages: 78,
  questions: [21, 22, 23, 24, 25, 26, 27].map((id) => ({ id: String(id), marks: id === 21 ? 8 : 2 })),
};
assert.equal(isObviouslyIncompleteCachedAnalysis(partialReadyMap, trialPaper), true);

const completeReadyMap = {
  status: 'ready',
  questionCount: 2,
  totalMarks: 70,
  pagesAnalysed: 2,
  totalPages: 2,
  questions: [{ id: '1', marks: 35 }, { id: '2', marks: 35 }],
};
assert.equal(isObviouslyIncompleteCachedAnalysis(completeReadyMap, trialPaper), false);

console.log('Question Map integrity checks passed.');
