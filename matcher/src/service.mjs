import { readFileSync } from 'node:fs';
import { requestGemini, validateGeminiAssessment } from './gemini.mjs';
import { pairCacheKey, validateMatchRequest, validateProfile } from './profiles.mjs';
import { chooseResult, experienceRoutes, RUBRIC_VERSION } from './rubric.mjs';

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
  timeoutMs = 3000,
  geminiEvaluator = requestGemini,
  fixtures = demoFixtures,
  logger = () => {},
} = {}) {
  if (mode !== 'auto' && mode !== 'fixture') throw new Error('MATCH_MODE must be auto or fixture');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3000) {
    throw new Error('Gemini timeout must be between 1 and 3000 milliseconds');
  }
  const cache = new Map();
  const pending = new Map();

  function fallback(profileA, profileB, routes) {
    return fixtureForPair(profileA, profileB, fixtures)
      ?? chooseResult(profileA, profileB, routes);
  }

  async function evaluate(profileA, profileB) {
    const routes = experienceRoutes(profileA, profileB);
    if (mode === 'fixture' || !apiKey) {
      return { result: fallback(profileA, profileB, routes), source: 'fallback', cacheable: true };
    }
    try {
      const raw = await withDeadline(
        (signal) => geminiEvaluator(profileA, profileB, { apiKey, model, signal }),
        timeoutMs,
      );
      const networking = validateGeminiAssessment(raw, profileA, profileB);
      const result = chooseResult(profileA, profileB, routes, networking);
      const expected = fixtureForPair(profileA, profileB, fixtures);
      if (expected && result.compatible !== expected.compatible) {
        throw new Error('Gemini contradicted a demo fixture');
      }
      return { result, source: 'gemini', cacheable: true };
    } catch {
      return { result: fallback(profileA, profileB, routes), source: 'fallback', cacheable: false };
    }
  }

  async function match(requestBody) {
    const [profileA, profileB] = validateMatchRequest(requestBody);
    const key = pairCacheKey(profileA, profileB, `${RUBRIC_VERSION}:${mode}:${model}`);
    const pair = `${profileA.userId}:${profileB.userId}`;
    if (cache.has(key)) {
      const result = cache.get(key);
      logger({ source: 'cache', pair, score: result.score });
      return { result, source: 'cache' };
    }
    if (pending.has(key)) {
      const { result } = await pending.get(key);
      logger({ source: 'cache', pair, score: result.score });
      return { result, source: 'cache' };
    }
    const work = evaluate(profileA, profileB);
    pending.set(key, work);
    try {
      const { result, source, cacheable } = await work;
      if (cacheable) cache.set(key, result);
      logger({ source, pair, score: result.score });
      return { result, source };
    } finally {
      pending.delete(key);
    }
  }

  return {
    match,
    health: () => ({
      status: 'ok',
      mode,
      geminiConfigured: Boolean(apiKey),
      model,
      rubricVersion: RUBRIC_VERSION,
    }),
  };
}
