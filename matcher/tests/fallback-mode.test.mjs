import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { NETWORKING_MAX } from '../src/rubric.mjs';
import { createMatcher, demoFixtures } from '../src/service.mjs';
import { createRoomRelay } from '../src/rooms.mjs';
import { createMatchServer } from '../src/server.mjs';

const { alex, maya, sam } = demoFixtures.profiles;
const pair = { profileA: alex, profileB: maya };
const text = 'You both attended Build Together. What could you create together next?';
const assessment = () => ({
  criteria: Object.fromEntries(Object.keys(NETWORKING_MAX).map(key => [key,
    { score: 0, evidenceA: '', evidenceB: '' }])),
  reason: '', introduction: { text, evidenceA: 'Build Together', evidenceB: 'Build Together' },
});
const options = { mode: 'live', liveFallback: true, apiKey: 'test' };
const servers = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});

test('fallback is opt-in and defaults to a three-second AI budget', () => {
  assert.equal(createMatcher({ mode: 'live' }).health().introductionMode, 'gemini-required');
  assert.equal(createMatcher(options).health().introductionMode, 'gemini-with-fallback');
  assert.equal(createMatcher(options).health().fallbackAfterMs, 3000);
  assert.equal(createMatcher({ ...options, timeoutMs: 1000 }).health().fallbackAfterMs, 1000);
  for (const fallbackTimeoutMs of [0, -1, 15001, NaN, 1.5]) {
    assert.throws(() => createMatcher({ ...options, fallbackTimeoutMs }));
  }
});

test('a fast valid AI response wins and is shared by concurrent requests', async () => {
  let calls = 0;
  const matcher = createMatcher({ ...options, geminiEvaluator: async () => { calls++; return assessment(); } });
  const [first, second] = await Promise.all([matcher.assess(pair), matcher.assess(pair)]);
  assert.equal(first.source, 'gemini');
  assert.equal(second.provenance, 'gemini');
  assert.equal(first.result.reason, text);
  assert.equal(calls, 1);
});

test('a slow AI call is aborted and its late answer cannot replace the cached shared fallback', async () => {
  let finish, signal, calls = 0;
  let clock = 0;
  const matcher = createMatcher({ ...options, fallbackTimeoutMs: 15, now: () => clock,
    geminiEvaluator: async (_a, _b, context) => {
      calls++;
      signal = context.signal;
      return new Promise(resolve => { finish = resolve; });
    } });
  const started = Date.now();
  const first = await matcher.assess(pair);
  assert.ok(Date.now() - started < 1000);
  assert.equal(signal.aborted, true);
  assert.equal(first.source, 'fallback');
  assert.equal(first.provenance, 'rules');
  assert.equal(first.result.compatible, true);
  assert.match(first.result.reason, /^You both attended Build Together in 2025/);
  assert.ok(first.result.reason.split(/\s+/u).length <= 30);
  assert.notEqual(first.result.reason, demoFixtures.offlineResults[0].reason);
  finish(assessment());
  await new Promise(resolve => setImmediate(resolve));
  clock += 2 * 60 * 60 * 1000;
  const cached = await matcher.assess({ profileA: maya, profileB: alex });
  assert.equal(cached.source, 'cache');
  assert.equal(cached.provenance, 'rules');
  assert.deepEqual(cached.result, first.result);
  assert.equal(calls, 1);
});

test('missing credentials, invalid prose, and provider errors use shared fallback immediately', async () => {
  for (const overrides of [
    { apiKey: '' },
    { geminiEvaluator: async () => { throw new Error('private-provider-key'); } },
    { geminiEvaluator: async () => ({ ...assessment(), introduction: undefined }) },
  ]) {
    const matcher = createMatcher({ ...options, ...overrides });
    const { result, source } = await matcher.match(pair);
    assert.equal(source, 'fallback');
    assert.equal(result.compatible, true);
    assert.match(result.reason, /You both attended Build Together/);
    assert.ok(!JSON.stringify(result).includes('private-provider-key'));
  }
});

test('quota failures enable fallback without calling the exhausted model for other pairs', async () => {
  let calls = 0;
  const matcher = createMatcher({ ...options, geminiEvaluator: async () => {
    calls++;
    throw Object.assign(new Error('quota'), { status: 429, dailyQuota: true, retryAfterMs: 3600000 });
  } });
  assert.equal((await matcher.match(pair)).source, 'fallback');
  const nonmatch = await matcher.match({ profileA: alex, profileB: sam });
  assert.equal(nonmatch.source, 'fallback');
  assert.equal(nonmatch.result.compatible, false);
  assert.equal(nonmatch.result.reason, '');
  assert.equal(matcher.health().geminiRateLimited, true);
  assert.equal(calls, 1);
});

test('profile changes invalidate a fallback and cannot reuse a hardcoded match for the old people', async () => {
  const matcher = createMatcher({ ...options, apiKey: '' });
  assert.equal((await matcher.match(pair)).result.compatible, true);
  const edited = await matcher.assess({ profileA: { ...alex, experiences: [] }, profileB: maya });
  assert.equal(edited.result.compatible, false);
  assert.equal(edited.result.reason, '');
  assert.equal(edited.available, false);
});

test('the relay publishes one fallback for both headsets and narrates exactly that text', async () => {
  let finish;
  const matcher = createMatcher({ ...options, fallbackTimeoutMs: 10,
    geminiEvaluator: async () => new Promise(resolve => { finish = resolve; }) });
  const relay = createRoomRelay({ matcher, fixtures: demoFixtures });
  const update = clientId => ({ roomCode: 'FALLBACK', clientId, requestedProfileId: 'auto', calibrated: true,
    pose: { px: 0, py: 1.6, pz: 0, rx: 0, ry: 0, rz: 0, rw: 1, tracked: true, sequence: 1 } });
  await relay.update(update('a'));
  assert.equal((await relay.update(update('b'))).matchStatus, 'pending');
  // Join the in-flight request without producing a second model call.
  await matcher.match(pair);
  await new Promise(resolve => setImmediate(resolve));
  const first = await relay.update(update('a'));
  const second = await relay.update(update('b'));
  assert.equal(first.matchStatus, 'ready');
  assert.equal(first.matchSource, 'fallback');
  assert.deepEqual(first.match, second.match);
  assert.equal(first.introductionRevealed, false);
  await relay.update({ ...update('a'), revealIntroduction: true, presentationId: first.presentationId });
  const narration = relay.narrationMatch({ roomCode: 'FALLBACK', clientId: 'a', profileId: 'maya' });
  assert.equal(narration.reason, first.match.reason);
  finish(assessment());
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual((await relay.update(update('b'))).match, first.match);
});

test('HTTP health and source header identify fallback without changing the headset result contract', async () => {
  const server = createMatchServer(createMatcher({ ...options, apiKey: '' }));
  servers.push(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await (await fetch(`${base}/health`)).json();
  assert.equal(health.introductionMode, 'gemini-with-fallback');
  const response = await fetch(`${base}/match`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pair),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-align-match-source'), 'fallback');
  assert.deepEqual(Object.keys(await response.json()).sort(), ['compatible', 'reason', 'score', 'userA', 'userB']);
});
