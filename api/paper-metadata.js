import { getDeadline } from '@vercel/functions';
import { requireAuthenticatedUser } from './lib/firebaseAdmin.js';
import {
  claimPaperAnalysis,
  completePaperAnalysis,
  getPaperMetadata,
  invalidateIncompletePaperAnalysis,
  invalidateRefreshablePaperAnalysis,
  recordPaperAnalysisFailure,
} from '../server/portalStorage.js';
import {
  getPaperSourceFingerprint,
  loadPaperRecord,
} from './lib/paperSource.js';
import { getCompletionRoute, isRetryableProviderStatus, userSafeProviderError } from '../openRouterRouting.js';

// This route only claims a shared job and returns immediately. The separate worker
// route owns the five-minute analysis allowance.
export const maxDuration = 60;

const PAPER_ID_FIELDS = ['v', 's', 'l', 'c', 'y', 'h', 'w', 'n'];
const EXTRACTION_VERSION = 'question-marks-v4-topic-labels';
const ANALYSIS_LOCK_MS = 6 * 60 * 1000;
const STUDENT_REFRESH_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const MIN_REFRESHABLE_TOTAL_MARKS = 30;
const MIN_REFRESHABLE_PAGES = 5;
const MAX_ANALYSIS_TEXT_CHARS = 150000;
const MAX_ANALYSIS_OUTPUT_TOKENS = 8000;

// The whole request has to finish inside maxDuration. Reserve a margin so a slow
// provider is reported as a timeout instead of the runtime killing the function
// mid-write and leaving the shared document locked as 'analysing'.
const FALLBACK_FUNCTION_BUDGET_MS = 294 * 1000;
const RESPONSE_RESERVE_MS = 4 * 1000;
const MIN_PROVIDER_TIMEOUT_MS = 8 * 1000;
const ANALYSIS_PROVIDER_TIMEOUT_MS = 240 * 1000;
const MAX_JSON_REPAIR_STEPS = 400;

function remainingBudgetMs(startedAt) {
  const deadline = getDeadline?.();
  if (deadline instanceof Date && Number.isFinite(deadline.getTime())) {
    return deadline.getTime() - Date.now() - RESPONSE_RESERVE_MS;
  }
  return FALLBACK_FUNCTION_BUDGET_MS - RESPONSE_RESERVE_MS - (Date.now() - startedAt);
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

const MAX_TOPIC_LABELS = 3;
const MAX_TOPIC_LABEL_LENGTH = 48;
const MAX_SKILL_LABEL_LENGTH = 88;
const COMMAND_VERBS = new Set([
  'analyse', 'assess', 'calculate', 'compare', 'construct', 'deduce', 'describe',
  'determine', 'discuss', 'evaluate', 'explain', 'identify', 'interpret', 'justify',
  'outline', 'predict', 'propose', 'show', 'solve', 'summarise',
]);

function normaliseTopicLabel(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, MAX_TOPIC_LABEL_LENGTH);
}

function normaliseTopics(value) {
  return (Array.isArray(value) ? value : [])
    .map(normaliseTopicLabel)
    .filter((topic, index, all) => topic && all.findIndex((candidate) => candidate.toLowerCase() === topic.toLowerCase()) === index)
    .slice(0, MAX_TOPIC_LABELS);
}

function normaliseCommandVerb(value) {
  const verb = String(value || '').trim().toLowerCase();
  return COMMAND_VERBS.has(verb) ? verb : '';
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

function normaliseSubpartId(value) {
  const id = String(value || '').trim().replace(/\s+/g, ' ');
  if (!id) return '';

  // Models sometimes return "(b)" or "b." even when the extracted PDF label
  // is simply "b". Store one predictable display form for matching and rendering.
  const match = id.match(/^\(?\s*([a-z]|\d+|[ivxlcdm]+)\s*\)?[.:]?$/i);
  return match ? match[1].toLowerCase() : id;
}

function normaliseChallenge(rawChallenge, subparts = []) {
  const level = CHALLENGE_LEVELS.has(rawChallenge?.level) ? rawChallenge.level : 'routine';
  const reasons = (Array.isArray(rawChallenge?.reasons) ? rawChallenge.reasons : [])
    .map((reason) => String(reason || '').trim())
    .filter((reason, index, all) => CHALLENGE_REASON_CODES.has(reason) && all.indexOf(reason) === index)
    .slice(0, 2);
  const note = String(rawChallenge?.note || '').trim().replace(/\s+/g, ' ').slice(0, 220);
  const requestedSubpartId = normaliseSubpartId(rawChallenge?.subpartId);
  const matchingSubpart = subparts.find((subpart) => (
    normaliseSubpartId(subpart?.id) === requestedSubpartId
  ));

  // Never surface an invented part label. A missing or mismatched value remains a
  // valid whole-question challenge and is deliberately rendered without brackets.
  return { level, reasons, note, subpartId: matchingSubpart?.id || '' };
}

function normaliseQuestion(rawQuestion, index) {
  const subparts = (Array.isArray(rawQuestion?.subparts) ? rawQuestion.subparts : [])
    .map((subpart, subpartIndex) => {
      const id = normaliseSubpartId(subpart?.id || subpart?.label);
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
    topics: normaliseTopics(rawQuestion?.topics),
    skill: String(rawQuestion?.skill || '').trim().replace(/\s+/g, ' ').slice(0, MAX_SKILL_LABEL_LENGTH),
    commandVerb: normaliseCommandVerb(rawQuestion?.commandVerb),
    challenge: normaliseChallenge(rawQuestion?.challenge, subparts),
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

const SUBSTANTIVE_PAPER_CATEGORIES = new Set(['H', 'T']);
const MIN_SUBSTANTIVE_QUESTION_RANGE = 4;

function questionRangeFromPaperText(paperText) {
  const questionIds = new Set();
  const text = String(paperText || '');
  const rangePattern = /\b(?:attempt|answer|complete)\s+(?:all\s+)?questions?\s+(\d{1,3})\s*(?:-|–|to)\s*(\d{1,3})\b/gi;

  for (const match of text.matchAll(rangePattern)) {
    const first = Number(match[1]);
    const last = Number(match[2]);
    if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last - first > 100) continue;
    for (let question = first; question <= last; question += 1) questionIds.add(question);
  }

  return [...questionIds].sort((left, right) => left - right);
}

function questionNumberFromId(id) {
  const match = String(id || '').match(/^\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function incompleteQuestionCoverage({ paper, paperText, questions }) {
  const expectedQuestionIds = questionRangeFromPaperText(paperText);
  if (!SUBSTANTIVE_PAPER_CATEGORIES.has(paper?.c) || expectedQuestionIds.length < MIN_SUBSTANTIVE_QUESTION_RANGE) {
    return null;
  }

  const analysedQuestionIds = new Set(questions
    .map((question) => questionNumberFromId(question.id))
    .filter(Number.isInteger));
  const covered = expectedQuestionIds.filter((questionId) => analysedQuestionIds.has(questionId)).length;
  const requiredCoverage = expectedQuestionIds.length;

  if (covered === requiredCoverage && questions.length >= requiredCoverage) return null;
  return { expectedQuestionIds, covered, requiredCoverage };
}

class IncompletePaperAnalysisError extends Error {
  constructor(coverage) {
    super(`The AI response covered only ${coverage.covered} of ${coverage.expectedQuestionIds.length} explicitly listed questions.`);
    this.name = 'IncompletePaperAnalysisError';
    this.coverage = coverage;
  }
}

function normaliseAnalysis(answer, sourceFingerprint, { paper = null, paperText = '' } = {}) {
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

  const incompleteCoverage = incompleteQuestionCoverage({ paper, paperText, questions });
  if (incompleteCoverage) throw new IncompletePaperAnalysisError(incompleteCoverage);

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
  const expectedQuestionIds = questionRangeFromPaperText(paperText);
  const coverageInstruction = expectedQuestionIds.length >= MIN_SUBSTANTIVE_QUESTION_RANGE
    ? `Completeness requirement: the paper instructions explicitly list top-level Questions ${expectedQuestionIds.join(', ')}. Return one item for every one of those question numbers, including Section I multiple-choice questions. Do not stop after Question 1 or omit a section.`
    : 'Completeness requirement: continue through every top-level numbered question visible in the question paper before returning JSON.';

  return [
    'You extract the structure of NSW HSC past papers. Return JSON only, with no markdown or commentary.',
    'Identify each top-level numbered question exactly once. For each, extract its printed marks where reliably stated, its PDF page number, every explicit direct subpart (such as a, b, c or i, ii) in printed order, each subpart’s own marks and page where reliably stated, and a compact challenge classification. Preserve a subpart even when its marks are not printed, provided its label is explicit.',
    coverageInstruction,
    'Classify the question itself, not the student. Use challenge.level "routine" for ordinary single-step practice, "challenging" when careful application or more than one step is required, and "stretch" only when the question is unusually difficult, non-routine, or deliberately unfamiliar for this course.',
    'For every substantive HSC-style paper, identify at least one strongest question as "challenging" or "stretch". Choose the question with the most demanding reasoning, application, or marks; do not mark every substantive question routine merely because the paper is broadly accessible.',
    'For question topics, provide zero to three concise syllabus-aligned labels using the course language students would search for. Examples include Equilibrium, Acid–Base Reactions, Organic Chemistry, Complex Numbers, Calculus, Texts and Human Experiences, and Module B. Do not use generic labels such as Question 5, Section II, Diagram, or Extended Response as a topic. skill is one short phrase stating the main assessed skill, such as Apply Le Chatelier’s Principle or Analyse Language Techniques; use an empty string only when no meaningful skill can be identified. commandVerb is the printed command verb in lowercase when clear, otherwise an empty string.',
    'For challenge.reasons, select zero to two exact codes only from: unfamiliar-context, multi-step-reasoning, cross-topic-synthesis, data-interpretation, common-misconception, non-routine-method, extended-response. challenge.note must be one plain, factual sentence of no more than 24 words explaining the selection, or an empty string for routine questions.',
    'Do not invent marks. Use null when a mark cannot be established. Do not treat instructions, multiple-choice option labels, tables, source labels, or section headings as questions.',
    'For a question with subparts, preserve the top-level question as one item; only use subparts for a, b, i, ii style labels. When a challenge is chiefly about one direct subpart, set challenge.subpartId to that exact extracted label. For Mathematics Extension 1 and Mathematics Extension 2 papers, every challenging or stretch recommendation with explicit lettered or roman subparts must identify the specific relevant subpart whenever one can be established. Use null only when the challenge genuinely concerns the entire top-level question or no exact direct subpart can be determined.',
    'totalMarks should be the printed paper total if stated, otherwise the sum of reliable top-level marks, otherwise null.',
    'Use this exact shape: {"totalMarks":number|null,"confidence":"high"|"medium"|"low","notes":"short caveat or empty string","questions":[{"id":"1","marks":number|null,"page":number|null,"subparts":[{"id":"a","marks":number|null,"page":number|null}],"topics":["Equilibrium"],"skill":"Apply Le Chatelier’s Principle","commandVerb":"explain","challenge":{"level":"routine"|"challenging"|"stretch","reasons":["unfamiliar-context"],"note":"short explanation or empty string","subpartId":"a"|null}}]}.',
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

function hasNoDetectedSubparts(data, paper) {
  if (data?.status !== 'ready' || !SUBSTANTIVE_PAPER_CATEGORIES.has(paper?.c)) return false;
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const hasSubparts = questions.some((question) => Array.isArray(question?.subparts) && question.subparts.length > 0);
  const totalMarks = normaliseNumber(data.totalMarks) || 0;
  const pageCount = Math.max(Number(data.pagesAnalysed) || 0, Number(data.totalPages) || 0);
  return !hasSubparts && questions.length >= MIN_SUBSTANTIVE_QUESTION_RANGE
    && (totalMarks >= MIN_REFRESHABLE_TOTAL_MARKS || pageCount >= MIN_REFRESHABLE_PAGES);
}

function refreshEligibility(data, paper) {
  if (data?.status !== 'ready') return { eligible: false, needsRefresh: false, reason: '' };
  if (!hasNoDetectedSubparts(data, paper)) return { eligible: false, needsRefresh: false, reason: '' };

  const extractedAtMillis = Date.parse(data?.extractedAt || '');
  const availableAtMillis = Number.isFinite(extractedAtMillis)
    ? extractedAtMillis + STUDENT_REFRESH_COOLDOWN_MS
    : Date.now() + STUDENT_REFRESH_COOLDOWN_MS;
  const secondsUntilAvailable = Math.max(0, Math.ceil((availableAtMillis - Date.now()) / 1000));
  if (secondsUntilAvailable > 0) {
    return {
      eligible: false,
      needsRefresh: true,
      reason: 'This Question Map was recently refreshed. Try again later.',
      retryAfterSeconds: secondsUntilAvailable,
    };
  }

  return {
    eligible: true,
    needsRefresh: true,
    reason: 'This full-paper map has no detected subparts. Refresh it to capture the printed parts.',
    retryAfterSeconds: null,
  };
}

function publicMetadata(data, { cached = true, paper = null } = {}) {
  const refresh = refreshEligibility(data, paper);
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
    extractedAt: data?.extractedAt || null,
    analysisStartedAtMillis: Number(data?.analysisStartedAtMillis) || null,
    retryAfterSeconds: data?.status === 'analysing' ? 4 : null,
    error: data?.status === 'error' ? String(data?.errorMessage || 'The last analysis of this paper failed.') : '',
    refresh,
  };
}

function isObviouslyIncompleteCachedAnalysis(data, paper) {
  if (data?.status !== 'ready' || !SUBSTANTIVE_PAPER_CATEGORIES.has(paper?.c)) return false;
  const questionCount = Number(data.questionCount) || 0;
  const totalMarks = normaliseNumber(data.totalMarks) || 0;
  const pageCount = Math.max(Number(data.pagesAnalysed) || 0, Number(data.totalPages) || 0);
  return questionCount <= 1 && (totalMarks >= 20 || pageCount >= 4);
}

function isCurrentCacheEntry(data, sourceFingerprint, paper) {
  return data?.sourceFingerprint === sourceFingerprint
    && data?.extractionVersion === EXTRACTION_VERSION
    && !isObviouslyIncompleteCachedAnalysis(data, paper);
}

async function readMetadata({ paper, sourceFingerprint }) {
  const data = await getPaperMetadata(metadataDocumentId(paper));
  if (!data) return { data: null, failure: null, incompleteReadyEntry: false };
  if (data.sourceFingerprint !== sourceFingerprint || data.extractionVersion !== EXTRACTION_VERSION) {
    return { data: null, failure: null, incompleteReadyEntry: false };
  }
  if (isObviouslyIncompleteCachedAnalysis(data, paper)) {
    return { data: null, failure: null, incompleteReadyEntry: true };
  }
  if (data.status === 'ready') return { data, failure: null, incompleteReadyEntry: false };
  if (data.status === 'analysing') {
    const startedAtMillis = Number(data.analysisStartedAtMillis) || 0;
    if (startedAtMillis && Date.now() - startedAtMillis < ANALYSIS_LOCK_MS) {
      return { data, failure: null, incompleteReadyEntry: false };
    }
    return { data: null, failure: null, incompleteReadyEntry: false };
  }
  // A recorded failure is reported so the reader can show why, rather than looking
  // like a paper that has simply never been analysed.
  if (data.status === 'error') return { data: null, failure: data, incompleteReadyEntry: false };
  return { data: null, failure: null, incompleteReadyEntry: false };
}

async function recordAnalysisFailure({ paperKey, sourceFingerprint, error }) {
  await recordPaperAnalysisFailure({
    paperKey,
    sourceFingerprint,
    error,
    // Provider throttling should release the shared job immediately so another
    // student can retry after the provider recovers.
    allowRetry: Number(error?.status) === 429,
  });
}

export async function runPaperAnalysisWorker({ paper, sourceFingerprint, requestStartedAt }) {
  try {
    // pdf.js and its worker bundle are loaded only inside the separate, long-running
    // analysis route. The short job-claim route must be able to respond before
    // these expensive modules initialise on a cold invocation.
    const { extractFullPaperText } = await import('./agent/paper-context.js');
    console.info('[paper-metadata] deferred analysis started', { paperId: String(paper.v) });
    const extractionBudgetMs = remainingBudgetMs(requestStartedAt);
    if (extractionBudgetMs < MIN_PROVIDER_TIMEOUT_MS) {
      throw new Error('The analysis job ran out of time before PDF extraction could begin. Please retry this paper.');
    }

    const extracted = await extractFullPaperText(paper, { timeoutMs: extractionBudgetMs });
    if (extracted.status !== 'ready' || !extracted.text) {
      throw new Error(extracted.reason || 'The PDF does not expose readable text for question extraction.');
    }

    const providerTimeoutMs = remainingBudgetMs(requestStartedAt);
    if (providerTimeoutMs < MIN_PROVIDER_TIMEOUT_MS) {
      throw new Error('The analysis job ran out of time before the AI response was ready. Please retry this paper.');
    }

    console.info('[paper-metadata] PDF extracted; requesting analysis', {
      paperId: String(paper.v),
      pages: extracted.pagesExtracted,
      elapsedMs: Date.now() - requestStartedAt,
    });
    const answer = await callPaperAnalysis(
      buildAnalysisPrompt(paper, extracted.text),
      { timeoutMs: providerTimeoutMs },
    );
    let analysis;
    try {
      analysis = normaliseAnalysis(answer, sourceFingerprint, { paper, paperText: extracted.text });
    } catch (error) {
      if (!(error instanceof IncompletePaperAnalysisError)) throw error;

      const retryTimeoutMs = remainingBudgetMs(requestStartedAt);
      if (retryTimeoutMs < MIN_PROVIDER_TIMEOUT_MS) throw error;
      console.warn('[paper-metadata] incomplete analysis response; retrying once', {
        paperId: String(paper.v),
        message: error.message,
      });
      const retryAnswer = await callPaperAnalysis(
        `${buildAnalysisPrompt(paper, extracted.text)}\n\nThe preceding response was rejected because it did not cover the stated question range. Re-read the complete text and return the full required JSON now.`,
        { timeoutMs: retryTimeoutMs },
      );
      analysis = normaliseAnalysis(retryAnswer, sourceFingerprint, { paper, paperText: extracted.text });
    }
    await completePaperAnalysis({
      paperKey: metadataDocumentId(paper),
      sourceFingerprint,
      analysis,
      paper,
      pagesAnalysed: extracted.pagesExtracted,
      totalPages: extracted.totalPages,
    });
    console.info('[paper-metadata] deferred analysis completed', {
      paperId: String(paper.v),
      questions: analysis.questionCount,
      elapsedMs: Date.now() - requestStartedAt,
    });
  } catch (error) {
    console.error('[paper-metadata] deferred analysis failed', {
      paperId: String(paper.v),
      message: error?.message || String(error),
      elapsedMs: Date.now() - requestStartedAt,
    });
    try {
      await recordAnalysisFailure({
        paperKey: metadataDocumentId(paper),
        sourceFingerprint,
        error,
      });
    } catch (recordError) {
      console.error('[paper-metadata] failed to record deferred analysis error', {
        paperId: String(paper.v),
        message: recordError?.message || String(recordError),
      });
    }
  }
}

export default async function handler(req, res) {
  const requestStartedAt = Date.now();
  const logPhase = (phase, details = {}) => {
    console.info('[paper-metadata] claim route phase', {
      phase,
      elapsedMs: Date.now() - requestStartedAt,
      ...details,
    });
  };

  if (!['GET', 'POST'].includes(req.method)) {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const paperId = requestUrl.searchParams.get('paperId');
    const paperName = requestUrl.searchParams.get('paperName');
    const isRefreshRequest = requestUrl.searchParams.get('refresh') === '1';
    logPhase('request received', { method: req.method, paperId: String(paperId || '') });
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
    if (req.method === 'POST') {
      logPhase('verifying token');
      await requireAuthenticatedUser(req);
      logPhase('token verified');
    }

    logPhase('reading metadata cache');
    const initial = await readMetadata({ paper, sourceFingerprint });
    logPhase('metadata cache read', { status: initial.data?.status || initial.failure?.status || 'missing' });
    if (initial.data && !(req.method === 'POST' && isRefreshRequest)) {
      sendJson(res, initial.data.status === 'analysing' ? 202 : 200, publicMetadata(initial.data, { paper }));
      return;
    }

    if (req.method === 'GET') {
      if (initial.failure) {
        sendJson(res, 200, publicMetadata(initial.failure, { paper }));
        return;
      }
      sendJson(res, 404, { status: 'missing', cached: false, error: 'No shared question-and-mark analysis exists for this paper yet.' });
      return;
    }

    if (isRefreshRequest) {
      const refresh = refreshEligibility(initial.data, paper);
      if (!refresh.eligible) {
        sendJson(res, 409, {
          error: refresh.reason || 'This Question Map is already complete enough and cannot be refreshed.',
          refresh,
        });
        return;
      }
      logPhase('invalidating refreshable ready cache');
      const invalidated = await invalidateRefreshablePaperAnalysis({
        paperKey: metadataDocumentId(paper),
        sourceFingerprint,
        cooldownMs: STUDENT_REFRESH_COOLDOWN_MS,
      });
      if (!invalidated) {
        sendJson(res, 409, { error: 'This Question Map changed before it could be refreshed. Please reopen it and try again.' });
        return;
      }
    } else if (initial.incompleteReadyEntry) {
      logPhase('invalidating incomplete ready cache');
      await invalidateIncompletePaperAnalysis({
        paperKey: metadataDocumentId(paper),
        sourceFingerprint,
      });
    }

    const now = Date.now();
    logPhase('claiming analysis job');
    const claimedData = await claimPaperAnalysis({
      paperKey: metadataDocumentId(paper),
      paperId: String(paper.v),
      paperName: paper.n,
      sourceFingerprint,
      extractionVersion: EXTRACTION_VERSION,
      analysisStartedAtMillis: now,
      lockMs: ANALYSIS_LOCK_MS,
    });

    if (!claimedData) {
      throw new Error('The shared paper analysis could not be claimed. Please retry.');
    }

    const claimState = claimedData.status === 'ready' && isCurrentCacheEntry(claimedData, sourceFingerprint, paper)
      ? 'ready'
      : claimedData.status === 'analysing'
        && Number(claimedData.analysisStartedAtMillis) !== now
        && now - Number(claimedData.analysisStartedAtMillis) < ANALYSIS_LOCK_MS
        ? 'analysing'
        : 'claimed';
    logPhase('analysis job claim completed', { state: claimState });

    if (claimState === 'ready') {
      sendJson(res, 200, publicMetadata(claimedData, { paper }));
      return;
    }
    if (claimState === 'analysing') {
      sendJson(res, 202, publicMetadata(claimedData, { paper }));
      return;
    }

    // Return before any PDF or AI work begins. The browser starts the independent
    // worker route after receiving this response, so this request cannot be held
    // open by the long-running analysis.
    sendJson(res, 202, {
      status: 'analysing',
      cached: false,
      started: true,
      analysisStartedAtMillis: now,
      retryAfterSeconds: 4,
    });
  } catch (error) {
    const isAuthenticationError = /Sign in is required|sign-in session/i.test(String(error?.message || ''));
    const isQuotaError = Number(error?.status) === 429 || Number(error?.code) === 429;
    const status = isAuthenticationError ? 401 : isQuotaError ? 429 : 500;
    const message = isQuotaError
      ? 'Paper analysis is temporarily busy. Please try again later.'
      : error?.message || 'The shared paper analysis could not be started.';
    sendJson(res, status, { error: message });
  }
}

export { metadataDocumentId, normaliseAnalysis, paperIdentity, refreshEligibility };
