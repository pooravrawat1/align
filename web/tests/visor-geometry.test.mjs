import test from 'node:test';
import assert from 'node:assert/strict';
import { roomLayout, journeyState, matchLayout, JOURNEY, JOURNEY_TRACKS } from '../src/visorGeometry.ts';

const sizes = [[320, 680], [390, 844], [768, 1024], [900, 700], [1568, 878], [2560, 1080]];

test('the shared photo transform covers the viewport throughout the approach', () => {
  for (const [width, height] of sizes) {
    for (const approach of [0, .25, .5, .75, 1]) {
      const rect = roomLayout(width, height, 1672 / 941, approach);
      assert.ok(rect.left <= 0 && rect.top <= 0);
      assert.ok(rect.left + rect.width >= width - 1e-8);
      assert.ok(rect.top + rect.height >= height - 1e-8);
    }
  }
});

test('Maya expands directly from her identity into one combined connection card', () => {
  for (const [width, height] of sizes.filter(([width]) => width >= 900)) {
    const initial = journeyState(0);
    const image = roomLayout(width, height, 1672 / 941, initial.camera);
    const identity = matchLayout(width, height, image, initial);
    assert.equal(identity.width, 218);
    assert.equal(identity.height, 76);
    const saved = matchLayout(width, height, image, journeyState(JOURNEY.network));
    assert.equal(saved.width, 380);
    assert.equal(saved.height, 448);
    for (let i = 0; i <= 200; i++) {
      const p = i / 200;
      const state = journeyState(p);
      const rect = matchLayout(width, height, roomLayout(width, height, 1672 / 941, state.camera), state);
      assert.ok(Object.values(state).every(value => Number.isFinite(value) && value >= -1e-12 && value <= 1 + 1e-12));
      assert.ok(rect.width >= 218 && rect.height >= 76);
      assert.equal(state.chip, 0, 'the combined chapter never collapses to an intermediate marker');
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width);
      assert.ok(rect.y >= 0 && rect.y + rect.height <= height);
      assert.deepEqual(journeyState(p), state, 'revisiting a frame does not depend on travel history');
    }
  }
});

test('optical travel and card expansion finish before combined details arrive', () => {
  assert.ok(JOURNEY_TRACKS.lens[1] <= JOURNEY_TRACKS.savedIn[0]);
  assert.ok(JOURNEY_TRACKS.savedShell[1] <= JOURNEY_TRACKS.savedIn[0]);
  assert.equal(JOURNEY.network, 1, 'the next gesture releases the sticky stage immediately');
  assert.equal(journeyState(JOURNEY.discover).approach, 1);
  assert.equal(journeyState(JOURNEY.discover).camera, 1);
  assert.equal(journeyState(JOURNEY.network).portrait, 1);
});

test('the camera push holds Maya in place so her image-space HUD anchor cannot drift', () => {
  for (const [width, height] of sizes) {
    const start = roomLayout(width, height, 1672 / 941);
    const end = roomLayout(width, height, 1672 / 941, 1);
    assert.ok(Math.abs(start.left + start.width * .586 - end.left - end.width * .586) < 1e-8);
    assert.ok(Math.abs(start.top + start.height * .411 - end.top - end.height * .411) < 1e-8);
  }
});
