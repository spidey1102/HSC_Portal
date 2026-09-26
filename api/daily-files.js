import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { requireAuthenticatedUser } from '../server/firebaseAdmin.js';
import { getSupabaseSql } from '../server/supabaseDb.js';
import { canManage, canViewAnswers, dateString, errorStatus, findPost, readBody, roleFor, sendJson, todaySydney } from '../server/dailyPosts.js';

const BUCKET = 'daily-questions';
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const EXTENSIONS = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function storage() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('Daily question file storage is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(BUCKET);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const user = await requireAuthenticatedUser(req);
      const body = await readBody(req);
      const kind = String(body.kind || '');
      const mime = String(body.mimeType || '');
      const size = Number(body.size);
      if (!EXTENSIONS[mime] || !Number.isInteger(size) || size < 1 || size > MAX_FILE_BYTES) {
        throw new Error('Attach a PDF, JPG, PNG, or WebP file up to 20 MB.');
      }
      const post = await findPost(String(body.postId || ''));
      if (!post) throw new Error('Question not found.');
      const role = await roleFor(user.uid);
      if (kind === 'answer') {
        if (!post.published_at || dateString(post.publish_date) > todaySydney()) {
          throw new Error('This question is not open for answers.');
        }
        const sql = getSupabaseSql();
        const existing = await sql`
          select id from public.daily_submissions
          where post_id = ${post.id} and student_uid = ${user.uid} limit 1
        `;
        if (existing.length) throw new Error('You have already submitted an answer.');
      } else if (!['question', 'solution'].includes(kind) || !canManage(post, user.uid, role)) {
        throw new Error('Poster access is required.');
      }
      const path = kind === 'answer'
        ? `answers/${post.id}/${user.uid}/${randomUUID()}.${EXTENSIONS[mime]}`
        : `posts/${post.id}/${kind}/${randomUUID()}.${EXTENSIONS[mime]}`;
      const { data, error } = await storage().createSignedUploadUrl(path);
      if (error || !data?.signedUrl) throw new Error(error?.message || 'Could not prepare the upload.');
      sendJson(res, 200, { path, uploadUrl: data.signedUrl });
      return;
    }

    if (req.method === 'GET') {
      const kind = String(req.query?.kind || '');
      const post = await findPost(String(req.query?.postId || ''));
      if (!post) throw new Error('Question not found.');
      let user = null;
      let role = null;
      if (req.headers?.authorization) {
        user = await requireAuthenticatedUser(req);
        role = await roleFor(user.uid);
      }
      const managesPost = canManage(post, user?.uid, role);
      let path;
      if (kind === 'question') {
        if (!managesPost && (!post.published_at || dateString(post.publish_date) > todaySydney())) {
          throw new Error('This question is not public yet.');
        }
        path = post.question_file_path;
      } else if (kind === 'solution') {
        if (!managesPost && (!post.solution_released_at || dateString(post.publish_date) > todaySydney())) {
          throw new Error('The solution has not been released.');
        }
        path = post.solution_file_path;
      } else if (kind === 'answer') {
        if (!user || !canViewAnswers(post, user.uid, role)) throw new Error('Only this question’s poster can view submissions.');
        const sql = getSupabaseSql();
        const rows = await sql`
          select file_path from public.daily_submissions
          where id = ${String(req.query?.submissionId || '')}::uuid and post_id = ${post.id} limit 1
        `;
        path = rows[0]?.file_path;
      } else {
        throw new Error('Unknown attachment type.');
      }
      if (!path) throw new Error('There is no attachment.');
      const { data, error } = await storage().createSignedUrl(path, 60);
      if (error || !data?.signedUrl) throw new Error(error?.message || 'Could not open the attachment.');
      sendJson(res, 200, { url: data.signedUrl });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    sendJson(res, errorStatus(error), { error: String(error?.message || 'The attachment could not be opened.') });
  }
}
