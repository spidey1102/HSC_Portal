export function createEmptyPaperMetadata(status = 'loading') {
  return {
    status,
    cached: false,
    questionCount: 0,
    totalMarks: null,
    questions: [],
    confidence: null,
    notes: '',
    retryAfterSeconds: null,
    analysisStartedAtMillis: null,
    refresh: { eligible: false, needsRefresh: false, reason: '', retryAfterSeconds: null },
    error: '',
  };
}

function isKnownMark(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

const MAX_TOPIC_LABELS = 3;
const MAX_TOPIC_LABEL_LENGTH = 48;
const MAX_SKILL_LABEL_LENGTH = 88;
const COMMAND_VERBS = new Set([
  'analyse', 'assess', 'calculate', 'compare', 'construct', 'deduce', 'describe',
  'determine', 'discuss', 'evaluate', 'explain', 'identify', 'interpret', 'justify',
  'outline', 'predict', 'propose', 'show', 'solve', 'summarise',
]);

function normaliseTopics(value) {
  return (Array.isArray(value) ? value : [])
    .map((topic) => String(topic || '').trim().replace(/\s+/g, ' ').slice(0, MAX_TOPIC_LABEL_LENGTH))
    .filter((topic, index, all) => topic && all.findIndex((candidate) => candidate.toLowerCase() === topic.toLowerCase()) === index)
    .slice(0, MAX_TOPIC_LABELS);
}

function normaliseCommandVerb(value) {
  const verb = String(value || '').trim().toLowerCase();
  return COMMAND_VERBS.has(verb) ? verb : '';
}

function normaliseSubpartId(value) {
  const id = String(value || '').trim().replace(/\s+/g, ' ');
  const match = id.match(/^\(?\s*([a-z]|\d+|[ivxlcdm]+)\s*\)?[.:]?$/i);
  return match ? match[1].toLowerCase() : id;
}

function normaliseSubparts(value) {
  return (Array.isArray(value) ? value : [])
    .map((subpart) => ({
      id: normaliseSubpartId(subpart?.id || subpart?.label),
      marks: isKnownMark(subpart?.marks) ? Number(subpart.marks) : null,
      page: Number.isInteger(Number(subpart?.page)) && Number(subpart.page) > 0 ? Number(subpart.page) : null,
      topics: normaliseTopics(subpart?.topics),
      skill: String(subpart?.skill || '').trim().replace(/\s+/g, ' ').slice(0, MAX_SKILL_LABEL_LENGTH),
      commandVerb: normaliseCommandVerb(subpart?.commandVerb),
    }))
    .filter((subpart, index, all) => subpart.id && all.findIndex((candidate) => candidate.id === subpart.id) === index)
    .slice(0, 40);
}

const CHALLENGE_LEVELS = new Set(['routine', 'challenging', 'stretch']);
const CHALLENGE_REASONS = new Set([
  'unfamiliar-context',
  'multi-step-reasoning',
  'cross-topic-synthesis',
  'data-interpretation',
  'common-misconception',
  'non-routine-method',
  'extended-response',
]);

function normaliseQuestion(question) {
  const rawChallenge = question?.challenge || {};
  return {
    ...question,
    subparts: normaliseSubparts(question?.subparts),
    topics: normaliseTopics(question?.topics),
    skill: String(question?.skill || '').trim().replace(/\s+/g, ' ').slice(0, MAX_SKILL_LABEL_LENGTH),
    commandVerb: normaliseCommandVerb(question?.commandVerb),
    challenge: {
      level: CHALLENGE_LEVELS.has(rawChallenge.level) ? rawChallenge.level : 'routine',
      reasons: (Array.isArray(rawChallenge.reasons) ? rawChallenge.reasons : [])
        .filter((reason, index, all) => CHALLENGE_REASONS.has(reason) && all.indexOf(reason) === index)
        .slice(0, 2),
      note: String(rawChallenge.note || '').trim().slice(0, 220),
      // The server only persists a subpartId that matches an extracted direct
      // subpart. Keep it through the browser normalizer for the challenge card.
      subpartId: String(rawChallenge.subpartId || '').trim(),
    },
  };
}

function normaliseRefresh(value) {
  return {
    eligible: value?.eligible === true,
    needsRefresh: value?.needsRefresh === true,
    reason: String(value?.reason || '').trim().slice(0, 240),
    retryAfterSeconds: Number(value?.retryAfterSeconds) || null,
  };
}

function normaliseMetadata(data, { cached = true } = {}) {
  return {
    ...createEmptyPaperMetadata(data?.status || 'ready'),
    cached,
    paperKey: data?.paperKey || '',
    questionCount: Number(data?.questionCount) || 0,
    totalMarks: isKnownMark(data?.totalMarks) ? Number(data.totalMarks) : null,
    questions: Array.isArray(data?.questions) ? data.questions.map(normaliseQuestion) : [],
    confidence: data?.confidence || null,
    notes: data?.notes || '',
    sourceFingerprint: data?.sourceFingerprint || '',
    retryAfterSeconds: Number(data?.retryAfterSeconds) || null,
    analysisStartedAtMillis: Number(data?.analysisStartedAtMillis) || null,
    refresh: normaliseRefresh(data?.refresh),
    // A recorded server-side failure is worth showing; a healthy record carries no error.
    error: data?.status === 'error' ? String(data?.error || 'The last analysis of this paper failed.') : '',
  };
}

function metadataRequestUrl(paper, suffix = '', { refresh = false } = {}) {
  const params = new URLSearchParams({
    paperId: String(paper?.v || ''),
    paperName: String(paper?.n || ''),
  });
  if (refresh) params.set('refresh', '1');
  return `/api/paper-metadata${suffix}?${params.toString()}`;
}

async function readMetadataResponse(paper) {
  const response = await fetch(metadataRequestUrl(paper));
  const payload = await response.json().catch(() => ({}));

  if (response.status === 404) return createEmptyPaperMetadata('missing');
  if (!response.ok) {
    throw new Error(payload?.error || 'Paper structure could not be loaded.');
  }

  return normaliseMetadata(payload, { cached: true });
}

// Cache reads use the validated server endpoint rather than a direct Firestore read.
// This guarantees the browser reads the same named database, document identity, and
// source fingerprint as the privileged cache writer, while exposing only reusable paper structure.
export async function getPaperMetadata(paper) {
  return readMetadataResponse(paper);
}

export async function analysePaperMetadata(paper, idToken, { refresh = false } = {}) {
  const response = await fetch(metadataRequestUrl(paper, '', { refresh }), {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const payload = await response.json().catch(() => ({}));

  if (response.status === 202) {
    // The claim endpoint returns immediately. Start the long worker request without
    // awaiting it so the reader can render its elapsed analysis timer straight away.
    if (payload?.started) {
      void fetch(metadataRequestUrl(paper, '/worker'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      }).catch(() => {
        // The shared job stays marked as analysing and can be retried once its lock
        // expires if the browser loses its worker-start request.
      });
    }
    return normaliseMetadata({ ...payload, status: 'analysing' }, { cached: false });
  }
  if (!response.ok) {
    throw new Error(payload?.error || 'The paper structure could not be analysed.');
  }
  return normaliseMetadata(payload, { cached: false });
}
