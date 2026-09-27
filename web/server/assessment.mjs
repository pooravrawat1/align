import { createHash } from 'node:crypto';
import { createMatcher } from '../../matcher/src/service.mjs';
import { requestGemini } from '../../matcher/src/gemini.mjs';
import { MATCH_THRESHOLD, RUBRIC_VERSION } from '../../matcher/src/rubric.mjs';

export const ASSESSMENT_VERSION = `web-${RUBRIC_VERSION}-v1`;
export const CATEGORY_DEFINITIONS = [
  { id: 'skills', key: 'skillToNeed', label: 'Reciprocal skill fit', max: 30 },
  { id: 'goals', key: 'networkingGoals', label: 'Networking-goal compatibility', max: 25 },
  { id: 'projects', key: 'projectAlignment', label: 'Project/problem synergy', max: 15 },
  { id: 'mutual-value', key: 'mutualBenefit', label: 'Mutual value', max: 15 },
  { id: 'interests', key: 'sharedInterests', label: 'Shared interests', max: 10 },
  { id: 'conversation', key: 'conversationPotential', label: 'Conversation potential', max: 5 },
];
const normalize = value => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');

// This is the only web-to-matcher projection. Contact, avatar, location and notes
// never cross the matching boundary, even when shared on the full profile.
export function matchingProfile(profile, audience) {
  const visibility = profile.visibility ?? {};
  if (audience === 'event' ? visibility.activeInEvent === false : visibility.previousConnections === false) return null;
  const list = field => visibility[field] === false ? [] : (profile[field] ?? []);
  return {
    userId: profile.id, name: profile.name,
    bio: visibility.bio === false ? '' : profile.bio,
    interests: list('interests'), skills: list('skills'), lookingFor: list('lookingFor'),
    networkingGoal: list('goals').join('; ').slice(0, 240),
    domains: list('domains'), experiences: list('experiences'),
  };
}
function projectedPair(first, second, audience) {
  return [matchingProfile(first, audience), matchingProfile(second, audience)]
    .sort((a, b) => (a?.userId ?? '').localeCompare(b?.userId ?? ''));
}
export function assessmentFingerprint(first, second, { audience, eventId }) {
  return createHash('sha256').update(JSON.stringify({ version: ASSESSMENT_VERSION, audience, eventId: eventId ?? null, profiles: projectedPair(first, second, audience) })).digest('hex');
}
const commonGround = profiles => {
  if (profiles.some(profile => !profile)) return [];
  const other = new Set(profiles[1].interests.map(normalize));
  return [...new Map(profiles[0].interests.filter(item => other.has(normalize(item))).map(item => [normalize(item), item])).values()];
};
function categories(criteria) {
  return CATEGORY_DEFINITIONS.map(({ key, ...definition }) => ({ ...definition, points: criteria?.[key]?.points ?? null, evidence: criteria?.[key]?.evidence ?? '' }));
}
function unavailable(fingerprint, profiles, error = 'Compatibility analysis is temporarily unavailable.') {
  const common = commonGround(profiles).slice(0, 5);
  return { status: common.length ? 'partial' : 'unavailable', score: null, compatible: false, reason: common.length ? `You both mention ${common.join(' and ')}.` : '', commonGround: common, contributions: [], starter: '', categories: categories(null), source: 'unavailable', fingerprint, error };
}
function adapt(assessment, fingerprint, profiles) {
  if (!assessment.available) return unavailable(fingerprint, profiles);
  const common = commonGround(profiles).slice(0, 5);
  const contributions = profiles.map((profile, index) => {
    const needs = new Set(profiles[1 - index].lookingFor.map(normalize));
    return { userId: profile.userId, items: profile.skills.filter(skill => needs.has(normalize(skill))).slice(0, 5) };
  });
  return {
    status: 'ready', score: assessment.result.score, compatible: assessment.result.score >= MATCH_THRESHOLD,
    reason: assessment.result.reason || (common.length ? `You both mention ${common.join(' and ')}.` : ''),
    commonGround: common, contributions, starter: assessment.result.reason,
    categories: categories(assessment.criteria), source: assessment.provenance,
    route: assessment.route, routes: assessment.routes, fingerprint,
  };
}
export function createAssessmentService({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  const matcher = createMatcher({
    mode: env.MATCH_MODE || 'auto', apiKey: env.GEMINI_API_KEY || '', model: env.GEMINI_MODEL || 'gemini-3.8-flash',
    timeoutMs: Math.max(1, Math.min(env.MATCH_MODE === 'live' ? 30000 : 15000, Number(env.GEMINI_TIMEOUT_MS) || 15000)),
    liveFallback: env.MATCH_LIVE_FALLBACK === 'true',
    ...(env.MATCH_FALLBACK_TIMEOUT_MS ? { fallbackTimeoutMs: Number(env.MATCH_FALLBACK_TIMEOUT_MS) } : {}),
    geminiEvaluator: (first, second, options) => requestGemini(first, second, { ...options, fetchImpl }),
  });
  const fixtureMatcher = createMatcher({ mode: 'fixture' });
  const failures = new Map();
  const inFlight = new Map();
  const failureTtl = Math.max(1000, Number(env.GEMINI_FAILURE_TTL_MS) || 30000);
  return {
    clear() { failures.clear(); inFlight.clear(); matcher.clear(); fixtureMatcher.clear(); },
    async assess(first, second, context) {
      const fingerprint = assessmentFingerprint(first, second, context) + (context.fixture ? ':fixture' : '');
      const profiles = projectedPair(first, second, context.audience);
      if (profiles.some(profile => !profile)) return unavailable(fingerprint, profiles, 'This profile is not shared in this context.');
      const cached = failures.get(fingerprint);
      if (cached && cached.expiresAt > Date.now() && !context.retry) return structuredClone(cached.value);
      failures.delete(fingerprint);
      if (inFlight.has(fingerprint)) return structuredClone(await inFlight.get(fingerprint));
      const work = (async () => {
        let result;
        // The demo button cannot bypass live generation; only the server's
        // explicit fallback setting permits shared-connection templates.
        try { result = adapt(await (context.fixture && env.MATCH_MODE !== 'live' ? fixtureMatcher : matcher).assess({ profileA: profiles[0], profileB: profiles[1] }), fingerprint, profiles); }
        catch { result = unavailable(fingerprint, profiles); }
        if (result.source === 'unavailable') {
          failures.set(fingerprint, { value: result, expiresAt: Date.now() + failureTtl });
          while (failures.size > 256) failures.delete(failures.keys().next().value);
        }
        return result;
      })();
      inFlight.set(fingerprint, work);
      try { return structuredClone(await work); } finally { inFlight.delete(fingerprint); }
    },
  };
}
