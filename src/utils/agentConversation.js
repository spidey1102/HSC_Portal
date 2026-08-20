const STORAGE_PREFIX = 'hsc_agent_conversation_v1';

const MAX_STORED_MESSAGES = 30;
const MAX_STORED_CHARACTERS = 30000;
const MAX_CONTEXT_MESSAGES = 12;
const MAX_CONTEXT_CHARACTERS = 12000;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normaliseMessages(messages, { maxMessages, maxCharacters }) {
  const valid = (Array.isArray(messages) ? messages : [])
    .filter((message) => message && ['user', 'assistant'].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content || '').trim().slice(0, 8000),
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
  });
}

export const AGENT_COMMAND_CONVERSATION_SCOPE = 'command-centre';

export function getPaperMarginConversationScope(paperIdentity) {
  return `paper-margin:${String(paperIdentity || 'unknown-paper')}`;
}
