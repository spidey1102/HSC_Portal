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
    error: '',
  };
}

function isKnownMark(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
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
    // A recorded server-side failure is worth showing; a healthy record carries no error.
    error: data?.status === 'error' ? String(data?.error || 'The last analysis of this paper failed.') : '',
  };
}

function metadataRequestUrl(paper, suffix = '') {
  const params = new URLSearchParams({
    paperId: String(paper?.v || ''),
    paperName: String(paper?.n || ''),
  });
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

export async function analysePaperMetadata(paper, idToken) {
  const response = await fetch(metadataRequestUrl(paper), {
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
