import { requireAuthenticatedUser } from './firebaseAdmin.js';

/**
 * Protects a Vercel API request with the active Firebase session. The browser
 * gate is the first layer; this prevents direct requests from bypassing it.
 *
 * @returns {Promise<object|null>} verified user, or null after sending 401.
 */
export async function requireApiAuth(req, res) {
  try {
    return await requireAuthenticatedUser(req);
  } catch (error) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: error?.message || 'Sign in is required to continue.' }));
    return null;
  }
}
