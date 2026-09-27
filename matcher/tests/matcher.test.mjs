import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { buildGeminiPrompt, modelProfile, requestGemini, validateGeminiAssessment } from '../src/gemini.mjs';
import { InputError, pairCacheKey, validateMatchRequest } from '../src/profiles.mjs';
import { chooseResult, experienceRoutes, RUBRIC_VERSION } from '../src/rubric.mjs';
import { createMatchServer } from '../src/server.mjs';
import { createMatcher, demoFixtures } from '../src/service.mjs';

const { alex, maya, sam } = demoFixtures.profiles;
const emptyFixtures = { rubricVersion: RUBRIC_VERSION, profiles: {}, offlineResults: [] };
const reviewedDemoIntroduction = 'You share a vision for wearable assistive technology. Combining computer vision with embedded hardware could turn that idea into something people can use every day.';
const servers = [];

after(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
});

function clone(value) {
  return structuredClone(value);
}

function request(profileA, profileB) {
  return { profileA, profileB };
}

function assessment() {
  return {
    criteria: {
      skillToNeed: { score: 30, evidenceA: 'Embedded systems', evidenceB: 'Embedded systems' },
      networkingGoals: {
        score: 25,
        evidenceA: 'Find a computer-vision collaborator',
        evidenceB: 'Find a hardware collaborator',
      },
      projectAlignment: { score: 15, evidenceA: 'Assistive technology', evidenceB: 'Assistive technology' },
      mutualBenefit: { score: 15, evidenceA: 'Embedded systems', evidenceB: 'Computer vision' },
      sharedInterests: { score: 10, evidenceA: 'Robotics', evidenceB: 'Robotics' },
      conversationPotential: { score: 5, evidenceA: 'Build Together', evidenceB: 'Build Together' },
    },
    reason: 'You both care about Robotics. How could your complementary skills help your projects?',
  };
}

async function listen(matcher) {
  const server = createMatchServer(matcher);
  servers.push(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

test('fixture profiles track the web seed while adding Quest-only matching fields', () => {
  const seed = JSON.parse(readFileSync(new URL('../../web/shared/demo-data.json', import.meta.url), 'utf8'));
  assert.equal(demoFixtures.rubricVersion, RUBRIC_VERSION);
  for (const [id, profile] of Object.entries(demoFixtures.profiles)) {
    const webProfile = seed.profiles.find((item) => item.id === id);
    assert.ok(webProfile);
    for (const field of ['name', 'bio', 'interests', 'skills', 'lookingFor']) {
      assert.deepEqual(profile[field], webProfile[field]);
    }
    assert.ok(profile.networkingGoal);
    assert.ok(profile.domains.length);
    assert.ok(profile.experiences.length);
    assert.ok(profile.experiences.every((item) => item.year < new Date().getUTCFullYear()));
  }
  for (const result of demoFixtures.offlineResults) {
    assert.ok(Number.isInteger(result.score) && result.score >= 0 && result.score <= 100);
    assert.equal(result.compatible, result.score >= 70);
    assert.ok(result.reason === '' || result.reason.split(/\s+/u).length <= 30);
  }
  assert.equal(demoFixtures.offlineResults[0].reason, reviewedDemoIntroduction);
  assert.equal(demoFixtures.offlineResults.filter(result => result.compatible).length, 1);
});

test('professional experience: same edition, different edition, and different hackathons', () => {
  const first = clone(alex);
  const second = clone(maya);
  assert.equal(experienceRoutes(first, second).professional.score, 100);
  first.experiences = first.experiences.filter((item) => item.category === 'professional');
  second.experiences = second.experiences.filter((item) => item.category === 'professional');
  second.interests = [];
  second.lookingFor = [];
  second.skills = [];
  second.experiences[0].year = 2024;
  assert.equal(experienceRoutes(first, second).professional.score, 80);
  second.experiences[0].label = 'Another Hackathon';
  assert.equal(experienceRoutes(first, second).professional.score, 70);
  const result = chooseResult(first, second, experienceRoutes(first, second));
  assert.equal(result.compatible, true);
  assert.match(result.reason, /both been to hackathon/u);
});

test('personal experience needs additional field alignment', () => {
  const first = clone(alex);
  const second = clone(maya);
  first.experiences = first.experiences.filter((item) => item.category === 'personal');
  second.experiences = second.experiences.filter((item) => item.category === 'personal');
  first.experiences[0].kind = 'travel';
  second.experiences[0].kind = 'travel';
  first.experiences[0].label = 'Kyoto trip';
  second.experiences[0].label = 'Kyoto trip';
  first.interests = [];
  second.interests = [];
  first.skills = [];
  second.skills = [];
  first.lookingFor = [];
  second.lookingFor = [];
  assert.equal(experienceRoutes(first, second).personal.score, 75);
  assert.match(experienceRoutes(first, second).personal.reason, /assistive technology/iu);
  second.domains = ['Unrelated field'];
  assert.equal(experienceRoutes(first, second).personal.score, 50);
  assert.equal(chooseResult(first, second, experienceRoutes(first, second)).compatible, false);
  second.experiences[0].label = 'Different hike';
  assert.equal(experienceRoutes(first, second).personal.score, 20);
});

test('Sam stays neutral and Maya restores the shared result after a profile switch', async () => {
  const matcher = createMatcher();
  const first = await matcher.match(request(alex, maya));
  const switched = await matcher.match(request(alex, sam));
  const restored = await matcher.match(request(alex, maya));
  assert.deepEqual(first.result, demoFixtures.offlineResults[0]);
  assert.deepEqual(switched.result, demoFixtures.offlineResults[1]);
  assert.equal(restored.source, 'cache');
  assert.deepEqual(restored.result, first.result);
});

test('reversed pair is canonical and cached; profile and rubric changes invalidate the key', async () => {
  let calls = 0;
  const matcher = createMatcher({
    apiKey: 'test-key',
    geminiEvaluator: async () => { calls += 1; return assessment(); },
  });
  const forward = await matcher.match(request(alex, maya));
  const reverse = await matcher.match(request(maya, alex));
  assert.equal(forward.source, 'gemini');
  assert.equal(reverse.source, 'cache');
  assert.deepEqual(reverse.result, forward.result);
  assert.equal(calls, 1);
  const edited = clone(alex);
  edited.bio += ' New project detail.';
  await matcher.match(request(edited, maya));
  assert.equal(calls, 2);
  const [a, b] = validateMatchRequest(request(alex, maya));
  assert.notEqual(pairCacheKey(a, b, 'rubric-v1'), pairCacheKey(a, b, 'rubric-v2'));
});

test('simultaneous requests for one pair share a single Gemini evaluation', async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const matcher = createMatcher({
    apiKey: 'test-key',
    geminiEvaluator: async () => { calls += 1; await gate; return assessment(); },
  });
  const first = matcher.match(request(alex, maya));
  const second = matcher.match(request(maya, alex));
  release();
  const results = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.deepEqual(results[0].result, results[1].result);
  assert.deepEqual(results.map((item) => item.source), ['gemini', 'cache']);
});

test('simultaneous rich assessments expose only the public contract', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const matcher = createMatcher({
    apiKey: 'test-key',
    geminiEvaluator: async () => { await gate; return assessment(); },
  });
  const first = matcher.assess(request(alex, maya));
  const second = matcher.assess(request(maya, alex));
  release();
  const results = await Promise.all([first, second]);
  const expectedKeys = [
    'available', 'criteria', 'provenance', 'result', 'route', 'routes', 'source',
  ];
  assert.deepEqual(Object.keys(results[0]).sort(), expectedKeys);
  assert.deepEqual(Object.keys(results[1]).sort(), expectedKeys);
});

test('edited demo profiles cannot reuse the precomputed offline result', async () => {
  const edited = clone(alex);
  edited.bio += ' New detail.';
  const result = await createMatcher({ mode: 'fixture' }).match(request(edited, maya));
  assert.equal(result.source, 'fallback');
  assert.equal(result.result.compatible, true);
  assert.notDeepEqual(result.result, demoFixtures.offlineResults[0]);
});

test('Gemini rubric scores are bounded, grounded, and added by the backend', () => {
  const result = validateGeminiAssessment(assessment(), alex, maya);
  assert.equal(result.score, 100);
  assert.deepEqual(result.criteria.skillToNeed, {
    points: 30,
    evidence: 'Embedded systems | Embedded systems',
  });
  const tooHigh = assessment();
  tooHigh.criteria.skillToNeed.score = 31;
  assert.throws(() => validateGeminiAssessment(tooHigh, alex, maya), /score is invalid/u);
  const invented = assessment();
  invented.criteria.sharedInterests.evidenceA = 'space travel';
  assert.throws(() => validateGeminiAssessment(invented, alex, maya), /not grounded/u);
  const longReason = assessment();
  longReason.reason = `Robotics ${'something '.repeat(30)}`;
  assert.throws(() => validateGeminiAssessment(longReason, alex, maya), /too long/u);
});

test('strong networking fit can match without any shared experience', async () => {
  const first = clone(alex);
  const second = clone(maya);
  first.experiences = [];
  second.experiences = [];
  const graded = assessment();
  graded.criteria.conversationPotential.evidenceA = 'Assistive technology';
  graded.criteria.conversationPotential.evidenceB = 'Assistive technology';
  const matcher = createMatcher({
    apiKey: 'test-key', fixtures: emptyFixtures,
    geminiEvaluator: async () => graded,
  });
  const response = await matcher.match(request(first, second));
  assert.equal(response.source, 'gemini');
  assert.equal(response.result.score, 100);
  assert.equal(response.result.compatible, true);
  assert.match(response.result.reason, /Robotics/u);
});

test('a Gemini contradiction cannot turn the known Alex/Sam nonmatch green', async () => {
  const inflated = assessment();
  inflated.criteria.skillToNeed.evidenceA = 'Embedded systems';
  inflated.criteria.skillToNeed.evidenceB = 'Frontend development';
  inflated.criteria.networkingGoals.evidenceB = 'Find a frontend collaborator';
  inflated.criteria.projectAlignment.evidenceB = 'Design';
  inflated.criteria.mutualBenefit.evidenceB = 'Figma';
  inflated.criteria.sharedInterests.evidenceB = 'Design';
  inflated.criteria.conversationPotential.evidenceB = 'Coastal cycling trip';
  inflated.reason = 'Alex offers Embedded systems and Sam offers Figma. What could they build together?';
  const matcher = createMatcher({ apiKey: 'test-key', geminiEvaluator: async () => inflated });
  const response = await matcher.match(request(alex, sam));
  assert.equal(response.source, 'fallback');
  assert.deepEqual(response.result, demoFixtures.offlineResults[1]);
});

test('Gemini request uses stateless structured output and only approved fields', async () => {
  let captured;
  const extra = { ...alex, contact: 'private@example.com', socialLinks: ['secret-handle'] };
  assert.equal(modelProfile(extra).contact, undefined);
  assert.doesNotMatch(buildGeminiPrompt(extra, maya), /private@example.com|secret-handle/u);
  const raw = assessment();
  const result = await requestGemini(extra, maya, {
    apiKey: 'test-key',
    model: 'gemini-3.8-flash',
    fetchImpl: async (_url, options) => {
      captured = options;
      return new Response(JSON.stringify({
        status: 'completed',
        steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(raw) }] }],
      }), { status: 200 });
    },
  });
  assert.deepEqual(result, raw);
  const body = JSON.parse(captured.body);
  assert.equal(body.store, false);
  assert.equal(body.model, 'gemini-3.8-flash');
  assert.equal(body.response_format.mime_type, 'application/json');
  assert.doesNotMatch(captured.body, /private@example.com|secret-handle/u);
});

test('bad input cannot reach Gemini', async () => {
  let called = false;
  const matcher = createMatcher({
    apiKey: 'test-key',
    geminiEvaluator: async () => { called = true; return assessment(); },
  });
  await assert.rejects(matcher.match(request({ ...alex, contact: 'private' }, maya)), InputError);
  await assert.rejects(matcher.match(request(alex, alex)), InputError);
  await assert.rejects(matcher.match(request({ ...alex, name: '' }, maya)), InputError);
  await assert.rejects(matcher.match(request({ ...alex, bio: 'x'.repeat(501) }, maya)), InputError);
  assert.equal(called, false);
});

test('the default Quest deadline still aborts a model response after three seconds', async () => {
  let signal;
  const matcher = createMatcher({
    apiKey: 'test-key',
    geminiEvaluator: async (_first, _second, options) => {
      signal = options.signal;
      await new Promise(resolve => setTimeout(resolve, 3200));
      return assessment();
    },
  });
  const result = await matcher.match(request(alex, maya));
  assert.equal(signal.aborted, true);
  assert.equal(result.source, 'fallback');
  assert.deepEqual(result.result, demoFixtures.offlineResults[0]);
});

test('missing key, invalid model output, and timeout use known offline fixtures', async () => {
  const noKey = createMatcher({ geminiEvaluator: async () => { throw new Error('should not call'); } });
  assert.deepEqual((await noKey.match(request(alex, maya))).result, demoFixtures.offlineResults[0]);
  const invalid = createMatcher({ apiKey: 'test-key', geminiEvaluator: async () => ({ nope: true }) });
  const bad = await invalid.match(request(alex, sam));
  assert.equal(bad.source, 'fallback');
  assert.deepEqual(bad.result, demoFixtures.offlineResults[1]);
  const timeout = createMatcher({
    apiKey: 'test-key', timeoutMs: 10,
    geminiEvaluator: async () => new Promise(() => {}),
  });
  const started = Date.now();
  const timed = await timeout.match(request(alex, maya));
  assert.equal(timed.source, 'fallback');
  assert.ok(Date.now() - started < 1000);
});

test('fixture mode never calls Gemini even when a key is configured', async () => {
  let called = false;
  const matcher = createMatcher({
    mode: 'fixture',
    apiKey: 'test-key',
    geminiEvaluator: async () => {
      called = true;
      throw new Error('Gemini must not run in fixture mode');
    },
  });
  const response = await matcher.match(request(alex, maya));
  assert.equal(called, false);
  assert.equal(response.source, 'fallback');
  assert.deepEqual(response.result, demoFixtures.offlineResults[0]);
  assert.equal(matcher.health().mode, 'fixture');
});

test('failed live calls are not cached, so a recovered Gemini call can retry', async () => {
  let calls = 0;
  const matcher = createMatcher({
    apiKey: 'test-key',
    geminiEvaluator: async () => {
      calls += 1;
      if (calls === 1) throw new Error('offline');
      return assessment();
    },
  });
  assert.equal((await matcher.match(request(alex, maya))).source, 'fallback');
  assert.equal((await matcher.match(request(alex, maya))).source, 'gemini');
  assert.equal(calls, 2);
});

test('rich assessment is stable through cache and preserves winning provenance', async () => {
  let calls = 0;
  const matcher = createMatcher({
    apiKey: 'test-key', fixtures: emptyFixtures,
    geminiEvaluator: async () => { calls += 1; return assessment(); },
  });
  const first = await matcher.assess(request(alex, maya));
  const cached = await matcher.assess(request(maya, alex));
  assert.equal(first.source, 'gemini');
  assert.equal(cached.source, 'cache');
  assert.equal(first.provenance, 'rules');
  assert.equal(cached.provenance, first.provenance);
  assert.equal(first.route, 'professional');
  assert.deepEqual(cached.result, first.result);
  assert.deepEqual(cached.routes, first.routes);
  assert.deepEqual(cached.criteria, first.criteria);
  assert.equal(calls, 1);
  matcher.clear();
  assert.equal((await matcher.assess(request(alex, maya))).source, 'gemini');
  assert.equal(calls, 2);
});

test('fixture assessments identify fixture provenance including known zero', async () => {
  const assessed = await createMatcher({ mode: 'fixture' }).assess(request(alex, sam));
  assert.equal(assessed.provenance, 'fixture');
  assert.equal(assessed.available, true);
  assert.equal(assessed.result.score, 0);
  assert.equal(assessed.criteria, null);
  assert.equal(assessed.routes.networking, null);
});

test('missing AI and no qualifying experience reports assessment unavailable', async () => {
  const assessed = await createMatcher({ fixtures: emptyFixtures }).assess(request(alex, sam));
  assert.equal(assessed.available, false);
  assert.equal(assessed.provenance, 'rules');
  assert.equal(assessed.criteria, null);
  assert.deepEqual(assessed.routes, { networking: null, professional: 0, personal: 0 });
});

test('HTTP contract returns health, match JSON, source header, and safe errors', async () => {
  const base = await listen(createMatcher({ mode: 'fixture' }));
  const health = await (await fetch(`${base}/health`)).json();
  assert.equal(health.status, 'ok');
  assert.equal(health.rubricVersion, RUBRIC_VERSION);
  const response = await fetch(`${base}/match`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request(alex, maya)),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-align-match-source'), 'fallback');
  const responseBody = await response.json();
  assert.deepEqual(responseBody, demoFixtures.offlineResults[0]);
  assert.deepEqual(Object.keys(responseBody), ['userA', 'userB', 'compatible', 'score', 'reason']);
  const invalid = await fetch(`${base}/match`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request({ ...alex, socialLinks: ['secret'] }, maya)),
  });
  assert.equal(invalid.status, 400);
  const huge = await fetch(`${base}/match`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload: 'x'.repeat(17 * 1024) }),
  });
  assert.equal(huge.status, 413);
  const wrongType = await fetch(`${base}/match`, { method: 'POST', body: '{}' });
  assert.equal(wrongType.status, 415);
});

test('an unreachable service fails without a live dependency', async () => {
  const server = createMatchServer(createMatcher());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  await assert.rejects(fetch(`http://127.0.0.1:${port}/health`));
});
