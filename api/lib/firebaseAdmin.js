import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

const DEFAULT_DATABASE_ID = '(default)';
const APP_NAME = 'hsc-portal-server';
const IDENTITY_LOOKUP_TIMEOUT_MS = 8 * 1000;

function readServiceAccount() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be configured for the shared paper metadata cache.');
  }

  try {
    const serviceAccount = JSON.parse(raw);
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('The service-account JSON is missing required fields.');
    }
    return serviceAccount;
  } catch (error) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is invalid: ${error.message}`);
  }
}

export function getFirebaseAdminApp() {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;

  return initializeApp({ credential: cert(readServiceAccount()) }, APP_NAME);
}

export function getAdminFirestore() {
  const databaseId = String(process.env.FIREBASE_FIRESTORE_DATABASE_ID || DEFAULT_DATABASE_ID).trim();
  return getFirestore(getFirebaseAdminApp(), databaseId);
}

export async function requireAuthenticatedUser(req) {
  const header = String(req.headers?.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Sign in is required to analyse a new paper.');

  // The Firebase web API key is intentionally public and already ships with the
  // browser application. Using the documented accounts:lookup endpoint avoids the
  // Admin SDK certificate fetch that can stall a Vercel cold start for the full
  // request duration. The returned account is accepted only when Firebase confirms
  // the supplied ID token and the account is active.
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
