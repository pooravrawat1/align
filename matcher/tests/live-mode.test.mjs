import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { requestGemini, validateGeminiIntroduction } from '../src/gemini.mjs';
import { NETWORKING_MAX } from '../src/rubric.mjs';
import { createMatcher, demoFixtures } from '../src/service.mjs';
import { createMatchServer } from '../src/server.mjs';
import { createRoomRelay } from '../src/rooms.mjs';

const { alex, maya, sam } = demoFixtures.profiles;
const pair = { profileA: alex, profileB: maya };
const introduction = {
  text: 'You both attended Build Together. What did you learn that could help you collaborate now?',
  evidenceA: 'Build Together', evidenceB: 'Build Together',
};
function assessment() {
  return {
    criteria: Object.fromEntries(Object.keys(NETWORKING_MAX).map(key => [key, { score: 0, evidenceA: '', evidenceB: '' }])),
    reason: '', introduction: { ...introduction },
  };
}
const servers = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});

test('live mode replaces a winning experience template with a grounded AI introduction', async () => {
  let calls = 0;
  const matcher = createMatcher({ mode: 'live', apiKey: 'test', geminiEvaluator: async (_a, _b, options) => {
    calls++;
    assert.equal(options.introductionContext.professional, 100);
    return assessment();
  } });
  const forward = await matcher.assess(pair);
  const reverse = await matcher.assess({ profileA: maya, profileB: alex });
  assert.equal(forward.route, 'professional');
  assert.equal(forward.result.reason, introduction.text);
  assert.notEqual(forward.result.reason, demoFixtures.offlineResults[0].reason);
  assert.equal(forward.provenance, 'gemini');
  assert.equal(reverse.provenance, 'gemini');
  assert.equal(reverse.source, 'cache');
  assert.deepEqual(reverse.result, forward.result);
  assert.equal(calls, 1);
  assert.equal(matcher.health().introductionMode, 'gemini-required');
});

test('live mode never falls back for missing credentials, provider errors, invalid prose, or timeouts', async () => {
  const missing = createMatcher({ mode: 'live' });
  await assert.rejects(missing.match(pair), { status: 503 });
  for (const evaluator of [
    async () => { throw new Error('private-provider-body secret-key'); },
    async () => ({ ...assessment(), introduction: undefined }),
    async () => ({ ...assessment(), introduction: { ...introduction, evidenceB: 'invented quote' } }),
    async () => new Promise(() => {}),
  ]) {
    const matcher = createMatcher({ mode: 'live', apiKey: 'test', timeoutMs: 10, geminiEvaluator: evaluator });
    await assert.rejects(matcher.match(pair), error => error.status === 502 && !/secret-key|private-provider/.test(error.message));
  }
});

test('a failed live request is not cached and can recover', async () => {
  let calls = 0;
  const matcher = createMatcher({ mode: 'live', apiKey: 'test', geminiEvaluator: async () => {
    if (++calls === 1) throw new Error('offline');
    return assessment();
  } });
  await assert.rejects(matcher.match(pair));
  assert.equal((await matcher.match(pair)).result.reason, introduction.text);
  assert.equal(calls, 2);
});

test('nonmatches stay silent without inventing an introduction', async () => {
  const matcher = createMatcher({ mode: 'live', apiKey: 'test', geminiEvaluator: async () => assessment() });
  const { result } = await matcher.match({ profileA: alex, profileB: sam });
  assert.equal(result.compatible, false);
  assert.equal(result.reason, '');
});

test('introduction validation requires short prose containing evidence from BOTH profiles', () => {
  assert.equal(validateGeminiIntroduction(introduction, alex, maya), introduction.text);
  for (const raw of [null, {}, { ...introduction, text: '' },
    { ...introduction, text: `Build Together ${'word '.repeat(30)}` },
    { ...introduction, evidenceB: 'Coastal cycling trip' },
    { ...introduction, text: 'An unsupported shared claim.' },
  ]) assert.throws(() => validateGeminiIntroduction(raw, alex, maya));
});

test('live Gemini requests require the introduction schema and do not send fixture prose or contacts', async () => {
  let body;
  const result = await requestGemini({ ...alex, contact: 'secret@example.com' }, maya, {
    apiKey: 'test', introductionContext: { professional: 100, personal: 60 },
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response(JSON.stringify({ status: 'completed', steps: [
        { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(assessment()) }] },
      ] }));
    },
  });
  assert.equal(body.store, false);
  assert.deepEqual(body.generation_config, { thinking_level: 'low', max_output_tokens: 2048 });
  assert.ok(body.response_format.schema.required.includes('introduction'));
  assert.ok(!body.input.includes(demoFixtures.offlineResults[0].reason));
  assert.ok(!body.input.includes('secret@example.com'));
  assert.equal(result.introduction.text, introduction.text);
});

function update(clientId, overrides = {}) {
  return { roomCode: 'LIVE', clientId, requestedProfileId: 'auto', calibrated: true,
    pose: { px: 0, py: 1.6, pz: 0, rx: 0, ry: 0, rz: 0, rw: 1, tracked: true, sequence: 1 },
    ...overrides };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('headset pose polls return immediately while one live request runs in the background', async () => {
  let finish;
  let calls = 0;
  const matcher = createMatcher({ mode: 'live', apiKey: 'test', geminiEvaluator: async () => {
    calls++;
    return new Promise(resolve => { finish = () => resolve(assessment()); });
  } });
  const relay = createRoomRelay({ matcher, fixtures: demoFixtures });
  await relay.update(update('a'));
  const pending = await relay.update(update('b'));
  assert.equal(pending.matchAvailable, false);
  assert.equal(pending.matchStatus, 'pending');
  assert.throws(() => relay.narrationMatch({ roomCode: 'LIVE', clientId: 'a', profileId: 'maya' }));
  assert.equal((await relay.update(update('a'))).participants.length, 2);
  assert.equal(calls, 1);
  finish();
  await tick();
  const ready = await relay.update(update('a'));
  assert.equal(ready.matchStatus, 'ready');
  assert.equal(ready.match.reason, introduction.text);
  assert.deepEqual(relay.narrationMatch({ roomCode: 'LIVE', clientId: 'a', profileId: 'maya' }),
    { compatible: true, reason: introduction.text });
});

test('live failures are explicit, rate-limited, silent, and recover without losing pose updates', async () => {
  let clock = 0;
  let calls = 0;
  const matcher = createMatcher({ mode: 'live', apiKey: 'test', geminiEvaluator: async () => {
    if (++calls === 1) throw new Error('private provider error');
    return assessment();
  } });
  const relay = createRoomRelay({ matcher, fixtures: demoFixtures, now: () => clock, memberTtlMs: 60000 });
  await relay.update(update('a'));
  await relay.update(update('b'));
  await tick();
  const failed = await relay.update(update('a'));
  assert.equal(failed.matchStatus, 'unavailable');
  assert.equal(failed.matchAvailable, false);
  assert.equal(failed.match.reason, '');
  assert.equal(failed.participants.length, 2);
  assert.ok(!failed.matchError.includes('private provider'));
  for (let count = 0; count < 10; count++) await relay.update(update('b'));
  assert.equal(calls, 1);
  clock = 30001;
  await relay.update(update('a'));
  await tick();
  assert.equal((await relay.update(update('b'))).match.reason, introduction.text);
  assert.equal(calls, 2);
});

test('a profile switch or room reset discards an in-flight introduction', async () => {
  for (const change of [{ requestedProfileId: 'sam' }, { resetRoom: true, calibrated: false }]) {
    let finish;
    const matcher = createMatcher({ mode: 'live', apiKey: 'test', geminiEvaluator: async () =>
      new Promise(resolve => { finish = () => resolve(assessment()); }) });
    const relay = createRoomRelay({ matcher, fixtures: demoFixtures });
    await relay.update(update('a'));
    await relay.update(update('b'));
    const releaseOriginal = finish;
    await relay.update(update('b', change));
    releaseOriginal();
    if (change.requestedProfileId) finish();
    await tick();
    const state = await relay.update(update('b', { ...change, resetRoom: false }));
    assert.equal(state.match.compatible, false);
    assert.equal(state.match.reason, '');
  }
});

test('live HTTP errors are explicit instead of returning a scripted 200 match', async () => {
  const server = createMatchServer(createMatcher({ mode: 'live' }));
  servers.push(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/match`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pair),
  });
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes(demoFixtures.offlineResults[0].reason));
});
