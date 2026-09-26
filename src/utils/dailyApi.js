const MAX_FILE_BYTES = 20 * 1024 * 1024;
const FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

async function request(user, path, options = {}) {
  const token = user ? await user.getIdToken() : null;
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'The request could not be completed.');
  return payload;
}

export const getDaily = (user, query = '') => request(user, `/api/daily-posts${query}`);
export const postDaily = (user, body) => request(user, '/api/daily-posts', {
  method: 'POST', body: JSON.stringify(body),
});

export async function uploadDailyFile(user, postId, kind, file) {
  if (!FILE_TYPES.has(file?.type) || file.size < 1 || file.size > MAX_FILE_BYTES) {
    throw new Error('Attach a PDF, JPG, PNG, or WebP file up to 20 MB.');
  }
  const ticket = await request(user, '/api/daily-files', {
    method: 'POST',
    body: JSON.stringify({ postId, kind, mimeType: file.type, size: file.size }),
  });
  const body = new FormData();
  body.append('cacheControl', '3600');
  body.append('', file);
  const upload = await fetch(ticket.uploadUrl, {
    method: 'PUT', headers: { 'x-upsert': 'false' }, body,
  });
  if (!upload.ok) throw new Error('The attachment could not be uploaded. Please try again.');
  return { path: ticket.path, name: file.name };
}

export async function openDailyFile(user, params) {
  const popup = window.open('', '_blank');
  try {
    const query = new URLSearchParams(params);
    const payload = await request(user, `/api/daily-files?${query}`);
    if (popup) popup.location.href = payload.url;
    else window.location.href = payload.url;
  } catch (error) {
    if (popup) popup.close();
    throw error;
  }
}
