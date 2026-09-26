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

test('the quiet Maya marker remains anchored and expands into the saved card', () => {
  for (const [width, height] of sizes.filter(([width]) => width >= 900)) {
    const quiet = journeyState(JOURNEY.quiet);
    const image = roomLayout(width, height, 1672 / 941, quiet.camera);
    const chip = matchLayout(width, height, image, quiet);
    assert.equal(chip.width, 84);
    assert.equal(chip.height, 28);
    assert.equal(quiet.identityDetail, 0);
    assert.equal(quiet.chip, 1);
    assert.ok(Math.abs(chip.x - (image.left + image.width * .586)) <= 26.001);
    const saved = matchLayout(width, height, image, journeyState(JOURNEY.network));
    assert.equal(saved.width, 340);
    assert.equal(saved.height, 274);
    for (let i = 0; i <= 200; i++) {
      const p = i / 200;
      const state = journeyState(p);
      const rect = matchLayout(width, height, roomLayout(width, height, 1672 / 941, state.camera), state);
      assert.ok(Object.values(state).every(value => Number.isFinite(value) && value >= -1e-12 && value <= 1 + 1e-12));
      assert.ok(rect.width >= 84 && rect.height >= 28);
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width);
      assert.ok(rect.y >= 0 && rect.y + rect.height <= height);
      assert.deepEqual(journeyState(p), state, 'revisiting a frame does not depend on travel history');
    }
  }
});

test('optical travel finishes before reason text, and saved text follows the shell', () => {
  assert.ok(JOURNEY_TRACKS.lens[1] <= JOURNEY_TRACKS.reasonIn[0]);
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
