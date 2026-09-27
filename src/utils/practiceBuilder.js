import { DEFAULT_MINUTES_PER_MARK } from '../../shared/practiceBuilderConstants.js';

export { DEFAULT_MINUTES_PER_MARK };

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'The practice builder request failed.');
  return payload;
}

export async function fetchPracticeBuilderFacets(subject, level, { signal } = {}) {
  const params = new URLSearchParams({ subject, level: String(level) });
  return readResponse(await fetch(`/api/paper-metadata?practiceBuilder=1&${params}`, { signal }));
}

export async function generatePracticeSet(options, { signal } = {}) {
  return readResponse(await fetch('/api/paper-metadata?practiceBuilder=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
    signal,
  }));
}
