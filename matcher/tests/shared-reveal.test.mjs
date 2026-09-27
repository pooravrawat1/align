import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoomRelay } from '../src/rooms.mjs';
import { createMatcher, demoFixtures } from '../src/service.mjs';

const update = (clientId, extra = {}) => ({
  roomCode: 'REVEAL', clientId, requestedProfileId: 'auto', calibrated: true,
  pose: { px: 0, py: 1.6, pz: 0, rx: 0, ry: 0, rz: 0, rw: 1, tracked: true, sequence: 1 },
  ...extra,
});
const createRelay = extra => createRoomRelay({ matcher: createMatcher({ mode: 'fixture' }), fixtures: demoFixtures, ...extra });
const join = async relay => {
  await relay.update(update('a'));
  return relay.update(update('b'));
};
const reveal = (relay, clientId, state) => relay.update(update(clientId, {
  revealIntroduction: true, presentationId: state.presentationId,
}));

test('a ready match remains names-only and silent until either person reveals it', async () => {
  for (const initiator of ['a', 'b']) {
    const relay = createRelay();
    const ready = await join(relay);
    assert.equal(ready.matchAvailable, true);
    assert.equal(ready.match.compatible, true);
    assert.equal(ready.introductionRequested, false);
    assert.equal(ready.introductionRevealed, false);
    assert.throws(() => relay.narrationMatch({ roomCode: 'REVEAL', clientId: 'a', profileId: 'maya' }), { status: 403 });
    const revealed = await reveal(relay, initiator, ready);
    const peer = await relay.update(update(initiator === 'a' ? 'b' : 'a'));
    assert.equal(revealed.introductionRevealed, true);
    assert.equal(peer.introductionRevealed, true);
    assert.equal(revealed.presentationId, peer.presentationId);
    assert.deepEqual(revealed.match, peer.match);
    const first = relay.narrationMatch({ roomCode: 'REVEAL', clientId: 'a', profileId: 'maya' });
    const second = relay.narrationMatch({ roomCode: 'REVEAL', clientId: 'b', profileId: 'alex' });
    assert.deepEqual(first, second);
    // Both pressing, duplicated packets, and later polls cannot toggle it away.
    assert.equal((await reveal(relay, 'a', ready)).introductionRevealed, true);
    assert.equal((await reveal(relay, 'b', ready)).introductionRevealed, true);
  }
});

test('a press while generation is pending reveals for both once the single summary arrives', async () => {
  let finish, calls = 0;
  const relay = createRelay({ backgroundMatching: true, matcher: { match: async () => {
    calls++;
    return new Promise(resolve => { finish = resolve; });
  } } });
  const pending = await join(relay);
  const requested = await reveal(relay, 'a', pending);
  assert.equal(requested.introductionRequested, true);
  assert.equal(requested.introductionRevealed, false);
  assert.equal(requested.matchStatus, 'pending');
  finish({ result: demoFixtures.offlineResults[0], source: 'fallback' });
  await new Promise(resolve => setImmediate(resolve));
  const a = await relay.update(update('a'));
  const b = await relay.update(update('b'));
  assert.equal(a.introductionRevealed, true);
  assert.equal(b.introductionRevealed, true);
  assert.equal(calls, 1);
});

test('calibration cannot double as a reveal press', async () => {
  const relay = createRelay();
  await relay.update(update('a', { calibrated: false }));
  const initial = await relay.update(update('b', { calibrated: false }));
  await reveal(relay, 'a', initial);
  const ready = await reveal(relay, 'b', initial);
  assert.equal(ready.match.compatible, true);
  assert.equal(ready.introductionRequested, false);
  assert.equal(ready.introductionRevealed, false);
  assert.equal((await reveal(relay, 'a', ready)).introductionRevealed, true);
});

test('switching profiles requires a fresh press even when switching back to the same cached match', async () => {
  const relay = createRelay();
  const ready = await join(relay);
  await reveal(relay, 'a', ready);
  const sam = await relay.update(update('b', { requestedProfileId: 'sam' }));
  assert.equal(sam.introductionRevealed, false);
  const noMatch = await relay.update(update('b', { requestedProfileId: 'sam', revealIntroduction: true, presentationId: sam.presentationId }));
  assert.equal(noMatch.introductionRevealed, false);
  const restored = await relay.update(update('b', { requestedProfileId: 'maya' }));
  assert.equal(restored.match.compatible, true);
  assert.equal(restored.introductionRevealed, false);
  assert.notEqual(restored.presentationId, ready.presentationId);
  assert.equal((await reveal(relay, 'a', ready)).introductionRevealed, false);
  assert.equal((await reveal(relay, 'b', restored)).introductionRevealed, true);
});

test('room reset and peer reconnect invalidate old reveal presses', async () => {
  let clock = 0;
  const relay = createRelay({ now: () => clock, memberTtlMs: 100 });
  const ready = await join(relay);
  await reveal(relay, 'a', ready);
  await relay.update(update('a', { resetRoom: true, calibrated: false }));
  const recalibrated = await join(relay);
  assert.notEqual(recalibrated.presentationId, ready.presentationId);
  assert.equal((await reveal(relay, 'a', ready)).introductionRevealed, false);
  await reveal(relay, 'a', recalibrated);
  clock = 60;
  await relay.update(update('a'));
  clock = 101;
  await relay.update(update('a')); // Only b expired.
  const reconnected = await relay.update(update('b'));
  assert.notEqual(reconnected.presentationId, recalibrated.presentationId);
  assert.equal(reconnected.introductionRevealed, false);
  assert.equal((await reveal(relay, 'b', recalibrated)).introductionRevealed, false);
});

test('invalid reveal payloads are rejected before affecting a room', async () => {
  const relay = createRelay();
  for (const extra of [
    { revealIntroduction: 'true' }, { revealIntroduction: true },
    { presentationId: 12 }, { presentationId: 'x'.repeat(65) },
  ]) await assert.rejects(relay.update(update('a', extra)), { status: 400 });
  assert.equal(relay.roomCount(), 0);
});
