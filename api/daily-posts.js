import { requireAuthenticatedUser } from '../server/firebaseAdmin.js';
import { getSupabaseSql } from '../server/supabaseDb.js';
import { createClient } from '@supabase/supabase-js';
import {
  canManage, canViewAnswers, cleanText, dateString, errorStatus, fileName, filePath, findPost,
  managedPost, publicPost, readBody, roleFor, sendJson, todaySydney, validDate,
} from '../server/dailyPosts.js';

export const maxDuration = 30;

function questionStorage() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('Daily question file storage is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from('daily-questions');
}

async function optionalUser(req) {
  if (!req.headers?.authorization) return null;
  return requireAuthenticatedUser(req);
}

export default async function handler(req, res) {
  const sql = getSupabaseSql();
  try {
    if (req.method === 'GET') {
      const scope = String(req.query?.scope || 'public');
      if (scope === 'public') {
        const rows = await sql`
          select * from public.daily_posts
          where published_at is not null and publish_date <= ${todaySydney()}::date
          order by publish_date desc limit 60
        `;
        const user = await optionalUser(req);
        const submitted = user ? await sql`
          select post_id from public.daily_submissions
          where student_uid = ${user.uid}
        ` : [];
        sendJson(res, 200, { posts: rows.map(publicPost), submittedPostIds: submitted.map((row) => row.post_id) });
        return;
      }

      const user = await requireAuthenticatedUser(req);
      const role = await roleFor(user.uid);
      if (scope === 'identity') {
        sendJson(res, 200, { uid: user.uid, role });
        return;
      }
      if (scope === 'manage') {
        if (!role) throw new Error('Poster access is required.');
        const rows = role === 'owner'
          ? await sql`select * from public.daily_posts order by created_at desc limit 100`
          : await sql`select * from public.daily_posts where author_uid = ${user.uid} order by created_at desc limit 100`;
        sendJson(res, 200, { posts: rows.map(managedPost) });
        return;
      }
      if (scope === 'submissions') {
        const post = await findPost(String(req.query?.postId || ''));
        if (!post || !canViewAnswers(post, user.uid, role)) throw new Error('Only this question’s poster can view submissions.');
        const rows = await sql`
          select id, answer_text, file_path, file_name, created_at
          from public.daily_submissions where post_id = ${post.id}
          order by created_at desc limit 500
        `;
        sendJson(res, 200, { submissions: rows.map((row) => ({
          id: row.id, answerText: row.answer_text, fileName: row.file_name,
          hasFile: Boolean(row.file_path), createdAt: row.created_at,
        })) });
        return;
      }
      if (scope === 'contributors') {
        if (role !== 'owner') throw new Error('Owner access is required.');
        const rows = await sql`select firebase_uid, display_name, active from public.daily_contributors order by created_at desc`;
        sendJson(res, 200, { contributors: rows });
        return;
      }
      throw new Error('Unknown request.');
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }
    const user = await requireAuthenticatedUser(req);
    const role = await roleFor(user.uid);
    const body = await readBody(req);
    const action = String(body.action || '');

    if (action === 'delete') {
      if (role !== 'owner') throw new Error('Owner access is required to delete questions.');
      const post = await findPost(String(body.postId || ''));
      if (!post) throw new Error('Question not found.');
      const submissions = await sql`
        select file_path from public.daily_submissions where post_id = ${post.id}
      `;
      await sql.begin(async (transaction) => {
        await transaction`delete from public.daily_submissions where post_id = ${post.id}`;
        await transaction`delete from public.daily_posts where id = ${post.id}`;
      });

      const paths = [...new Set([
        post.question_file_path,
        post.solution_file_path,
        ...submissions.map((row) => row.file_path),
      ].filter(Boolean))];
      let cleanupWarning = false;
      if (paths.length) {
        try {
          const bucket = questionStorage();
          for (let index = 0; index < paths.length; index += 100) {
            const { error } = await bucket.remove(paths.slice(index, index + 100));
            if (error) throw error;
          }
        } catch (error) {
          console.error('Daily question attachment cleanup failed:', error);
          cleanupWarning = true;
        }
      }
      sendJson(res, 200, { ok: true, cleanupWarning });
      return;
    }

    if (action === 'grant' || action === 'revoke') {
      if (role !== 'owner') throw new Error('Owner access is required.');
      const uid = cleanText(body.uid, 128);
      if (!uid || !/^[A-Za-z0-9_-]+$/.test(uid)) throw new Error('Enter a valid Firebase UID.');
      if (action === 'grant') {
        const name = cleanText(body.displayName, 100);
        await sql`
          insert into public.daily_contributors (firebase_uid, display_name, active)
          values (${uid}, ${name}, true)
          on conflict (firebase_uid) do update set display_name = excluded.display_name, active = true
        `;
      } else {
        await sql`update public.daily_contributors set active = false where firebase_uid = ${uid}`;
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (action === 'create') {
      if (!role) throw new Error('Poster access is required.');
      const title = cleanText(body.title, 160);
      const subject = cleanText(body.subject, 80);
      const question = cleanText(body.questionText, 10_000);
      const date = cleanText(body.publishDate, 10);
      if (!title || !validDate(date)) throw new Error('A title and valid date are required.');
      const rows = await sql`
        insert into public.daily_posts (author_uid, title, subject, question_text, publish_date)
        values (${user.uid}, ${title}, ${subject}, ${question}, ${date}::date)
        returning *
      `;
      sendJson(res, 200, { post: managedPost(rows[0]) });
      return;
    }

    if (action === 'submit') {
      const post = await findPost(String(body.postId || ''));
      if (!post || !post.published_at || dateString(post.publish_date) > todaySydney()) {
        throw new Error('This question is not open for answers.');
      }
      const answer = cleanText(body.answerText, 10_000);
      const attachment = filePath(body.filePath, `answers/${post.id}/${user.uid}/`);
      if (!answer && !attachment) throw new Error('Write an answer or attach a file.');
      await sql`
        insert into public.daily_submissions (post_id, student_uid, answer_text, file_path, file_name)
        values (${post.id}, ${user.uid}, ${answer}, ${attachment}, ${attachment ? fileName(body.fileName) : null})
      `;
      sendJson(res, 200, { ok: true });
      return;
    }

    const post = await findPost(String(body.postId || ''));
    if (!post || !canManage(post, user.uid, role)) throw new Error('Poster access is required.');

    if (action === 'update') {
      const title = cleanText(body.title, 160);
      const subject = cleanText(body.subject, 80);
      const question = cleanText(body.questionText, 10_000);
      const solution = cleanText(body.solutionText, 20_000);
      const date = cleanText(body.publishDate, 10);
      if (!title || !validDate(date)) throw new Error('A title and valid date are required.');
      if (post.published_at && (title !== post.title || subject !== post.subject || question !== post.question_text || date !== dateString(post.publish_date))) {
        throw new Error('Published questions cannot be changed. Create a new draft instead.');
      }
      const questionPath = filePath(body.questionFilePath, `posts/${post.id}/question/`);
      const solutionPath = filePath(body.solutionFilePath, `posts/${post.id}/solution/`);
      if (post.published_at && questionPath !== post.question_file_path) throw new Error('Published question files cannot be changed.');
      if (post.solution_released_at && (solution !== post.solution_text || solutionPath !== post.solution_file_path)) {
        throw new Error('Released solutions cannot be changed.');
      }
      const rows = await sql`
        update public.daily_posts
        set title = ${title}, subject = ${subject}, question_text = ${question},
            publish_date = ${date}::date,
            question_file_path = ${questionPath}, question_file_name = ${questionPath ? fileName(body.questionFileName) : null},
            solution_text = ${solution},
            solution_file_path = ${solutionPath}, solution_file_name = ${solutionPath ? fileName(body.solutionFileName) : null},
            updated_at = now()
        where id = ${post.id}
        returning *
      `;
      sendJson(res, 200, { post: managedPost(rows[0]) });
      return;
    }
    if (action === 'publish') {
      if (!post.question_text.trim() && !post.question_file_path) throw new Error('Add a question or attachment first.');
      const rows = await sql`
        update public.daily_posts set published_at = coalesce(published_at, now()), updated_at = now()
        where id = ${post.id} returning *
      `;
      sendJson(res, 200, { post: managedPost(rows[0]) });
      return;
    }
    if (action === 'release') {
      if (!post.published_at || (!post.solution_text.trim() && !post.solution_file_path)) {
        throw new Error('Publish the question and add a solution first.');
      }
      const rows = await sql`
        update public.daily_posts set solution_released_at = coalesce(solution_released_at, now()), updated_at = now()
        where id = ${post.id} returning *
      `;
      sendJson(res, 200, { post: managedPost(rows[0]) });
      return;
    }
    throw new Error('Unknown action.');
  } catch (error) {
    const message = error?.code === '23505'
      ? 'That subject already has a question for that day, or you have already submitted an answer.'
      : String(error?.message || 'The request could not be completed.');
    sendJson(res, errorStatus(error), { error: message });
  }
}
