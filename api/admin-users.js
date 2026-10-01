import { requireAuthenticatedUser } from '../server/firebaseAdmin.js';
import { isOwner } from '../server/dailyPosts.js';
import { AdminUsersError, getAdminUserDetail, listAdminUsers } from '../server/adminUsers.js';

export const maxDuration = 30;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(payload));
}

function queryOf(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  const params = new URL(req.url || '/', 'http://localhost').searchParams;
  const query = {};
  for (const [key, value] of params) {
    if (Object.hasOwn(query, key)) {
      if (!Array.isArray(query[key])) query[key] = [query[key]];
      query[key].push(value);
    } else query[key] = value;
  }
  return query;
}

function queryValue(query, key) {
  const value = query[key];
  if (Array.isArray(value)) throw new AdminUsersError(400, `Invalid ${key} parameter.`);
  return value === undefined ? undefined : String(value);
}

function validateQuery(query) {
  const allowed = new Set(['uid', 'pageToken', 'section', 'offset']);
  for (const key of Object.keys(query)) if (!allowed.has(key)) throw new AdminUsersError(400, 'Invalid query parameter.');
  const uid = queryValue(query, 'uid');
  const pageToken = queryValue(query, 'pageToken');
  const section = queryValue(query, 'section');
  const rawOffset = queryValue(query, 'offset');
  if (uid !== undefined && (!uid || uid.length > 128 || !/^[A-Za-z0-9_-]+$/.test(uid))) {
    throw new AdminUsersError(400, 'Invalid uid parameter.');
  }
  if (pageToken !== undefined && (!pageToken || pageToken.length > 4096 || uid !== undefined || section !== undefined || rawOffset !== undefined)) {
    throw new AdminUsersError(400, 'Invalid pageToken parameter.');
  }
  if (section !== undefined && (!uid || !['submissions', 'posts'].includes(section))) {
    throw new AdminUsersError(400, 'Invalid section parameter.');
  }
  if (rawOffset !== undefined && (!uid || !section || !/^(0|[1-9]\d*)$/.test(rawOffset)
    || !Number.isSafeInteger(Number(rawOffset)) || Number(rawOffset) > Number.MAX_SAFE_INTEGER - 50)) {
    throw new AdminUsersError(400, 'Invalid offset parameter.');
  }
  return { uid, pageToken, section, offset: rawOffset === undefined ? 0 : Number(rawOffset) };
}

function authFailure(error) {
  const message = String(error?.message || 'Authentication is required.');
  if (/configuration is unavailable/i.test(message)) return new AdminUsersError(503, 'Account inspection is not configured.');
  return new AdminUsersError(401, 'A valid sign-in is required.');
}

export function createAdminUsersHandler({
  authenticate = requireAuthenticatedUser,
  ownerCheck = isOwner,
  getDetail = getAdminUserDetail,
  listUsers = listAdminUsers,
} = {}) {
  return async function adminUsersHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }
    try {
      let user;
      try {
        user = await authenticate(req);
      } catch (error) {
        throw authFailure(error);
      }
      if (!ownerCheck(user.uid)) throw new AdminUsersError(403, 'Owner access is required.');
      const query = validateQuery(queryOf(req));
      const response = query.uid
        ? await getDetail(query.uid, query.section || null, query.offset)
        : await listUsers({ pageToken: query.pageToken });
      sendJson(res, 200, response);
    } catch (error) {
      const status = error instanceof AdminUsersError ? error.status : 500;
      const message = error instanceof AdminUsersError ? error.message : 'Account inspection could not be completed.';
      sendJson(res, status, { error: message });
    }
  };
}

const handler = createAdminUsersHandler();
export default handler;
