import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewAnswers, filePath, publicPost, validDate } from './dailyPosts.js';

test('only the active author can view private submissions', () => {
  const post = { author_uid: 'poster-1' };
  assert.equal(canViewAnswers(post, 'poster-1', 'poster'), true);
  assert.equal(canViewAnswers(post, 'poster-1', null), false);
  assert.equal(canViewAnswers(post, 'owner-2', 'owner'), false);
  assert.equal(canViewAnswers(post, 'student-3', null), false);
});

test('public posts hide unreleased solutions and storage paths', () => {
  const post = publicPost({
    id: 'post-id', title: 'Proof', subject: 'Mathematics', question_text: 'Show why',
    question_file_path: 'posts/private/question/a.pdf', question_file_name: 'question.pdf',
    publish_date: '2026-09-26', solution_text: 'The answer',
    solution_file_path: 'posts/private/solution/b.pdf', solution_file_name: 'answer.pdf',
    solution_released_at: null,
  });
  assert.equal(post.solutionText, '');
  assert.equal(post.hasSolutionFile, false);
  assert.equal(JSON.stringify(post).includes('posts/private'), false);
});

test('attachment paths and calendar dates reject malformed values', () => {
  assert.equal(filePath('answers/post/user/file.pdf', 'answers/post/user/'), 'answers/post/user/file.pdf');
  assert.throws(() => filePath('answers/post/other/file.pdf', 'answers/post/user/'));
  assert.throws(() => filePath('answers/post/user/../file.pdf', 'answers/post/user/'));
  assert.equal(validDate('2026-09-26'), true);
  assert.equal(validDate('2026-02-30'), false);
});
