import { getPracticeBuilderSubjects } from '../server/practiceBuilder.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    const subjects = await getPracticeBuilderSubjects({ level: requestUrl.searchParams.get('level') || 12 });
    res.status(200).json({ subjects });
  } catch (error) {
    const message = error?.message || '';
    const isInputError = /^Year level/i.test(message);
    res.status(isInputError ? 400 : 500).json({
      error: isInputError ? message : 'Question-map subjects are temporarily unavailable.',
    });
  }
}
