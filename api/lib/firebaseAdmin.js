import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

const IDENTITY_LOOKUP_TIMEOUT_MS = 8 * 1000;

/**
 * Verifies the browser's Firebase ID token without loading Firebase Admin or
 * Firestore. The Firebase web API key is public by design; the Identity Toolkit
 * accepts the token only when Firebase confirms the corresponding active account.
 */
export async function requireAuthenticatedUser(req) {
  const header = String(req.headers?.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Sign in is required to continue.');

  const apiKey = String(firebaseConfig?.apiKey || '').trim();
  if (!apiKey) throw new Error('The portal authentication configuration is unavailable.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IDENTITY_LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: match[1] }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    const user = payload?.users?.[0];

    if (!response.ok || !user?.localId || user.disabled) {
      throw new Error('invalid session');
    }

    return {
      uid: String(user.localId),
      email: String(user.email || ''),
      email_verified: user.emailVerified === true,
    };
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new Error('Sign-in verification took too long. Please retry.');
    }
    throw new Error('Your sign-in session could not be verified. Please sign in again.');
  } finally {
    clearTimeout(timeout);
  }
}
