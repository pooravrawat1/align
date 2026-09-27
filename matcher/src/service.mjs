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
  geminiEvaluator = requestGemini,
  fixtures = demoFixtures,
  logger = () => {},
} = {}) {
  if (!['auto', 'fixture', 'live'].includes(mode)) throw new Error('MATCH_MODE must be auto, fixture, or live');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) {
    throw new Error('Gemini timeout must be between 1 and 15000 milliseconds');
  }
  const cache = new Map();
  const pending = new Map();

  function putCache(key, value) {
    cache.delete(key);
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  }

  function getCache(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
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
    if (mode === 'live' && !apiKey) {
      throw new InputError('Live AI introductions require GEMINI_API_KEY on the matcher server.', 503);
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
        timeoutMs,
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
    } catch {
      if (mode === 'live') {
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
      introductionMode: mode === 'live' ? 'gemini-required' : 'mixed',
    }),
  };
}
