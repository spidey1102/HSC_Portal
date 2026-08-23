const STORAGE_PREFIX = 'hsc_agent_conversation_v1';

const MAX_STORED_MESSAGES = 30;
const MAX_STORED_CHARACTERS = 30000;
const MAX_CONTEXT_MESSAGES = 12;
const MAX_CONTEXT_CHARACTERS = 12000;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normaliseQuestionResults(value) {
  return (Array.isArray(value) ? value : [])
    .map((result) => ({
      key: String(result?.key || '').trim().slice(0, 420),
      paperIdentity: String(result?.paperIdentity || '').trim().slice(0, 420),
      paperName: String(result?.paperName || '').trim().slice(0, 180),
      paperYear: Number.isFinite(Number(result?.paperYear)) ? Number(result.paperYear) : null,
      subject: String(result?.subject || '').trim().slice(0, 80),
      school: String(result?.school || '').trim().slice(0, 120),
      question: {
        id: String(result?.question?.id || '').trim().slice(0, 32),
        page: Number.isInteger(Number(result?.question?.page)) ? Number(result.question.page) : null,
        marks: result?.question?.marks === null || result?.question?.marks === undefined ? null : Number(result.question.marks),
        topics: (Array.isArray(result?.question?.topics) ? result.question.topics : []).map((topic) => String(topic || '').trim().slice(0, 48)).filter(Boolean).slice(0, 3),
        skill: String(result?.question?.skill || '').trim().slice(0, 120),
        commandVerb: String(result?.question?.commandVerb || '').trim().slice(0, 32),
        challenge: {
          level: ['routine', 'challenging', 'stretch'].includes(String(result?.question?.challenge?.level || '')) ? result.question.challenge.level : 'routine',
          subpartId: String(result?.question?.challenge?.subpartId || '').trim().slice(0, 20),
        },
      },
    }))
    .filter((result) => result.key && result.paperIdentity && result.question.id && Number.isInteger(result.question.page) && result.question.page > 0)
    .slice(0, 5);
}

function normaliseMessages(messages, { maxMessages, maxCharacters }) {
  const valid = (Array.isArray(messages) ? messages : [])
    .filter((message) => message && ['user', 'assistant'].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content || '').trim().slice(0, 8000),
      questionResults: normaliseQuestionResults(message.questionResults),
    }))
    .filter((message) => message.content)
    .slice(-maxMessages);

  const kept = [];
  let characters = 0;
  for (let index = valid.length - 1; index >= 0; index -= 1) {
    const message = valid[index];
    if (characters + message.content.length > maxCharacters && kept.length > 0) break;
    kept.push(message);
    characters += message.content.length;
  }
  return kept.reverse();
}

export function getConversationStorageKey(scope = 'general') {
  return `${STORAGE_PREFIX}:${encodeURIComponent(String(scope || 'general'))}`;
}

export function loadConversation(scope) {
  if (!canUseStorage()) return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(getConversationStorageKey(scope)) || '[]');
    return normaliseMessages(stored, {
      maxMessages: MAX_STORED_MESSAGES,
      maxCharacters: MAX_STORED_CHARACTERS,
    });
  } catch {
    return [];
  }
}

export function saveConversation(scope, messages) {
  if (!canUseStorage()) return;
  try {
    const stored = normaliseMessages(messages, {
      maxMessages: MAX_STORED_MESSAGES,
      maxCharacters: MAX_STORED_CHARACTERS,
    });
    if (stored.length === 0) {
      window.localStorage.removeItem(getConversationStorageKey(scope));
      return;
    }
    window.localStorage.setItem(getConversationStorageKey(scope), JSON.stringify(stored));
  } catch {
    // History is a convenience only; failing storage must never block study help.
  }
}

export function clearConversation(scope) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(getConversationStorageKey(scope));
  } catch {
    // Storage can be unavailable in private browsing or locked-down environments.
  }
}

export function buildConversationContext(messages) {
  return normaliseMessages(messages, {
    maxMessages: MAX_CONTEXT_MESSAGES,
    maxCharacters: MAX_CONTEXT_CHARACTERS,
  }).map(({ role, content }) => ({ role, content }));
}

export function getCachedQuestionResultKeys(messages) {
  return [...new Set((Array.isArray(messages) ? messages : [])
    .flatMap((message) => Array.isArray(message?.questionResults) ? message.questionResults : [])
    .map((result) => String(result?.key || '').trim())
    .filter(Boolean))];
}

export const AGENT_COMMAND_CONVERSATION_SCOPE = 'command-centre';

export function getPaperMarginConversationScope(paperIdentity) {
  return `paper-margin:${String(paperIdentity || 'unknown-paper')}`;
}
