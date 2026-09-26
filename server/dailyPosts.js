import { getSupabaseSql } from './supabaseDb.js';

export const todaySydney = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export function isOwner(uid) {
  return String(process.env.DAILY_POST_OWNER_UIDS || '')
    .split(',').map((part) => part.trim()).filter(Boolean).includes(String(uid));
}

export async function roleFor(uid) {
  if (!uid) return null;
  if (isOwner(uid)) return 'owner';
  const sql = getSupabaseSql();
  const rows = await sql`
    select active from public.daily_contributors where firebase_uid = ${uid} limit 1
  `;
  return rows[0]?.active ? 'poster' : null;
}

export function canManage(post, uid, role) {
  return role === 'owner' || (role === 'poster' && post?.author_uid === uid);
}

export function canViewAnswers(post, uid, role) {
  return Boolean(role && uid && post?.author_uid === uid);
}

export function validDate(value) {
  const date = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function dateString(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
}

export function publicPost(row) {
  const released = Boolean(row.solution_released_at);
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    questionText: row.question_text,
    questionFileName: row.question_file_name,
    hasQuestionFile: Boolean(row.question_file_path),
    questionIsImage: /\.(?:jpe?g|png|webp)$/i.test(row.question_file_path || ''),
    publishDate: dateString(row.publish_date),
    solutionReleased: released,
    solutionText: released ? row.solution_text : '',
    solutionFileName: released ? row.solution_file_name : null,
    hasSolutionFile: released && Boolean(row.solution_file_path),
    solutionIsImage: released && /\.(?:jpe?g|png|webp)$/i.test(row.solution_file_path || ''),
  };
}

export function managedPost(row) {
  return {
    ...publicPost(row),
    authorUid: row.author_uid,
    questionFilePath: row.question_file_path,
    solutionText: row.solution_text,
    solutionFilePath: row.solution_file_path,
    published: Boolean(row.published_at),
  };
}

export async function findPost(id) {
  const sql = getSupabaseSql();
  const rows = await sql`select * from public.daily_posts where id = ${id}::uuid limit 1`;
  return rows[0] || null;
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    const raw = typeof req.body === 'string' || Buffer.isBuffer(req.body)
      ? String(req.body)
      : JSON.stringify(req.body);
    if (raw.length > 100_000) throw new Error('Request is too large.');
    return JSON.parse(raw || '{}');
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 100_000) throw new Error('Request is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export function cleanText(value, max) {
  const result = String(value || '').trim();
  if (result.length > max) throw new Error(`Text must be under ${max} characters.`);
  return result;
}

export function filePath(value, prefix) {
  if (value == null || value === '') return null;
  const path = String(value);
  if (!path.startsWith(prefix) || !/^[-/a-zA-Z0-9_.]+$/.test(path) || path.includes('..')) {
    throw new Error('Invalid attachment. Please upload it again.');
  }
  return path;
}

export function fileName(value) {
  return value ? cleanText(value, 180).replace(/[\\/]/g, '_') : null;
}

export function errorStatus(error) {
  if (error?.code === '23505') return 409;
  if (error?.code === '22P02') return 400;
  return /sign in|session/i.test(String(error?.message || '')) ? 401 : 400;
}
