import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createServer } from '../server/index.mjs';
import { createMatchNarrator } from '../../matcher/src/narration.mjs';

const servers = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});

async function harness(narrator) {
  const calls = [];
  const server = createServer({ env: {}, narrator: narrator ?? {
    health: () => ({ enabled: true }),
    narrate: async match => { calls.push(match); return Buffer.from('test-mp3'); },
  } });
  servers.push(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const api = (path, sessionId, body, method = body === undefined ? 'GET' : 'POST') => fetch(
    `http://127.0.0.1:${server.address().port}/api/${path}`, {
      method, headers: { 'content-type': 'application/json', ...(sessionId ? { 'x-session-id': sessionId } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  const login = async id => (await (await api('login', null, { profileId: id })).json()).session.id;
  const match = async sessionId => {
    await api('room', sessionId, { code: 'DEMO' });
    assert.equal((await api('matches', sessionId, { demo: true })).status, 200);
  };
  return { api, login, match, calls };
}

test('browser narration is session/match scoped and accepts only a participant ID', async () => {
  const h = await harness();
  assert.equal((await h.api('narration', null, { participantId: 'maya' })).status, 401);
  const alex = await h.login('alex');
  assert.equal((await h.api('narration', alex, { participantId: 'maya' })).status, 409);
  await h.api('room', alex, { code: 'DEMO' });
  assert.equal((await h.api('narration', alex, { participantId: 'maya' })).status, 403);
  await h.match(alex);
  assert.equal((await h.api('narration', alex, { participantId: 'maya', text: 'Arbitrary text' })).status, 400);
  assert.equal((await h.api('narration', alex, { participantId: 'alex' })).status, 403);
  assert.equal((await h.api('narration', alex, { participantId: 'sam' })).status, 403);
  assert.equal(h.calls.length, 0);
  const response = await h.api('narration', alex, { participantId: 'maya' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'audio/mpeg');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), 'test-mp3');
  const state = await (await h.api('bootstrap', alex)).json();
  const matched = state.matches.find(match => match.compatible && match.userB === 'maya');
  assert.deepEqual(h.calls[0], { compatible: true, reason: matched.reason });
  const maya = await h.login('maya');
  await h.match(maya);
  assert.equal((await h.api('narration', maya, { participantId: 'alex' })).status, 200);
  assert.deepEqual(h.calls[1], h.calls[0]);
});

test('profile edits invalidate stale reasons; a fresh shared reason can speak even with bios hidden', async () => {
  const spoken = [];
  const h = await harness(createMatchNarrator({ env: { ELEVENLABS_API_KEY: 'test' }, fetchImpl: async (_url, options) => {
    spoken.push(JSON.parse(options.body).text);
    return new Response('mp3', { headers: { 'content-type': 'audio/mpeg' } });
  } }));
  const alex = await h.login('alex');
  const maya = await h.login('maya');
  await h.match(alex);
  assert.equal((await h.api('profile', maya, { visibility: { bio: false } }, 'PATCH')).status, 200);
  assert.equal((await h.api('narration', alex, { participantId: 'maya' })).status, 403);
  await h.match(alex);
  const hidden = await h.api('narration', alex, { participantId: 'maya' });
  assert.equal(hidden.status, 200);
  const state = await (await h.api('bootstrap', alex)).json();
  assert.deepEqual(spoken, [state.matches.find(match => match.compatible && match.userB === 'maya').reason]);
  assert.equal((await h.api('profile', maya, { visibility: { activeInEvent: false } }, 'PATCH')).status, 200);
  assert.equal((await h.api('narration', alex, { participantId: 'maya' })).status, 403);
  assert.equal(spoken.length, 1);
});

test('leaving during generation prevents stale audio from being returned', async () => {
  let started;
  let finish;
  const pending = new Promise(resolve => { started = resolve; });
  const h = await harness({ health: () => ({ enabled: true }), narrate: async () => {
    started();
    return new Promise(resolve => { finish = () => resolve(Buffer.from('mp3')); });
  } });
  const alex = await h.login('alex');
  await h.match(alex);
  const speech = h.api('narration', alex, { participantId: 'maya' });
  await pending;
  await h.api('leave', alex, {});
  finish();
  assert.equal((await speech).status, 409);
});

test('missing ElevenLabs credentials do not prevent matches from succeeding', async () => {
  const h = await harness(createMatchNarrator({ env: {} }));
  const alex = await h.login('alex');
  await h.match(alex);
  assert.equal((await h.api('narration', alex, { participantId: 'maya' })).status, 503);
  const state = await (await h.api('bootstrap', alex)).json();
  assert.ok(state.matches.some(match => match.compatible && match.userB === 'maya'));
});
