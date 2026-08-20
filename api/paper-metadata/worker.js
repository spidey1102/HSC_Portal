import { requireAuthenticatedUser } from '../lib/firebaseAdmin.js';
import { getPaperMetadata } from '../lib/portalStorage.js';
import {
  getPaperSourceFingerprint,
  loadPaperRecord,
} from '../lib/paperSource.js';
import {
  metadataDocumentId,
  runPaperAnalysisWorker,
} from '../paper-metadata.js';

// This route is intentionally separate from the job-claim endpoint. It may use
// the full Vercel Hobby limit while the reader polls the shared Supabase status.
export const maxDuration = 300;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    await requireAuthenticatedUser(req);
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const paperId = requestUrl.searchParams.get('paperId');
    const paperName = requestUrl.searchParams.get('paperName');
    if (!paperId) {
      sendJson(res, 400, { error: 'paperId is required.' });
      return;
    }

    const paper = loadPaperRecord(paperId, paperName);
    if (!paper?.cf) {
      sendJson(res, 404, { error: 'The requested paper cannot be analysed.' });
      return;
    }

    const sourceFingerprint = getPaperSourceFingerprint(paper);
    const data = await getPaperMetadata(metadataDocumentId(paper));
    if (data?.status !== 'analysing' || data?.sourceFingerprint !== sourceFingerprint) {
      sendJson(res, 202, { status: data?.status || 'missing', started: false });
      return;
    }

    // The caller does not wait for this response; its purpose is to give the
    // long-running job its own invocation and duration budget.
    await runPaperAnalysisWorker({
      paper,
      sourceFingerprint,
      requestStartedAt: Date.now(),
    });
    sendJson(res, 200, { status: 'finished' });
  } catch (error) {
    const status = /Sign in is required|sign-in session/i.test(String(error?.message || '')) ? 401 : 500;
    sendJson(res, status, { error: error?.message || 'The analysis worker could not start.' });
  }
}
