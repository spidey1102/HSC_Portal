import { auth } from '../lib/firebase.js';

/**
 * Fetches a protected portal API using the active Firebase session.
 * The global sign-in gate prevents normal unsigned use; this check protects
 * against expired sessions and ensures the API receives a bearer token.
 */
export async function authenticatedFetch(input, init = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in is required to continue.');

  const token = await user.getIdToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
