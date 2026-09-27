import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPracticeSet } from './practiceBuilderCore.js';

function candidate({ id, marks, topic = 'A', level = 'routine', paper = id, parentKey, hasSolutions = false, year = 2024 }) {
  return {
    key: `${paper}::${id}`,
    parentKey: parentKey || `${paper}::${id}`,
    paperIdentity: paper,
    paperName: `Paper ${paper}`,
    paperYear: year,
    subject: 'Mathematics Extension 1',
    level: 12,
    hasSolutions,
    question: { id, page: 1, marks, topics: [topic], challenge: { level, subpartId: '' } },
  };
}

const options = (overrides = {}) => ({
  subject: 'Mathematics Extension 1', level: 12, topics: [], difficulty: 'mixed',
  target: { mode: 'marks', value: 10 }, preferSolutions: false, ...overrides,
});

test('fits an exact mark target when possible', () => {
  const result = buildPracticeSet([
    candidate({ id: '1', marks: 5 }), candidate({ id: '2', marks: 5, paper: 'b' }),
    candidate({ id: '3', marks: 4, paper: 'c' }), candidate({ id: '4', marks: 3, paper: 'd' }), candidate({ id: '5', marks: 2, paper: 'e' }),
  ], options());
  assert.equal(result.summary.totalMarks, 10);
});

test('warns when the suitable pool cannot reach the target', () => {
  const result = buildPracticeSet([candidate({ id: '1', marks: 3 }), candidate({ id: '2', marks: 2, paper: 'b' })], options());
  assert.equal(result.summary.totalMarks, 5);
  assert.match(result.warnings.join(' '), /Only 5 suitable marks/);
});

test('returns the nearest useful question when every option exceeds a short target', () => {
  const result = buildPracticeSet([candidate({ id: '1', marks: 8 })], options({ target: { mode: 'marks', value: 5 } }));
  assert.equal(result.summary.totalMarks, 8);
  assert.equal(result.summary.questionCount, 1);
  assert.ok(result.warnings.length);
});

test('covers each selected topic when suitable questions exist', () => {
  const pool = [
    candidate({ id: '1', marks: 3, topic: 'A' }),
    candidate({ id: '2', marks: 3, topic: 'B', paper: 'b' }),
    candidate({ id: '3', marks: 3, topic: 'C', paper: 'c' }),
  ];
  const result = buildPracticeSet(pool, options({ topics: ['A', 'B', 'C'], target: { mode: 'marks', value: 10 } }));
  assert.deepEqual(new Set(result.questions.flatMap((item) => item.question.topics)), new Set(['A', 'B', 'C']));
});

test('matches topics beyond the first three labels on a cached question', () => {
  const item = candidate({ id: '1', marks: 10, topic: 'Topic A' });
  item.allTopics = ['Topic A', 'Topic B', 'Topic C', 'Topic D'];
  item.question.topics = ['Topic A', 'Topic B', 'Topic C'];
  const result = buildPracticeSet([item], options({ topics: ['Topic D'], target: { mode: 'marks', value: 10 } }));
  assert.equal(result.summary.questionCount, 1);
});

test('prevents selecting a parent and its subpart', () => {
  const result = buildPracticeSet([
    candidate({ id: '6', marks: 5, parentKey: 'paper::6' }),
    candidate({ id: '6', marks: 5, topic: 'B', paper: 'paper', parentKey: 'paper::6' }),
    { ...candidate({ id: '6', marks: 2, topic: 'B', paper: 'paper', parentKey: 'paper::6' }), key: 'paper::6(a)', question: { ...candidate({ id: '6', marks: 2 }).question, challenge: { level: 'routine', subpartId: 'a' } } },
    candidate({ id: '7', marks: 5, paper: 'other' }),
  ], options({ target: { mode: 'marks', value: 10 } }));
  assert.ok(!result.questions.some((item) => item.key === 'paper::6' && item.question.challenge.subpartId === 'a'));
  assert.ok(new Set(result.questions.map((item) => item.parentKey)).size === result.questions.length);
});

test('honours exclusions when alternatives exist', () => {
  const pool = [candidate({ id: '1', marks: 5 }), candidate({ id: '2', marks: 5, paper: 'b' })];
  const result = buildPracticeSet(pool, options({ excludeQuestionKeys: ['1::1'] }));
  assert.ok(!result.questions.some((item) => item.key === '1::1'));
});

test('strict difficulty does not mix in other challenge levels', () => {
  const result = buildPracticeSet([
    candidate({ id: '1', marks: 5, level: 'routine' }),
    candidate({ id: '2', marks: 5, level: 'stretch', paper: 'b' }),
  ], options({ difficulty: 'stretch' }));
  assert.ok(result.questions.every((item) => item.question.challenge.level === 'stretch'));
});

test('mixed sets include varied difficulty when the pool allows it', () => {
  const result = buildPracticeSet([
    candidate({ id: '1', marks: 3, level: 'routine' }),
    candidate({ id: '2', marks: 3, level: 'challenging', paper: 'b' }),
    candidate({ id: '3', marks: 3, level: 'stretch', paper: 'c' }),
  ], options({ target: { mode: 'marks', value: 9 } }));
  assert.ok(new Set(result.questions.map((item) => item.question.challenge.level)).size > 1);
});

test('prefers supplied solutions among comparable options', () => {
  const result = buildPracticeSet([
    candidate({ id: '1', marks: 5, hasSolutions: false }),
    candidate({ id: '2', marks: 5, paper: 'b', hasSolutions: true }),
  ], options({ preferSolutions: true }));
  assert.equal(result.questions[0].hasSolutions, true);
});

test('uses more than one source paper when practical', () => {
  const result = buildPracticeSet([
    candidate({ id: '1', marks: 3, paper: 'same' }),
    candidate({ id: '2', marks: 3, paper: 'same' }),
    candidate({ id: '3', marks: 3, paper: 'other' }),
  ], options({ target: { mode: 'marks', value: 6 } }));
  assert.ok(new Set(result.questions.map((item) => item.paperIdentity)).size > 1);
});

test('returns an empty best-effort result with a warning for an empty pool', () => {
  const result = buildPracticeSet([], options());
  assert.equal(result.questions.length, 0);
  assert.ok(result.warnings.length);
});

test('PDF-ready mode excludes questions without verified crops', () => {
  const unverified = candidate({ id: '1', marks: 5 });
  const verified = candidate({ id: '2', marks: 5, paper: 'b' });
  verified.question.pdfCrop = { sourceSha256: 'verified' };
  const result = buildPracticeSet([unverified, verified], options({ pdfOnly: true }));
  assert.deepEqual(result.questions.map((item) => item.key), [verified.key]);
  const unavailable = buildPracticeSet([unverified], options({ pdfOnly: true }));
  assert.equal(unavailable.questions.length, 0);
  assert.match(unavailable.warnings[0], /verified PDF images/);
});
