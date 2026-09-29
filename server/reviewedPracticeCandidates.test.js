import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import reviewed from './reviewedPracticeData.js';
import { getPracticeBuilderFacets, createPracticeBuilderSet } from './practiceBuilder.js';

test('all reviewed sources retain their approval fingerprint and exact catalog identity', () => {
  const catalog = JSON.parse(readFileSync(new URL('../public/papers.json', import.meta.url)));
  const identities = new Set(catalog.papers.map((p) => JSON.stringify([p.v, p.s, p.l, p.c, p.y, p.h, p.w, p.n])));
  assert.equal(reviewed.papers.length, 21);
  for (const paper of reviewed.papers) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../public${paper.sourceUrl}`, import.meta.url))).digest('hex'), paper.sourceSha256);
  }
  for (const candidate of reviewed.candidates) {
    assert.ok(identities.has(candidate.paperIdentity));
    const crop = candidate.question.pdfCrop;
    assert.equal(crop.marks, candidate.question.marks);
    assert.equal(crop.questionId, candidate.question.id);
    assert.match(crop.unitId, /^(whole|[a-z])$/);
    assert.equal(crop.unitId, candidate.question.challenge.subpartId || 'whole');
    assert.ok(crop.fragments.length > 0);
    for (const fragment of crop.fragments) {
      assert.ok(fragment.bbox[0] >= 0 && fragment.bbox[2] <= fragment.pageWidth);
      assert.ok(fragment.bbox[1] >= 0 && fragment.bbox[3] <= fragment.pageHeight);
    }
  }
});

test('reviewed builder works without database access for both subjects', async () => {
  for (const [subject, paperCount] of [['Maths Ext 1', 10], ['Chemistry', 11]]) {
    const facets = await getPracticeBuilderFacets({ subject, level: 12, pdfOnly: true });
    assert.equal(facets.reviewedPaperCount, paperCount);
    assert.ok(facets.pdfReadyQuestionCount > 100);
    for (const value of [10, 20, 50, 80]) {
      const build = await createPracticeBuilderSet({ subject, level: 12, pdfOnly: true, target: { mode: 'marks', value } });
      assert.ok(build.questions.length);
      assert.equal(build.summary.totalMarks, build.questions.reduce((sum, q) => sum + q.question.marks, 0));
      assert.ok(Math.abs(build.summary.totalMarks - value) <= Math.max(2, value * .1));
      assert.ok(build.questions.every((q) => q.question.pdfCrop));
      for (const question of build.questions) {
        if (question.key === question.parentKey) assert.equal(build.questions.filter((q) => q.parentKey === question.parentKey).length, 1);
      }
    }
  }
});

test('roman subsections are offered as their complete letter, never alone', () => {
  const units = reviewed.candidates.filter((c) => c.paperName === 'North Sydney Girls 2021' && c.question.id === '5');
  assert.deepEqual(units.map((c) => c.question.pdfCrop.unitId), ['whole', 'a', 'b', 'c']);
  assert.equal(units.find((c) => c.question.pdfCrop.unitId === 'b').question.marks, 5);
});

test('topics, year, exclusions and unavailable PDF coverage are respected', async () => {
  const options = { subject: 'Chemistry', level: 12, pdfOnly: true, topics: ['Equilibrium'], target: { mode: 'marks', value: 20 } };
  const first = await createPracticeBuilderSet(options);
  assert.ok(first.questions.length);
  assert.ok(first.questions.every((q) => q.question.topics.includes('Equilibrium')));
  const next = await createPracticeBuilderSet({ ...options, excludeQuestionKeys: first.questions.map((q) => q.key) });
  assert.ok(next.questions.every((q) => !first.questions.some((old) => old.key === q.key)));
  assert.equal((await getPracticeBuilderFacets({ subject: 'Chemistry', level: 11, pdfOnly: true })).pdfReadyQuestionCount, 0);
});
