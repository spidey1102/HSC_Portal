import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, requireAuthenticatedUser } from './lib/firebaseAdmin.js';
import {
  extractFullPaperText,
  getPaperSourceFingerprint,
  loadPaperRecord,
} from './agent/paper-context.js';
import { getCompletionRoute, isRetryableProviderStatus, userSafeProviderError } from '../openRouterRouting.js';

export const maxDuration = 60;

const PAPER_ID_FIELDS = ['v', 's', 'l', 'c', 'y', 'h', 'w', 'n'];
const METADATA_COLLECTION = 'paperMetadata';
const EXTRACTION_VERSION = 'question-marks-v2-challenge';
const ANALYSIS_LOCK_MS = 2 * 60 * 1000;
const MAX_ANALYSIS_TEXT_CHARS = 150000;
const MAX_ANALYSIS_OUTPUT_TOKENS = 8000;

// The whole request has to finish inside maxDuration. Reserve a margin so a slow
// provider is reported as a timeout instead of the runtime killing the function
// mid-write and leaving the shared document locked as 'analysing'.
const FUNCTION_BUDGET_MS = 54 * 1000;
const RESPONSE_RESERVE_MS = 3 * 1000;
const MIN_PROVIDER_TIMEOUT_MS = 8 * 1000;
const ANALYSIS_PROVIDER_TIMEOUT_MS = 45 * 1000;
const MAX_JSON_REPAIR_STEPS = 400;

function remainingBudgetMs(startedAt) {
  return FUNCTION_BUDGET_MS - RESPONSE_RESERVE_MS - (Date.now() - startedAt);
}

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

const CHALLENGE_LEVELS = new Set(['routine', 'challenging', 'stretch']);
const CHALLENGE_REASON_CODES = new Set([
  'unfamiliar-context',
  'multi-step-reasoning',
  'cross-topic-synthesis',
  'data-interpretation',
  'common-misconception',
  'non-routine-method',
  'extended-response',
]);

function normaliseChallenge(rawChallenge) {
  const level = CHALLENGE_LEVELS.has(rawChallenge?.level) ? rawChallenge.level : 'routine';
  const reasons = (Array.isArray(rawChallenge?.reasons) ? rawChallenge.reasons : [])
    .map((reason) => String(reason || '').trim())
    .filter((reason, index, all) => CHALLENGE_REASON_CODES.has(reason) && all.indexOf(reason) === index)
    .slice(0, 2);
  const note = String(rawChallenge?.note || '').trim().replace(/\s+/g, ' ').slice(0, 220);

  return { level, reasons, note };
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

  const marks = normaliseNumber(rawQuestion?.marks);
  const subpartMarks = subparts.reduce((sum, subpart) => sum + (subpart.marks ?? 0), 0);

  return {
    id: normaliseQuestionId(rawQuestion?.id || rawQuestion?.number || rawQuestion?.label, index),
    // A paper that prints marks only against its parts still has a known question total.
    marks: marks ?? (subpartMarks > 0 ? subpartMarks : null),
    page: normaliseNumber(rawQuestion?.page),
    subparts,
    challenge: normaliseChallenge(rawQuestion?.challenge),
  };
}

// Questions read out of a PDF arrive in whatever order the model emitted them.
// Sort on the leading number so "10" follows "9" rather than "1".
function questionOrder(id) {
  const match = String(id).match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function trimJsonTail(text) {
  return text.replace(/[\s,]+$/, '');
}

// Returns the closing brackets needed to balance a JSON fragment, ignoring
// braces that appear inside string literals.
function closeOpenStructures(text) {
  const stack = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') stack.push('}');
    else if (char === '[') stack.push(']');
    else if (char === '}' || char === ']') stack.pop();
  }

  if (inString) stack.push('"');
  return stack.reverse().join('');
}

function parseJsonAnswer(answer) {
  const clean = String(answer || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const first = clean.indexOf('{');
  if (first === -1) {
    throw new Error('The analysis response was not valid JSON.');
  }

  const last = clean.lastIndexOf('}');
  if (last > first) {
    try {
      return JSON.parse(clean.slice(first, last + 1));
    } catch (error) {
      // A response cut off by the output ceiling is repaired below rather than lost.
    }
  }

  // Every question emitted before the cut is still usable, so step back to the
  // last complete value and close the structures that were left open.
  let body = trimJsonTail(clean.slice(first));
  for (let attempt = 0; attempt < MAX_JSON_REPAIR_STEPS && body.length > 1; attempt += 1) {
    try {
      return JSON.parse(`${body}${closeOpenStructures(body)}`);
    } catch (error) {
      // Fall through and drop the incomplete trailing value.
    }
    const cut = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
    if (cut <= 0) break;
    body = trimJsonTail(body.slice(0, cut));
  }

  throw new Error('The analysis response was not valid JSON.');
}

function normaliseAnalysis(answer, sourceFingerprint) {
  const parsed = parseJsonAnswer(answer);
  const questions = (Array.isArray(parsed?.questions) ? parsed.questions : [])
    .map(normaliseQuestion)
    .filter((question, index, all) => question.id && all.findIndex((candidate) => candidate.id === question.id) === index)
    .sort((left, right) => questionOrder(left.id) - questionOrder(right.id)
      || String(left.id).localeCompare(String(right.id)))
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

const PAPER_CATEGORY_LABELS = { H: 'official HSC paper', T: 'school trial paper', A: 'assessment task', O: 'resource' };

function buildAnalysisPrompt(paper, paperText) {
  return [
    'You extract the structure of NSW HSC past papers. Return JSON only, with no markdown or commentary.',
    'Identify each top-level numbered question exactly once. For each, extract its printed marks where reliably stated, its PDF page number, direct subparts only where their labels and marks are explicit, and a compact challenge classification.',
    'Classify the question itself, not the student. Use challenge.level "routine" for ordinary single-step practice, "challenging" when careful application or more than one step is required, and "stretch" only when the question is unusually difficult, non-routine, or deliberately unfamiliar for this course.',
    'For every substantive HSC-style paper, identify at least one strongest question as "challenging" or "stretch". Choose the question with the most demanding reasoning, application, or marks; do not mark every substantive question routine merely because the paper is broadly accessible.',
    'For challenge.reasons, select zero to two exact codes only from: unfamiliar-context, multi-step-reasoning, cross-topic-synthesis, data-interpretation, common-misconception, non-routine-method, extended-response. challenge.note must be one plain, factual sentence of no more than 24 words explaining the selection, or an empty string for routine questions.',
    'Do not invent marks. Use null when a mark cannot be established. Do not treat instructions, multiple-choice option labels, tables, source labels, or section headings as questions.',
    'For a question with subparts, preserve the top-level question as one item; only use subparts for a, b, i, ii style labels. totalMarks should be the printed paper total if stated, otherwise the sum of reliable top-level marks, otherwise null.',
    'Use this exact shape: {"totalMarks":number|null,"confidence":"high"|"medium"|"low","notes":"short caveat or empty string","questions":[{"id":"1","marks":number|null,"page":number|null,"subparts":[{"id":"a","marks":number|null,"page":number|null}],"challenge":{"level":"routine"|"challenging"|"stretch","reasons":["unfamiliar-context"],"note":"short explanation or empty string"}}]}.',
    '',
    `Paper: ${paper.n}`,
    `Source category: ${PAPER_CATEGORY_LABELS[paper.c] || 'unknown'}`,
    paper.w === 1
      ? 'This file also contains marking guidelines or worked solutions. Extract the question paper only, and never treat a solution heading as a separate question.'
      : '',
    'PDF text follows, grouped by page:',
    paperText.slice(0, MAX_ANALYSIS_TEXT_CHARS),
  ].join('\n');
}

class PaperAnalysisProviderError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'PaperAnalysisProviderError';
    this.status = Number(status) || 500;
  }
}

async function requestPaperAnalysis({ prompt, apiKey, route, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const completionRoute = getCompletionRoute({
      route,
      keySelection: { source: 'server' },
    });
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hscportal.pages.dev',
        'X-Title': 'HSC Portal paper metadata cache',
      },
      signal: controller.signal,
      body: JSON.stringify({
        ...completionRoute,
        messages: [
          { role: 'system', content: 'Return only strictly valid JSON. Never include markdown fences.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: MAX_ANALYSIS_OUTPUT_TOKENS,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    const raw = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      // Never expose raw provider payloads through this shared public route.
    }

    if (!response.ok) {
      const providerMessage = payload?.error?.message || `The paper analysis provider returned status ${response.status}.`;
      throw new PaperAnalysisProviderError(
        response.status,
        userSafeProviderError(response.status, providerMessage),
      );
    }

    const answer = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!answer) throw new Error('The paper analysis provider returned no result.');
    return answer;
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new Error('The paper analysis provider took too long to respond. Please retry this paper.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function callPaperAnalysis(prompt, { timeoutMs = ANALYSIS_PROVIDER_TIMEOUT_MS } = {}) {
  const apiKey = String(process.env.OPENROUTER_API_KEY || '').trim();
  if (!apiKey) throw new Error('The portal AI key is not configured for paper analysis.');

  const deadline = Date.now() + timeoutMs;
  try {
    return await requestPaperAnalysis({
      prompt,
      apiKey,
      route: 'paperMetadataPrimary',
      timeoutMs,
    });
  } catch (error) {
    // The alternate Flash Lite model has a separate model quota. Retrying is only
    // appropriate when OpenRouter reports an immediate quota or provider failure;
    // a timeout or malformed answer should be reported as-is.
    const remainingMs = deadline - Date.now();
    if (!isRetryableProviderStatus(error?.status) || remainingMs < MIN_PROVIDER_TIMEOUT_MS) throw error;

    return requestPaperAnalysis({
      prompt,
      apiKey,
      route: 'paperMetadataFallback',
      timeoutMs: remainingMs,
    });
  }
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
    error: data?.status === 'error' ? String(data?.errorMessage || 'The last analysis of this paper failed.') : '',
  };
}

function isCurrentCacheEntry(data, sourceFingerprint) {
  return data?.sourceFingerprint === sourceFingerprint
    && data?.extractionVersion === EXTRACTION_VERSION;
}

async function readMetadata({ paper, sourceFingerprint }) {
  const db = getAdminFirestore();
  const ref = db.collection(METADATA_COLLECTION).doc(metadataDocumentId(paper));
  const snapshot = await ref.get();
  if (!snapshot.exists) return { ref, data: null, failure: null };

  const data = snapshot.data();
  if (!isCurrentCacheEntry(data, sourceFingerprint)) return { ref, data: null, failure: null };
  if (data?.status === 'ready') return { ref, data, failure: null };
  // A recorded failure is reported so the reader can show why, rather than looking
  // like a paper that has simply never been analysed.
  if (data?.status === 'error') return { ref, data: null, failure: data };
  return { ref, data: null, failure: null };
}

export default async function handler(req, res) {
  // Only a request that successfully claimed a fresh analysis may mark its document
  // as failed. This prevents auth, lookup, or response errors from corrupting an
  // already-ready shared cache entry.
  let claimedAnalysisRef = null;
  const requestStartedAt = Date.now();

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
      if (initial.failure) {
        sendJson(res, 200, publicMetadata(initial.failure));
        return;
      }
      sendJson(res, 404, { status: 'missing', cached: false, error: 'No shared question-and-mark analysis exists for this paper yet.' });
      return;
    }

    const db = getAdminFirestore();
    const ref = initial.ref;
    const now = Date.now();
    const claim = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(ref);
      const data = current.exists ? current.data() : null;
      if (data?.status === 'ready' && isCurrentCacheEntry(data, sourceFingerprint)) {
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
        errorMessage: FieldValue.delete(),
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

    claimedAnalysisRef = ref;
    const extracted = await extractFullPaperText(paper, { timeoutMs: remainingBudgetMs(requestStartedAt) });
    if (extracted.status !== 'ready' || !extracted.text) {
      throw new Error(extracted.reason || 'The PDF does not expose readable text for question extraction.');
    }

    const providerTimeoutMs = Math.max(remainingBudgetMs(requestStartedAt), MIN_PROVIDER_TIMEOUT_MS);
    const answer = await callPaperAnalysis(
      buildAnalysisPrompt(paper, extracted.text),
      { timeoutMs: providerTimeoutMs },
    );
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
    claimedAnalysisRef = null;
    sendJson(res, 200, publicMetadata({ ...analysis, paperKey: paperIdentity(paper) }, { cached: false }));
  } catch (error) {
    if (claimedAnalysisRef) {
      try {
        if (Number(error?.status) === 429) {
          // Quota exhaustion is transient. Clear the claim rather than turning it
          // into a shared cached failure that would block a later student retry.
          await claimedAnalysisRef.set({
            status: 'missing',
            analysisStartedAtMillis: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        } else {
          await claimedAnalysisRef.set({
            status: 'error',
            errorMessage: String(error?.message || 'The shared paper analysis could not be completed.').slice(0, 500),
            analysisStartedAtMillis: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      } catch (recordError) {
        // Preserve the original failure for the client even if error recording is unavailable.
      }
    }

    const status = /Sign in is required|sign-in session/i.test(String(error?.message || ''))
      ? 401
      : Number(error?.status) === 429 ? 429 : 500;
    sendJson(res, status, { error: error?.message || 'The shared paper analysis could not be completed.' });
  }
}

export { metadataDocumentId, normaliseAnalysis, paperIdentity };
