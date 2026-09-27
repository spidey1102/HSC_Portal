import { createPracticeBuilderSet, getPracticeBuilderFacets } from '../server/practiceBuilder.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const payload = await getPracticeBuilderFacets({ subject: req.query?.subject, level: req.query?.level });
      res.status(200).json(payload);
      return;
    }
    if (req.method === 'POST') {
      const payload = await createPracticeBuilderSet(req.body || {});
      res.status(200).json(payload);
      return;
    }
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    const inputMessage = error?.message || '';
    const isInputError = /^(Choose|Year level|Too many)/i.test(inputMessage);
    res.status(isInputError ? 400 : 500).json({
      error: isInputError ? inputMessage : 'The practice builder is temporarily unavailable. Please try again.',
    });
  }
}
