import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MatchNarrator } from '../src/matchNarration.ts';

const maya = { id: 'maya', reason: 'You both build assistive technology.' };
const alex = { id: 'alex', reason: 'Your interests align around robotics.' };
const flush = () => new Promise(resolve => setImmediate(resolve));
const audio = () => new Response('mp3', { headers: { 'content-type': 'audio/mpeg' } });

function harness(fetchImpl = async () => audio()) {
  const statuses = [];
  const requests = [];
  const sources = [];
  const context = {
    state: 'running', destination: {},
    resume: async () => { context.state = 'running'; },
    close: async () => { context.state = 'closed'; },
    decodeAudioData: async () => ({}),
    createBufferSource() {
      const source = { connect() {}, disconnect() {}, start() { source.started = true; }, stop() { source.stopped = true; }, onended: null };
      sources.push(source);
      return source;
    },
  };
  const narrator = new MatchNarrator(status => statuses.push(status), () => context, async (url, options) => {
    requests.push({ url, options });
    return fetchImpl(url, options);
  });
  return { narrator, context, requests, sources, statuses };
}

test('shared introductions play serially and refreshed matches do not repeat them', async () => {
  const h = harness();
  h.narrator.update('session', 'room', [maya, alex], true);
  await flush();
  assert.equal(h.sources.length, 1);
  assert.equal(h.statuses.at(-1), 'speaking');
  h.narrator.update('session', 'room', [{ ...maya }, { ...alex }], true);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, '/api/narration');
  assert.deepEqual(JSON.parse(h.requests[0].options.body), { participantId: 'maya' });
  assert.equal(h.requests[0].options.headers['x-session-id'], 'session');
  h.sources[0].onended();
  await flush();
  assert.equal(h.sources.length, 2);
  h.sources[1].onended();
  h.narrator.update('session', 'room', [maya, alex], true);
  await flush();
  assert.equal(h.requests.length, 2);
  assert.equal(h.statuses.at(-1), 'idle');
  h.narrator.dispose();
});

test('a removed match cancels a late response; a later new match can speak again', async () => {
  let finish;
  const h = harness(() => new Promise(resolve => { finish = resolve; }));
  h.narrator.update('session', 'room', [maya], true);
  h.narrator.update('session', 'room', [], true);
  assert.equal(h.requests[0].options.signal.aborted, true);
  finish(audio());
  await flush();
  assert.equal(h.sources.length, 0);
  h.narrator.update('session', 'room', [maya], true);
  finish(audio());
  await flush();
  assert.equal(h.sources.length, 1);
  h.narrator.dispose();
});

test('mute stops playback and pending work; leaving closes audio and prevents stale playback', async () => {
  const h = harness();
  h.narrator.update('session', 'room', [maya, alex], true);
  await flush();
  h.narrator.update('session', 'room', [maya, alex], false);
  assert.equal(h.sources[0].stopped, true);
  assert.equal(h.requests.length, 1);
  assert.equal(h.statuses.at(-1), 'idle');
  h.narrator.dispose();
  assert.equal(h.context.state, 'closed');
});

test('browser autoplay restrictions retain audio until a user gesture unlocks playback', async () => {
  const h = harness();
  h.context.state = 'suspended';
  h.narrator.update('session', 'room', [maya], true);
  await flush();
  assert.equal(h.sources.length, 0);
  assert.equal(h.statuses.at(-1), 'blocked');
  h.narrator.unlock();
  await flush();
  assert.equal(h.sources.length, 1);
  assert.equal(h.requests.length, 1);
  h.narrator.dispose();
});

test('narration errors allow an explicit retry without repeatedly fetching on each render', async () => {
  let calls = 0;
  const h = harness(async () => ++calls === 1 ? new Response('{}', { status: 503 }) : audio());
  h.narrator.update('session', 'room', [maya], true);
  await flush();
  assert.equal(h.statuses.at(-1), 'unavailable');
  h.narrator.update('session', 'room', [maya], true);
  assert.equal(h.requests.length, 1);
  h.narrator.retry();
  await flush();
  assert.equal(h.statuses.at(-1), 'speaking');
  assert.equal(h.requests.length, 2);
  h.narrator.dispose();
});

test('changing a match reason or session cancels old playback and reads the current introduction', async () => {
  const h = harness();
  h.narrator.update('session-a', 'room', [maya], true);
  await flush();
  h.narrator.update('session-a', 'room', [{ ...maya, reason: 'Updated shared introduction.' }], true);
  await flush();
  assert.equal(h.sources[0].stopped, true);
  assert.equal(h.requests.length, 2);
  h.narrator.update('session-b', 'room', [maya], true);
  await flush();
  assert.equal(h.sources[1].stopped, true);
  assert.equal(h.requests[2].options.headers['x-session-id'], 'session-b');
  h.narrator.dispose();
});
