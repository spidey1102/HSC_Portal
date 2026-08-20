import { requireAuthenticatedUser } from './lib/firebaseAdmin.js';
import { getUserData, saveUserData } from '../server/portalStorage.js';

export const maxDuration = 30;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('The sync payload was not valid JSON.');
  }
}

function safeUserData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The sync payload must be an object.');
  }
  // Keep the payload intentionally bounded. User data is a small settings/history
  // document, not a place for PDFs, AI output, or arbitrary uploaded content.
  if (JSON.stringify(value).length > 1_000_000) {
    throw new Error('The synced study data is too large.');
  }
  return value;
}

export default async function handler(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const user = await requireAuthenticatedUser(req);
    if (req.method === 'GET') {
      const data = await getUserData(user.uid);
      sendJson(res, 200, { data });
      return;
    }

    const body = await readJsonBody(req);
    const data = safeUserData(body?.data);
    const saved = await saveUserData(user.uid, data);
    sendJson(res, 200, saved);
  } catch (error) {
    const message = String(error?.message || 'The study data could not be synchronised.');
    const status = /sign in|required|session/i.test(message) ? 401 : 400;
    sendJson(res, status, { error: message });
  }
}
