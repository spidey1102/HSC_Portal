import test from 'node:test';
import assert from 'node:assert/strict';
import { correctedPracticeQuestion, verifiedPracticeCrop } from './verifiedPracticeCrops.js';

const stGeorge = 'yr12/Maths/Extension 1/St George Girls 2025 w. sol [5338-213e821d].pdf';
const riverview = 'yr12/Maths/Extension 1/Riverview 2024 w. sol [5338-c4cce351].pdf';
const kings = 'yr12/Maths/Extension 1/Kings 2021 w. sol [5338-ab88617a].pdf';
const pymble = 'yr12/Maths/Extension 1/Pymble 2024 w. sol [5338-7640dcbc].pdf';

test('the failed three-question set uses only approved exam pages and correct marks', () => {
  const first = verifiedPracticeCrop(stGeorge, '5', 'whole', 1);
  const second = verifiedPracticeCrop(riverview, '14', 'b', 3);
  const third = verifiedPracticeCrop(kings, '14', 'a', 4);
  assert.deepEqual([first, second, third].map((crop) => crop.fragments.map((part) => part.page)), [[4], [10], [12]]);
  assert.deepEqual([first, second, third].map((crop) => crop.marks), [1, 3, 4]);
  assert.equal(verifiedPracticeCrop(riverview, '14', 'b', 15), null);
});

test('the map corrections remove answer-page addresses', () => {
  const stGeorgeQuestion = correctedPracticeQuestion(stGeorge, { id: '5', page: 5, geometry: { segments: [{ page: 14 }] } });
  assert.equal(stGeorgeQuestion.page, 4);
  assert.deepEqual(stGeorgeQuestion.geometry.segments.map((segment) => segment.page), [4]);
  const riverviewQuestion = correctedPracticeQuestion(riverview, { id: '14', page: 10, subparts: [{ id: 'b', page: 29, marks: null }] });
  assert.deepEqual(riverviewQuestion.geometry.segments.map((segment) => segment.page), [10, 11]);
  assert.equal(riverviewQuestion.subparts.find((part) => part.id === 'b').marks, 3);
  assert.equal(riverviewQuestion.subparts.find((part) => part.id === 'b').page, 10);
});

test('roman numeral groups keep all subsections of the verified letter', () => {
  const kingsA = verifiedPracticeCrop(kings, '14', 'a', 4);
  assert.equal(kingsA.fragments.length, 1);
  assert.equal(kingsA.fragments[0].bbox[1], 104);
  assert.equal(kingsA.fragments[0].bbox[3], 302);
});

test('a verified question spanning pages includes only its exam pages', () => {
  const whole = verifiedPracticeCrop(riverview, '14', 'whole', 15);
  assert.deepEqual(whole.fragments.map((fragment) => fragment.page), [10, 11]);
});

test('a scanned question uses its reviewed page and corrected topic', () => {
  const question = correctedPracticeQuestion(pymble, { id: '1', page: 12, topics: ['Calculus'] });
  assert.equal(question.page, 2);
  assert.deepEqual(question.topics, ['Vectors']);
  assert.deepEqual(verifiedPracticeCrop(pymble, '1', 'whole', 1).fragments.map((fragment) => fragment.page), [2]);
});
