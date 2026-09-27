import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoomRelay } from '../src/rooms.mjs';
import { createMatcher, demoFixtures } from '../src/service.mjs';

function pose(sequence, x = 0) {
  return {
    px: x, py: 1.65, pz: 0,
    rx: 0, ry: 0, rz: 0, rw: 1,
    tracked: true,
    sequence,
  };
}

function update(clientId, overrides = {}) {
  return {
    roomCode: 'DEMO',
    clientId,
    requestedProfileId: 'auto',
    calibrated: false,
    pose: pose(0),
    ...overrides,
  };
}

test('room relay assigns Alex then Maya and matches after both calibrate', async () => {
  const relay = createRoomRelay({ matcher: createMatcher({ mode: 'fixture' }), fixtures: demoFixtures });
  const first = await relay.update(update('quest-a'));
  assert.equal(first.assignedProfileId, 'alex');
  const second = await relay.update(update('quest-b'));
  assert.equal(second.assignedProfileId, 'maya');
  await relay.update(update('quest-a', { calibrated: true, pose: pose(1) }));
  const ready = await relay.update(update('quest-b', { calibrated: true, pose: pose(1, 2) }));
  assert.equal(ready.participants.length, 2);
  assert.equal(ready.matchAvailable, true);
  assert.equal(ready.match.compatible, true);
  assert.equal(ready.match.userA, 'alex');
  assert.equal(ready.match.userB, 'maya');
});

test('operator switch clears Maya result and publishes the Sam nonmatch', async () => {
  const relay = createRoomRelay({ matcher: createMatcher({ mode: 'fixture' }), fixtures: demoFixtures });
  await relay.update(update('quest-a', { calibrated: true }));
  const matched = await relay.update(update('quest-b', { calibrated: true }));
  assert.equal(matched.match.compatible, true);
  const switched = await relay.update(update('quest-b', {
    requestedProfileId: 'sam', calibrated: true, pose: pose(2),
  }));
  assert.equal(switched.assignedProfileId, 'sam');
  assert.equal(switched.matchAvailable, true);
  assert.equal(switched.match.compatible, false);
  assert.equal(switched.match.reason, '');
  const restored = await relay.update(update('quest-b', {
    requestedProfileId: 'maya', calibrated: true, pose: pose(3),
  }));
  assert.equal(restored.match.compatible, true);
});

test('stale members are removed and a reset clears the old peer', async () => {
  let clock = 1000;
  const relay = createRoomRelay({
    matcher: createMatcher({ mode: 'fixture' }), fixtures: demoFixtures,
    now: () => clock, memberTtlMs: 100,
  });
  await relay.update(update('quest-a'));
  await relay.update(update('quest-b'));
  clock += 101;
  const fresh = await relay.update(update('quest-c'));
  assert.deepEqual(fresh.participants.map((item) => item.clientId), ['quest-c']);
  const reset = await relay.update(update('quest-c', { resetRoom: true }));
  assert.deepEqual(reset.participants.map((item) => item.clientId), ['quest-c']);
  assert.equal(reset.assignedProfileId, 'alex');
});

test('room reset preserves role assignments while clearing readiness', async () => {
  const relay = createRoomRelay({ matcher: createMatcher({ mode: 'fixture' }), fixtures: demoFixtures });
  await relay.update(update('quest-a', { calibrated: true }));
  await relay.update(update('quest-b', { calibrated: true }));
  const reset = await relay.update(update('quest-b', { resetRoom: true }));
  assert.equal(reset.assignedProfileId, 'maya');
  assert.equal(reset.resetGeneration, 1);
  assert.deepEqual(
    reset.participants.map((item) => [item.profileId, item.calibrated]),
    [['alex', false], ['maya', false]],
  );
  assert.equal(reset.matchAvailable, false);
  const observed = await relay.update(update('quest-a'));
  assert.equal(observed.resetGeneration, 1);
});

test('room relay rejects unknown fields and unsafe poses', async () => {
  const relay = createRoomRelay({ matcher: createMatcher({ mode: 'fixture' }), fixtures: demoFixtures });
  await assert.rejects(
    relay.update({ ...update('quest-a'), secret: 'nope' }),
    /secret is not allowed/u,
  );
  await assert.rejects(
    relay.update(update('quest-a', { pose: pose(0, 100) })),
    /safety bound/u,
  );
});
