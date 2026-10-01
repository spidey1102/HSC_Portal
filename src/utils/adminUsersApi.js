function abortError() {
  const error = new Error('The request was cancelled.');
  error.name = 'AbortError';
  return error;
}

async function request(user, query, signal) {
  if (!user) throw new Error('Sign in again to inspect accounts.');
  const token = await user.getIdToken();
  if (signal?.aborted) throw abortError();

  const response = await fetch(`/api/accounts/users?${query}`, {
    method: 'GET',
    cache: 'no-store',
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'The account request could not be completed.');
  return payload;
}

export function getAdminUsers(user, { pageToken, signal } = {}) {
  const query = new URLSearchParams();
  if (pageToken) query.set('pageToken', pageToken);
  return request(user, query, signal);
}

export function getAdminUserDetail(user, uid, { signal } = {}) {
  const query = new URLSearchParams({ uid });
  return request(user, query, signal);
}

export function getAdminUserActivity(user, uid, section, offset, { signal } = {}) {
  const query = new URLSearchParams({ uid, section, offset: String(offset) });
  return request(user, query, signal);
}
