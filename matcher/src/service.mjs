import { readFileSync } from 'node:fs';
import { requestGemini, validateGeminiAssessment, validateGeminiIntroduction } from './gemini.mjs';
import { InputError, pairCacheKey, validateMatchRequest, validateProfile } from './profiles.mjs';
import { chooseRoute, experienceRoutes, RUBRIC_VERSION } from './rubric.mjs';

const CACHE_LIMIT = 256;
const CACHE_TTL_MS = 30 * 60 * 1000;
export { MATCH_THRESHOLD } from './rubric.mjs';

export const demoFixtures = JSON.parse(
  readFileSync(new URL('../../assets/quest-demo-fixtures.json', import.meta.url), 'utf8'),
);

function fixtureForPair(profileA, profileB, fixtures) {
  if (fixtures.rubricVersion !== RUBRIC_VERSION) return null;
  const expectedA = fixtures.profiles[profileA.userId];
  const expectedB = fixtures.profiles[profileB.userId];
  if (!expectedA || !expectedB) return null;
  if (JSON.stringify(profileA) !== JSON.stringify(validateProfile(expectedA))
    || JSON.stringify(profileB) !== JSON.stringify(validateProfile(expectedB))) return null;
  return fixtures.offlineResults.find((result) =>
    result.userA === profileA.userId && result.userB === profileB.userId) ?? null;
}

async function withDeadline(operation, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Gemini deadline exceeded'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function createMatcher({
  mode = 'auto',
  apiKey = '',
  model = 'gemini-3.8-flash',
  timeoutMs = mode === 'live' ? 15000 : 3000,
  liveFallback = false,
  fallbackTimeoutMs = 3000,
  geminiEvaluator = requestGemini,
  fixtures = demoFixtures,
  logger = () => {},
  now = () => Date.now(),
} = {}) {
  if (!['auto', 'fixture', 'live'].includes(mode)) throw new Error('MATCH_MODE must be auto, fixture, or live');
  const maximumTimeoutMs = mode === 'live' ? 30000 : 15000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > maximumTimeoutMs) {
    throw new Error(`Gemini timeout must be between 1 and ${maximumTimeoutMs} milliseconds`);
  }
  if (typeof liveFallback !== 'boolean') throw new Error('liveFallback must be boolean');
  if (!Number.isInteger(fallbackTimeoutMs) || fallbackTimeoutMs < 1 || fallbackTimeoutMs > 15000) {
    throw new Error('Fallback timeout must be between 1 and 15000 milliseconds');
  }
  const fallbackEnabled = mode === 'live' && liveFallback;
  const effectiveTimeoutMs = fallbackEnabled ? Math.min(timeoutMs, fallbackTimeoutMs) : timeoutMs;
  const cache = new Map();
  const pending = new Map();
  let quotaFailure = null;

  function putCache(key, value) {
    cache.delete(key);
    // Keep live results (AI or opted-in shared templates) stable for the session.
    // This avoids repeated quota use and changing text while it is being spoken.
    cache.set(key, { value, expiresAt: mode === 'live' ? Infinity : now() + CACHE_TTL_MS });
    while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  }

  function getCache(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now()) {
      cache.delete(key);
      return null;
    }
    cache.delete(key);
    cache.set(key, entry);
    return entry.value;
  }

  function deterministicAssessment(profileA, profileB, routes, fixture) {
    if (fixture) {
      const selected = chooseRoute(profileA, profileB, routes);
      const route = selected.result.score === fixture.score ? selected.route : 'networking';
      return { result: fixture, provenance: 'fixture', route };
    }
    const selected = chooseRoute(profileA, profileB, routes);
    return { ...selected, provenance: 'rules' };
  }

  async function evaluate(profileA, profileB) {
    const routes = experienceRoutes(profileA, profileB);
    const fixture = fixtureForPair(profileA, profileB, fixtures);
    const routeScores = {
      networking: null,
      professional: routes.professional.score,
      personal: routes.personal.score,
    };
    const sharedFallback = () => ({
      // Use only the shared-experience templates, never two individual bio blurbs.
      // These rules also leave unrelated pairs unmatched, with an empty reason.
      ...chooseRoute(profileA, profileB, routes),
      source: 'fallback', provenance: 'rules', routes: routeScores, criteria: null,
      available: Boolean(fixture) || routes.professional.score > 0 || routes.personal.score > 0,
      cacheable: true,
    });
    if (mode === 'live' && !apiKey) {
      if (fallbackEnabled) return sharedFallback();
      throw new InputError('Live AI introductions require GEMINI_API_KEY on the matcher server.', 503);
    }
    if (mode === 'live' && quotaFailure?.expiresAt > now()) {
      if (fallbackEnabled) return sharedFallback();
      throw quotaFailure.error;
    }
    if (mode === 'fixture' || !apiKey) {
      const selected = deterministicAssessment(profileA, profileB, routes, fixture);
      return {
        ...selected, source: 'fallback', routes: routeScores, criteria: null,
        available: Boolean(fixture) || routes.professional.score > 0 || routes.personal.score > 0,
        cacheable: true,
      };
    }
    try {
      const raw = await withDeadline(
        (signal) => geminiEvaluator(profileA, profileB, {
          apiKey, model, signal,
          ...(mode === 'live' ? { introductionContext: {
            professional: routes.professional.score, personal: routes.personal.score,
          } } : {}),
        }),
        effectiveTimeoutMs,
      );
      const networking = validateGeminiAssessment(raw, profileA, profileB);
      const selected = chooseRoute(profileA, profileB, routes, networking);
      if (mode !== 'live' && fixture && selected.result.compatible !== fixture.compatible) {
        throw new Error('Gemini contradicted a demo fixture');
      }
      if (mode === 'live' && selected.result.compatible) {
        // Scoring still uses the rubric, but no winning rule/template supplies live prose.
        selected.result.reason = validateGeminiIntroduction(raw.introduction, profileA, profileB);
      }
      return {
        ...selected,
        source: 'gemini',
        provenance: mode === 'live' || selected.route === 'networking' ? 'gemini' : 'rules',
        routes: { ...routeScores, networking: networking.score },
        criteria: networking.criteria,
        available: true,
        cacheable: true,
      };
    } catch (error) {
      if (mode === 'live') {
        if (error.status === 429) {
          const failure = new InputError(error.dailyQuota
            ? 'Gemini daily quota is exhausted for this model. Use an available model or wait for the quota reset.'
            : 'Gemini is rate-limited. Retrying after the provider cooldown.', 429);
          failure.retryAfterMs = error.retryAfterMs || 30000;
          quotaFailure = { error: failure, expiresAt: now() + failure.retryAfterMs };
          logger({ source: 'unavailable', pair: `${profileA.userId}:${profileB.userId}`, score: null,
            errorCode: error.dailyQuota ? 'gemini-daily-quota' : 'gemini-rate-limit' });
          if (fallbackEnabled) return sharedFallback();
          throw failure;
        }
        const errorCode = error?.message === 'Gemini deadline exceeded' || error?.name === 'AbortError'
          ? 'gemini-timeout' : Number.isInteger(error?.status)
            ? `gemini-http-${error.status}` : error?.message?.startsWith('Gemini ')
              ? 'gemini-invalid-response' : 'gemini-request-failed';
        logger({ source: 'unavailable', pair: `${profileA.userId}:${profileB.userId}`, score: null, errorCode });
        if (fallbackEnabled) return sharedFallback();
        throw new InputError('AI introduction unavailable. Check the Gemini key, model, quota, or retry shortly. No scripted fallback was used.', 502);
      }
      const selected = deterministicAssessment(profileA, profileB, routes, fixture);
      return {
        ...selected, source: 'fallback', routes: routeScores, criteria: null,
        available: Boolean(fixture) || routes.professional.score > 0 || routes.personal.score > 0,
        cacheable: false,
      };
    }
  }

  async function assess(requestBody) {
    const [profileA, profileB] = validateMatchRequest(requestBody);
    const key = pairCacheKey(profileA, profileB, `${RUBRIC_VERSION}:${mode}:${model}`);
    const pair = `${profileA.userId}:${profileB.userId}`;
    const cached = getCache(key);
    if (cached) {
      logger({ source: 'cache', pair, score: cached.result.score });
      return { ...cached, source: 'cache' };
    }
    if (pending.has(key)) {
      const assessment = await pending.get(key);
      logger({ source: 'cache', pair, score: assessment.result.score });
      const { cacheable: _cacheable, ...output } = assessment;
      return { ...output, source: 'cache' };
    }
    const work = evaluate(profileA, profileB);
    pending.set(key, work);
    try {
      const assessment = await work;
      if (assessment.cacheable) {
        const { cacheable: _cacheable, ...stored } = assessment;
        putCache(key, stored);
      }
      logger({ source: assessment.source, pair, score: assessment.result.score });
      const { cacheable: _cacheable, ...output } = assessment;
      return output;
    } finally {
      pending.delete(key);
    }
  }

  async function match(requestBody) {
    const { result, source } = await assess(requestBody);
    return { result, source };
  }

  return {
    match,
    assess,
    clear: () => { cache.clear(); },
    health: () => ({
      status: 'ok',
      mode,
      geminiConfigured: Boolean(apiKey),
      model,
      rubricVersion: RUBRIC_VERSION,
      introductionMode: fallbackEnabled ? 'gemini-with-fallback' : mode === 'live' ? 'gemini-required' : 'mixed',
      fallbackAfterMs: fallbackEnabled ? effectiveTimeoutMs : null,
      introductionCache: mode === 'live' ? 'profile-keyed-session' : '30-minutes',
      geminiRateLimited: Boolean(quotaFailure?.expiresAt > now()),
    }),
  };
}
