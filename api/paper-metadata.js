import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, requireAuthenticatedUser } from './lib/firebaseAdmin.js';
import {
  extractFullPaperText,
  getPaperSourceFingerprint,
  loadPaperRecord,
} from './agent/paper-context.js';

export const maxDuration = 60;

const PAPER_ID_FIELDS = ['v', 's', 'l', 'c', 'y', 'h', 'w', 'n'];
const METADATA_COLLECTION = 'paperMetadata';
const EXTRACTION_VERSION = 'question-marks-v1';
const ANALYSIS_LOCK_MS = 6 * 60 * 1000;
const MAX_ANALYSIS_TEXT_CHARS = 150000;
const DEFAULT_MODEL = 'openrouter/free';

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function paperIdentity(paper) {
  return JSON.stringify(PAPER_ID_FIELDS.map((field) => paper?.[field]));
}

function metadataDocumentId(paper) {
  // The route identity is URL-safe and comfortably below Firestore's document-ID limit.
  return encodeURIComponent(paperIdentity(paper));
}

function normaliseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1000 ? parsed : null;
}

function normaliseQuestionId(value, fallbackIndex) {
  const id = String(value || '').trim().replace(/\s+/g, ' ');
  return id || String(fallbackIndex + 1);
}

function normaliseQuestion(rawQuestion, index) {
  const subparts = (Array.isArray(rawQuestion?.subparts) ? rawQuestion.subparts : [])
    .map((subpart, subpartIndex) => {
      const id = String(subpart?.id || subpart?.label || '').trim().replace(/\s+/g, ' ');
      if (!id) return null;
      return {
        id,
        marks: normaliseNumber(subpart?.marks),
        page: normaliseNumber(subpart?.page),
      };
    })
    .filter(Boolean);

  return {
    id: normaliseQuestionId(rawQuestion?.id || rawQuestion?.number || rawQuestion?.label, index),
    marks: normaliseNumber(rawQuestion?.marks),
    page: normaliseNumber(rawQuestion?.page),
    subparts,
  };
}

function parseJsonAnswer(answer) {
  const clean = String(answer || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const first = clean.indexOf('{');
  const last = clean.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) {
    throw new Error('The analysis response was not valid JSON.');
  }
  return JSON.parse(clean.slice(first, last + 1));
}

function normaliseAnalysis(answer, sourceFingerprint) {
  const parsed = parseJsonAnswer(answer);
  const questions = (Array.isArray(parsed?.questions) ? parsed.questions : [])
    .map(normaliseQuestion)
    .filter((question, index, all) => question.id && all.findIndex((candidate) => candidate.id === question.id) === index)
    .slice(0, 250);

  if (questions.length === 0) {
    throw new Error('No numbered questions could be identified in this paper.');
  }

  const marksFromQuestions = questions.reduce((sum, question) => sum + (question.marks ?? 0), 0);
  const suppliedTotal = normaliseNumber(parsed?.totalMarks);
  const totalMarks = suppliedTotal ?? (marksFromQuestions > 0 ? marksFromQuestions : null);

  return {
    status: 'ready',
    extractionVersion: EXTRACTION_VERSION,
    sourceFingerprint,
    questionCount: questions.length,
    totalMarks,
    questions,
    confidence: ['high', 'medium', 'low'].includes(parsed?.confidence) ? parsed.confidence : 'medium',
    notes: String(parsed?.notes || '').trim().slice(0, 1000),
  };
}

function buildAnalysisPrompt(paper, paperText) {
  return [
    'You extract the structure of NSW HSC past papers. Return JSON only, with no markdown or commentary.',
    'Identify each top-level numbered question exactly once. For each, extract its printed marks where reliably stated, its PDF page number, and direct subparts only where their labels and marks are explicit.',
    'Do not invent marks. Use null when a mark cannot be established. Do not treat instructions, multiple-choice option labels, tables, source labels, or section headings as questions.',
    'For a question with subparts, preserve the top-level question as one item; only use subparts for a, b, i, ii style labels. totalMarks should be the printed paper total if stated, otherwise the sum of reliable top-level marks, otherwise null.',
    'Use this exact shape: {"totalMarks":number|null,"confidence":"high"|"medium"|"low","notes":"short caveat or empty string","questions":[{"id":"1","marks":number|null,"page":number|null,"subparts":[{"id":"a","marks":number|null,"page":number|null}]}]}.',
    '',
    `Paper: ${paper.n}`,
    `Source category: ${paper.c || 'unknown'}`,
    'PDF text follows, grouped by page:',
    paperText.slice(0, MAX_ANALYSIS_TEXT_CHARS),
  ].join('\n');
}

async function callPaperAnalysis(prompt) {
  const apiKey = String(process.env.OPENROUTER_API_KEY || '').trim();
  if (!apiKey) throw new Error('The portal AI key is not configured for paper analysis.');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://hscportal.pages.dev',
      'X-Title': 'HSC Portal paper metadata cache',
    },
    body: JSON.stringify({
      model: String(process.env.PAPER_METADATA_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'Return only strictly valid JSON. Never include markdown fences.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 7000,
      temperature: 0,
    }),
  });

  const raw = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    // The error message below deliberately avoids exposing the raw provider response.
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message || `The paper analysis provider returned status ${response.status}.`);
  }

  const answer = String(payload?.choices?.[0]?.message?.content || '').trim();
  if (!answer) throw new Error('The paper analysis provider returned no result.');
  return answer;
}

function publicMetadata(data, { cached = true } = {}) {
  return {
    status: data?.status || 'missing',
    cached,
    paperKey: data?.paperKey || '',
    questionCount: Number(data?.questionCount) || 0,
    totalMarks: normaliseNumber(data?.totalMarks),
    questions: Array.isArray(data?.questions) ? data.questions : [],
    confidence: data?.confidence || null,
    notes: data?.notes || '',
    sourceFingerprint: data?.sourceFingerprint || '',
    extractedAt: data?.extractedAt?.toDate?.().toISOString?.() || null,
  };
}

async function readMetadata({ paper, sourceFingerprint }) {
  const db = getAdminFirestore();
  const ref = db.collection(METADATA_COLLECTION).doc(metadataDocumentId(paper));
  const snapshot = await ref.get();
  if (!snapshot.exists) return { ref, data: null };

  const data = snapshot.data();
  if (data?.status === 'ready' && data?.sourceFingerprint === sourceFingerprint) {
    return { ref, data };
  }
  return { ref, data: null };
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const paperId = requestUrl.searchParams.get('paperId');
    const paperName = requestUrl.searchParams.get('paperName');
    if (!paperId) {
      sendJson(res, 400, { error: 'paperId is required.' });
      return;
    }

    const paper = loadPaperRecord(paperId, paperName);
    if (!paper) {
      sendJson(res, 404, { error: 'The requested paper was not found in the library.' });
      return;
    }
    if (!paper.cf) {
      sendJson(res, 422, { error: 'This paper does not have a direct PDF source that can be analysed.' });
      return;
    }

    const sourceFingerprint = getPaperSourceFingerprint(paper);
    // GET is deliberately public for reusable paper structure. Every POST is an
    // analysis request and must authenticate before even returning a cache hit.
    if (req.method === 'POST') await requireAuthenticatedUser(req);

    const initial = await readMetadata({ paper, sourceFingerprint });
    if (initial.data) {
      sendJson(res, 200, publicMetadata(initial.data));
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 404, { status: 'missing', cached: false, error: 'No shared question-and-mark analysis exists for this paper yet.' });
      return;
    }

    const db = getAdminFirestore();
    const ref = initial.ref;
    const now = Date.now();
    const claim = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(ref);
      const data = current.exists ? current.data() : null;
      if (data?.status === 'ready' && data?.sourceFingerprint === sourceFingerprint) {
        return { state: 'ready', data };
      }
      const startedAtMillis = Number(data?.analysisStartedAtMillis) || 0;
      if (data?.status === 'analysing' && now - startedAtMillis < ANALYSIS_LOCK_MS) {
        return { state: 'analysing' };
      }

      transaction.set(ref, {
        paperKey: paperIdentity(paper),
        paperId: String(paper.v),
        paperName: paper.n,
        sourceFingerprint,
        extractionVersion: EXTRACTION_VERSION,
        status: 'analysing',
        analysisStartedAtMillis: now,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { state: 'claimed' };
    });

    if (claim.state === 'ready') {
      sendJson(res, 200, publicMetadata(claim.data));
      return;
    }
    if (claim.state === 'analysing') {
      sendJson(res, 202, { status: 'analysing', cached: false, retryAfterSeconds: 10 });
      return;
    }

    const extracted = await extractFullPaperText(paper);
    if (extracted.status !== 'ready' || !extracted.text) {
      throw new Error(extracted.reason || 'The PDF does not expose readable text for question extraction.');
    }

    const answer = await callPaperAnalysis(buildAnalysisPrompt(paper, extracted.text));
    const analysis = normaliseAnalysis(answer, sourceFingerprint);
    const stored = {
      ...analysis,
      paperKey: paperIdentity(paper),
      paperId: String(paper.v),
      paperName: paper.n,
      pagesAnalysed: extracted.pagesExtracted,
      totalPages: extracted.totalPages,
      analysisStartedAtMillis: FieldValue.delete(),
      extractedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await ref.set(stored, { merge: true });
    sendJson(res, 200, publicMetadata({ ...analysis, paperKey: paperIdentity(paper) }, { cached: false }));
  } catch (error) {
    try {
      const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const paper = loadPaperRecord(requestUrl.searchParams.get('paperId'), requestUrl.searchParams.get('paperName'));
      if (paper) {
        const db = getAdminFirestore();
        await db.collection(METADATA_COLLECTION).doc(metadataDocumentId(paper)).set({
          status: 'error',
          analysisStartedAtMillis: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    } catch (recordError) {
      // Preserve the original failure for the client even if error recording is unavailable.
    }

    const status = /Sign in is required|sign-in session/i.test(String(error?.message || '')) ? 401 : 500;
    sendJson(res, status, { error: error?.message || 'The shared paper analysis could not be completed.' });
  }
}

export { metadataDocumentId, normaliseAnalysis, paperIdentity };
