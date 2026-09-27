import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { matchNarrationText, createMatchNarrator, DEFAULT_VOICE_ID } from '../src/narration.mjs';
import { createRoomRelay } from '../src/rooms.mjs';
import { createMatchServer } from '../src/server.mjs';
import { createMatcher, demoFixtures } from '../src/service.mjs';

const match = { compatible: true, reason: 'You both build assistive technology. Explore a wearable prototype together.', bio: 'Private individual biography.', email: 'private@example.com' };
const audioResponse = () => new Response('test-mp3', { headers: { 'content-type': 'audio/mpeg' } });
const servers = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});

test('only the shared match reason goes to ElevenLabs; neither profile bio is narrated', async () => {
  const calls = [];
  const narrator = createMatchNarrator({
    env: { ELEVENLABS_API_KEY: 'secret-test-key' },
    fetchImpl: async (url, options) => { calls.push({ url, options }); return audioResponse(); },
  });
  const [first, second] = await Promise.all([narrator.narrate(match), narrator.narrate(match)]);
  assert.equal(first.toString(), 'test-mp3');
  assert.deepEqual(first, second);
  await narrator.narrate(match);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}?output_format=mp3_44100_128`);
  assert.equal(calls[0].options.headers['xi-api-key'], 'secret-test-key');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    text: match.reason, model_id: 'eleven_flash_v2_5',
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  });
  assert.ok(!JSON.stringify(narrator.health()).includes('secret-test-key'));
  await narrator.narrate({ ...match, bio: 'A different private biography.' });
  assert.equal(calls.length, 1);
  await narrator.narrate({ ...match, reason: 'An updated shared introduction.' });
  assert.equal(calls.length, 2);
});

test('cache expires, respects custom voice/model and is bounded', async () => {
  let clock = 0;
  let calls = 0;
  const narrator = createMatchNarrator({
    env: { ELEVENLABS_API_KEY: 'key', ELEVENLABS_VOICE_ID: 'custom-female', ELEVENLABS_MODEL_ID: 'eleven_multilingual_v2' },
    now: () => clock,
    fetchImpl: async (url, options) => {
      calls++;
      assert.ok(url.includes('/custom-female?'));
      assert.equal(JSON.parse(options.body).model_id, 'eleven_multilingual_v2');
      return audioResponse();
    },
  });
  await narrator.narrate(match);
  clock += 30 * 60 * 1000 + 1;
  await narrator.narrate(match);
  assert.equal(calls, 2);
  for (let index = 0; index < 32; index++) await narrator.narrate({ ...match, reason: `Introduction ${index}` });
  await narrator.narrate(match);
  assert.equal(calls, 35);
});

test('missing credentials, nonmatches, absent reasons and raw bios never reach the provider', async () => {
  let calls = 0;
  const narrator = createMatchNarrator({ env: {}, fetchImpl: async () => { calls++; return audioResponse(); } });
  await assert.rejects(narrator.narrate(match), { status: 503 });
  await assert.rejects(narrator.narrate({ ...match, reason: '' }), { status: 404 });
  await assert.rejects(narrator.narrate({ ...match, compatible: false }), { status: 403 });
  await assert.rejects(narrator.narrate({ name: 'Maya', bio: 'Individual bio' }), { status: 403 });
  assert.throws(() => matchNarrationText({ ...match, reason: 'x'.repeat(1001) }), { status: 400 });
  assert.equal(calls, 0);
});

test('provider errors are sanitized and cooled down without blocking future recovery', async () => {
  let clock = 0;
  let calls = 0;
  const narrator = createMatchNarrator({
    env: { ELEVENLABS_API_KEY: 'secret-test-key' }, now: () => clock,
    fetchImpl: async () => ++calls === 1 ? new Response('secret-test-key private bio', { status: 401 }) : audioResponse(),
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(narrator.narrate(match), error => error.status === 502 && !error.message.includes('secret-test-key'));
  }
  assert.equal(calls, 1);
  clock += 30001;
  assert.equal((await narrator.narrate(match)).toString(), 'test-mp3');
});

test('a hung request is bounded by the narration deadline and aborted', async () => {
  let signal;
  const narrator = createMatchNarrator({
    env: { ELEVENLABS_API_KEY: 'key', ELEVENLABS_TIMEOUT_MS: '10' },
    fetchImpl: async (_url, options) => { signal = options.signal; return new Promise(() => {}); },
  });
  await assert.rejects(narrator.narrate(match), { status: 504 });
  assert.equal(signal.aborted, true);
});

test('empty, non-audio and oversized provider responses cannot be returned as speech', async () => {
  for (const response of [new Response('', { headers: { 'content-type': 'audio/mpeg' } }),
    new Response('{}', { headers: { 'content-type': 'application/json' } }),
    new Response(new Uint8Array(2 * 1024 * 1024 + 1), { headers: { 'content-type': 'audio/mpeg' } })]) {
    const narrator = createMatchNarrator({ env: { ELEVENLABS_API_KEY: 'key' }, fetchImpl: async () => response });
    await assert.rejects(narrator.narrate(match), { status: 502 });
  }
});

const update = (clientId, overrides = {}) => ({
  roomCode: 'DEMO', clientId, requestedProfileId: 'auto', calibrated: true,
  pose: { px: 0, py: 1.6, pz: 0, rx: 0, ry: 0, rz: 0, rw: 1, tracked: true, sequence: 1 }, ...overrides,
});

test('Quest narration requires an active matched peer and rechecks after audio generation', async () => {
  const matcher = createMatcher({ mode: 'fixture' });
  let clock = 0;
  const relay = createRoomRelay({ matcher, fixtures: demoFixtures, now: () => clock });
  let calls = 0;
  let duringGeneration = () => {};
  const narrator = {
    health: () => ({ enabled: true }),
    narrate: async shared => {
      calls++;
      assert.deepEqual(shared, { compatible: true, reason: demoFixtures.offlineResults[0].reason });
      await duringGeneration();
      return Buffer.from('test-mp3');
    },
  };
  const server = createMatchServer(matcher, relay, narrator);
  servers.push(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const request = (body = {}) => fetch(`http://127.0.0.1:${server.address().port}/room/narration`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomCode: 'DEMO', clientId: 'quest-a', profileId: 'maya', ...body }),
  });
  await relay.update(update('quest-a'));
  assert.equal((await request()).status, 403);
  const ready = await relay.update(update('quest-b'));
  assert.equal((await request()).status, 403); // Ready is not yet revealed.
  assert.equal(calls, 0);
  await relay.update(update('quest-a', { revealIntroduction: true, presentationId: ready.presentationId }));
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'audio/mpeg');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), 'test-mp3');
  const reverse = await request({ clientId: 'quest-b', profileId: 'alex' });
  assert.equal(reverse.status, 200);
  assert.equal(await reverse.text(), 'test-mp3');
  assert.equal((await request({ profileId: 'alex' })).status, 403);
  assert.equal((await request({ clientId: 'stranger' })).status, 403);
  assert.equal((await request({ text: 'Do not synthesize arbitrary text' })).status, 400);
  assert.equal(calls, 2);
  duringGeneration = () => relay.update(update('quest-b', { requestedProfileId: 'sam' }));
  assert.equal((await request()).status, 403);
  assert.equal((await request({ profileId: 'sam' })).status, 403);
  await relay.update(update('quest-b'));
  clock += 5001;
  assert.equal((await request()).status, 403);
});
