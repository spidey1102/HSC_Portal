// Session storage key for active topic question queue
export const TOPIC_QUESTION_QUEUE_STORAGE_KEY = 'hsc_topic_question_queue';
export const CACHED_QUESTION_TARGET_STORAGE_KEY = 'hsc_cached_question_target';

/**
 * Normalise a question label for display (e.g. "Question 14 (b)")
 */
export function formatQuestionLabel(question) {
  if (!question) return 'Question';
  const id = String(question.id || '').trim();
  const subpart = String(question.challenge?.subpartId || question.subpartId || '').trim();
  return `Question ${id}${subpart ? ` (${subpart})` : ''}`;
}

/**
 * Extract an array of all excluded keys from an array of question results
 */
export function extractQuestionKeys(questions = []) {
  if (!Array.isArray(questions)) return [];
  return questions.map((q) => q.key || `${q.paperIdentity}::${q.question?.id}`).filter(Boolean);
}

/**
 * Save an active topic question session queue to sessionStorage
 * @param {Array} questions - list of question result objects
 * @param {number} currentIndex - index of active question
 * @param {string} topicTitle - optional topic or category name
 * @param {object} searchParams - parameters needed to fetch more questions (topic, subject, difficulty, level)
 */
export function saveTopicQuestionQueue(questions, currentIndex = 0, topicTitle = '', searchParams = null) {
  if (!Array.isArray(questions) || questions.length === 0) {
    clearTopicQuestionQueue();
    return;
  }
  try {
    const queueData = {
      questions,
      currentIndex: Math.max(0, Math.min(currentIndex, questions.length - 1)),
      topicTitle: topicTitle || questions[0]?.question?.topics?.[0] || questions[0]?.subject || 'Topic Practice',
      searchParams: searchParams || {
        topic: topicTitle || questions[0]?.question?.topics?.[0] || '',
        subject: questions[0]?.subject || '',
      },
      hasMore: true,
      updatedAt: Date.now(),
    };
    sessionStorage.setItem(TOPIC_QUESTION_QUEUE_STORAGE_KEY, JSON.stringify(queueData));
    window.dispatchEvent(new CustomEvent('hsc:topic-queue-updated', { detail: queueData }));
  } catch (err) {
    console.warn('Failed to save topic question queue:', err);
  }
}

/**
 * Load the current topic question session queue from sessionStorage
 */
export function loadTopicQuestionQueue() {
  try {
    const raw = sessionStorage.getItem(TOPIC_QUESTION_QUEUE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.questions) || parsed.questions.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Update the active index in the topic queue
 */
export function updateTopicQueueIndex(nextIndex) {
  const queue = loadTopicQuestionQueue();
  if (!queue) return null;
  const safeIndex = Math.max(0, Math.min(nextIndex, queue.questions.length - 1));
  queue.currentIndex = safeIndex;
  try {
    sessionStorage.setItem(TOPIC_QUESTION_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('hsc:topic-queue-updated', { detail: queue }));
  } catch (err) {
    console.warn('Failed to update topic question queue index:', err);
  }
  return queue;
}

/**
 * Append more questions to the active topic queue (for continuous / extended topic practice)
 */
export function appendToTopicQuestionQueue(newQuestions, hasMore = true) {
  const queue = loadTopicQuestionQueue();
  if (!queue) {
    saveTopicQuestionQueue(newQuestions);
    return;
  }
  const existingKeys = new Set(queue.questions.map((q) => q.key || `${q.paperIdentity}::${q.question?.id}`));
  const filteredNew = (newQuestions || []).filter((q) => !existingKeys.has(q.key || `${q.paperIdentity}::${q.question?.id}`));
  
  queue.questions = [...queue.questions, ...filteredNew];
  queue.hasMore = hasMore && filteredNew.length > 0;
  queue.updatedAt = Date.now();
  
  try {
    sessionStorage.setItem(TOPIC_QUESTION_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('hsc:topic-queue-updated', { detail: queue }));
  } catch (err) {
    console.warn('Failed to append to topic question queue:', err);
  }
  return queue;
}

/**
 * Fetches the next batch of cached questions for the current topic queue
 */
export async function fetchMoreTopicQuestions(queue) {
  if (!queue || !Array.isArray(queue.questions)) return { success: false, questions: [] };

  const existingKeys = extractQuestionKeys(queue.questions);
  const searchParams = queue.searchParams || {
    topic: queue.topicTitle || queue.questions[0]?.question?.topics?.[0] || '',
    subject: queue.questions[0]?.subject || '',
  };

  try {
    const response = await fetch('/api/agent-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'search_cached_questions',
        search: {
          topic: searchParams.topic || '',
          subject: searchParams.subject || '',
          difficulty: searchParams.difficulty || 'any',
          level: searchParams.level || null,
          excludeQuestionKeys: existingKeys,
        },
      }),
    });

    if (!response.ok) return { success: false, questions: [] };
    const payload = await response.json();
    const newQuestions = Array.isArray(payload.questions) ? payload.questions : [];
    
    if (newQuestions.length > 0) {
      const updatedQueue = appendToTopicQuestionQueue(newQuestions, newQuestions.length >= 5);
      return { success: true, count: newQuestions.length, queue: updatedQueue };
    } else {
      // Mark hasMore as false
      const current = loadTopicQuestionQueue();
      if (current) {
        current.hasMore = false;
        sessionStorage.setItem(TOPIC_QUESTION_QUEUE_STORAGE_KEY, JSON.stringify(current));
        window.dispatchEvent(new CustomEvent('hsc:topic-queue-updated', { detail: current }));
      }
      return { success: true, count: 0, queue: current };
    }
  } catch (err) {
    console.error('Failed to fetch more topic questions:', err);
    return { success: false, questions: [] };
  }
}

/**
 * Clear the topic question queue
 */
export function clearTopicQuestionQueue() {
  try {
    sessionStorage.removeItem(TOPIC_QUESTION_QUEUE_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('hsc:topic-queue-updated', { detail: null }));
  } catch {
    // Ignore storage issues
  }
}
