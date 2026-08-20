/**
 * OpenRouter model and provider policy for portal-owned completions.
 *
 * A student who supplies a personal OpenRouter key retains the model they chose.
 * Requests paid for by the portal, however, must use its linked Google AI Studio
 * key and must never silently fall back to shared OpenRouter capacity.
 */
export const SHARED_OPENROUTER_MODEL = 'openrouter/free';

export const PORTAL_AI_ROUTES = Object.freeze({
  chat: Object.freeze({
    model: 'google/gemma-4-31b-it',
    provider: Object.freeze({
      only: Object.freeze(['google-ai-studio']),
      allow_fallbacks: false,
    }),
  }),
  paperMetadataPrimary: Object.freeze({
    model: 'google/gemini-3.1-flash-lite',
    provider: Object.freeze({
      only: Object.freeze(['google-ai-studio']),
      allow_fallbacks: false,
    }),
  }),
  paperMetadataFallback: Object.freeze({
    model: 'google/gemini-3.5-flash-lite',
    provider: Object.freeze({
      only: Object.freeze(['google-ai-studio']),
      allow_fallbacks: false,
    }),
  }),
});

function cleanModel(value, fallback) {
  return String(value || '').trim() || fallback;
}

/**
 * Builds the `model` and, for a portal-owned request, the strict provider lock
 * expected by OpenRouter. Personal-key requests deliberately receive no
 * provider policy and retain their requested model.
 */
export function getCompletionRoute({ route = 'chat', keySelection, requestedModel, defaultModel = SHARED_OPENROUTER_MODEL } = {}) {
  const personalModel = cleanModel(requestedModel, defaultModel);
  if (keySelection?.source !== 'server') return { model: personalModel };

  const portalRoute = PORTAL_AI_ROUTES[route];
  if (!portalRoute) throw new Error(`Unknown portal AI route: ${route}`);

  return {
    model: portalRoute.model,
    // Return a fresh value to avoid any caller mutating the shared policy.
    provider: {
      only: [...portalRoute.provider.only],
      allow_fallbacks: portalRoute.provider.allow_fallbacks,
    },
  };
}

export function isRetryableProviderStatus(status) {
  const code = Number(status);
  return code === 429 || (code >= 500 && code <= 599);
}

export function userSafeProviderError(status, fallback = 'The AI service could not complete that request.') {
  if (Number(status) === 429) {
    return 'The portal AI allowance is temporarily busy. Please try again shortly.';
  }
  return fallback;
}
